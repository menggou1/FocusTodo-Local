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
    const lock = JSON.parse(read('package-lock.json'));
    assert.equal(lock.version, version); assert.equal(lock.packages[''].version, version);
    assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
    assert.deepEqual(release, { ...config, version, repository: release.repository });
    assert(read('index.html').includes('<title>专注清单 · ' + version + ' · ' + config.author + '</title>'));
    assert.equal(release.updates[0].version, version); assert.equal(release.updates[0].date, config.date);
});

test('release scripts load before consumers and local cache tags use the current version', () => {
    const html = read('index.html');
    const order = ['js/local-i18n-catalog.js', 'js/local-i18n.js', 'js/local-release.js', 'js/local-timer-core.js', 'js/local-data.js', 'js/local-achievements.js', 'js/local-timer-ui.js', 'js/local-app-ui.js', 'js/local-backup.js', 'js/local-theme-storage.js', 'js/local-settings-ui.js', 'js/local-network.js', 'patch.js', 'js/local-calendar.js', 'js/main.js'];
    let previous = -1;
    for (const name of order) { const index = html.indexOf('src="' + name); assert(index > previous, name + ' load order'); previous = index; }
    for (const match of html.matchAll(/\?v=([^"\s]+)/g)) assert.equal(match[1], release.version);
});

test('every maintenance report and the local repository icon are available', () => {
    assert(!fs.existsSync(path.join(root, 'CNAME')), 'Local main runtime must not contain an upstream CNAME');
    for (const update of release.updates) {
        assert.match(update.report, /^docs\/releases\/[A-Za-z0-9._-]+\.md$/);
        assert(fs.statSync(path.join(root, update.report)).isFile(), update.report);
    }
    assert.match(release.repository, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    assert(read('img/github.svg').includes('<svg'));
});

test('report directories match metadata and historical entry points remain valid', () => {
    const expected = config.updates.map(update => path.basename(update.report)).sort();
    for (const directory of ['docs/releases', 'docs/en/releases']) {
        assert.deepEqual(fs.readdirSync(path.join(root, directory)).filter(name => name.endsWith('.md')).sort(), expected);
    }
    for (const directory of ['docs', 'docs/en']) {
        for (const name of fs.readdirSync(path.join(root, directory)).filter(name => name.startsWith('UPDATE-'))) {
            assert(fs.existsSync(path.join(root, directory, 'releases', name)), name + ' historical destination');
        }
    }
});

test('startup feedback is inlined and independent of external assets', () => {
    const html = read('index.html');
    assert(html.includes('<style id="focus-startup-style">\n' + read('startup.css') + '</style>'));
    assert(html.includes('<script id="focus-startup-code">\n' + read('js/local-startup.js') + '</script>'));
    const assetScripts = [...html.matchAll(/<script\b[^>]*src="[^"]+"[^>]*>/g)];
    assert.equal(assetScripts.length, 15);
    for (const [tag] of assetScripts) assert.match(tag, /\bdefer\b/);
    const steps = [...html.matchAll(/data-focus-asset="/g)].length + 1;
    assert(html.includes('id="focus-startup-progress" max="' + steps + '"'));
    assert(!html.includes('http-equiv="Cache-Control"'));
});

test('timer font declarations match the archived official 7.1.1 styles', () => {
    const baseline = JSON.parse(read('tests/official-timer-fonts.json'));
    const rules = new Map([...read('main.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => [match[1].trim().replace(/\r\n/g, '\n'), match[2]]));
    for (const rule of baseline.rules) {
        const declaration = /\bfont-family\s*:\s*([^;}]+)/.exec(rules.get(rule.selector));
        assert.equal(declaration?.[1].trim(), rule.family, rule.selector);
    }
});
