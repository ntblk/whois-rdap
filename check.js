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
const ipaddr = require('ipaddr.js');
const fetchRDAP = require('./fetch-rdap');

// We use a variation of the db storage technique discussed here:
// http://ddiguru.com/blog/156-how-to-store-ip-addresses-in-mongodb-using-javascript

// NOTE: Another data source, though it only supports RIPE, not ARIN etc.: https://rest.db.ripe.net/search.json?type-filter=inetnum&source=ripe&query-string=${IP}

// TODO: Cache 404 to avoid hammering the server?
// TODO: Remove fallback/default db/collection names?
// TODO: Concurrency wait lock?
// TODO: API throttling, HTTP proxy support?

// TODO: Don't hard-code these
var DEFAULT_DB_URL = 'mongodb://localhost:27017';
var DEFAULT_DB_NAME = 'mydb';
var DEFAULT_DB_COLLECTION = 'whois_ip';

// Cache entries 'expire' after n days
const DEFAULT_TTL_SECS = 7 * 24 * 60 * 60;

function WhoisIP () {
  this.ttl_secs = DEFAULT_TTL_SECS;
  this.http_timeout = 2500;
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
  var coll = this.db_collection;
  // TODO: Is this index actually working for [0,1] queries?
  //db.whois_ip.aggregate( [ { $indexStats: { } } ] )

  var simple_indexes = [
    {'validatedAt': 1},
    {"addr_range.0": 1, "addr_range.1": -1, "validatedAt": 1},
    {'rdap': 'hashed'},
  ];

  var indexes = simple_indexes.map(e => ({key: e}));
  return coll.createIndexes(indexes);
}

function canonicalizeRdap (rdap) {
  fixup(rdap);

  function fixup (o) {
    // redact all links, as they often contain the requested IP
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

WhoisIP.prototype.checkOne = async function (addr) {
  // First check for special purpose addresses. This isn't just cosmetic - regional RDAP servers return quirky answers so we need to be defensive
  var ipa = ipaddr.process(addr);
  // TODO: Decide on error handling scheme. Empty object is inconvenient for consumers.
  if (!['unicast'].includes(ipa.range()))
    return {};
  return this.check(addr);
}

WhoisIP.prototype.check = async function (addr) {
  var coll = this.db_collection;
  var res = null;

  if (this.ttl_secs > 0 && coll)
    res = await this.query(addr);

  // TODO: Support an offline/fallback mode
  if (!res) {
    res = await this.fetch(addr);
    if (coll)
      res = await this.revalidate(res);
  }

  return res;
};

WhoisIP.prototype.query = function (addr) {
  var coll = this.db_collection;
  var ip_addr = toV6(addr);
  var ip_bin = ipToBufferRange(ip_addr);

  return coll.find({
    $and: [
        { 'addr_range.0' : {$lte: ip_bin[0]}},
        { 'addr_range.1' : {$gte: ip_bin[1]}}
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
    var doc = docs[0];
    if (!doc)
      return null;

    debug("Using cached object: " + doc._id);
    return {
      date: doc.validatedAt,
      rdap: doc.rdap,
      object_id: doc._id
    };
  });
}

WhoisIP.prototype.fetch = function (addr) {
  // FIXME: If fetch fails, can we throttle future attempts and return older cached values?
  debug("Fetching RDAP with HTTP: " + addr);
  return fetchRDAP(addr, {timeout: this.http_timeout})
  .then(res => {
    // TODO: log the notices to db?
    canonicalizeRdap(res.rdap);
    return {
      date: new Date(),
      rdap: res.rdap
    };
  });
}

WhoisIP.prototype.revalidate = function ({date, rdap}) {
  var coll = this.db_collection;
  var addr_range = extractBufferRange(rdap);

  return coll.findOneAndUpdate(
    {
      addr_range,
      rdap
    },
    {
      $max: {validatedAt: date},
      $min: {date: date},
      //$setOnInsert: {date: date},
    },
    {
      upsert: true,
      projection: {_id: 1},
      returnOriginal: false,
    }
  )
  .then(res => {
    assert(res.ok);
    var doc = res.value;
    return {
      date: date,
      rdap: rdap,
      object_id: doc._id
    };
  });
}

function toV6 (addr) {
  var v6;
  v6 = new Address6(addr);
  if (v6.isValid())
    return v6;
  v6 = Address6.fromAddress4(addr);
  if (v6.isValid())
    return v6;
  throw new Error('IP not valid');
}

function ipToBuffer (parsedAddr) {
  var arr = parsedAddr.toByteArray();
  while (arr.length < 16)
    arr.unshift(0);
  assert(arr.length == 16);
  return Buffer.from(arr);
}

function ipToBufferRange (parsedAddr) {
  if (!parsedAddr.isValid())
    throw new Error('IP not valid');
  var res = [parsedAddr.startAddress(), parsedAddr.endAddress()];
  return res.map(v => ipToBuffer(v));
}

function extractBufferRange (rdap) {
  var range = [rdap.startAddress, rdap.endAddress];

  if (rdap.ipVersion === 'v4')
    range = range.map(v => Address6.fromAddress4(v));
  else if (rdap.ipVersion === 'v6')
    range = range.map(v => new Address6(v));
  else
    throw new Error ('Unsupported IP version: ' + rdap.ipVersion);

  range = [range[0].startAddress(), range[1].endAddress()];
  range = range.map(v => ipToBuffer(v));

  return range;
}

/*
var addr = '2001:67c:4e8:fa60:3:0:811:134';
console.log(ipToBufferRange(toV6(addr)));

var addr = '192.168.1.1';
console.log(ipToBufferRange(toV6(addr)));
*/

module.exports = WhoisIP;
