## whois-rdap

A fast, concurrent RDAP client library for the next-generation IP WHOIS lookup
system supporting database-backed caching and distributed operation.

[![NPM Version][npm-image]][npm-url]

## Synopsis

<img src="https://netblocks.org/files/netblocks-logo.png" width="200px" align="right" />

whois-rdap is a caching WHOIS client library that looks up IPv4 and IPv6
addresses and finds registry records at ARIN, RIPE etc. Only the next-generation
RDAP (Registration Data Access Protocol) Query Format specified by
[RFC7482](https://tools.ietf.org/html/rfc7482) and
[RFC7483](https://tools.ietf.org/html/rfc7483) response format are
supported, allowing for structured retrieval and processing of registrar
records. All addresses are mapped to the IPv6 address space for consistency.

This package is maintained as part of the the
[NetBlocks.org](https://netblocks.org) network observation framework.

## Features

* IPv4 and IPv6 support
* Database-backed NoSQL storage supporting schema-free queries
* Client implementation of RFC7482 REST protocol
* Vendor-agnostic support for RFC7483 JSON data format and extensions
* Legacy-free with no support for classic whois queries
* Supports IP to ASN and ASN origin queries
* node.js library API for embedded use in servers-side JavaScript applications
* CLI for ipwhois with optional pretty ANSI-colored console output
* Workaround mode for RDAP [server quirks](https://github.com/arineng/nicinfo/issues/21)

## Usage

### Command-line utility

A basic command-line utility is included that can be used for testing or to seed and exist a deployed cache instance.

```bash
$ npm install -g whois-rdap
```

After installing globally the utility should be available on your PATH:

```bash
$ whois-rdap -h
Usage: whois-rdap [options] [ip ...]

Commands:
  whois-rdap  RDAP IP WHOIS client

Options:
  --version      Show version number                                   [boolean]
  -f, --force    avoid cache and force update                          [boolean]
  -v, --verbose  enable verbose debug output                           [boolean]
  -p, --pretty   pretty-print RDAP output                              [boolean]
  -h, --help     Show help                                             [boolean]

Examples:
  whois-rdap 8.8.8.8  query the specified IPv4/IPv6 address

The NetBlocks Project <https://netblocks.org>
```

### API

#### Installation

```bash
$ npm install whois-rdap
```
#### Usage

`whois-rdap` exposes a Promise-based asynchronous programming interface.

A data store instance can optionally be supplied to enable persistence and caching of results.

```js
const whois = require('whois-rdap');

whois.check('2001:67c:4e8:fa60:3:0:811:134');
{
  "handle": "2001:67c:4e8::/48",
  "startAddress": "2001:67c:4e8::/128",
  "endAddress": "2001:67c:4e8:ffff:ffff:ffff:ffff:ffff/128",
  "ipVersion": "v6",
  "name": "Telegram_Messenger_Network",
  "type": "ASSIGNED PI",
  "country": "NL",
  "parentHandle": "EU-ZZ-2001-678",
  "entities": [
...
```

Tests and sources are currently the best place to look for usage examples.

## Status

This library provides caching and deduplication and is used in production. The bootstrap mechanism has not yet been implemented.

[npm-image]: https://img.shields.io/npm/v/whois-rdap.svg?style=flat-square
[npm-url]: https://npmjs.org/package/whois-rdap
[npm-downloads]: https://img.shields.io/npm/dm/whois-rdap.svg?style=flat-square
