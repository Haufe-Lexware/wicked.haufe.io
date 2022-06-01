# wicked Command Line Interface

## Introduction

This project contains a command line interface for working with wicked.haufe.io. Currently, the main use case for the CLI is setting up new configurations and testing them out on a local machine, using "wicked-in-a-box", which is a simplified and complete setup for wicked, but which is not suitable for most production use cases.

## Versioning

The `wicked.cli` (package `wicked-cli`) is versioned with actual wicked release, even if the CLI component does not actually change. Each command which needs a specific wicked version takes a parameter `--tag` which has to be used to select the version to use.

In most cases, the wicked CLI is just a wrapper around certain docker commands, so docker is a **prerequisite** to use the command line interface.

## Usage

Install the command line interface using:

```
$ npm install -g wicked-cli
```

This will add the command line tool `wicked` to your path. Call

```
$ wicked --help
```

to see which commands are available.

More documentation on the usage of the wicked CLI can be found in the official documentation of wicked, at https://github.com/Haufe-Lexware/wicked.haufe.io.
