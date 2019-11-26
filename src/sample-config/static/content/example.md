# This is an example

Write your markdown here.

* And have fun
* You can do whatever you want

## Images

If you have images, just don't give them a JSON file, and they'll be served.

![This is an image](images/animal.jpg)

This is standard markdown.

## Code

XML:

```xml
<xml>
    <too>hot to handle</too>
</xml>
```

JavaScript:

```javascript
renderer.renderMarkdown = function (res, layout, apiResponse, body) {
    var metaInfo = { showTitle: false };
    var metaInfo64 = apiResponse.headers['x-metainfo'];
    if (metaInfo64)
        metaInfo = JSON.parse(new Buffer(metaInfo64, 'base64'));

    console.log(JSON.stringify(metaInfo));

    var title = null;
    if (metaInfo.title)
        title = metaInfo.title;
    var subTitle = null;
    if (metaInfo.subTitle)
        subTitle = marked(metaInfo.subTitle);

    var route = '/content';
    if (layout == "index")
        route = '/';
        
    marked.setOptions({
        highlight: function (code) {
            return highlightJs.highlightAuto(code).value;
        }
    });

    res.render(
        layout,
        {
            route: route,
            showTitle: metaInfo.showTitle,
            title: title,
            subTitle: subTitle,
            markdown: marked(body)
        });
}
```