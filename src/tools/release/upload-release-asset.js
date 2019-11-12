const request = require('request');
const async = require('async');

const github = require('./github/github.js');

if (process.argv.length < 5) {
    console.error('Usage: node upload-release-asset.js <owner/repo> <tag> <file to upload>');
    console.error('The env var GITHUB_TOKEN must be set to a valid access token.');
    process.exit(1);
}

if (!process.env.GITHUB_TOKEN) {
    console.error('ERROR: The env var GITHUB_TOKEN is not set.');
    process.exit(1);
}

const repo = process.argv[2];
const tag = process.argv[3];
const assetPath = process.argv[4];
const accessToken = process.env.GITHUB_TOKEN;

github.init(repo, accessToken, tag, assetPath);

console.log(`Uploading file ${assetPath} to release ${tag} for repo ${repo}`);

async.waterfall([
    github.getAssetInfoIfPresent,
    github.deleteAssetIfPresent,
    github.uploadAsset
], function (err, result) {
    if (err) {
        console.error('ERROR: Operation failed.');
        console.error(err);
        process.exit(1);
    }
    console.log('Operation succeeded.');
});
