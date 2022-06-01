#!/usr/bin/env node

'use strict';

const program = require('commander');
const tags = require('../impl/tags-impl');

let didAction = false;

program
    .action(() => {
        didAction = true;
        tags.getCurrentTag((err) => {
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
