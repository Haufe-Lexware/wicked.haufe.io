'use strict';

const request = require('request');
const async = require('async');
const utils = require('./utils');

// COMMAND LINE PROCESSING

let success = utils.checkForConfigKey();
if (success && process.argv.length < 4)
    success = false;
const options = utils.parseCommandLine(process.argv);
if (!options.url || !options.file) {
    console.log('URL and/or output file not specified:');
    console.log(options);
    success = false;
}

if (!success) {
    printUsage();
    console.error('Exiting.');
    process.exit(1);
}

// deployUrl will end with /
const deployUrl = utils.makeApiUrl(options.url);
const outputFileName = options.file;
if (options.host)
    utils.setHost(options.host);

// MAIN

utils.configureAgent(deployUrl);

async.waterfall([
    function (callback) {
        utils.postExport(deployUrl, callback);
    }, function (exportId, callback) {
        utils.awaitDone(deployUrl, 'export', exportId, callback);
    }, function (exportId, callback) {
        utils.downloadArchive(deployUrl, exportId, outputFileName, callback);
    }, function (exportId, callback) {
        utils.cancelExport(deployUrl, exportId, callback);
    }
], function (err, result) {
    if (err) {
        console.error('An error occurred.');
        console.error(err.stack);
        process.exit(1);
    }

    console.log('Export ID: ' + result);
    process.exit(0);
});

// SUBROUTINES

function printUsage() {
    console.log('');
    console.log('Usage: node export-config.js [<options>] <https://api.yourcompany.com/deploy/v1> <output.enc>');
    console.log('');
    console.log('  The environment variable PORTAL_CONFIG_KEY has to contain the deployment');
    console.log('  key which was used when creating the configuration repository and');
    console.log('  deploying the API Portal.');
    console.log('');
    console.log('  The output file <output.enc> will have been encrypted using AES256, using');
    console.log('  openssl, having applied the key passed in PORTAL_CONFIG_KEY.');
    console.log('');
    console.log('  To decrypt the file, use the following command line:');
    console.log('');
    console.log('  openssl enc -d -aes-256-cbc -k "$PORTAL_CONFIG_KEY" -in <output.enc> -out archive.tgz');
    console.log('');
    console.log('  Options:');
    console.log('    --host <host name>: Specify the Host header to use when talking to wicked;');
    console.log('         This enables deploying to or exporting from instances without correct');
    console.log('         DNS entries.');
}
