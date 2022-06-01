'use strict';

// const request = require('request');
const axios = require('axios');

const utils = require('../commands/utils');
const box = require('./box-impl');
const settings = require('./settings');

// const GITHUB_API = 'https://api.github.com/repos/Haufe-Lexware/wicked.haufe.io/releases';

const tags = function () { };

tags.getCurrentTag = (callback) => {
    try {
        let currentTag = tags.getCurrentTagSync();
        console.log(currentTag);
        return callback(null);
    } catch (err) {
        console.error(err.message);
        console.error('*** Could not retrieve current tag.');
        process.exit(1);
    }
};

tags.getCurrentTagSync = () => {
    let currentTag = settings.get('tag');
    if (!currentTag)
        currentTag = utils.getVersion();
    return currentTag;
};

tags.setCurrentTag = async (tag, force, callback) => {
    try {
        if (force) {
            settings.set('tag', tag);
            console.log(`Force-set the current tag to ${tag}.`);
            return callback(null);
        }
        const tagList = await getTagList();
        const exists = tagList.find(t => t == tag);
        if (!exists) {
            console.error(`*** The tag ${tag} does not exist. To force setting the tag, use --force.`);
            process.exit(1);
        }
        settings.set('tag', tag);
        console.log(`Successfully updated the current tag to '${tag}'.`);
        return callback(null);
    } catch (err) {
        console.error(err.message);
        console.error('*** Could not set current tag.');
    }
};

tags.listTags = async (callback) => {
    const imageName = box.getBoxImageName();
    try {
        const tagList = await getTagList();
        console.log('These tags are currently available:');
        console.log();
        const currentTag = tags.getCurrentTagSync();
        let foundSelected = false;
        for (let tag of tagList) {
            let sel = '';
            if (tag == currentTag) {
                sel = ' (selected)';
                foundSelected = true;
            }
            console.log('- %s%s', tag, sel);
        }
        console.log();
        if (!foundSelected) {
            console.log(`WARNING: The currently selected tag is ${currentTag}, which is not part of this list.`);
        }
        return callback(null);
    } catch (err) {
        console.error(`*** Could not list tags of ${imageName}`);
        console.error(err.message);
        process.exit(1);
    }
};

async function getAccessToken() {
    const imageName = box.getBoxImageName();
    const authUrl = 'https://auth.docker.io/token';
    const tokenResult = await axios(authUrl, {
        params: {
            service: 'registry.docker.io',
            scope: `repository:${imageName}:pull`
        }
    });
    return tokenResult.data.access_token;
}

async function getTagList() {
    const token = await getAccessToken();
    if (!token) {
        console.error('*** Could not obtain an access token for the Docker registry.');
        process.exit(1);
    }
    const imageName = box.getBoxImageName();
    const tagsUrl = `https://registry-1.docker.io/v2/${imageName}/tags/list`;
    const tagList = await axios({
        headers: {
            Authorization: `Bearer ${token}`
        },
        url: tagsUrl
    });
    if (!tagList.data || !tagList.data.tags) {
        console.error('*** Did not receive a tag list from the Docker registry.');
        process.exit();
    }
    const list = tagList.data.tags.sort().reverse();
    return list;
}

// versionApi.listVersions = function (callback) {
//     getAvailableVersions((err, releaseList) => {
//         if (err)
//             return callback(err);
//         console.log('Available versions');
//         console.log('==================');
//         for (let i = 0; i < releaseList.length; ++i) {
//             const r = releaseList[i];
//             process.stdout.write(` - ${r.version}`);
//             if (r.latest)
//                 process.stdout.write(' (latest)');
//             console.log('');
//         }
//         return callback(null);
//     });
// };

// versionApi.setVersion = (newVersion, callback) => {
//     return callback(null);
// };

// versionApi.getVersion = (callback) => {
//     return callback(null);
// };

// const getAvailableVersions = (callback) => {
//     request.get({
//         url: GITHUB_API,
//         headers: {
//             'User-Agent': 'wicked-cli ' + utils.getVersion(),
//             'Accept': 'application/vnd.github.v3+json'
//         }
//     }, function (err, apiRes, apiBody) {
//         if (err)
//             return callback(err);
//         if (apiRes.statusCode !== 200)
//             return callback(new Error('Getting release list from github.com returned status code ' + apiRes.statusCode));

//         const releases = utils.getJson(apiBody);
//         let latest = null;
//         const releaseList = [];
//         for (let i = 0; i < releases.length; ++i) {
//             const r = releases[i].name.substring(1);
//             if (r < '0.11.4')
//                 continue;
//             if (!latest || (latest < r))
//                 latest = r;
//             releaseList.push(r);
//         }
//         releaseList.sort();
//         const niceList = [];
//         for (let i = 0; i < releaseList.length; ++i) {
//             const r = releaseList[i];
//             const releaseInfo = {
//                 version: r
//             };
//             if (latest === r)
//                 releaseInfo.latest = true;
//             niceList.push(releaseInfo);
//         }
//         return callback(null, niceList);
//     });
// };

module.exports = tags;
