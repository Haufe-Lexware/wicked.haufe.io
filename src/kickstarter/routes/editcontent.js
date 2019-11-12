'use strict';

const fs = require('fs');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:editcontent');

const express = require('express');
const router = express.Router();

const utils = require('./utils');

router.get('/*', function (req, res, next) {
    const pathUri = req.path;
    if (!/^[a-zA-Z\-_\/\.]+$/.test(pathUri)) // eslint-disable-line
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    if (/\.\./.test(pathUri))
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });

    let filePath = utils.getContentFileName(req.app, pathUri);
    let isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }

    const mdPath = filePath + '.md';
    const jadePath = filePath + '.jade';
    const mdExists = fs.existsSync(mdPath);
    const jadeExists = fs.existsSync(jadePath);
    if (!mdExists && !jadeExists)
        return next(utils.makeError(404, 'Not found.'));

    let contentPath = mdPath;
    if (!mdExists)
        contentPath = jadePath;
    const content = fs.readFileSync(contentPath, 'utf8');
    const contentType = mdExists ? 'markdown' : 'jade';

    res.render('content_edit', {
        configPath: req.app.get('config_path'),
        pathUri: pathUri,
        content: content,
        contentType: contentType
    });
});

router.post('/*', function (req, res, next) {
    const pathUri = req.path;
    const redirect = req.body.redirect;
    if (!/^[a-zA-Z\-_\/\.]+$/.test(pathUri)) // eslint-disable-line
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    if (/\.\./.test(pathUri))
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });

    let filePath = utils.getContentFileName(req.app, pathUri);
    let isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }

    if (req.body.contentType == 'markdown') {
        const mdPath = filePath + '.md';
        if (!fs.existsSync(mdPath))
            return next(utils.makeError(404, 'Not found.'));

        const markdown = req.body.content;

        fs.writeFileSync(mdPath, markdown, 'utf8');
    } else { // contentType == 'jade'
        const jadePath = filePath + '.jade';
        if (!fs.existsSync(jadePath))
            return next(utils.makeError(404, 'Jade not found.'));
        const jadeContent = req.body.content;
        fs.writeFileSync(jadePath, jadeContent, 'utf8');
    }

    res.redirect(redirect);
});

module.exports = router;