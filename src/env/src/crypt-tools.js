'use strict';

var crypto = require('crypto');

var ALGORITHM = 'aes-256-ctr';

var cryptTools = function () { };

cryptTools.createRandomId = function() {
    return crypto.randomBytes(20).toString('hex');
};

function getCipher(keyText) {
    var key = keyText.toString("binary");
    var cipher = crypto.createCipher(ALGORITHM, key);
    return cipher;
}

cryptTools.apiEncrypt = function (keyText, text) {
    //debug('apiEncrypt() - clear text: ' + text);
    var cipher = getCipher(keyText);
    // Add random bytes so that it looks different each time.
    var cipherText = cipher.update(cryptTools.createRandomId() + text, 'utf8', 'hex');
    cipherText += cipher.final('hex');
    return cipherText;
};

function getDecipher(keyText) {
    var key = keyText.toString("binary");
    var decipher = crypto.createDecipher(ALGORITHM, key);
    return decipher;
}

cryptTools.apiDecrypt = function(keyText, cipherText) {
    var decipher = getDecipher(keyText);
    var text = decipher.update(cipherText, 'hex', 'utf8');
    text += decipher.final('utf8');
    text = text.substring(40); // Strip random bytes
    return text; 
};

module.exports = cryptTools;
