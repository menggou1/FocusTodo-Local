const test = require('node:test'), assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const python = process.env.PYTHON || ['python3', 'python']
    .find(command => spawnSync(command, ['--version']).status === 0);
test('Python fallback rejects untrusted Hosts and serves uncached GET/HEAD assets', { skip: !python, timeout: 10000 }, async t => {
    const child = spawn(python, ['scripts/serve-static.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = new Promise(resolve => child.once('close', resolve));
    t.after(async () => { child.kill(); await closed; });
    const ready = new Promise((resolve, reject) => {
        let stdout = '', stderr = '';
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
        child.once('error', reject);
        child.once('close', (code, signal) => reject(new Error(`Python exited before startup (${code ?? signal}): ${stderr.trim()}`)));
        child.stdout.setEncoding('utf8').on('data', chunk => {
            stdout += chunk;
            const match = stdout.match(/127\.0\.0\.1:(\d+)\/index\.html/);
            if (match) resolve(Number(match[1]));
        });
    });
    const port = await ready;
    function request(host, method = 'GET', headers = {}) {
        return new Promise((resolve, reject) => {
            const req = http.request({ host: '127.0.0.1', port, path: '/index.html', method, headers: { ...headers, Host: host } }, res => {
                let size = 0; res.on('data', chunk => { size += chunk.length; });
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, size }));
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
        assert.equal((await request(host, 'GET', { 'If-Modified-Since': new Date(Date.now() + 86400000).toUTCString() })).status, 200);
    }
});
