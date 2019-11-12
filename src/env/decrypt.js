'use strict';

var cryptTools = require('./crypt-tools');

if (process.argv.length < 4) {
    console.log('Usage: ');
    console.log('  node decrypt <key> <text to encrypt>');
    process.exit(1);
}

var keyText = process.argv[2];
var cipherText = process.argv[3];

console.log(cryptTools.apiDecrypt(keyText, cipherText));
