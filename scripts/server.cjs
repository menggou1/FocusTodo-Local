/* Dependency-free, loopback-only development server. */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { pipeline } = require('node:stream');
function streamFile(file, response, options) {
    if (response.destroyed) return;
    // A closed browser context cancels optional fonts/images. pipeline destroys
    // the source too, releasing its descriptor instead of leaving it paused.
    pipeline(fs.createReadStream(file, options), response, () => {});
}
const root = path.resolve(__dirname, '..');
const realRoot = fs.realpathSync(root);
const isPrivate = parts => parts.some(p => p.startsWith('.') || ['node_modules', 'scripts', 'tests'].includes(p.toLowerCase()));
const port = Number(process.env.FOCUS_PORT || 5500);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };
function createServer() { return http.createServer((req, res) => {
    // Loopback binding alone does not stop DNS rebinding: browsers send the
    // attacker's hostname after it resolves to 127.0.0.1.
    const host = /^(127\.0\.0\.1|localhost)(?::(\d{1,5}))?$/i.exec(req.headers.host || '');
    if (!host || (host[2] && (Number(host[2]) < 1 || Number(host[2]) > 65535))) { res.writeHead(403); res.end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (_) { res.writeHead(400); res.end(); return; }
    const parts = pathname.split(/[\\/]/);
    if (!['GET', 'HEAD'].includes(req.method) || isPrivate(parts)) { res.writeHead(403); res.end(); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.realpath(file, (error, realFile) => {
        if (res.destroyed) return;
        if (error) { res.writeHead(404); res.end(); return; }
        const relative = path.relative(realRoot, realFile);
        if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || isPrivate(relative.split(path.sep))) {
            res.writeHead(403); res.end(); return;
        }
        fs.stat(realFile, (error, stat) => {
            if (res.destroyed) return;
            if (error || !stat.isFile()) { res.writeHead(404); res.end(); return; }
            const headers = { 'Content-Type': types[path.extname(realFile)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
            let start = 0, end = stat.size - 1, code = 200;
            if (req.headers.range) {
                const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
                if (!match || (!match[1] && !match[2]) || stat.size === 0) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return; }
                if (!match[1]) {
                    const suffix = Number(match[2]);
                    if (!Number.isSafeInteger(suffix) || suffix <= 0) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return; }
                    start = Math.max(0, stat.size - suffix);
                } else {
                    start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
                }
                if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return; }
                headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`; code = 206;
            }
            headers['Content-Length'] = Math.max(0, end - start + 1);
            res.writeHead(code, headers);
            if (req.method === 'HEAD' || stat.size === 0) res.end();
            else streamFile(realFile, res, { start, end });
        });
    });
}); }
module.exports = { createServer, streamFile };
if (require.main === module) {
    const server = createServer();
    server.on('error', error => { console.error('Local server startup failed: ' + error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`FocusTodo ${require('../package.json').version}: http://127.0.0.1:${server.address().port}/index.html`));
}
