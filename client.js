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
const WhoisIP = require('./check');
const prettyjson = require('prettyjson');
const argv = require('yargs')
  .command('whois-rdap', 'RDAP IP WHOIS client')
  .usage('Usage: $0 [options] [ip ...]')
  .example('$0 8.8.8.8', 'query the specified IPv4/IPv6 address')
  .demandCommand(1)
  .boolean('verbose')
  .alias('v', 'verbose')
  .describe('v', 'enable verbose debug output')
  .boolean('pretty')
  .alias('p', 'pretty')
  //.default('p', process.stdout.isTTY)
  .describe('p', 'pretty-print RDAP output')
  .help('h')
  .alias('h', 'help')
  .epilog('The NetBlocks Project <https://netblocks.org>')
  .argv;

const VERBOSE = argv.verbose;
const ips = argv._;

var whois = new WhoisIP();
// TODO: Pass verbose flag down to the backend

whois.connect().then(() => {
  return whois.check(ips[0]).then((res) => {
    if (argv.pretty) {
      console.log(prettyjson.render(res.rdap));
    } else  {
      console.log(JSON.stringify(res.rdap, null, '  '));
    }
    if (VERBOSE)
      console.error(res.object_id);
  });
}).finally(() => {
  if (whois.db)
    return whois.db.close();
});
