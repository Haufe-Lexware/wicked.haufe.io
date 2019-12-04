module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    {
      name      : 'api',
      script    : 'bin/api',
      cwd       : '/usr/src/app/api',
      env: {
      }
    },
    {
      name      : 'ui',
      script    : 'bin/www',
      cwd       : '/usr/src/app/ui',
      env: {
        PORTAL_API_URL: 'http://localhost:3001'
      }
    },
    {
      name      : 'kong-adapter',
      script    : 'dist/bin/kong-adapter.js',
      cwd       : '/usr/src/app/kong-adapter',
      env: {
        PORTAL_API_URL: 'http://localhost:3001'
      }
    },
    {
      name      : 'auth',
      script    : 'dist/authz.js',
      cwd       : '/usr/src/app/auth',
      env: {
        PORTAL_API_URL: 'http://localhost:3001'
      }
    },
    {
      name      : 'mailer',
      script    : 'bin/mailer',
      cwd       : '/usr/src/app/mailer',
      env: {
        PORTAL_API_URL: 'http://localhost:3001'
      }
    },
    {
      name      : 'chatbot',
      script    : 'bin/chatbot',
      cwd       : '/usr/src/app/chatbot',
      env: {
        PORTAL_API_URL: 'http://localhost:3001'
      }
    }
  ],

  /**
   * Deployment section - not needed/makes no sense for wicked here.
   * http://pm2.keymetrics.io/docs/usage/deployment/
   */
  deploy : {
  }
};
