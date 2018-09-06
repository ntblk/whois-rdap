## whois-rdap

A fast, concurrent RDAP client library for the next-generation IP WHOIS lookup
system supporting database-backed caching and distributed operation.

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

```
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

```bash
$ npm install whois-rdap
```

See the tests for usage examples.

## Status

This library provides direct access to query responses and tries not to make assumptions about the content.
