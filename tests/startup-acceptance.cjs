/* Startup acceptance uses generated data, loopback and independent profiles. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../scripts/server.cjs');
const root = path.resolve(__dirname, '..');
const evidence = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || path.join(root, 'docs/acceptance'));
const results = [];
function gate() {
    let release;
    const promise = new Promise(resolve => { release = resolve; });
    return { promise, release };
}
(async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    fs.mkdirSync(evidence, { recursive: true });
    async function scenario(name, body, options = {}) {
        const started = Date.now();
        const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 800 }, ...options });
        await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            const measurements = await body(page, context);
            if (!options.expectedErrors) assert.deepEqual(errors, []);
            results.push({ name, passed: true, ms: Date.now() - started, ...measurements });
            console.log('PASS ' + name);
        } catch (error) {
            results.push({ name, passed: false, error: error.stack });
            console.error('FAIL ' + name + ': ' + error.stack);
        } finally { await context.close(); }
    }
    const ready = page => page.waitForFunction(() => !document.getElementById('focus-startup') && document.querySelector('#root').firstElementChild && !document.documentElement.classList.contains('focus-starting'));
    try {
        await scenario('first screen paints while CSS and scripts are pending; scripts download in parallel', async page => {
            const css = gate(), catalog = gate(), main = gate(), requested = new Set();
            page.on('request', request => requested.add(new URL(request.url()).pathname));
            await page.route('**/main.css?*', async route => { await css.promise; await route.continue(); });
            await page.route('**/js/local-i18n-catalog.js?*', async route => { await catalog.promise; await route.continue(); });
            await page.route('**/js/main.js?*', async route => { await main.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'commit' });
                await page.locator('#focus-startup-status').waitFor({ state: 'visible' });
                await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length);
                assert(requested.has('/js/main.js'), 'Main download starts before the first dependency finishes');
                assert.equal(await page.locator('#root').evaluate(node => node.children.length), 0);
                await page.screenshot({ path: path.join(evidence, 'startup-loading.png') });
                const firstContentfulPaintMs = await page.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime));
                const initial = Number(await page.locator('progress').getAttribute('value'));
                const totalSteps = await page.locator('progress').evaluate(node => node.max);
                css.release(); catalog.release();
                await page.waitForFunction(() => document.querySelector('progress').value === document.querySelector('progress').max - 2);
                const completedWhileMainPending = await page.locator('progress').evaluate(node => node.value);
                assert(completedWhileMainPending > initial && completedWhileMainPending < totalSteps);
                main.release();
                await ready(page);
                await page.screenshot({ path: path.join(evidence, 'startup-ready.png') });
                return { firstContentfulPaintMs, completedWhileMainPending, totalSteps };
            } finally { css.release(); catalog.release(); main.release(); }
        });
        await scenario('mounted application waits for critical CSS without exposing an unstyled screen', async page => {
            const css = gate();
            await page.route('**/main.css?*', async route => { await css.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => document.querySelector('#root').firstElementChild);
                assert.equal(await page.locator('#root').evaluate(node => getComputedStyle(node).visibility), 'hidden');
                assert(await page.locator('#focus-startup').isVisible());
                css.release(); await ready(page);
                assert.equal(await page.locator('#root').evaluate(node => getComputedStyle(node).visibility), 'visible');
            } finally { css.release(); }
        });
        await scenario('workspace appears before optional images and fonts; Chinese needs no language requests', async page => {
            const optional = gate(), languageRequests = [], optionalRequests = [];
            page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/i18n/')) languageRequests.push(request.url()); });
            await page.route(/\/(img|font)\//, async route => { optionalRequests.push(route.request().url()); await optional.promise; await route.abort(); });
            try {
                await page.goto(origin, { waitUntil: 'domcontentloaded' }); await ready(page);
                assert(optionalRequests.length > 0);
                assert.deepEqual(languageRequests, []);
                assert.equal(await page.locator('#root').getAttribute('aria-busy'), null);
                return { optionalRequestsStillPending: optionalRequests.length, languageRequests: languageRequests.length };
            } finally { optional.release(); }
        });
        await scenario('failed application download offers retry and preserves saved settings', async page => {
            let first = true;
            await page.addInitScript(() => localStorage.setItem('startup-test-preserve', 'saved'));
            await page.route('**/js/main.js?*', route => { if (first) { first = false; return route.abort(); } return route.continue(); });
            await page.goto(origin, { waitUntil: 'domcontentloaded' });
            await page.locator('#focus-startup[data-state="error"]').waitFor();
            assert(await page.getByRole('button', { name: '重新加载', exact: true }).isVisible());
            await page.getByRole('button', { name: '重新加载', exact: true }).click();
            await ready(page);
            assert.equal(await page.evaluate(() => localStorage.getItem('startup-test-preserve')), 'saved');
        });
        await scenario('stylesheet failures retain a visible recovery action', async page => {
            await page.route('**/main.css?*', route => route.abort());
            await page.goto(origin, { waitUntil: 'domcontentloaded' });
            await page.locator('#focus-startup[data-state="error"]').waitFor();
            assert(await page.locator('#focus-startup-retry').isVisible());
            assert.equal(await page.locator('#root').evaluate(node => getComputedStyle(node).visibility), 'hidden');
            await page.screenshot({ path: path.join(evidence, 'startup-error.png') });
        });
        await scenario('initialization exceptions retain retry instead of a permanent blank screen', async page => {
            await page.route('**/js/local-i18n.js?*', route => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("simulated startup failure")' }));
            await page.goto(origin, { waitUntil: 'domcontentloaded' });
            await page.locator('#focus-startup[data-state="error"]').waitFor();
            assert(await page.locator('#focus-startup-retry').isVisible());
        }, { expectedErrors: true });
        await scenario('failed data recovery retains the loading screen and retry without clearing settings', async page => {
            await page.addInitScript(() => {
                localStorage.setItem('startup-test-preserve', 'saved');
                let ready;
                Object.defineProperty(window, 'FocusLocalReady', {
                    configurable: true, get: () => ready,
                    set(value) { ready = Promise.resolve(value).then(() => { throw new Error('simulated recovery failure'); }); }
                });
            });
            await page.goto(origin, { waitUntil: 'domcontentloaded' });
            await page.locator('#focus-startup[data-state="error"]').waitFor();
            assert(await page.locator('#focus-startup-retry').isVisible());
            assert.equal(await page.locator('#root').evaluate(node => node.children.length), 0);
            assert.equal(await page.evaluate(() => localStorage.getItem('startup-test-preserve')), 'saved');
        }, { expectedErrors: true });
        await scenario('long waits show an explanation without inventing progress', async page => {
            const main = gate();
            await page.clock.install();
            await page.route('**/js/main.js?*', async route => { await main.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'commit' });
                await page.waitForFunction(() => document.querySelector('progress')?.value === document.querySelector('progress')?.max - 2);
                await page.clock.fastForward(16000);
                assert.match(await page.locator('#focus-startup-hint').innerText(), /加载比平时久/);
                assert.equal(await page.locator('progress').evaluate(node => node.max - node.value), 2);
                assert(await page.locator('#focus-startup-retry').isVisible());
                main.release(); await ready(page);
            } finally { main.release(); }
        });
        await scenario('saved English, dark appearance, narrow screens and reduced motion work before assets load', async page => {
            const main = gate();
            const languageRequests = [];
            page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/i18n/')) languageRequests.push(request.url()); });
            await page.addInitScript(() => { localStorage.setItem('FocusTodo.language', 'en'); localStorage.setItem('DarkMode', 'true'); });
            await page.route('**/js/main.js?*', async route => { await main.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'commit' });
                await page.getByText('Preparing your focus space', { exact: true }).waitFor();
                assert.equal(await page.locator('#focus-startup').getAttribute('lang'), 'en');
                assert(await page.locator('html').evaluate(node => node.classList.contains('focus-startup-dark')));
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                assert.equal(await page.locator('progress').evaluate(node => getComputedStyle(node, '::-webkit-progress-value').transitionDuration), '0s');
                await page.screenshot({ path: path.join(evidence, 'startup-english-mobile.png') });
                main.release(); await ready(page);
                assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
                assert.deepEqual(languageRequests, []);
            } finally { main.release(); }
        }, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await scenario('existing system-selected locales load asynchronously with an immediate first screen', async page => {
            const language = gate(), languageStarted = gate();
            await page.route('**/i18n/strings*.txt*', async route => { languageStarted.release(); await language.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'domcontentloaded' });
                await languageStarted.promise;
                assert(await page.locator('#focus-startup').isVisible());
                assert.equal(await page.locator('#root').evaluate(node => node.children.length), 0);
                language.release(); await ready(page);
                assert.equal(await page.evaluate(() => window.FocusI18n.locale), 'fr');
            } finally { language.release(); }
        }, { locale: 'fr-CA' });
        await scenario('failed optional language files finish asynchronously with readable English fallback', async page => {
            await page.route('**/i18n/strings*.txt*', route => route.abort());
            await page.goto(origin, { waitUntil: 'domcontentloaded' });
            await ready(page);
            assert.equal(await page.evaluate(() => window.FocusI18n.legacyText('tsk_notification')), 'Notifications');
        }, { locale: 'fr-CA' });
        await scenario('Chinese workspace appears before bundled fonts and swaps to Noto when they finish', async (page, context) => {
            const fonts = gate(), requested = [];
            await page.route('**/font/NotoSansSC-*.ttf', async route => { requested.push(route.request().url()); await fonts.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'domcontentloaded' }); await ready(page);
                assert(requested.length > 0, 'Chinese uses the bundled fonts');
                assert(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Noto Sans SC' && font.status === 'loading')));
                assert.match(await page.locator('#root').evaluate(node => getComputedStyle(node).fontFamily), /^"Noto Sans SC"/);
                fonts.release();
                await page.evaluate(() => document.fonts.ready);
                const client = await context.newCDPSession(page);
                await client.send('DOM.enable'); await client.send('CSS.enable');
                const { root: documentNode } = await client.send('DOM.getDocument');
                const { nodeId } = await client.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector: '[class*="HomeHeader-username"]' });
                const { fonts: rendered } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
                assert(rendered.some(font => font.isCustomFont && /Noto Sans SC/.test(font.familyName)), JSON.stringify(rendered));
                await page.screenshot({ path: path.join(evidence, 'typography-chinese.png') });
                return { bundledFontRequests: requested.length, renderedFonts: rendered.map(font => font.familyName) };
            } finally { fonts.release(); }
        });
        await scenario('English swaps to bundled western font without downloading CJK fonts', async (page, context) => {
            const fonts = gate(), requested = [];
            await page.addInitScript(() => localStorage.setItem('FocusTodo.language', 'en'));
            page.on('request', request => { if (/NotoSansSC-/.test(request.url())) requested.push(request.url()); });
            await page.route('**/font/NotoSans-Variable.ttf', async route => { await fonts.promise; await route.continue(); });
            try {
                await page.goto(origin, { waitUntil: 'domcontentloaded' }); await ready(page);
                assert(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Focus Noto Sans' && font.status === 'loading')));
                fonts.release(); await page.evaluate(() => document.fonts.ready);
                const client = await context.newCDPSession(page);
                await client.send('DOM.enable'); await client.send('CSS.enable');
                const { root: documentNode } = await client.send('DOM.getDocument');
                const { nodeId } = await client.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector: '[class*="HomeHeader-username"]' });
                const { fonts: rendered } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
                assert(rendered.some(font => font.isCustomFont && /Noto Sans/.test(font.familyName)), JSON.stringify(rendered));
                assert.deepEqual(requested, []);
                await page.screenshot({ path: path.join(evidence, 'typography-english.png') });
                return { renderedFonts: rendered.map(font => font.familyName), bundledCjkRequests: requested.length };
            } finally { fonts.release(); }
        });
        await scenario('disabled JavaScript keeps a readable explanation', async page => {
            await page.goto(origin);
            assert(await page.locator('#focus-startup noscript').isVisible());
            assert.match(await page.locator('#focus-startup noscript').innerText(), /Enable JavaScript/);
        }, { javaScriptEnabled: false });
    } finally {
        await browser.close(); await new Promise(resolve => server.close(resolve));
        fs.writeFileSync(path.join(evidence, 'startup-results.json'), JSON.stringify({ version: require('../package.json').version, results }, null, 2) + '\n');
    }
    if (results.some(result => !result.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
