#!/usr/bin/env node

'use strict';

const program = require('commander');
const utils = require('./utils');

let didAction = false;

program
    .command('start', 'starts a local Postgres container')
    .command('stop', 'stops the local Postgres container')
    .command('status', 'checks status of the Postgres container; returns 0 if running, 1 if not')
    .on('command:*', function (command) {
        const firstCommand = command[0];
        if (!this.commands.find(c => c._name == firstCommand)) {
            console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
            process.exit(1);
        }
    })
    .parse(process.argv);
