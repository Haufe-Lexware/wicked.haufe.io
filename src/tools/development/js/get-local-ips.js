'use strict';

const os = require('os');

function getDefaultLocalIP() {
    let localIPs = getLocalIPs();
    if (localIPs.length > 0)
        return localIPs[0];
    console.error('No valid local IPv4 addresses found.');
    return "";
}

function getLocalIPs() {
    console.error('Finding local IP addresses...');
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    console.error(addresses);
    return addresses;
}

console.log(getDefaultLocalIP());
