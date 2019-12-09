const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
    console.log("Usage: node set-version.js <version>");
    process.exit(1);
}

const versionToSet = process.argv[2];
console.log(`Setting versions to ${versionToSet} in all sub directories.`);

if (!process.env.WICKED_DIRS) {
    console.error('ERROR: Env var WICKED_DIRS must be set.');
    process.exit(1);
}
const subDirs = process.env.WICKED_DIRS.match(/\S+/g);

for (let dirIndex in subDirs) {
    const subDir = subDirs[dirIndex];
    if (!subDir.startsWith('wicked.'))
        throw new Error('Unexpected non-wicked. prefix for dir: ' + dir);
    const dir = subDir.substring(7); // strip wicked.
    const pkgFileName = path.join(process.cwd(), dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgFileName, 'utf8'));
    if (pkg.version !== versionToSet) {
        console.log(`Setting version in package.json of ${dir}.`);
        pkg.version = versionToSet;
        let packageJson = JSON.stringify(pkg, null, 2);
        if (!packageJson.endsWith('\n'))
            packageJson += '\n';
        fs.writeFileSync(pkgFileName, packageJson, 'utf8');
    } else {
        console.log(`In ${dir}, package.json already has ${versionToSet}.`);
    }
}
