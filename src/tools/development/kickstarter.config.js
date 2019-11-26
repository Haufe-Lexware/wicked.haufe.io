module.exports = {
    /**
     * Application configuration section
     * http://pm2.keymetrics.io/docs/usage/application-declaration/
     */
    apps : [
      {
        name      : 'kickstarter',
        script    : 'bin/kickstart',
        args      : '../sample-config',
        cwd       : '../../kickstarter',
        env: {
          DEBUG: 'portal-env:*,kickstarter:*'
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
  