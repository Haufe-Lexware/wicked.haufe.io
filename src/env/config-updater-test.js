'use strict';

const updateRouteServices = require('../src/steps/routes-services-update');

const assert = require('chai').assert;

describe('config-updater', function () {
    describe('updateRouteServices', function () {

      it('must convert API', function () {
        let apiConfig = {
          api: {
            upstream_url: "http://petstore.swagger.io/v2",
            name: "petstore-oauth",
            uris: [
              "/petstore-oauth"
            ],
            strip_uri: true,
            preserve_host: false
          },
          plugins: [
            {
              config: {
                origins: "*",
                methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
              },
              name: "cors"
            }
          ]
        };

        apiConfig = updateRouteServices(apiConfig);

        assert.isUndefined(apiConfig.api.uris);
        assert.isUndefined(apiConfig.api.strip_uri);
        assert.isUndefined(apiConfig.api.preserve_host);
        assert.isArray(apiConfig.plugins);
        assert.strictEqual(apiConfig.plugins[0].config.origins, "*");

        assert.strictEqual(apiConfig.api.upstream_url, "http://petstore.swagger.io/v2");
        assert.strictEqual(apiConfig.api.name, "petstore-oauth");

        assert.isNotNull(apiConfig.api.routes);
        assert.isArray(apiConfig.api.routes);
        assert.strictEqual(apiConfig.api.routes.length, 1);

        assert.strictEqual(apiConfig.api.routes[0].strip_path, true);
        assert.strictEqual(apiConfig.api.routes[0].preserve_host, false);
        //assert.isArray(apiConfig.api.routes[0].plugins);
      });
  });
});