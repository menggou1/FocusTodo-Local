/* Optional reproducible cold-start comparison, not a CI performance threshold.
 * node tests/startup-performance.cjs <known baseline commit>
 * Isolated contexts, synthetic network, optional fonts/images aborted equally.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const baselineRef = process.argv[2];
if (!baselineRef) throw new Error('Pass the baseline commit explicitly.');
const baselineCommit = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', baselineRef + '^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const changed = ['index.html', 'main.css', 'js/main.js', 'js/local-i18n.js', 'js/local-release.js', 'patch.js', 'local-ui.css', 'js/local-data.js', 'js/local-backup.js', 'js/local-theme-storage.js', 'js/local-settings-ui.js'];
const baseline = new Map(changed.map(name => [name, execFileSync('git', ['show', baselineCommit + ':' + name], { cwd: root, maxBuffer: 5 * 1024 * 1024 })]));
const cache = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8' };
let mode = 'baseline';
const server = http.createServer((request, response) => {
    let name = new URL(request.url, 'http://localhost').pathname;
    if (!name.startsWith('/FocusTodo-Local/')) { response.writeHead(404); response.end(); return; }
    name = name.slice('/FocusTodo-Local/'.length) || 'index.html';
    if (name.split('/').some(part => part.startsWith('.'))) { response.writeHead(403); response.end(); return; }
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    if (!cache.has(name)) cache.set(name, fs.readFileSync(file));
    const body = mode === 'baseline' && baseline.has(name) ? baseline.get(name) : cache.get(name);
    response.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    response.end(body);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const results = [];
    try {
        for (mode of ['baseline', 'current']) {
            const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } });
            await context.route('**/*', route => {
                const url = route.request().url();
                if (!url.startsWith(origin) || /\/(font|img)\//.test(new URL(url).pathname)) return route.abort();
                return route.continue();
            });
            const page = await context.newPage(), session = await context.newCDPSession(page);
            await session.send('Network.enable');
            await session.send('Network.setCacheDisabled', { cacheDisabled: true });
            await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/FocusTodo-Local/', { waitUntil: 'commit' });
            await page.waitForFunction(() => document.querySelector('#root')?.firstElementChild && getComputedStyle(document.querySelector('#root')).visibility !== 'hidden', null, { timeout: 60000 });
            const workspaceVisibleMs = await page.evaluate(() => Math.round(performance.now()));
            await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length);
            const firstContentfulPaintMs = await page.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime));
            const result = { mode, firstContentfulPaintMs, workspaceVisibleMs, pageErrors: errors };
            results.push(result); console.log(JSON.stringify(result));
            if (errors.length) throw new Error(errors.join('\n'));
            await context.close();
        }
        fs.writeFileSync(path.join(root, 'docs/acceptance/startup-performance.json'), JSON.stringify({
            version: require('../package.json').version, baselineCommit,
            network: { latencyMs: 150, downloadBytesPerSecond: 200 * 1024, uploadBytesPerSecond: 100 * 1024 },
            method: 'One cold isolated Edge/Chromium run per revision, HTTP cache disabled, generated empty database, loopback project subpath. Optional images and fonts aborted equally. Baseline uses committed copies of the changed existing runtime files; unchanged runtime assets are shared. Synthetic network results are not a live GitHub Pages speed guarantee.',
            results
        }, null, 2) + '\n');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
