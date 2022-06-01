#!/usr/bin/env node

'use strict';

const program = require('commander');
const utils = require('./utils');
const kickstart = require('../impl/kickstart-impl');

let didAction = false;

program
    .command('start [options]', 'start wicked-in-a-box')
    .command('stop [options]', 'stop wicked-in-a-box')
    .command('status', 'check status if wicked-in-a-box; returns 0 if running, 1 if not.')
    .on('command:*', function (command) {
        const firstCommand = command[0];
        if (!this.commands.find(c => c._name == firstCommand)) {
            console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
            process.exit(1);
        }
    })
    .parse(process.argv);
