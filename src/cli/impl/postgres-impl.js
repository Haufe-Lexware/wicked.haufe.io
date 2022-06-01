'use strict';

const Docker = require('dockerode');
const docker = new Docker();
const path = require('path');

const implUtils = require('./impl-utils');

const postgres = {};

const PG_CONTAINER_NAME = 'wicked-postgres';

postgres.start = async (tag, pull, pgPort, dataDir, platform, callback) => {
    const pgContainer = await postgres.getPgContainer();

    let volumeDir;
    if (dataDir) {
        const currentDir = process.cwd();
        volumeDir = dataDir;
        if (!path.isAbsolute(volumeDir))
            volumeDir = path.resolve(path.join(currentDir, volumeDir));
    }

    const foundPg = !!pgContainer;
    if (foundPg) {
        console.log(`Container '${PG_CONTAINER_NAME}' is already running.`);
        return callback(null);
    }
    const imageName = `postgres:${tag}`;
    const createOptions = {
        name: PG_CONTAINER_NAME,
        Image: imageName,
        Tty: false,
        ExposedPorts: {}, // Filled below, inline notation not possible
        Env: [
            'POSTGRES_USER=kong',
            'POSTGRES_PASSWORD=kong'
        ],
        HostConfig: {
            PortBindings: { '5432/tcp': [{ 'HostPort': pgPort.toString() }] },
            AutoRemove: true,
        },
        Platform: platform,
        platform: platform
    };
    const portString = `${pgPort}/tcp`;
    createOptions.ExposedPorts[portString] = {};
    if (volumeDir) {
        createOptions.HostConfig.Binds = [
            `${volumeDir}:/var/lib/postgresql/data`
        ];
    }

    try {
        if (pull) {
            console.log(`Pulling ${imageName} (${platform})...`);
            await implUtils.pull(imageName, {
                Platform: platform,
                platform: platform
            });
        }
        const container = await docker.createContainer(createOptions);
        await container.start({});
        console.log(`Postgres ${tag} is running.`);
        console.log('To stop Postgres, use one of the following commands:');
        console.log('  wicked postgres stop');
        console.log(`  docker rm -f ${PG_CONTAINER_NAME}`);
        callback(null);
    } catch (err) {
        console.error(err);
        console.error('*** Could not start the Postgres container.');
        process.exit(1);
    }
};

postgres.stop = async (callback) => {
    const pgContainerInfo = await postgres.getPgContainer();
    if (!pgContainerInfo) {
        console.log(`Container '${PG_CONTAINER_NAME}' is not running, cannot stop.`);
        return callback(null);
    }
    try {
        const pgContainer = await docker.getContainer(pgContainerInfo.Id);
        await pgContainer.stop();
        console.log('Postgres was stopped.');
        return callback(null);
    } catch (err) {
        return callback(err);
    }
};

postgres.status = async (callback) => {
    const pgContainerInfo = await postgres.getPgContainer();
    if (!pgContainerInfo) {
        console.error(`Container '${PG_CONTAINER_NAME}' is NOT running.`);
        process.exit(1);
    }
    console.error(`Container '${PG_CONTAINER_NAME}' is running.`);
    process.exit(0);
};

postgres.getPgContainer = async () => {
    return implUtils.getContainerByName(PG_CONTAINER_NAME);
};

module.exports = postgres;
