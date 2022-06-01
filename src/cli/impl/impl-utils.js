'use strict';

const Docker = require('dockerode');
const docker = new Docker();
const axios = require('axios');
const os = require('os');

const utils = require('../commands/utils');
const settings = require('./settings');

const implUtils = {};

implUtils.getContainerByName = async (name) => {
    const containers = await docker.listContainers();
    for (let i = 0; i < containers.length; ++i) {
        const c = containers[i];
        if (c.Names.find(cn => { return cn.indexOf(name) >= 0; }))
            return c;
    }
    return null;
};

implUtils.pull = async (imageName, options) => {
    return new Promise(function (resolve, reject) {
        docker.pull(imageName, options, function (err, stream) {
            if (err)
                return reject(err);
            docker.modem.followProgress(stream, onFinished, onProgress);

            const layerMap = {};

            function onFinished(err, output) {
                if (err) {
                    return reject(err);
                }

                let layerCount = 0;
                for (let l in layerMap)
                    layerCount++;
                process.stderr.write(`\rFinished pull of ${layerCount} layers.                                                                            `);
                console.error();
                console.error('Pull finished.');
                resolve();
            }


            function onProgress(event) {
                if (!event.id)
                    return;
                // Non-layer event "Pulling from ..."
                if (event.status && event.status.toLowerCase().indexOf('pulling') >= 0)
                    return;
                layerMap[event.id] = event;
                let totalBytes = 0;
                let currentBytes = 0;
                let layerCount = 0;
                let layerFinished = 0;
                for (let l in layerMap) {
                    layerCount++;
                    const layer = layerMap[l];
                    if (layer.progressDetail && layer.progressDetail.total) {
                        totalBytes += layer.progressDetail.total;
                        currentBytes += layer.progressDetail.current;
                    } else if (layer.status && layer.status.toLowerCase().indexOf('pull complete') >= 0) {
                        layerFinished++;
                    }
                }
                process.stderr.write(`\rPulling ${layerCount} layers, ${layerFinished} finished (${currentBytes} / ${totalBytes} bytes).                   `);
            }
        });
    });
};

implUtils.checkForLatest = async () => {
    let lastCheck = settings.get('lastCheck');
    if (!lastCheck)
        lastCheck = 0;
    const now = new Date().getTime();
    if (now - lastCheck > 24 * 60 * 60 * 1000) {
        console.error('Checking for a new version of wicked-cli...');
        settings.set('lastCheck', now);
        const versions = await axios('https://registry.npmjs.org/wicked-cli');
        const latestVersion = versions.data['dist-tags'].latest;
        if (latestVersion !== utils.getVersion()) {
            console.error();
            console.error(`There is a new version available: ${latestVersion}`);
            console.error(`You are currently using:          ${utils.getVersion()}`);
            console.error();
            console.error('Update with:');
            console.error('  npm upgrade -g wicked-cli');
            console.error();
        }
    }
    return;
};

implUtils.getDefaultLocalIP = () => {
    let localIPs = getLocalIPs();
    if (localIPs.length > 0)
        return localIPs[0];
    throw new Error('No valid local IPv4 addresses found.');
};

function getLocalIPs() {
    console.error('Finding local IP addresses...');
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (let k in interfaces) {
        for (let k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    console.error(addresses);
    return addresses;
}

implUtils.isLinux = () => {
    return os.platform().toLowerCase() === 'linux';
};

implUtils.delay = async function (ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => { resolve(); }, ms);
    });
};

module.exports = implUtils;