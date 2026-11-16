/* Shared digest for release build freshness; docs and legacy oracle are excluded. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const inputs = ['standalone', 'public', 'release.json', 'package.json', 'package-lock.json',
  'vite.standalone.config.mjs', 'scripts/build-standalone.mjs', 'scripts/app-inputs.cjs',
  'scripts/app-layout.json', 'LICENSE', 'THIRD-PARTY-NOTICES.txt'];
function inputDigest() {
  const names = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...inputs],
    { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean))].sort();
  const digest = crypto.createHash('sha256');
  for (const name of names) {
    let bytes = fs.readFileSync(path.join(root, name));
    if (/\.(?:tsx?|mjs|cjs|json|html|css|txt)$/.test(name)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    digest.update(name + '\0').update(bytes).update('\0');
  }
  return digest.digest('hex');
}
module.exports = { inputs, inputDigest };
if (require.main === module) console.log(inputDigest());
