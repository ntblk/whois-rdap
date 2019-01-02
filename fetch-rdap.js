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

const axios = require('axios');

// JSON Responses for the Registration Data Access Protocol (RDAP)
// https://tools.ietf.org/html/rfc7483

// TODO: Support HTTP status codes?
// https://github.com/cnnic/rdap/wiki/Query-Api

function query (ip, {timeout = 2500} = {}) {
  var ip_str = ip.toString();
  var query_url = 'https://rdap.db.ripe.net/ip/' + ip_str;
  return axios.get(query_url, {
    // TODO: Make timeout configurable
    timeout,
    validateStatus: false,
    headers: {
      'Accept': 'application/rdap+json'
    }
  })
  .then(function (res) {
    if (res.status === 400) {
      // https://github.com/arineng/nicinfo/issues/21
      var m = res.data.title.match(/^Multiple country: found in (.*) - (.*)$/);
      if (m) {
        return {synthesized: true, rdap: {
          errorCode: res.status,
          ipVersion: /^[\d.]+$/.test(m[1]) ? 'v4' : 'v6',
          startAddress: m[1],
          endAddress: m[2],
          ...res.data,
        }};
      }
    }
    if (res.status != 200) {
      // TODO: report this condition properly
      // FIXME: pretty print the problematic host to help identify broken rdap servers!
      console.error(res.data);
      throw new Error('Invalid HTTP status: ' + res.status);
    }
    return {rdap: res.data};
  })
}

module.exports = query;
