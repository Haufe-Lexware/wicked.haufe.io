#!/usr/bin/env node

'use strict';

const program = require('commander');

const utils = require('./utils');
const implUtils = require('../impl/impl-utils');

(async () => {
    await implUtils.checkForLatest();

    program
        .version(utils.getVersion(), '-v, --version')
        .command('tags <command>', 'tag commands')
        .command('kickstart [options]', 'invoke the wicked kickstarter')
        .command('box <command>', 'manage a local wicked-in-a-box')
        .command('postgres <command>', 'manage a local Postgres container')
        .on('command:*', function (command) {
            const firstCommand = command[0];
            if (!this.commands.find(c => c._name == firstCommand)) {
                console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
                process.exit(1);
            }
        })
        .parse(process.argv);
})();
