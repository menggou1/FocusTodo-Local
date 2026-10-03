const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('../scripts/server.cjs');
const root = path.resolve(__dirname, '..');
let server, base;
test.before(async () => {
    server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));
function request(name, headers = {}, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request(base + name, { method, headers }, res => {
            const chunks = []; res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject); req.end();
    });
}
test('loopback server serves the actual app without cached content', async () => {
    assert.equal(server.address().address, '127.0.0.1');
    const res = await request('/'); assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store'); assert.match(res.headers['content-type'], /text\/html/);
    assert.equal(res.body.toString(), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    assert.match((await request('/js/local-timer-core.js')).headers['content-type'], /javascript/);
});
test('HEAD returns metadata with no response body', async () => {
    const res = await request('/audio/alm_AlarmBeep.mp3', {}, 'HEAD');
    assert.equal(res.status, 200); assert.equal(res.body.length, 0);
    assert.equal(Number(res.headers['content-length']), fs.statSync(path.join(root, 'audio/alm_AlarmBeep.mp3')).size);
    assert.equal(res.headers['content-type'], 'audio/mpeg');
});
test('closed, open and suffix audio ranges return the exact requested bytes', async () => {
    const file = fs.readFileSync(path.join(root, 'audio/alm_AlarmBeep.mp3'));
    for (const [range, start, end] of [['bytes=0-15', 0, 15], ['bytes=16-', 16, file.length - 1], ['bytes=-16', file.length - 16, file.length - 1]]) {
        const res = await request('/audio/alm_AlarmBeep.mp3', { Range: range });
        assert.equal(res.status, 206); assert.equal(res.headers['content-range'], `bytes ${start}-${end}/${file.length}`);
        assert.deepEqual(res.body, file.subarray(start, end + 1));
    }
});
test('invalid or unsatisfiable audio ranges reject without sending the file', async () => {
    for (const range of ['bytes=999999-', 'bytes=16-4', 'bytes=-0', 'bytes=-', 'bytes=0-1,5-9', 'bytes=999999999999999999999-']) {
        const res = await request('/audio/alm_AlarmBeep.mp3', { Range: range });
        assert.equal(res.status, 416); assert.equal(res.body.length, 0); assert.match(res.headers['content-range'], /^bytes \*\//);
    }
});
test('hidden files, private tooling, traversal and writes are inaccessible', async () => {
    for (const name of ['/.git/config', '/node_modules/acorn/package.json', '/scripts/server.cjs', '/tests/server.test.cjs', '/..%5c..%5cWindows/win.ini']) {
        assert.equal((await request(name)).status, 403);
    }
    assert.equal((await request('/index.html', {}, 'POST')).status, 403);
    assert.equal((await request('/%zz')).status, 400);
    assert.equal((await request('/missing-file.txt')).status, 404);
});
test('a busy port reports failure and exits instead of claiming startup succeeded', async () => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/server.cjs')], { cwd: path.parse(root).root, env: { ...process.env, FOCUS_PORT: String(server.address().port) }, windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(code, 1); assert.match(output, /EADDRINUSE/); assert.doesNotMatch(output, /http:\/\//);
});
test('Windows launcher changes directory and honors the port without opening a browser', { skip: process.platform !== 'win32' }, async () => {
    const quoted = path.join(root, 'start.ps1').replace(/'/g, "''");
    const script = `$script:BrowserAttempted=$false; function Start-Job { $script:BrowserAttempted=$true; throw 'Browser launch is forbidden in this test' }; function node { param([string]$ServerScript) Write-Output ('STARTUP_PROBE:' + (Get-Location).Path + ':' + $env:FOCUS_PORT + ':' + $ServerScript) }; . '${quoted}' -NoBrowser -Port 5511; Write-Output ('BROWSER_ATTEMPT:' + $script:BrowserAttempted)`;
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { cwd: path.parse(root).root, windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(code, 0); assert(output.includes('STARTUP_PROBE:' + root + ':5511:scripts/server.cjs'), output);
    assert(output.includes('BROWSER_ATTEMPT:False'), output);
});
