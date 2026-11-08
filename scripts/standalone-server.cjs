/* Candidate-only server; never serves the checkout or the legacy runtime. */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { pipeline } = require('node:stream');
const layout = require('./standalone-layout.json');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
function createStandaloneServer(options = {}) {
  const site = fs.realpathSync(options.root || path.resolve(__dirname, '..', layout.siteDirectory));
  const base = options.basePath || '/';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid prototype base path');
  const manifest = JSON.parse(fs.readFileSync(path.join(site, 'runtime-manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.files)) throw new Error('Invalid runtime manifest');
  const allowed = new Set(manifest.files);
  for (const name of allowed) {
    if (typeof name !== 'string' || name.split('/').some(part => !part || part.startsWith('.')) || /[\\:\0]/.test(name)
      || (!layout.files.includes(name) && !layout.directories.some(dir => name.startsWith(dir + '/')))
      || name.endsWith('.map')) throw new Error('Unexpected runtime path');
  }
  return http.createServer((req, res) => {
    const host = /^(127\.0\.0\.1|localhost):(\d{1,5})$/i.exec(req.headers.host || '');
    if (!host || Number(host[2]) < 1 || Number(host[2]) > 65535 || !['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(403); res.end(); return;
    }
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://' + req.headers.host).pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (/[\\\0]/.test(pathname) || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); res.end(); return; }
    if (pathname === base + '__prototype/session.json') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ kind: 'isolated-prototype', origin: 'http://' + req.headers.host })); return;
    }
    if (!pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
    const name = pathname.slice(base.length) || 'index.html';
    if (!allowed.has(name)) { res.writeHead(404); res.end(); return; }
    const file = path.join(site, name);
    fs.realpath(file, (error, real) => {
      if (error) { res.writeHead(404); res.end(); return; }
      if (!real.startsWith(site + path.sep) || path.relative(site, real).split(path.sep).join('/') !== name) { res.writeHead(403); res.end(); return; }
      fs.stat(real, (error, stat) => {
        if (error || !stat.isFile()) { res.writeHead(404); res.end(); return; }
        if (res.destroyed) return;
        res.writeHead(200, { ...headers, 'Content-Length': stat.size, 'Content-Type': types[path.extname(real)] || 'application/octet-stream' });
        if (req.method === 'HEAD') res.end();
        else pipeline(fs.createReadStream(real), res, () => {});
      });
    });
  });
}
module.exports = { createStandaloneServer };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--base')) throw new Error('Usage: node scripts/standalone-server.cjs [--base /project/]');
  const server = createStandaloneServer({ basePath: args[1] || '/' });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port + (args[1] || '/')));
}
