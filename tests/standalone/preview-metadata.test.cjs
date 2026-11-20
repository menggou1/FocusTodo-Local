const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');

test('long-running HMR reads current release metadata while builds reject stale generated metadata', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'focus-preview-version-'));
    let server;
    t.after(async () => {
        try { await server?.close(); }
        finally { await fs.rm(directory, { recursive: true, force: true }); }
    });
    const files = ['vite.standalone.config.mjs', 'standalone/services/scoped-storage.mjs', 'scripts/build-standalone.mjs'];
    for (const file of files) {
        const destination = path.join(directory, file);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(path.join(root, file), destination);
    }
    await fs.symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir');
    await fs.writeFile(path.join(directory, 'standalone/index.html'), '<title>FocusTodo __FOCUS_APP_TITLE__</title>');
    const version = '2.80.0', nextVersion = '2.80.1';
    const generated = { localVersion: version, officialVersion: '7.1.1', development: false };
    const generatedPath = path.join(directory, 'standalone/app-version.json');
    const releasePath = path.join(directory, 'release.json');
    const writeRelease = localVersion => fs.writeFile(releasePath, JSON.stringify({ ...generated, localVersion }));
    await fs.writeFile(generatedPath, JSON.stringify(generated));
    await writeRelease(version);

    const { createServer } = await import('vite');
    server = await createServer({
        root: path.join(directory, 'standalone'),
        configFile: path.join(directory, 'vite.standalone.config.mjs'),
        cacheDir: path.join(directory, 'vite-cache'),
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { host: '127.0.0.1', port: 0, strictPort: true, ws: false },
    });
    await server.listen();
    const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
    const html = async () => {
        const response = await fetch(origin);
        assert.equal(response.status, 200);
        return response.text();
    };
    assert((await html()).includes('<title>FocusTodo 2.80.0 — Preview</title>'));
    await writeRelease(nextVersion);
    assert((await html()).includes('<title>FocusTodo 2.80.1 — Preview</title>'));
    assert.deepEqual(JSON.parse(await fs.readFile(generatedPath, 'utf8')), generated);

    const build = spawnSync(process.execPath, [path.join(directory, 'scripts/build-standalone.mjs'), '--production'],
        { encoding: 'utf8', windowsHide: true });
    assert.equal(build.status, 1);
    assert.match(build.stderr, /Release metadata is out of sync\. Run npm run build:release\./);
});
