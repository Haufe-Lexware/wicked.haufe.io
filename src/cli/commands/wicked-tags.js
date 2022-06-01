#!/usr/bin/env node

'use strict';

const program = require('commander');
const tags = require('../impl/tags-impl');

program
    .command('get', 'get currently selected tag')
    .command('list', 'list available docker tags')
    .command('set', 'set the tag to use as a default')
    .on('command:*', function (command) {
        const firstCommand = command[0];
        if (!this.commands.find(c => c._name == firstCommand)) {
            console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
            process.exit(1);
        }
    })
    .parse(process.argv);
