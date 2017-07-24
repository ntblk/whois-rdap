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

function query (ip) {
  var ip_str = ip.toString();
  var query_url = 'https://rdap.db.ripe.net/ip/' + ip_str;
  return axios.get(query_url, {
    headers: {
      'Accept': 'application/rdap+json'
    }
  })
  .then(function (res) {
    if (res.status != 200)
      throw new Error('Invalid HTTP status: ' + res.status);
    return {rdap: res.data};
  })
}

module.exports = query;
