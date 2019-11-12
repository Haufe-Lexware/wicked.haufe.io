'use strict';

const fs = require('fs');
const path = require('path');
const semver = require('semver');

const dirs = [
    'wicked.ui',
    'wicked.api',
    'wicked.chatbot',
    'wicked.env',
    'wicked.kong-adapter',
    'wicked.mailer',
    'wicked.kickstarter',
    'wicked.auth',
    'wicked.test/portal-api',
    'wicked.test/portal-kong-adapter',
    'wicked.test/portal-auth'
];

const baseDir = path.resolve(path.join(__dirname, '..'));

const envPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const envVersion = envPackage.version;

const allDependencies = {};
const allDevDependencies = {};

for (let i = 0; i < dirs.length; ++i) {
    const dirName = dirs[i];
    const dir = path.join(baseDir, dirName);
    console.log('Checking packages.json in: ' + dir);

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));

    for (let depName in pkg.dependencies) {
        const depVersion = pkg.dependencies[depName];
        if (depVersion.startsWith('..') || depVersion.startsWith('file:'))
            continue;
        if (!allDependencies[depName])
            allDependencies[depName] = depVersion;
        else if (allDependencies[depName] !== depVersion) {
            console.log('WARNING: Dependency version mismatch for "' + dirName + '": ' + depName + ' - ' + depVersion + ' vs. ' + allDependencies[depName]);
            if (semver.gt(depVersion, allDependencies[depName])) {
                console.log('WARNING: Taking newer version: ' + depVersion);
                allDependencies[depName] = depVersion;
            }
        }
    }
    if (pkg.devDependencies) {
        for (let depName in pkg.devDependencies) {
            const depVersion = pkg.devDependencies[depName];
            if (depVersion.startsWith('..') || depVersion.startsWith('file:'))
                continue;
            if (!allDevDependencies[depName])
                allDevDependencies[depName] = depVersion;
            else if (allDevDependencies[depName] !== depVersion) {
                console.log('WARNING: Dependency version mismatch for "' + dirName + '": ' + depName + ' - ' + depVersion + ' vs. ' + allDependencies[depName]);
                if (semver.gt(depVersion, allDevDependencies[depName])) {
                    console.log('WARNING: Taking newer version: ' + depVersion);
                    allDevDependencies[depName] = depVersion;
                }
            }
        }
    }
}

let fixDependencies = false;
if (process.argv.length > 2 && process.argv[2] === '--fix') {
    fixDependencies = true;
}

function sortObjectByProperties(o) {
    const tmpString = JSON.stringify(o, Object.keys(o).sort());
    return JSON.parse(tmpString);
}

// Re-add the portal-env we filtered out above
allDependencies['portal-env'] = `file:../portal-env.tgz`;
// And wicked-sdk
allDependencies['wicked-sdk'] = 'file:wicked-sdk.tgz';

envPackage.dependencies = sortObjectByProperties(allDependencies);
envPackage.devDependencies = sortObjectByProperties(allDevDependencies);

console.log(JSON.stringify(envPackage, null, 2));

const allPackageFileName = path.join(__dirname, 'package.all.json');
console.log('Writing to ' + allPackageFileName);
fs.writeFileSync(allPackageFileName, JSON.stringify(envPackage, null, 2), 'utf8');

if (fixDependencies) {
    console.log('=========================');
    console.log('Fixing dependencies in all projects');
    console.log('=========================');


    for (let i = 0; i < dirs.length; ++i) {
        const dirName = dirs[i];
        const dir = path.join(baseDir, dirName);
        console.log('Checking packages.json in: ' + dir);

        const pkgFile = path.join(dir, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

        let changedDep = false;
        for (let depName in pkg.dependencies) {
            const depVersion = pkg.dependencies[depName];
            if (depVersion.startsWith('..') || depVersion.startsWith('file:'))
                continue;
            const newVersion = allDependencies[depName];
            if (!newVersion) {
                console.error('*** Dependency ${depName} not found. This should not be possible');
                continue;
            }
            if (newVersion !== depVersion) {
                console.log(`- Updating ${depName} to ${newVersion} (was ${depVersion})`);
                pkg.dependencies[depName] = newVersion;
                changedDep = true;
            }
        }
        if (pkg.devDependencies) {
            for (let depName in pkg.devDependencies) {
                const depVersion = pkg.devDependencies[depName];
                if (depVersion.startsWith('..') || depVersion.startsWith('file:'))
                    continue;
                const newVersion = allDevDependencies[depName];
                if (!newVersion) {
                    console.error('*** Dependency ${depName} not found. This should not be possible');
                    continue;
                }
                if (newVersion !== depVersion) {
                    console.log(`- Updating ${depName} to ${newVersion} (was ${depVersion})`);
                    pkg.devDependencies[depName] = newVersion;
                    changedDep = true;
                }
            }
        }
        if (changedDep) {
            console.log(`Saving package.json in ${dirName}`);
            fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        }
    }
}