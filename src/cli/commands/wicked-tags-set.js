#!/usr/bin/env node

'use strict';

const program = require('commander');
const tags = require('../impl/tags-impl');

let didAction = false;

program
    .option('-f, --force', 'specify this to avoid checking whether a tag is available')
    .arguments('<tag>', 'the tag to set as the current tag')
    .action((tag) => {
        didAction = true;
        const options = program.opts();
        tags.setCurrentTag(tag, options.force, (err) => {
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
