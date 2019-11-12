'use strict';

const fs = require('fs');
const path = require('path');
const marked = require('marked');
const express = require('express');
const router = express.Router();
const jade = require('jade');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:content');

const utils = require('./utils');

router.get('/', function (req, res, next) {

    const uris = utils.getContentFileNames(req.app);

    res.render('content',
        {
            configPath: req.app.get('config_path'),
            envFile: req.app.get('env_file'),
            pathUris: uris.pathUris,
            publicUris: uris.publicUris
        });
});

router.post('/', function (req, res, next) {
    const newContent = req.body.newContent;
    if (!newContent)
        return res.redirect('/content');

    const fileParts = newContent.split('/');
    for (let i = 0; i < fileParts.length; ++i) {
        if (!/^[a-zA-Z\-_]+$/.test(fileParts[i]))
            return next(utils.makeError(400, 'Invalid URI Path, it contains invalid characters. Allowed are only a-z, A-Z, - and _.'));
    }
    utils.createNewContent(req.app, newContent, req.body.contentType, function (err) {
        if (err)
            return next(err);
        res.redirect('/content/' + newContent);
    });
});

let _tempViewModel = {
    authUser: {
        firstName: 'Daniel',
        lastName: 'Developer',
        name: 'Daniel Developer',
        email: 'daniel@developer.com'
    },
    title: 'This is a title',
    subTitle: 'Some subtitle',
    omitContainer: false,
    showTitle: true,
    glob: {
        network: {
            schema: 'http',
            apiHost: 'api.mycompany.com',
            portalHost: 'mycompany.com'
        }
    }
};

router.get('/*', function (req, res, next) {
    const pathUri = req.path;
    if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(pathUri)) // eslint-disable-line
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    if (/\.\./.test(pathUri))
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });

    let filePath = utils.getContentFileName(req.app, pathUri);
    info(filePath);

    if (utils.isPublic(filePath.toLowerCase())) {
        if (!fs.existsSync(filePath))
            return res.status(404).jsonp({ message: 'Not found.: ' + pathUri });
        const contentType = utils.getContentType(filePath);
        // Just serve it
        fs.readFile(filePath, function (err, content) {
            res.setHeader('Content-Type', contentType);
            res.send(content);
        });
        return;
    }

    //debug(pathUri);

    let isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }

    const configPath = filePath + '.json';
    const mdPath = filePath + '.md';
    const jadePath = filePath + '.jade';

    const mdExists = fs.existsSync(mdPath);
    const jadeExists = fs.existsSync(jadePath);

    if (!mdExists && !jadeExists)
        return next(utils.makeError(404, 'Not found.'));
    if (!fs.existsSync(configPath))
        return next(utils.makeError(404, 'Companion .json file not found.'));
    const contentPath = mdExists ? mdPath : jadePath;

    const metaInfo = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const title = metaInfo.title;
    let subTitle = metaInfo.subTitle;
    if (!subTitle)
        subTitle = '';
    let requiredGroup = '<none>';
    if (metaInfo.requiredGroup)
        requiredGroup = metaInfo.requiredGroup;

    _tempViewModel.title = title;
    _tempViewModel.subTitle = subTitle;
    _tempViewModel.omitContainer = metaInfo.omitContainer;
    _tempViewModel.showTitle = metaInfo.showTitle;

    let content;
    if (mdExists)
        content = marked(fs.readFileSync(mdPath, 'utf8'));
    else
        content = jade.render(fs.readFileSync(jadePath, 'utf8'), _tempViewModel);

    const groups = utils.loadGroups(req.app);

    res.render('content_preview', {
        configPath: req.app.get('config_path'),
        envFile: req.app.get('env_file'),
        pathUri: pathUri,
        isIndex: isIndex,
        showTitle: metaInfo.showTitle,
        omitContainer: metaInfo.omitContainer,
        title: title,
        subTitle: marked(subTitle),
        subTitleRaw: subTitle,
        content: content,
        requiredGroup: requiredGroup,
        groups: groups.groups,
        viewModel: JSON.stringify(_tempViewModel, null, 2)
    });
    //res.status(400).send('not implemented');
});

router.post('/*', function (req, res, next) {
    const pathUri = req.path;
    const redirect = req.body.redirect;

    const body = utils.jsonifyBody(req.body);

    try {
        const tempViewModel = JSON.parse(body.viewModel);
        _tempViewModel = tempViewModel;
    } catch (err) {
        error(err);
    }

    let filePath = utils.getContentFileName(req.app, pathUri);
    let isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }

    const configPath = filePath + '.json';
    let requiredGroup = null;
    if (body.requiredGroup != '<none>')
        requiredGroup = body.requiredGroup;

    debug('requiredGroup: ' + requiredGroup);

    const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    configJson.showTitle = body.showTitle;
    configJson.omitContainer = body.omitContainer;
    configJson.title = body.title;
    configJson.subTitle = body.subTitleRaw;
    if (requiredGroup)
        configJson.requiredGroup = requiredGroup;
    else if (!requiredGroup && configJson.requiredGroup)
        delete configJson.requiredGroup;

    fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2), 'utf8');

    res.redirect('/content' + pathUri);
});

module.exports = router;
