'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const settings = {};

settings.get = (name) => {
    const data = loadSettings();
    if (data.hasOwnProperty(name))
        return data[name];
    return null;
};

settings.set = (name, content) => {
    const data = loadSettings();
    data[name] = content;
    saveSettings(data);
};

function getSettingsFileName() {
    const homeDir = os.homedir();
    const wickedDir = path.join(homeDir, '.wicked');
    if (!fs.existsSync(wickedDir))
        fs.mkdirSync(wickedDir);
    const settingsFile = path.join(wickedDir, 'wicked-cli.json');
    return settingsFile;
}

function loadSettings() {
    const settingsFile = getSettingsFileName();
    if (!fs.existsSync(settingsFile))
        return {};
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
}

function saveSettings(data) {
    const settingsFile = getSettingsFileName();
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = settings;