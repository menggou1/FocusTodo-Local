/* Read-only historical oracle. Never starts or opens the installed stable app. */
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const commit = 'b0ee5e26c133ea273e1634fa52b8a107e1649a69';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const worktrees = git('worktree', 'list', '--porcelain').split(/\r?\n\r?\n/);
const archived = worktrees.find(block => /branch refs\/heads\/archive\/1\.9\.4(?:\r?\n|$)/.test(block));
const legacyRoot = path.resolve(process.env.FOCUS_LEGACY_ROOT || archived?.split(/\r?\n/)[0].slice(9) || '.missing-legacy-oracle');
if (legacyRoot === root || !fs.existsSync(path.join(legacyRoot, 'src/index.html'))) throw new Error('Set FOCUS_LEGACY_ROOT to the archived 1.9.4 checkout');
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: legacyRoot, encoding: 'utf8', windowsHide: true }).trim();
if (actual !== commit) throw new Error('Historical oracle must be the immutable 1.9.4 commit');
const changed = execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'src', 'public', 'scripts'], { cwd: legacyRoot, encoding: 'utf8', windowsHide: true }).trim();
if (changed) throw new Error('Historical oracle runtime has local changes');
function file(name) {
  const target = path.resolve(legacyRoot, name);
  if (!target.startsWith(legacyRoot + path.sep)) throw new Error('Invalid historical fixture path');
  return target;
}
/** Open the archive's real storage services on the same origin, without its polling UI. */
async function openDataFixture(page, origin) {
  const url = origin + '/forest-storage-fixture.html';
  await page.route(url, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><script>window.FocusI18n={text:value=>value};</script>' +
      ['local-release', 'local-timer-core', 'local-backup', 'local-data']
        .map(name => '<script src="/js/' + name + '.js"></script>').join(''),
  }));
  await page.goto(url);
  await page.evaluate(() => FocusLocalReady);
}
module.exports = { root: legacyRoot, commit, file, openDataFixture, ...require(file('scripts/server.cjs')) };
