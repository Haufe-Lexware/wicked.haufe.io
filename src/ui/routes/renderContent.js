'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal:renderMarkdown');
const marked = require('marked');
const highlightJs = require('highlight.js');
const jade = require('jade');

const renderer = function () { };

// Synchronous highlighting with highlight.js; see also layout.jade, where
// the client side scripts are injected. 
marked.setOptions({
    highlight: function (code) {
        return highlightJs.highlightAuto(code).value;
    },
    sanitize: true
});

renderer.renderContent = function (req, res, subRoute, layout, apiResponse, body) {
    debug('renderMarkdown()');
    let metaInfo = { showTitle: false };
    const metaInfo64 = apiResponse.headers['x-metainfo'];
    if (metaInfo64)
        metaInfo = JSON.parse(new Buffer(metaInfo64, 'base64'));
    debug(metaInfo);

    const contentType = apiResponse.headers['content-type'];

    let title = null;
    if (metaInfo.title)
        title = metaInfo.title;
    let subTitle = null;
    if (metaInfo.subTitle)
        subTitle = marked(metaInfo.subTitle);

    const renderRoute = subRoute;
    const viewModel = {
        authUser: req.user,
        glob: req.app.portalGlobals,
        route: renderRoute,
        showTitle: metaInfo.showTitle,
        omitContainer: metaInfo.omitContainer,
        title: title,
        subTitle: subTitle
    };

    if ("text/jade" == contentType) {
        viewModel.content = jade.render(body, viewModel);
    } else { // Assume markdown
        viewModel.content = marked(body);
    }

    res.render(
        layout,
        viewModel
    );
};

module.exports = renderer;
