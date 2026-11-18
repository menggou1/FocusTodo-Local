// Release consistency for the shipped React application.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const config = JSON.parse(read('release.json')), pkg = JSON.parse(read('package.json'));
test('release source, application, package, lock and build metadata agree', () => {
 const version = config.localVersion, app = JSON.parse(read('standalone/app-version.json'));
 const lock = JSON.parse(read('package-lock.json')), info = JSON.parse(read('dist/app/site/build-info.json'));
 assert.equal(config.officialVersion, '7.1.1'); assert.equal(pkg.version, version); assert.equal(pkg.author, config.author);
 assert.equal(lock.version, version); assert.equal(lock.packages[''].version, version); assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
 assert.deepEqual(app, {localVersion:version, officialVersion:config.officialVersion, development:false});
 assert.equal(info.localVersion,version); assert.equal(info.kind,'standalone-app'); assert.equal(info.persistence,'legacy-compatible-v3');
 assert.equal(info.schemaVersion,3); assert.equal(info.backupExportVersion,2);
 assert.equal(config.updates[0].version,version); assert.equal(config.updates[0].date,config.date);
});
test('production entry loads React resources with no legacy scripts or preview label', () => {
 const html=read('dist/app/site/index.html');
 assert(html.includes('<title>FocusTodo '+config.localVersion+'</title>'));
 assert.match(html, /type="module"[^>]*src="\.\/assets\//); assert.match(html, /rel="stylesheet"[^>]*href="\.\/assets\//);
 assert(!/js\/main\.js|patch\.js|Preview/.test(html));
 assert(html.includes('window.__prototypeBoot')); assert(html.includes('id="prototype-startup"')); assert(html.includes('id="prototype-retry"'));
 assert(!fs.existsSync(path.join(root,'src')));
});
test('historical reports and licenses remain available with correct destinations', () => {
 assert(!fs.existsSync(path.join(root,'CNAME')));
 const expected=config.updates.map(update=>path.basename(update.report)).concat('UPDATE-2.0.1.md').sort();
 assert(!config.updates.some(update => update.version === '2.0.1'));
 for(const file of ['docs/CHANGELOG.md','docs/en/CHANGELOG.md']) {
  assert(!/^## 2\.0\.1\b/m.test(read(file)));
  assert.match(read(file), /\]\(releases\/UPDATE-2\.0\.1\.md\)/);
 }
 for(const update of config.updates){assert.match(update.report,/^docs\/releases\/[A-Za-z0-9._-]+\.md$/);assert(fs.statSync(path.join(root,update.report)).isFile())}
 for(const directory of ['docs/releases','docs/en/releases'])assert.deepEqual(fs.readdirSync(path.join(root,directory)).filter(name=>name.endsWith('.md')).sort(),expected);
 for(const name of ['LICENSE','THIRD-PARTY-NOTICES.txt','licenses/react.txt','licenses/react-dom.txt','licenses/scheduler.txt','licenses/NotoSans-OFL.txt'])assert(fs.statSync(path.join(root,'dist/app/site',name)).isFile());
});
