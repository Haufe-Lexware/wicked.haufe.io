'use strict';

const consts = {};

consts.BASE_URL = 'http://portal-api:3001/';
if (process.env.PORTAL_API_URL) {
    consts.BASE_URL = process.env.PORTAL_API_URL;
}
if (!consts.BASE_URL.endsWith('/'))
    consts.BASE_URL += '/';
console.log('---> Using Portal URL: ' + consts.BASE_URL);

consts.HOOK_PORT = 3003;
if (process.env.HOOK_PORT)
    consts.HOOK_PORT = process.env.HOOK_PORT;
consts.HOOK_URL = 'http://api-test-data:' + consts.HOOK_PORT;
if (process.env.HOOK_HOST)
    consts.HOOK_URL = `http://${process.env.HOOK_HOST}:${consts.HOOK_PORT}`;
console.log('---> Using Hook URL: ' + consts.HOOK_URL);

module.exports = consts;
