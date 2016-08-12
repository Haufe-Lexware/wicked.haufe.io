# Deploying to Production

# WORK IN PROGRESS

In principle, it's similar to [deploying locally](deploying-locally.md), with the following differences:

* You will need appropriate and good certificates
* Some scripting needs to be done, depending on your environment
* Make sure you have correct DNS entries matching your certificates
* Setting environment variables on your deployment machine
* Secure storage of certificates, `PORTAL_CONFIG_KEY` and such has to be considered

But otherwise, it's the same:

* Per environment, create a portal "Environment" with the kickstarter
* Override host names, and perhaps also backend API host names
* Make sure `NODE_ENV` is set to the correct thing when starting the production server
