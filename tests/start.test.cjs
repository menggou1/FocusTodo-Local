const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { parseArgs, browserCommand } = require('../scripts/start.cjs');
const root = path.resolve(__dirname, '..');

test('launcher options preserve the default storage origin and validate ports', () => {
    assert.deepEqual(parseArgs([], {}), { port: 5500, noBrowser: false, help: false });
    assert.equal(parseArgs([], { FOCUS_PORT: '5511' }).port, 5511);
    assert.deepEqual(parseArgs(['--port', '5512', '--no-browser'], { FOCUS_PORT: '5511' }), { port: 5512, noBrowser: true, help: false });
    for (const args of [['--port'], ['--port', '0'], ['--port', '-1'], ['--port', '65536'], ['--port', '1.5'], ['--port', '1e3'], ['--typo']]) assert.throws(() => parseArgs(args, {}));
});

test('each operating system uses its native browser opener without a shell', () => {
    const url = 'http://127.0.0.1:5500/index.html';
    for (const [platform, command] of [['win32', 'explorer.exe'], ['darwin', 'open'], ['linux', 'xdg-open']]) assert.deepEqual(browserCommand(platform, url), [command, [url]]);
});

test('launcher serves the app from an unrelated working directory and fails on a busy port', { timeout: 15000 }, async t => {
    const reservation = http.createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const args = [path.join(root, 'scripts/start.cjs'), '--port', String(port), '--no-browser'];
    const child = spawn(process.execPath, args, { cwd: path.parse(root).root, windowsHide: true });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => reject(new Error('Unexpected exit: ' + code + '\n' + output)));
        child.stdout.on('data', () => { if (output.includes('/index.html')) resolve(); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /local-release.js/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const busy = spawnSync(process.execPath, args, { cwd: path.parse(root).root, encoding: 'utf8', timeout: 5000 });
    assert.equal(busy.status, 1, busy.stderr);
    assert.match(busy.stderr, /EADDRINUSE/);
    assert.doesNotMatch(busy.stdout, /http:\/\//);
    child.kill();
    await once(child, 'exit');
});

test('Windows wrapper forwards absolute paths, options and the child exit code', { skip: process.platform !== 'win32' }, () => {
    const quoted = path.join(root, 'start.ps1').replace(/'/g, "''");
    const script = `function node { Write-Output ('PROBE:' + ($args -join '|')); $global:LASTEXITCODE=7 }; & '${quoted}' -NoBrowser -Port 5511; exit $LASTEXITCODE`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { cwd: path.parse(root).root, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 7, result.stderr);
    assert(result.stdout.includes('PROBE:' + path.join(root, 'scripts/start.cjs') + '|--port|5511|--no-browser'), result.stdout);
});

test('POSIX wrapper resolves its own location and forwards options', { skip: process.platform === 'win32' }, () => {
    const result = spawnSync('sh', [path.join(root, 'start.sh'), '--help'], { cwd: '/', encoding: 'utf8', timeout: 5000, env: { ...process.env, FOCUS_PORT: '5500' } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: node scripts\/start.cjs/);
    const invalid = spawnSync('sh', [path.join(root, 'start.sh'), '--port', '0'], { cwd: '/', encoding: 'utf8', timeout: 5000 });
    assert.equal(invalid.status, 1);
});
