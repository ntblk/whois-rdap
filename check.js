// Copyright (c) 2017 NetBlocks Project <https://netblocks.org>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const assert = require('assert');
const debug = require('debug')('whois-rdap');
const MongoClient = require('mongodb').MongoClient;
const Address4 = require('ip-address').Address4;
const Address6 = require('ip-address').Address6;
const fetchRDAP = require('./fetch-rdap');

// We use a variation of the db storage technique discussed here:
// http://ddiguru.com/blog/156-how-to-store-ip-addresses-in-mongodb-using-javascript

// NOTE: Another data source, though it only supports RIPE, not ARIN etc.: https://rest.db.ripe.net/search.json?type-filter=inetnum&source=ripe&query-string=${IP}

// TODO: Cache 404 to avoid hammering the server?
// TODO: Remove fallback/default db/collection names?
// TODO: Concurrency wait lock?
// TODO: API throttling, HTTP proxy support?

function toV6 (addr) {
  // TODO: Validate that a single IP is specified, not a range
  var v6;
  v6 = new Address6(addr);
  if (v6.isValid())
    return v6;
  v6 = Address6.fromAddress4(addr);
  return v6;
}

function ipToBuffer (parsedAddr) {
  if (!parsedAddr.isValid())
    throw new Error('IP not valid');
  // TODO: toUnsignedByteArray()?
  return Buffer.from(parsedAddr.toByteArray());
}

// TODO: Don't hard-code these
var DEFAULT_DB_URL = 'mongodb://localhost:27017';
var DEFAULT_DB_NAME = 'mydb';
var DEFAULT_DB_COLLECTION = 'whois_ip';

// Cache entries 'expire' after n days
const DEFAULT_TTL_SECS = 7 * 24 * 60 * 60;

function WhoisIP () {
  this.ttl_secs = DEFAULT_TTL_SECS;
  return this;
}

WhoisIP.prototype.connect = function(url) {
  return MongoClient.connect(url || DEFAULT_DB_URL, { useNewUrlParser: true })
  .then(client => this.use(client));
}

WhoisIP.prototype.use = function(client, dbName, collectionName) {
  this.client = client;
  this.db = client.db(dbName || DEFAULT_DB_NAME);
  this.db_collection = this.db.collection(collectionName || DEFAULT_DB_COLLECTION);
  return this.configure();
}

WhoisIP.prototype.configure = function () {
  var c = this.db_collection;
  // TODO: Is this index actually working for [0,1] queries?
  //db.whois_ip.aggregate( [ { $indexStats: { } } ] )

  var simple_indexes = [
    {'validatedAt': 1},
    {"addr_range.0": 1, "addr_range.1": -1, "validatedAt": 1},
    {'rdap': 'hashed'},
  ];

  var indexes = simple_indexes.map(e => ({key: e}));
  return c.createIndexes(indexes);
}

function canonicalizeRdap (rdap) {
  fixup(rdap);

  function fixup (o) {
    // links often contain the requested IP
    delete o.links;
    (o.notices || []).forEach(e => {
      fixup(e);
    });
    (o.entities || []).forEach(e => {
      // roles come unstably sorted from the server
      (e.roles || []).sort();
      fixup(e);
    });
  }
}

WhoisIP.prototype.check = function (addr) {
  var coll = this.db_collection;

  var ip_addr = toV6(addr);

  // TODO: Decide on error handling scheme
  if (ip_addr.isLoopback() || ip_addr.isLinkLocal())
    return Promise.resolve({});

  var ip_bin = ipToBuffer(ip_addr);

  return coll.find({
    $and: [
        { 'addr_range.0' : {$lte: ip_bin}},
        { 'addr_range.1' : {$gte: ip_bin}}
    ],
    validatedAt: {$gte: new Date(Date.now() - this.ttl_secs * 1000)},
  })
  .sort({
    // sort and return the most specific network using our compound index prefix
    'addr_range.0': -1,
    'addr_range.1': 1,
    'validatedAt': -1,
  }).limit(1).toArray()
  .then(docs => {
    if (docs.length) {
      var docID = docs[0]._id;
      debug("Using cached object: " + docID);
      return {rdap: docs[0].rdap, object_id: docID};
    }

    debug("Fetching RDAP with HTTP: " + addr);
    return fetchRDAP(addr)
    .then((res) => {
      var date = new Date();
      var rdap = res.rdap;
      // TODO: log the notices to db?
      return this.revalidate(date, rdap);
    });
  });
}

WhoisIP.prototype.revalidate = function (date, rdap) {
  var coll = this.db_collection;

  canonicalizeRdap(rdap);
  var addr_range = extractRange(rdap);

  return coll.findOneAndUpdate(
    {
      addr_range,
      rdap
    },
    {
      $set: {validatedAt: date},
      $setOnInsert: {date: date},
    },
    {
      upsert: true,
      projection: {_id: 1},
      returnOriginal: false,
    }
  )
  .then(res => {
    assert(res.ok);
    var value = res.value;
    return {rdap: rdap, object_id: value._id};
  });
}

function extractRange (rdap) {
  // Neither node-ip nor ip-address handle this properly so we do it ourselves
  if (rdap.ipVersion === 'v4') {
    return [
      ipToBuffer(Address6.fromAddress4(new Address4(rdap.startAddress).startAddress().address)),
      ipToBuffer(Address6.fromAddress4(new Address4(rdap.endAddress).endAddress().address)),
    ];
  } else if (rdap.ipVersion === 'v6') {
    return [
      ipToBuffer(new Address6(rdap.startAddress).startAddress()),
      ipToBuffer(new Address6(rdap.endAddress).endAddress()),
    ];
  } else {
    throw new Error ('Unsupported IP version: ' + rdap.ipVersion);
  }
}

/*
// Alternative implementation. Broken due to node-ip bugs.

const ip = require('ip');

function toV6Format (addr) {
  return ip.isV4Format(addr) ? ('::ffff:' + addr) : addr;
}

function toV6Buffer (addr) {
  return ip.toBuffer(toV6Format(addr));
}

function check(rdap) {
  // NOTE: cidrSubnet() seems broken with ipv6
  return {
    start_addr: toV6Buffer(ip.cidrSubnet(rdap.startAddress).firstAddress),
    end_addr: toV6Buffer(ip.cidrSubnet(rdap.endAddress).lastAddress),
  }
}
*/

module.exports = WhoisIP;
