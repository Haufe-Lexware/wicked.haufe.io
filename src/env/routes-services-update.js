'use strict';

module.exports = function (apiConfig) {
    // move to routes
    const route = {};

    // noop if already converted
    if ( !apiConfig.api.routes ) {
      route.paths = apiConfig.api.uris;
      route.strip_path = apiConfig.api.strip_uri;
      route.preserve_host = apiConfig.api.preserve_host;
      // TODO: rethink the concept
      // route.plugins = [];

      apiConfig.api.routes = [ route ];
    }

    delete apiConfig.api.uris;
    delete apiConfig.api.strip_uri;
    delete apiConfig.api.preserve_host;

    return apiConfig;
};