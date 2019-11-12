'use strict';

const fs = require('fs');
const path = require('path');

const languages = ['en', 'de', 'fr', 'es'];

const viewDir = path.join(__dirname, '..', 'views');
const viewFiles = fs.readdirSync(viewDir) as string[];

let isOk = true;
for (let i = 0; i < viewFiles.length; ++i) {
    const fileName = viewFiles[i];
    if (!fileName.endsWith('.jade'))
        continue;

    isOk = isOk && checkJadeFile(path.join(viewDir, fileName));
}

if (!isOk)
    process.exit(1);
process.exit(0);

// ===================================

function checkJadeFile(fileName: string): boolean {
    console.log(`Checking ${fileName}...`);
    const labels = extractLabels(fileName);
    const fileBase = fileName.substring(0, fileName.length - 4); // strip "jade"
    let isOk = true;
    for (let i = 0; i < languages.length; ++i) {
        const langFile = fileBase + languages[i] + '.json';
        if (!fs.existsSync(langFile)) {
            continue;
        }
        console.log(` - ${languages[i]}`);
        const langJson = JSON.parse(fs.readFileSync(langFile, 'utf8'));
        for (let j = 0; j < labels.length; ++j) {
            const l = labels[j];
            if (!langJson.hasOwnProperty(l)) {
                console.error(`   --> missing translation for label "${l}"`);
                isOk = false;
            }
        }
        for (let l in langJson) {
            const exists = labels.find(lb => lb === l);
            if (!exists) {
                console.error(`   --> unused translation "${l}"`);
                isOk = false;
            }
        }
    }
    return isOk;
}

function extractLabels(fileName: string): string[] {
    const content = fs.readFileSync(fileName, 'utf8');
    const i18nRegex = /\{i18n\.([a-z_0-9]+)\}/g;
    const labels = [];
    let matches;
    while (matches = i18nRegex.exec(content)) {
        labels.push(matches[1]);
    }

    return labels;
}
