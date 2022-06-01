'use strict';

const Docker = require('dockerode');
const docker = new Docker();
const axios = require('axios');
const opn = require('open');
const path = require('path');

const postgres = require('./postgres-impl');
const implUtils = require('./impl-utils');

const box = {};

const BOX_CONTAINER_NAME = 'wicked-box';
const BOX_IMAGE_NAME = 'haufelexware/wicked.box';

box.start = async (
    tag,
    pull,
    dir,
    nodeEnv,
    uiPort,
    apiPort,
    gatewayPort,
    adminPort,
    logLevel,
    defaultDockerHost,
    wait,
    open,
    platform,
    allowAnyRedirectUri,
    callback
) => {
    const currentDir = process.cwd();
    let configDir = dir;
    if (!path.isAbsolute(configDir))
        configDir = path.resolve(path.join(currentDir, dir));

    const pgContainer = await postgres.getPgContainer();
    if (!pgContainer) {
        console.error('*** Postgres is not running, cannot start "wicked-in-a-box".');
        console.error('*** Start a Postgres instance using "wicked postgres start".');
        process.exit(1);
    }

    let dockerHost = defaultDockerHost;
    if (implUtils.isLinux() && defaultDockerHost === 'host.docker.internal') {
        console.log('Linux detected: Attempting to resolve local machine\'s IP address...');
        try {
            const localIP = implUtils.getDefaultLocalIP();
            dockerHost = localIP;
            console.log(`Auto-setting --docker-host to ${localIP}.`);
        } catch (err) {
            console.error(err.message);
            console.error('WARNING: Could not resolve local IP address. Please pass in via the --docker-host option.');
        }
    }

    const publicPort = pgContainer.Ports.find(p => p.hasOwnProperty('PublicPort'));
    if (!publicPort) {
        console.error('*** Postgres does not have a PublicPort Ports entry.');
        process.exit(1);
    }
    const pgPort = publicPort.PublicPort;

    console.log(`Will use Postgres on port ${pgPort}.`);
    const imageName = `haufelexware/wicked.box:${tag}`;
    const createOptions = {
        name: BOX_CONTAINER_NAME,
        Image: imageName,
        Tty: false,
        ExposedPorts: {}, // Filled below, inline notation not possible
        Env: [
            `LOG_LEVEL=${logLevel}`,
            `NODE_ENV=${nodeEnv}`,
            'KONG_PG_USER=kong',
            'KONG_PG_PASSWORD=kong',
            `KONG_PG_HOST=${dockerHost}`,
            `KONG_PG_PORT=${pgPort}`,
            `PORTAL_STORAGE_PGPORT=${pgPort}`,
            `DOCKER_HOST=${dockerHost}`,
            `PORTAL_NETWORK_APIHOST=localhost:${gatewayPort}`,
            `PORTAL_NETWORK_PORTALHOST=localhost:${uiPort}`
        ],
        HostConfig: {
            PortBindings: {
                '3000/tcp': [{ 'HostPort': uiPort.toString() }],
                '8000/tcp': [{ 'HostPort': gatewayPort.toString() }]
            },
            Binds: [
                `${configDir}:/var/portal-api`
            ],
            RestartPolicy: {
                Name: 'unless-stopped'
            }
        },
        Platform: platform,
        platform: platform
    };

    if (adminPort) {
        console.log(`Exposing the Kong Admin API on http://localhost:${adminPort}`);
        createOptions.HostConfig.PortBindings['8001/tcp'] = [{ HostPort: adminPort.toString() }];
    }
    if (apiPort) {
        console.log(`Exposing the wicked API on http://localhost:${apiPort}`);
        createOptions.HostConfig.PortBindings['3001/tcp'] = [{ HostPort: apiPort.toString() }];
    }
    if (allowAnyRedirectUri) {
        // https://github.com/Haufe-Lexware/wicked.haufe.io/issues/196
        createOptions.Env.push('ALLOW_ANY_REDIRECT_URI=true');
    }

    try {
        if (pull) {
            console.log(`Pulling '${imageName}'...`);
            await implUtils.pull(createOptions.Image, {
                Platform: platform,
                platform: platform
            });
        }
        const boxContainer = await docker.createContainer(createOptions);
        await boxContainer.start();

        const uiUrl = `http://localhost:${uiPort}`;

        console.log('wicked-in-a-box has started. When the startup has finished, point your browser to:');
        console.log();
        console.log(`  ${uiUrl}`);
        console.log();
        console.log('You can follow the logs with the following command:');
        console.log();
        console.log(`  docker logs -f ${BOX_CONTAINER_NAME}`);
        console.log();
        console.log('Stop the wicked in a box container with the following command:');
        console.log();
        console.log(`  wicked box stop`);
        console.log();

        if (wait) {
            await environmentHasStarted(gatewayPort);
            if (open) {
                console.log(`Opening ${uiUrl}...`);
                opn(uiUrl);
            }
        } else {
            console.log('Not waiting for environment to start. Allow up to 20 seconds until the environment is ready.');
        }
        return callback(null);
    } catch (err) {
        console.error(err.message);
        console.error('*** Could not start wicked-in-a-box.');
        process.exit(1);
    }
};

box.stop = async (callback) => {
    const boxContainerInfo = await box.getBoxContainer();
    if (!boxContainerInfo) {
        console.log(`Container ${BOX_CONTAINER_NAME} is not running, cannot stop.`);
        process.exit(0);
        return callback(null);
    }
    try {
        const boxContainer = docker.getContainer(boxContainerInfo.Id);
        await boxContainer.stop();
        await boxContainer.remove();
        console.log(`Container ${BOX_CONTAINER_NAME} was stopped.`);
        return callback(null);
    } catch (err) {
        console.error(err.message);
        console.error('*** An error occurred while stopping the container.');
        process.exit(1);
    }
};

box.status = async (callback) => {
    const boxContainerInfo = await box.getBoxContainer();
    if (!boxContainerInfo) {
        console.log(`Container ${BOX_CONTAINER_NAME} is NOT running.`);
        process.exit(1);
    }
    console.log(`Container ${BOX_CONTAINER_NAME} is running.`);
    process.exit(0);
};

box.getBoxContainer = async () => {
    return implUtils.getContainerByName(BOX_CONTAINER_NAME);
};

box.getBoxImageName = () => {
    return BOX_IMAGE_NAME;
};

async function environmentHasStarted(gatewayPort) {
    const pingEndpoint = `http://localhost:${gatewayPort}/ping-portal`;
    console.log(`Probing ping endpoint ${pingEndpoint}`);
    process.stdout.write('Waiting for environment to start');
    let started = false;
    const startTime = Date.now();
    while (!started && (Date.now() - startTime < 60000)) {
        process.stdout.write('.');
        await implUtils.delay(1000);
        try {
            const pingRes = await axios({
                method: 'GET',
                url: pingEndpoint,
                timeout: 500
            });
            if (200 === pingRes.status) {
                started = true;
            }
        } catch (err) {
            // Ignore, this is somewhat expected
        }
    }
    console.log('');

    if (!started) {
        console.error('*** Start of wicked box timed out!');
        process.exit(1);
    }
    console.log('wicked-in-a-box successfully started.');
    return;
}

module.exports = box;
