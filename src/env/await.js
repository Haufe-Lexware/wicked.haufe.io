var envReader = require('./env-reader');

if (process.argv.length < 3) {
    console.log('Usage:');
    console.log('  node await.js <url>');
    process.exit(1);
}

var url = process.argv[2];

var tries = 100;
var timeout = 500;

console.log('Awaiting an answer from ' + url);
envReader.awaitUrl(url, tries, timeout, function(err, result) {
    if (err) {
        console.log(err);
        console.log('Giving up.');
        process.exit(1);
    }
    
    console.log('Success.');
    process.exit(0);
});