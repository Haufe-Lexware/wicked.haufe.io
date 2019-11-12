const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

if (process.argv.length < 4) {
    console.error('Usage: node verify-chart-version.js <chart dir> <version>');
    process.exit(1);
}

const chartDir = process.argv[2];
const version = process.argv[3];

console.log(`Checking chart dir ${chartDir} for version v${version}...`);

const chartFile = path.join(chartDir, 'Chart.yaml');
const valuesFile = path.join(chartDir, 'values.yaml');

console.log(`- Reading Chart.yaml and values.yaml`);
let chart = null;
let values = null;
try {
    chart = yaml.safeLoad(fs.readFileSync(chartFile, 'utf8'));
    values = yaml.safeLoad(fs.readFileSync(valuesFile, 'utf8'));
} catch (ex) {
    console.error(ex);
    process.exit(1);
}

let fail = false;
if (chart.version !== version) {
    if (version.indexOf('beta') < 0) {
        console.error(`ERROR: Version in Chart.yaml ${chart.version} does not match ${version}!`);
        fail = true;
    } else {
        console.error(`WARNING: Version in Chart.yaml ${chart.version} does not match ${version}`);
        if (!version.startsWith(chart.version)) {
            console.error('ERROR: Even for betas, the version has to start like the chart version (it does not)');
            fail = true;
        }
    }
}
if (values.image.tag !== version) {
    console.error(`ERROR: Tag (image.tag) in values.yaml ${values.image.tag} does not match ${version}!`);
    fail = true;
}
if (fail)
    process.exit(1);
