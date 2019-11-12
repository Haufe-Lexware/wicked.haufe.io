'use strict';

const path = require('path');
const fs = require('fs');
const mustache = require('mustache');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:content');
const users = require('./users');
const utils = require('./utils');

const content = require('express').Router();

// ===== SCOPES =====

const READ = 'read_content';

const verifyScope = utils.verifyScope(READ);

// ===== ENDPOINTS =====

content.get('/', verifyScope, function (req, res, next) {
    content.getContent(req.app, res, req.apiUserId, req.path);
});

content.get('/toc', verifyScope, function (req, res, next) {
    content.getToc(req.app, res, req.apiUserId);
});

content.get('/*', verifyScope, function (req, res, next) {
    content.getContent(req.app, res, req.apiUserId, req.path);
});

// ===== IMPLEMENTATION =====

content._toc = null;
content.setup = function (app) {
    debug('setup()');

    content._toc = [];

    addApisToToc(app, content._toc);
    addContentToToc(app, content._toc);

    content._toc.sort(function (a, b) {
        if (a.category == b.category) {
            return (a.title.localeCompare(b.title));
        }
        return a.category.localeCompare(b.category);
    });
};

function makeTocEntry(category, url, title, subTitle, requiredGroup, tags) {
    return {
        category: category,
        url: url,
        title: title,
        subTitle: subTitle,
        requiredGroup: requiredGroup,
        tags: tags
    };
}

function addApisToToc(app, toc) {
    const apiList = utils.loadApis(app);
    for (let i = 0; i < apiList.apis.length; ++i) {
        const thisApi = apiList.apis[i];
        toc.push(makeTocEntry("api",
            "/apis/" + thisApi.id,
            thisApi.name,
            thisApi.desc,
            thisApi.requiredGroup,
            thisApi.tags));
    }
}

function addContentToToc(app, toc) {
    const contentBase = path.join(utils.getStaticDir(), 'content');

    addContentDirToToc(app, contentBase, '/content/', toc);
}

function addContentDirToToc(app, dir, uriPart, toc) {
    const fileNames = fs.readdirSync(dir);
    for (let i = 0; i < fileNames.length; ++i) {
        const fileName = fileNames[i];
        if (fileName.toLowerCase().endsWith('.json')) {
            continue;
        }

        const stat = fs.statSync(path.join(dir, fileName));
        if (stat.isDirectory()) {
            // Recurse please
            addContentDirToToc(app, path.join(dir, fileName), uriPart + fileName + '/', toc);
            continue;
        }

        const isJadeFile = fileName.toLowerCase().endsWith('.jade');
        const isMarkdownFile = fileName.toLowerCase().endsWith('.md');
        if (!isJadeFile && !isMarkdownFile) {
            continue;
        }
        let strippedFileName = null;
        if (isJadeFile) {
            strippedFileName = fileName.substring(0, fileName.length - 5);
        }
        if (isMarkdownFile) {
            strippedFileName = fileName.substring(0, fileName.length - 3);
        }
        const jsonFileName = path.join(dir, strippedFileName + '.json');
        if (!fs.existsSync(jsonFileName)) {
            debug('JADE or MD file without companion JSON file: ' + fileName);
            continue;
        }

        const metaData = JSON.parse(fs.readFileSync(jsonFileName, 'utf8'));

        toc.push(makeTocEntry(
            'content',
            uriPart + strippedFileName,
            metaData.title,
            metaData.subTitle,
            metaData.requiredGroup,
            metaData.tags));
    }
}

content.getToc = function (app, res, loggedInUserId) {
    debug('getToc()');
    if (!content._toc) {
        return res.status(500).json({ message: 'Internal Server Error. Table of Content not initialized.' });
    }

    // This is fairly expensive. TODO: This should be cached.
    const groups = utils.loadGroups(app);
    const groupRights = {};
    // Initialize for not logged in users
    for (let i = 0; i < groups.groups.length; ++i) {
        groupRights[groups.groups[i].id] = false;
    }
    if (loggedInUserId) {
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'getToc: loadUser failed', err);
            }
            if (!userInfo) {
                return utils.fail(res, 400, 'Bad Request. Unknown User ID.');
            }
            if (userInfo.groups) {
                for (let i = 0; i < groups.groups.length; ++i) {
                    const groupId = groups.groups[i].id;
                    groupRights[groupId] = users.hasUserGroup(app, userInfo, groupId);
                }
            }
            return res.json(filterToc(groupRights));
        });
    } else {
        // No group rights (empty set {})
        res.json(filterToc(groupRights));
    }
};

function filterToc(groupRights) {
    const userToc = [];
    for (let i = 0; i < content._toc.length; ++i) {
        const tocEntry = content._toc[i];
        let addThis = false;
        if (!tocEntry.requiredGroup) {
            addThis = true;
        }
        if (!addThis && groupRights[tocEntry.requiredGroup]) {
            addThis = true;
        }
        if (addThis) {
            userToc.push(tocEntry);
        }
    }
    return userToc;
}

content.isPublic = function (uriName) {
    return uriName.endsWith('jpg') ||
        uriName.endsWith('jpeg') ||
        uriName.endsWith('png') ||
        uriName.endsWith('js') ||
        uriName.endsWith('gif') ||
        uriName.endsWith('css');
};

content.getContentType = function (uriName) {
    if (uriName.endsWith('jpg') ||
        uriName.endsWith('jpeg')) {
        return "image/jpeg";
    }
    if (uriName.endsWith('png')) {
        return "image/png";
    }
    if (uriName.endsWith('gif')) {
        return "image/gif";
    }
    if (uriName.endsWith('css')) {
        return "text/css";
    }
    if (uriName.endsWith('js')) {
        return "text/javascript";
    }

    return "text/markdown";
};

content.allowMustache = function (uriName) {
    if (uriName.endsWith('css')) {
        return true;
    }
    return false;
};

// Ahem. Don't use too large files here.
const _mustacheCache = {};
function mustacheFile(filePath) {
    if (_mustacheCache[filePath]) {
        return _mustacheCache[filePath];
    }
    const template = fs.readFileSync(filePath + '.mustache', 'utf8');
    const glob = utils.loadGlobals();
    const viewModel = {
        portalUrl: `${glob.network.schema}://${glob.network.portalHost}`,
        apiUrl: `${glob.network.schema}://${glob.network.apiHost}`
    };
    return mustache.render(template, viewModel);
}

content.getContent = function (app, res, loggedInUserId, pathUri) {
    debug('getContent(): ' + pathUri);
    if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(pathUri)) {
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    }
    if (/\.\./.test(pathUri)) {
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });
    }

    // QUICK AND DIRTY?!
    const contentPath = pathUri.replace('/', path.sep);
    const staticDir = utils.getStaticDir();

    let filePath = path.join(staticDir, 'content', contentPath);

    if (content.isPublic(filePath.toLowerCase())) {
        let contentType = content.getContentType(filePath);
        if (content.allowMustache(pathUri) && fs.existsSync(filePath + '.mustache')) {
            // Mustache it
            const templatedContent = mustacheFile(filePath);
            res.setHeader('Content-Type', contentType);
            res.send(templatedContent);
        } else if (!fs.existsSync(filePath)) {
            return res.status(404).jsonp({ message: 'Not found.: ' + pathUri });
        } else {
            // Just serve it
            fs.readFile(filePath, function (err, content) {
                res.setHeader('Content-Type', contentType);
                res.send(content);
            });
        }
        return;
    }

    // Special case: index
    if (pathUri == "/") {
        filePath = path.join(staticDir, 'index');
    }

    const mdFileName = filePath + '.md';
    const jadeFileName = filePath + '.jade';
    const metaName = filePath + '.json';
    const mdExists = fs.existsSync(mdFileName);
    const jadeExists = fs.existsSync(jadeFileName);

    if (!mdExists && !jadeExists) {
        return res.status(404).jsonp({ message: 'Not found: ' + pathUri });
    }

    let contentType;
    let fileName;
    if (mdExists) {
        fileName = mdFileName;
        contentType = 'text/markdown';
    } else { // jade
        fileName = jadeFileName;
        contentType = 'text/jade';
    }

    let metaInfo = { showTitle: false };
    if (fs.existsSync(metaName)) {
        metaInfo = JSON.parse(fs.readFileSync(metaName, 'utf8'));
    }
    if (metaInfo.requiredGroup) {
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'getContent: loadUser failed', err);
            }
            if (!userInfo || // requiredGroup but no user, can't be right
                !users.hasUserGroup(app, userInfo, metaInfo.requiredGroup)) {
                return utils.fail(res, 403, 'Not allowed.');
            }
            sendContent(res, metaInfo, fileName, contentType);
        });
    } else {
        sendContent(res, metaInfo, fileName, contentType);
    }
};

function sendContent(res, metaInfo, fileName, contentType) {
    debug('sendContent()');
    // Yay! We're good!
    const metaInfo64 = Buffer.from(JSON.stringify(metaInfo)).toString("base64");
    fs.readFile(fileName, function (err, content) {
        if (err) {
            return utils.fail(res, 500, 'Unexpected error', err);
        }
        res.setHeader('X-MetaInfo', metaInfo64);
        res.setHeader('Content-Type', contentType);
        res.send(content);
    });
}

module.exports = content;
