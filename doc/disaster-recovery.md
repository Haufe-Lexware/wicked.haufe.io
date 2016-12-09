# Disaster recovery

* Regularly use the `/deploy/export` end point to export your dynamic configuration; store the export files in a safe place (in a different location than your APIm deployment)
* Implement a disaster recovery script which does the following things:
    * An initial deployment of the API portal to your desired deployment location
    * Imports the latest backup to the running API Portal using the `/deploy/import` end point

**Make sure you always keep your `PORTAL_CONFIG_KEY` safe, so that you are able to redeploy and decrypt the backup archives!** 

**TODO**: Sample scripts, more documentation.