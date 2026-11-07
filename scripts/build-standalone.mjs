import { build } from 'vite';
import { readFile, writeFile, mkdir, readdir, rename, copyFile, rm, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
process.chdir(root);
const layout = JSON.parse(await readFile('scripts/standalone-layout.json', 'utf8'));
const site = path.join(root, layout.siteDirectory), debug = path.join(root, layout.debugDirectory);
// Both fixed output paths are inside ignored dist; never accept an arbitrary delete target.
for (const target of [site, debug]) {
  if (!target.startsWith(path.join(root, 'dist', 'standalone') + path.sep)) throw new Error('Invalid output directory');
  let current = root;
  for (const part of path.relative(root, target).split(path.sep)) {
    current = path.join(current, part);
    const stat = await lstat(current).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('Unsafe build output ancestor: ' + current);
  }
}
await rm(debug, { recursive: true, force: true });
await build({ configFile: path.join(root, 'vite.standalone.config.mjs') });
// Direct handlers also capture early stylesheet completion on engines whose
// non-bubbling link events do not reach a window/document capture listener.
const htmlPath = path.join(site, 'index.html');
let html = await readFile(htmlPath, 'utf8');
html = html.replace(/<link\b(?=[^>]*rel="stylesheet")[^>]*>/g, tag => tag.slice(0, -1)
  + ` onload="window.__prototypeBoot.styles[this.href]='loaded'" onerror="window.__prototypeBoot.failed=true;window.__prototypeBoot.fail?.()">`);
html = html.replace(/<script\b(?=[^>]*type="module")(?=[^>]*src=)[^>]*>/g, tag => tag.slice(0, -1)
  + ` onerror="window.__prototypeBoot.failed=true;window.__prototypeBoot.fail?.()">`);
await writeFile(htmlPath, html);
await mkdir(debug, { recursive: true });
await rename(path.join(site, '.vite'), path.join(debug, '.vite'));
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlink in build output');
    if (entry.isDirectory()) result.push(...await files(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}
for (const file of await files(site)) if (file.endsWith('.map')) {
  const destination = path.join(debug, path.relative(site, file));
  await mkdir(path.dirname(destination), { recursive: true });
  await rename(file, destination);
}
await mkdir(path.join(site, 'licenses'), { recursive: true });
for (const name of ['react', 'react-dom', 'scheduler']) {
  await copyFile(path.join(root, 'node_modules', name, 'LICENSE'), path.join(site, 'licenses', name + '.txt'));
}
await copyFile('LICENSE', path.join(site, 'LICENSE'));
await writeFile(path.join(site, 'THIRD-PARTY-NOTICES.txt'),
  'FocusTodo isolated engineering prototype\nReact, ReactDOM and scheduler: MIT. Full copyright and license texts are in licenses/.\nNo legacy bundle, fonts, photos or audio are distributed in this prototype.\n');
const release = JSON.parse(await readFile('release.json', 'utf8'));
await writeFile(path.join(site, 'prototype-build.json'), JSON.stringify({
  kind: 'isolated-prototype', localVersion: release.localVersion, sourceVersion: release.officialVersion,
  schemaVersion: 3, backupExportVersion: 2, persistence: 'synthetic-memory-only', base: './',
  syntaxTargets: ['Chrome 111', 'Edge 111', 'Firefox 114', 'Safari 16.4'],
  isolationCapabilities: ['localStorage key enumeration', 'indexedDB.databases (Firefox 126+)', 'loopback server attestation'],
}, null, 2) + '\n');
const names = (await files(site)).map(file => path.relative(site, file).split(path.sep).join('/')).sort();
for (const name of names) {
  if (!layout.files.includes(name) && !layout.directories.some(directory => name.startsWith(directory + '/'))) {
    throw new Error('Unexpected runtime asset: ' + name);
  }
}
await writeFile(path.join(site, 'runtime-manifest.json'), JSON.stringify({ files: [...names, 'runtime-manifest.json'].sort() }, null, 2) + '\n');
const metrics = [];
for (const file of await files(site)) {
  const bytes = await readFile(file);
  metrics.push({ file: path.relative(site, file).split(path.sep).join('/'), bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
}
await writeFile(path.join(root, 'dist/standalone/build-metrics.json'), JSON.stringify({
  node: process.version, files: metrics, totalBytes: metrics.reduce((n, item) => n + item.bytes, 0),
}, null, 2) + '\n');
console.log('Isolated prototype built in ' + layout.siteDirectory + '; private sourcemaps in ' + layout.debugDirectory);
