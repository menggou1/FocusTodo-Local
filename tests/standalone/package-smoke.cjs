/* Exercise both extracted candidates with no npm or Git inside either package. */
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { assert, fs, path, root, evidence, launch, contextFor, assertNoLegacyRuntime } = require('./helpers.cjs');

function start(file, cwd, basePath) {
    const process = spawn(global.process.execPath, [file, '--base', basePath], { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const ready = new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('Extracted server did not start: ' + output)), 10000);
        const receive = data => {
            output += data;
            const match = /http:\/\/127\.0\.0\.1:\d+\/[^\s]*/.exec(output);
            if (match) { clearTimeout(timeout); resolve(match[0]); }
        };
        process.stdout.on('data', receive);
        process.stderr.on('data', receive);
        process.once('error', error => { clearTimeout(timeout); reject(error); });
        process.once('exit', code => { clearTimeout(timeout); reject(new Error('Extracted server exited (' + code + '): ' + output)); });
    });
    return { process, ready };
}

async function stop(child) {
    if (child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
}

(async () => {
    fs.mkdirSync(evidence, { recursive: true });
    const browser = await launch('chromium');
    const results = [];
    try {
        for (const suffix of ['.zip', '.tar.gz']) {
            const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'FocusTodo prototype '));
            let child;
            try {
                const archive = path.join(root, 'dist/standalone/FocusTodo-standalone-prototype' + suffix);
                const unpack = path.join(temporary, 'path with spaces 本地版');
                fs.mkdirSync(unpack);
                const python = global.process.env.FOCUS_TEST_PYTHON || 'python';
                execFileSync(python, [path.join(__dirname, 'extract.py'), archive, unpack], { encoding: 'utf8', windowsHide: true });
                const extracted = path.join(unpack, 'FocusTodo-standalone-prototype');
                assert(!fs.existsSync(path.join(extracted, 'node_modules')));
                assert(!fs.existsSync(path.join(extracted, '.git')));
                const basePath = '/FocusTodo-Local/';
                const running = start(path.join(extracted, 'start.cjs'), temporary, basePath);
                child = running.process;
                const url = await running.ready;
                assert.equal(new URL(url).pathname.startsWith(basePath), true);
                const harness = await contextFor(browser, new URL(url).origin);
                try {
                    await harness.page.goto(url, { waitUntil: 'domcontentloaded' });
                    await harness.page.getByTestId('app-shell').waitFor();
                    assert(await harness.page.locator('.workspace-empty').isVisible());
                    const icon = await harness.page.locator('link[rel=icon]').getAttribute('href');
                    assert.match(icon, /^\.\/assets\/focus-app-.*\.ico$/);
                    const iconURL = new URL(icon, url);
                    assert(iconURL.pathname.startsWith(basePath));
                    const response = await harness.page.request.get(iconURL.href);
                    assert.equal(response.status(), 200);
                    assert((await response.body()).equals(fs.readFileSync(path.join(root, 'public/focus-app.ico'))));
                    const input = harness.page.locator('.workspace-add-task input');
                    await input.fill('Extracted candidate task'); await input.press('Enter');
                    await harness.page.getByTestId('task-row').getByText('Extracted candidate task', { exact: true }).waitFor();
                    await harness.page.reload(); await harness.page.getByTestId('task-row').getByText('Extracted candidate task', { exact: true }).waitFor();
                    assert.deepEqual(harness.errors, []);
                    assert.deepEqual(harness.external, []);
                    await assertNoLegacyRuntime(harness.page, harness.requests);
                    await harness.page.screenshot({ path: path.join(evidence, suffix === '.zip' ? 'standalone-extracted-zip.png' : 'standalone-extracted-tar.png') });
                    results.push({ archive: path.basename(archive), passed: true, externalNetworkBlocked: true, pathWithSpacesAndUnicode: true });
                    console.log('PASS extracted ' + suffix + ': offline local resources, project subpath, spaces and Unicode, no npm or Git');
                } finally { await harness.context.close(); }
            } finally {
                if (child) await stop(child);
                // Only this test's mkdtemp directory is removed; package inputs are retained.
                assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
                assert(path.basename(temporary).startsWith('FocusTodo prototype '));
                fs.rmSync(temporary, { recursive: true, force: true });
            }
        }
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(evidence, 'standalone-package-results.json'), JSON.stringify(results, null, 2) + '\n');
    }
})().catch(error => { console.error(error); global.process.exitCode = 1; });
