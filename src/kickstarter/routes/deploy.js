'use strict';

const express = require('express');
const router = express.Router();
const mustache = require('mustache');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:deploy');

const utils = require('./utils');

function fwibbleHost(host) {
    if (host.startsWith('$') && !host.startsWith('${'))
        return '${' + host.substring(1) + '}';
    return host;
}

function decodeHtmlEntity(str) {
    return str.replace(/&#(\d+);/g, function (match, dec) {
        return String.fromCharCode(dec);
    });
}

/* GET home page. */
router.get('/', function (req, res, next) {

    const dockerComposeFile = utils.readDockerComposeFile(req.app);
    const dockerFile = utils.readDockerfile(req.app);

    let hasDockerFiles = dockerComposeFile || dockerFile;
    let glob = utils.loadGlobals(req.app);

    let apiHost = fwibbleHost(glob.network.apiHost);
    let portalHost = fwibbleHost(glob.network.portalHost);
    let portalHostVarName = utils.resolveEnvVarName(glob.network.portalHost.trim(), 'PORTAL_NETWORK_PORTALHOST');
    let apiHostVarName = utils.resolveEnvVarName(glob.network.apiHost.trim(), 'PORTAL_NETWORK_APIHOST');
    let dockerTag = utils.getVersion();

    res.render('deploy', {
        configPath: req.app.get('config_path'),
        hasDockerFiles: hasDockerFiles,
        dockerTag: dockerTag,
        dockerComposeFile: dockerComposeFile,
        dockerFile: dockerFile,
        apiHost: apiHost,
        apiHostVarName: apiHostVarName,
        portalHost: portalHost,
        portalHostVarName: portalHostVarName,
        useMailer: glob.mailer && glob.mailer.useMailer,
        useChatbot: glob.chatbot && glob.chatbot.useChatbot
    });
});

router.post('/', function (req, res, next) {
    const redirect = req.body.redirect;

    const body = utils.jsonifyBody(req.body);

    // Do things with the POST body.
    debug(body);
    if (body.createDockerfiles) {
        if (body.alpine)
            body.buildAlpine = "-alpine";
        body.useDataOnly = (body.injectType === 'build');
        // Check for Chatbot and Mailer
        const glob = utils.loadGlobals(req.app);
        body.useMailer = glob.mailer && glob.mailer.useMailer;
        body.useChatbot = glob.chatbot && glob.chatbot.useChatbot;

        // Create new Dockerfiles
        const composeTemplate = utils.readDockerComposeTemplate(req.app);
        const composeContent = mustache.render(composeTemplate, body);
        utils.writeDockerComposeFile(req.app, composeContent);

        // Only create a Dockerfile if using the data only method
        if (body.useDataOnly) {
            const dockerfileTemplate = utils.readDockerfileTemplate(req.app);
            const dockerfileContent = mustache.render(dockerfileTemplate, body);
            utils.writeDockerfile(req.app, dockerfileContent);
        }
    } else if (body.deleteCompose) {
        error('Deleting compose file and Dockerfile');
        utils.deleteDockerComposeFile(req.app);
        utils.deleteDockerFile(req.app);
    } else if (body.editDockerfiles) {
        // Edit the Dockerfiles
        utils.writeDockerComposeFile(req.app, body.composeFile);
        if (body.dockerFile)
            utils.writeDockerfile(req.app, body.dockerFile);
    }

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.deploy = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
