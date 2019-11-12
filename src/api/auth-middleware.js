const authMiddleware = function () { };
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:auth-middleware');

// ===== MIDDLEWARE =====

authMiddleware.fillUserId = function (req, res, next) {
    req.kongRequest = false;
    if (req.get('x-consumer-custom-id')) {
        req.kongRequest = true;
    }

    // This header cannot be injected _through_ Kong, but only from
    // inside the network, which is how the wicked SDK does it to
    // inject the user id for the machine users.
    const authenticatedUserId = req.get('x-authenticated-userid');
    if (authenticatedUserId) {
        // This must be in this format:
        // sub=<user id>
        if (authenticatedUserId.startsWith('sub=')) {
            req.apiUserId = authenticatedUserId.substring(4);
            debug(`fillUserId: Authenticated User Id: ${req.apiUserId}`);
        } else {
            const msg = `Unexpected format of x-authenticated-userid, expected "sub=<user id>" (${authenticatedUserId})`;
            error(`fillUserId: ${msg}`);
            return res.status(400).json({ message: msg });
        }
    }
    const scope = req.get('x-authenticated-scope');
    if (scope) {
        req.scope = makeScopeMap(scope);
    }

    return next();
};

authMiddleware.rejectFromKong = function (req, res, next) {
    if (req.kongRequest) {
        res.status(403).json({ code: 403, message: 'Not allowed from outside network.' });
        return;
    }
    return next();
};

authMiddleware.verifyConfigKey = function (req, res, next) {
    debug('verifyConfigKey()');
    let configKey = req.get('Authorization');
    if (!configKey) {
        return res.status(403).json({ message: 'Not allowed. Unauthorized.' });
    }
    configKey = configKey.trim();
    const deployConfigKey = req.app.get('config_key').trim();
    if (configKey !== deployConfigKey) {
        return res.status(403).json({ message: 'Not allowed. Unauthorized.' });
    }
    // We're okay, let's do this.
    next();
};

// =======================

function makeScopeMap(scope) {
    if (!scope) {
        return {};
    }
    const scopeMap = {};
    const scopeList = scope.split(' ');
    for (let i = 0; i < scopeList.length; ++i) {
        scopeMap[scopeList[i]] = true;
    }
    return scopeMap;
}

module.exports = authMiddleware;
