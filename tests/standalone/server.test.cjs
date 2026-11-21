const test = require('node:test');
const http = require('node:http');
const os = require('node:os');
const { assert, fs, path } = require('./helpers.cjs');
const { createStandaloneServer } = require('../../scripts/standalone-server.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'FocusTodo server tests '));
let server, port;

test.before(async () => {
    fs.mkdirSync(path.join(temporary, 'assets'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><title>Generated server fixture</title>');
    fs.writeFileSync(path.join(temporary, 'assets', 'entry.js'), 'export const fixture = true;');
    fs.writeFileSync(path.join(temporary, 'assets', 'entry.js.map'), '{"sourcesContent":["private debug fixture"]}');
    fs.writeFileSync(path.join(temporary, 'assets', 'font.ttf'), 'font MIME fixture');
    fs.writeFileSync(path.join(temporary, 'assets', 'icon.png'), 'icon MIME fixture');
    fs.writeFileSync(path.join(temporary, 'runtime-manifest.json'), JSON.stringify({ files: ['index.html', 'assets/entry.js', 'assets/font.ttf', 'assets/icon.png'] }));
    server = createStandaloneServer({ root: temporary, basePath: '/FocusTodo-Local/' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
});
test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert(path.basename(temporary).startsWith('FocusTodo server tests '));
    fs.rmSync(temporary, { recursive: true, force: true });
});

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const pending = http.request({ hostname: '127.0.0.1', port, path: url, ...options }, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
        });
        pending.on('error', reject);
        pending.end();
    });
}

test('candidate server attests its exact origin and serves the explicit project-path manifest', async () => {
    const session = await request('/FocusTodo-Local/__prototype/session.json');
    assert.equal(session.status, 200);
    assert.deepEqual(JSON.parse(session.body), { kind: 'isolated-prototype', origin: 'http://127.0.0.1:' + port });
    assert.equal((await request('/FocusTodo-Local/__prototype/session.json', { method: 'HEAD' })).body, '');
    const home = await request('/FocusTodo-Local/');
    assert.equal(home.status, 200);
    assert(home.body.includes('Generated server fixture'));
    assert.equal(home.headers['x-frame-options'], 'DENY');
    assert.equal(home.headers['content-security-policy'], "frame-ancestors 'none'");
    const asset = await request('/FocusTodo-Local/assets/entry.js');
    assert.equal(asset.status, 200);
    assert.equal(asset.headers['cache-control'], 'no-store');
    assert.equal(asset.headers['x-content-type-options'], 'nosniff');
    assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal((await request('/FocusTodo-Local/assets/font.ttf')).headers['content-type'], 'font/ttf');
    assert.equal((await request('/FocusTodo-Local/assets/icon.png')).headers['content-type'], 'image/png');
});

test('candidate server excludes source maps, checkout files and resources outside its mount', async () => {
    for (const name of [
        '/', '/index.html', '/assets/entry.js', '/FocusTodo-Local/assets/entry.js.map',
        '/FocusTodo-Local/scripts/standalone-server.cjs', '/FocusTodo-Local/.git/config',
        '/FocusTodo-Local/%00', '/FocusTodo-Local/assets%5Centry.js', '/FocusTodo-Local/%ZZ'
    ]) assert.notEqual((await request(name)).status, 200, name);
    assert.equal((await request('/FocusTodo-Local/', { method: 'POST' })).status, 403);
    assert.equal((await request('/FocusTodo-Local/', { headers: { Host: 'attacker.example:' + port } })).status, 403);
    assert.equal((await request('/FocusTodo-Local/', { headers: { Host: '127.0.0.1:65536' } })).status, 403);
    assert.throws(() => createStandaloneServer({ root: temporary, basePath: '/unsafe/../' }), /Invalid prototype base path/);
});

test('candidate accepts only a single loopback Host and origin-form targets', async () => {
    const base = '/FocusTodo-Local/';
    assert.equal((await request(base + '?local=1', { headers: { Host: 'localhost:' + port } })).status, 200);
    assert.equal((await request(base, { headers: ['Host', 'localhost', 'Host', '127.0.0.1'] })).status, 403);
    for (const target of ['http://localhost' + base, '//' + base.slice(1)]) {
        assert.equal((await request(target)).status, 400, target);
    }
});
