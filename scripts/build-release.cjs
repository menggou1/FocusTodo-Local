// Generate release metadata from one source and the configured Git remote.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('./build-i18n.cjs');
require('./build-english-reports.cjs');
const config = JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'));
if (config.officialVersion !== '7.1.1' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(config.localVersion)) throw new Error('Invalid official/local version.');
const version = Number(config.localVersion.split('.')[0]) >= 2 ? config.localVersion : config.officialVersion + '-local.' + config.localVersion;
if (!config.updates.length || config.updates[0].version !== version || config.updates[0].date !== config.date) throw new Error('Latest update does not match the release.');
let remote;
for (const name of new Set([config.repositoryRemote, 'origin'])) {
    try { remote = execFileSync('git', ['config', '--get', 'remote.' + name + '.url'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); break; }
    catch (_) { /* A fresh clone normally has only origin. */ }
}
if (!remote) throw new Error('No configured release remote or origin found.');
let repository = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/').replace(/\.git$/, '');
const url = new URL(repository);
if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || !/^\/[^/]+\/[^/]+$/.test(url.pathname)) throw new Error('Expected a GitHub repository remote.');
config.updates.forEach(update => {
    if (!update.version || !/^\d{4}-\d{2}-\d{2}$/.test(update.date) || !Array.isArray(update.items) || !/^docs\/releases\/[A-Za-z0-9._-]+\.md$/.test(update.report)) throw new Error('Invalid update entry.');
});
if (Number(config.localVersion.split('.')[0]) >= 2) fs.writeFileSync(path.join(root, 'standalone/app-version.json'), JSON.stringify({localVersion: config.localVersion, officialVersion: config.officialVersion, development: false}, null, 2) + '\n');
const pkgPath = path.join(root, 'package.json'), pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version; pkg.author = config.author;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const lockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = version;
    lock.packages[''].version = version;
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
console.log('Generated ' + version + ' from ' + config.repositoryRemote + ': ' + url.href);
