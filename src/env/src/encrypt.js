'use strict';

var cryptTools = require('./crypt-tools');

if (process.argv.length < 4) {
    console.log('Usage: ');
    console.log('  node encrypt <key> <text to encrypt>');
    process.exit(1);
}

var keyText = process.argv[2];
var text = process.argv[3];

console.log(cryptTools.apiEncrypt(keyText, text));
