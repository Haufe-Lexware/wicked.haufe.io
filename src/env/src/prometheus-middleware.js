'use strict';

// Needs:
// - npm install prom-client --save --save-exact
// - Express
//
// Usage:
// const promMiddleware = require('./prometheus-middleware');
//
// app.use(promMiddleware.middleware('some_prefix'[, options]));
// app.get('/metrics', promMiddleware.metrics)
//
// Supported options:
// const options = {
//   // Prometheus histogram buckets
//   buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
// };

const process = require('process');
const promClient = require('prom-client');

promClient.collectDefaultMetrics({ timeout: 5000 });

const prometheusMiddleware = {
    getPromClient: function () {
        return promClient;
    },

    metrics: function (req, res, next) {
        res.send(promClient.register.metrics());
    },

    middleware: function (prefix, options) {
        let buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0];
        if (options && options.buckets)
            buckets = options.buckets;

        const routeHistogram = new promClient.Histogram({
            name: `${prefix}_response_times`,
            help: 'Response time histogram per route',
            labelNames: ['method', 'route'],
            buckets: buckets
        });

        const statusCount = new promClient.Counter({
            name: `${prefix}_status_codes`,
            help: 'Status codes per route',
            labelNames: ['method', 'route', 'code']
        });

        const statusUnknown = new promClient.Counter({
            name: `${prefix}_status_unknown`,
            help: 'Calls with an unknown status code',
            labelNames: ['method', 'route']
        });

        const status2xx = new promClient.Counter({
            name: `${prefix}_status_2xx`,
            help: 'Successful calls',
            labelNames: ['method', 'route']
        });

        const status404 = new promClient.Counter({
            name: `${prefix}_status_404`,
            help: 'Calls with status 404',
            labelNames: ['method', 'route']
        });

        const status4xx = new promClient.Counter({
            name: `${prefix}_status_4xx`,
            help: 'Calls with status 4xx (but not 404)',
            labelNames: ['method', 'route']
        });

        const status5xx = new promClient.Counter({
            name: `${prefix}_status_5xx`,
            help: 'Calls with status 5xx',
            labelNames: ['method', 'route']
        });

        return function (req, res, next) {
            const startTime = process.hrtime();
            // Decorate res.end with our measurement
            const end = res.end;
            res.end = function () {
                const elapsedMs = process.hrtime(startTime)[1] / 1000000; // divide by a million to get nano to milli
                const elapsedTotalS = process.hrtime(startTime)[0] + elapsedMs / 1000;
                // console.log('elapsed time: ' + elapsedTotalS.toFixed(6) + ' s');

                const statusCode = res.statusCode;
                const method = req.method;
                let routeName = 'undefined';
                if (req.route && req.route.path) {
                    routeName = '';
                    if (req.baseUrl)
                        routeName = req.baseUrl;
                    routeName += req.route.path;
                }
                routeHistogram.observe({ method: method, route: routeName }, elapsedTotalS);
                statusCount.inc({ method: method, route: routeName, code: statusCode });

                if (statusCode < 200) {
                    statusUnknown.inc({ method: method, route: routeName });
                } else if (statusCode >= 200 && statusCode < 299) {
                    status2xx.inc({ method: method, route: routeName });
                } else if (statusCode === 404) {
                    status404.inc({ method: method, route: routeName });
                } else if (statusCode >= 400 && statusCode < 500) {
                    status4xx.inc({ method: method, route: routeName });
                } else if (statusCode >= 500) {
                    status5xx.inc({ method: method, route: routeName });
                }

                // call to original express#res.end()
                end.apply(res, arguments);
            };

            return next();
        };
    }
};

module.exports = prometheusMiddleware;