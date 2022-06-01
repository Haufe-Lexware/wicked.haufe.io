'use strict';

const path = require('path');
const os = require('os');
const implUtils = require('./impl-utils');

const kickstart = {};

const Docker = require('dockerode');

// Default settings
const docker = new Docker();

const KICKSTARTER_CONTAINER = 'wicked-kickstarter';

kickstart.run = async (tag, pull, dir, newFlag, logLevel, platform, callback) => {
    const currentDir = process.cwd();
    let configDir = dir;
    if (!path.isAbsolute(configDir))
        configDir = path.resolve(path.join(currentDir, dir));

    console.log(`Running Kickstarter '${tag}' on '${configDir}' (mapped to /var/portal-api)...`);

    const createOptions = {
        name: KICKSTARTER_CONTAINER,
        Tty: true,
        ExposedPorts: { '3333/tcp': {} },
        HostConfig: {
            PortBindings: { '3333/tcp': [{ 'HostPort': '3333' }] },
            AutoRemove: true,
            Binds: [
                `${configDir}:/var/portal-api`
            ]
        },
        Env: [
            `LOG_LEVEL=${logLevel}`
        ],
        Platform: platform,
        platform: platform
    };

    const cmd = [];
    if (newFlag)
        cmd.push('--new');

    if (implUtils.isLinux()) {
        // We need to set the UID and GID into the Kickstarter container so that
        // the files are persisted with the correct user and group IDs; otherwise
        // the configuration files are written as the root user, which can lead
        // to various problems.
        const userInfo = os.userInfo();
        const envs = createOptions.Env;
        envs.push(`LOCAL_UID=${userInfo.uid}`);
        envs.push(`LOCAL_GID=${userInfo.gid}`);

        console.log(`Detected Linux; using UID ${userInfo.uid} and GID ${userInfo.gid} inside the Kickstarter container.`);
    }

    const kickstarterImage = `haufelexware/wicked.kickstarter:${tag}-alpine`;
    console.log(`Using image ${kickstarterImage}...`);

    if (pull) {
        console.log(`Pulling '${kickstarterImage}'...`);
        try {
            await implUtils.pull(kickstarterImage, {
                platform: platform,
                Platform: platform
            });
        } catch (err) {
            console.error(err.message);
            console.error('*** docker pull failed. Are you using the wrong --tag, or do you need to supply a --tag?');
            console.error('*** Call "wicked kickstart --help" for more options.');
            process.exit(1);
        }
    }

    docker.run(kickstarterImage, cmd, process.stdout, createOptions, (err, data, container) => {
        if (err)
            console.error(err);
        return callback(null);
    });

    if (process.platform === "win32") {
        const rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('SIGINT', function () {
            process.emit("SIGINT");
        });
    }

    let processingSigint = false;
    process.on('SIGINT', function () {
        if (processingSigint)
            return;
        processingSigint = true;
        console.error('*** Received SIGINT (Ctrl-C), attempting to shut down Kickstarter...');
        (async () => {
            try {
                const containerInfo = await implUtils.getContainerByName(KICKSTARTER_CONTAINER);
                const container = await docker.getContainer(containerInfo.Id);
                await container.stop();
                console.error('Kickstarter stopped.');
            } catch (err) {
                console.error(err);
                console.error('*** An error occurred while stopping the Kickstarter container.');
                process.exit(1);
            }
        })();
    });
};

module.exports = kickstart;
