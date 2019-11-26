module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    {
      name     : 'node-sdk',
      script   : 'npm',
      args     : 'run build-and-watch',
      cwd      : '../../node-sdk',
      watch    : true,
      ignore_watch: ['.git', 'node_modules', 'dist']
    },
    {
      name      : 'api',
      script    : 'bin/api',
      cwd       : '../../api',
      watch     : true,
      ignore_watch: ['.git', 'node_modules', 'routes/internal_apis/**/swagger.json'],
      env: {
        NODE_ENV: 'localhost',
        LOG_LEVEL: 'debug',
        PORTAL_CONFIG_BASE: '../sample-config'
      }
    },
    {
      name      : 'ui',
      script    : 'bin/www',
      cwd       : '../../ui',
      watch     : true,
      ignore_watch: ['.git', 'node_modules'],
      env: {
        // DEBUG: 'wicked-sdk:*',
        LOG_LEVEL: 'debug'
      }
    },
    {
      name      : 'kong-adapter',
      script    : 'npm',
      args      : 'run build-and-start',
      cwd       : '../../kong-adapter',
      watch     : true,
      ignore_watch: ['.git', 'node_modules', 'dist'],
      env: {
        // DEBUG: 'wicked-sdk:*',
        LOG_LEVEL: 'debug'
      }
    },
    {
      name      : 'auth',
      script    : 'npm',
      args      : 'run build-and-start',
      cwd       : '../../auth',
      watch     : true,
      ignore_watch: ['.git', 'node_modules', 'dist'],
      env: {
        // DEBUG: 'wicked-sdk',
        LOG_LEVEL: 'debug'
      }
    }
  ]
};
