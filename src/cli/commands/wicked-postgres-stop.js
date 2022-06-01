#!/usr/bin/env node

'use strict';

const program = require('commander');
const utils = require('./utils');
const postgres = require('../impl/postgres-impl');

let didAction = false;

program
    .action(() => {
        didAction = true;
        postgres.stop((err) => {
            if (err) {
                console.error(err);
                process.exit(1);
            }
            process.exit(0);
        });
    })
    .parse(process.argv);

if (!didAction) {
    program.help();
}
