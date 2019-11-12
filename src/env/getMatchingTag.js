const dockerTools = require('./docker-tools');

if (process.argv.length !== 5) {
    console.error('Usage: node getMatchingTag.js <namespace> <image> <tag>');
    process.exit(1);
}

const namespace = process.argv[2];
const imageName = process.argv[3];
const tagName = process.argv[4];

dockerTools.getMatchingTag(namespace, imageName, tagName, function (err, tagName) {
    if (err) {
        console.error('ERROR: Get matching tag faied.');
        console.error(err);
        process.exit(1);
    }
    console.log(tagName);
    process.exit(0);
});
