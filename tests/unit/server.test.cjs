const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('../../scripts/server.cjs');
const root = path.resolve(__dirname, '../..');
let server, base;
test.before(async () => {
    server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));
function request(name, headers = {}, method = 'GET', origin = base) {
    return new Promise((resolve, reject) => {
        const req = http.request(origin + name, { method, headers }, res => {
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
    assert.equal(res.body.toString(), fs.readFileSync(path.join(root, 'src/index.html'), 'utf8'));
    assert.match((await request('/js/local-timer-core.js')).headers['content-type'], /javascript/);
});
test('HEAD returns metadata with no response body', async () => {
    const res = await request('/audio/alm_AlarmBeep.mp3', {}, 'HEAD');
    assert.equal(res.status, 200); assert.equal(res.body.length, 0);
    assert.equal(Number(res.headers['content-length']), fs.statSync(path.join(root, 'public/audio/alm_AlarmBeep.mp3')).size);
    assert.equal(res.headers['content-type'], 'audio/mpeg');
});
test('NUL bytes in decoded paths return 400 and leave the server running', { timeout: 5000 }, async t => {
    // Isolate the process so a regression cannot terminate or hang this suite.
    const child = spawn(process.execPath, ['-e',
        "const server=require('./scripts/server.cjs').createServer();server.listen(0,'127.0.0.1',()=>console.log(server.address().port));"
    ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const closed = new Promise(resolve => child.once('exit', resolve));
    let errors = ''; child.stderr.on('data', chunk => { errors += chunk; });
    t.after(async () => { child.kill(); await closed; });
    const port = await new Promise((resolve, reject) => {
        child.once('error', reject); child.stdout.once('data', chunk => resolve(Number(String(chunk).trim())));
    });
    const origin = 'http://127.0.0.1:' + port;
    for (const name of ['/%00', '/img/github.svg%00.png', '/%00/index.html']) {
        for (const method of ['GET', 'HEAD']) {
            const res = await request(name, {}, method, origin).catch(error => assert.fail(errors || error.message));
            assert.equal(res.status, 400, method + ' ' + name);
            assert.equal(res.body.length, 0);
            assert.equal((await request('/index.html', {}, 'GET', origin)).status, 200, 'Valid requests still work');
        }
    }
});
test('rejects non-loopback Host headers while allowing documented local names', async () => {
    for (const host of ['attacker.example', 'localhost.attacker.example', '127.0.0.1.attacker.example', 'localhost@attacker.example', 'localhost:bad']) {
        const res = await request('/index.html', { Host: host });
        assert.equal(res.status, 403, host);
        assert.equal(res.body.length, 0);
    }
    for (const host of ['localhost', `localhost:${server.address().port}`, `127.0.0.1:${server.address().port}`]) {
        assert.equal((await request('/index.html', { Host: host })).status, 200, host);
    }
});

test('cancelled font downloads close their file streams', async t => {
    const original = fs.createReadStream;
    let stream;
    t.mock.method(fs, 'createReadStream', function (...args) {
        const opened = original.apply(this, args);
        if (String(args[0]).includes('NotoSansSC-')) stream = opened;
        return opened;
    });
    const font = fs.readdirSync(path.join(root, 'public/font')).find(name => name.startsWith('NotoSansSC-'));
    try {
        await new Promise((resolve, reject) => {
            const req = http.get(base + '/font/' + font, res => {
                res.once('data', () => { res.destroy(); resolve(); });
            });
            req.on('error', reject);
        });
        assert(stream, 'The real font stream was opened');
        await new Promise((resolve, reject) => {
            if (stream.closed) return resolve();
            const timer = setTimeout(() => reject(new Error('Cancelled download left a file stream open')), 2000);
            stream.once('close', () => { clearTimeout(timer); resolve(); });
        });
        assert(stream.destroyed);
        assert.equal((await request('/')).status, 200, 'The server still serves the application');
    } finally { stream?.destroy(); }
});
test('closed, open and suffix audio ranges return the exact requested bytes', async () => {
    const file = fs.readFileSync(path.join(root, 'public/audio/alm_AlarmBeep.mp3'));
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
    for (const name of ['/.git/config', '/node_modules/acorn/package.json', '/scripts/server.cjs', '/SCRIPTS/server.cjs', '/tests/server.test.cjs', '/..%5c..%5cWindows/win.ini']) {
        assert.equal((await request(name)).status, 403);
    }
    assert.equal((await request('/index.html', {}, 'POST')).status, 403);
    assert.equal((await request('/%zz')).status, 400);
    for (const name of ['/missing-file.txt', '/src/index.html', '/public/img/github.svg', '/startup.css', '/package.json']) {
        assert.equal((await request(name)).status, 404, name);
    }
});
test('symbolic links cannot expose files outside the root or protected paths', async t => {
    const dir = fs.mkdtempSync(path.join(root, 'public/img/test-server-link-'));
    const outside = fs.mkdtempSync(path.join(path.dirname(root), 'focustodo-server-'));
    t.after(() => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); });
    fs.writeFileSync(path.join(outside, 'private.txt'), 'private test data');
    try {
        // Windows junctions need no developer-mode or symlink privilege.
        const type = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(outside, path.join(dir, 'outside'), type);
        fs.symlinkSync(path.join(root, 'scripts'), path.join(dir, 'tool'), type);
        fs.symlinkSync(path.join(root, 'public/font'), path.join(dir, 'images'), type);
    } catch (error) {
        if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip('File symlinks unavailable'); return; }
        throw error;
    }
    const prefix = '/img/' + path.basename(dir);
    assert.equal((await request(prefix + '/outside/private.txt')).status, 403);
    assert.equal((await request(prefix + '/tool/server.cjs')).status, 403);
    assert.equal((await request(prefix + '/images/OFL-NotoSans.txt')).status, 200);
});
test('a busy port reports failure and exits instead of claiming startup succeeded', async () => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/server.cjs')], { cwd: path.parse(root).root, env: { ...process.env, FOCUS_PORT: String(server.address().port) }, windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(code, 1); assert.match(output, /EADDRINUSE/); assert.doesNotMatch(output, /http:\/\//);
});
