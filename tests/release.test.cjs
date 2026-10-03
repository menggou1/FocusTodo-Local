// Detect a release prepared with stale metadata, assets or report destinations.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const config = JSON.parse(read('release.json')), pkg = JSON.parse(read('package.json'));
const sandbox = { window: {} }; vm.runInNewContext(read('js/local-release.js'), sandbox);
const release = JSON.parse(JSON.stringify(sandbox.window.FocusRelease));

test('published metadata, package and page all use the same official/local release', () => {
    const version = config.officialVersion + '-local.' + config.localVersion;
    assert.equal(config.officialVersion, '7.1.1');
    assert.equal(pkg.version, version); assert.equal(pkg.author, config.author);
    assert.deepEqual(release, { ...config, version, repository: release.repository });
    assert(read('index.html').includes('<title>专注清单 · ' + version + ' · ' + config.author + '</title>'));
    assert.equal(release.updates[0].version, version); assert.equal(release.updates[0].date, config.date);
});

test('release scripts load before consumers and local cache tags use the current version', () => {
    const html = read('index.html');
    const order = ['js/local-release.js', 'js/local-timer-core.js', 'js/local-data.js', 'js/local-timer-ui.js', 'js/local-app-ui.js', 'patch.js', 'js/main.js'];
    let previous = -1;
    for (const name of order) { const index = html.indexOf('src="' + name); assert(index > previous, name + ' load order'); previous = index; }
    for (const match of html.matchAll(/\?v=([^"\s]+)/g)) assert.equal(match[1], release.version);
});

test('every maintenance report and the local repository icon are available', () => {
    for (const update of release.updates) {
        assert.match(update.report, /^docs\/[A-Za-z0-9._-]+\.md$/);
        assert(fs.statSync(path.join(root, update.report)).isFile(), update.report);
    }
    assert.match(release.repository, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    assert(read('img/github.svg').includes('<svg'));
});
