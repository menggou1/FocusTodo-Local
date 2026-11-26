const test = require('node:test'), assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const python = process.env.PYTHON || ['python3', 'python']
    .find(command => spawnSync(command, ['--version']).status === 0);
const serverArgs = ['scripts/serve-static.py', '--port', '0'];

async function startServer(t, args, connection = {}) {
    const child = spawn(python, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = new Promise(resolve => child.once('close', resolve));
    let stdout = '', stderr = '';
    let phase = 'startup';
    const describe = () => JSON.stringify({
        phase, pid: child.pid, exitCode: child.exitCode, signal: child.signalCode,
        port: connection.port, request: connection.request, stdout: stdout.slice(-1000), stderr: stderr.slice(-2000),
    });
    const onTimeout = () => t.diagnostic('Python fallback state on abort: ' + describe());
    t.signal.addEventListener('abort', onTimeout, { once: true });
    t.after(async () => {
        phase = 'shutdown';
        child.kill();
        await closed;
        t.signal.removeEventListener('abort', onTimeout);
    });
    return new Promise((resolve, reject) => {
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
        child.once('error', reject);
        child.once('close', () => reject(new Error('Python exited before startup: ' + describe())));
        child.stdout.setEncoding('utf8').on('data', chunk => {
            stdout += chunk;
            const match = stdout.match(/127\.0\.0\.1:(\d+)\/index\.html/);
            if (match) {
                phase = 'ready';
                connection.port = Number(match[1]);
                resolve(connection.port);
            }
        });
    });
}

test('Python fallback binds loopback without reverse DNS', { skip: !python, timeout: 10000 }, async t => {
    const rejectReverseLookup = [
        'import runpy, sys',
        'def audit(event, args):',
        '    if event == "socket.gethostbyaddr":',
        '        raise AssertionError("Loopback startup attempted reverse DNS")',
        'sys.addaudithook(audit)',
        'runpy.run_path(sys.argv.pop(1), run_name="__main__")',
    ].join('\n');
    const port = await startServer(t, ['-c', rejectReverseLookup, ...serverArgs]);
    assert(port >= 1 && port <= 65535);
});

test('Python fallback rejects untrusted Hosts and serves uncached GET/HEAD assets', { skip: !python, timeout: 10000 }, async t => {
    const connection = {};
    const port = await startServer(t, serverArgs, connection);
    function request(host, method = 'GET', headers = {}, target = '/index.html') {
        connection.request = { host, method, target, phase: 'request' };
        return new Promise((resolve, reject) => {
            const req = http.request({ host: '127.0.0.1', port, path: target, method, signal: t.signal, headers: { ...headers, Host: host } }, res => {
                connection.request.phase = 'response';
                let size = 0; res.on('data', chunk => { size += chunk.length; });
                res.on('end', () => { connection.request.phase = 'complete'; resolve({ status: res.statusCode, headers: res.headers, size }); });
            }); req.once('error', reject); req.end();
        });
    }
    for (const host of ['attacker.invalid', 'localhost.attacker.invalid', '127.0.0.1.attacker.invalid', 'localhost:bad', 'localhost:0', 'localhost:65536']) {
        for (const method of ['GET', 'HEAD']) assert.equal((await request(host, method)).status, 403, method + ' ' + host);
    }
    for (const host of ['localhost', 'localhost:' + port, '127.0.0.1:' + port]) {
        const get = await request(host), head = await request(host, 'HEAD');
        assert.equal(get.status, 200); assert(get.size > 0);
        assert.equal(head.status, 200); assert.equal(head.size, 0);
        assert.equal(head.headers['content-length'], get.headers['content-length']);
        assert.equal(get.headers['cache-control'], 'no-store');
        assert.equal(get.headers['x-content-type-options'], 'nosniff');
        assert.equal(get.headers['x-frame-options'], 'DENY');
        assert.equal(get.headers['content-security-policy'], "frame-ancestors 'none'");
        assert.equal((await request(host, 'GET', { 'If-Modified-Since': new Date(Date.now() + 86400000).toUTCString() })).status, 200);
    }
    assert.equal((await request('localhost', 'GET', {}, '/index.html?local=1')).status, 200);
    for (const target of ['http://localhost/index.html', '//index.html']) {
        assert.equal((await request('localhost', 'GET', {}, target)).status, 400, target);
    }
});

test('Python launcher validates the manifest against the runtime layout', { skip: !python }, () => {
    const check = [
        'from pathlib import Path',
        'import json, runpy, tempfile',
        'load_manifest = runpy.run_path("scripts/serve-static.py")["load_manifest"]',
        'with tempfile.TemporaryDirectory() as folder:',
        '    root = Path(folder)',
        '    manifest = root / "runtime-manifest.json"',
        '    layout = {"files": ["index.html"], "directories": ["assets"]}',
        '    manifest.write_text(json.dumps({"files": ["index.html", "assets/app.js"]}))',
        '    assert load_manifest(root, layout) == {"index.html", "assets/app.js"}',
        '    for name in ("README.md", "assets/app.js.MAP", "assets/.cache/info", "assets/Tests/info"):',
        '        manifest.write_text(json.dumps({"files": [name]}))',
        '        try:',
        '            load_manifest(root, layout)',
        '        except ValueError:',
        '            continue',
        '        raise AssertionError(name)',
    ].join('\n');
    const result = spawnSync(python, ['-c', check], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
