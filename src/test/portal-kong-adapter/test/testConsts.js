'use strict';

const consts = {};

consts.BASE_URL = checkSlash(process.env.PORTAL_API_URL || 'http://portal-api:3001/');
consts.KONG_ADAPTER_URL = checkSlash(process.env.KONG_ADAPTER_URL || 'http://portal-kong-adapter:3002/');
consts.KONG_ADMIN_URL = checkSlash(process.env.KONG_ADMIN_URL || 'http://kong:8001/');
consts.KONG_GATEWAY_URL = checkSlash(process.env.KONG_GATEWAY_URL || 'http://kong:8000/');

function checkSlash(s) {
    if (!s.endsWith('/'))
        return s + '/';
    return s;
}

module.exports = consts;
