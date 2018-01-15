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

global.Promise = require('bluebird');
const _ = require('lodash');
const WhoisIP = require('./check');

var whois = new WhoisIP();

const ips_ipv4 = ['157.240.1.35', '104.244.42.1', '216.58.212.142', '193.0.6.139', '178.242.154.5', '178.242.154.7'];
const ips_ipv6 = ['2001:67c:2e8:22::c100:68b'];

// TODO: Proper testing.
whois.connect().then(() => {
  return whois.check(ips_ipv4[0]).then((res) => {
    console.log(JSON.stringify(res.rdap, null, '  '));
    console.log(res.object_id);
    console.log(res.rdap.name);
    console.log(res.rdap.handle);
  });
}).finally(() => {
  if (whois.client)
    return whois.client.close();
});

function checkNotices() {
// Known to be issued by LACNIC
  var rdap = {
    "notices" : [{ "title" : "Rate Limit Notice", "description" : [ "Rate Limit is maxed at 10 queries per 1 minutes." ] }]
  };
  var notice = _.find(rdap.notices, (n) => n.title === 'Rate Limit Notice');
  if (notice)
    console.log(notice);
}
