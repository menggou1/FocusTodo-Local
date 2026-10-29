/* Isolated browser checks for real Web Locks and explicit capability fallback.
 * Audio is a test double: these checks prove ownership, not audible output. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const modulePath = path.join(__dirname, '../js/local-timer-ui.js');
const server = http.createServer((request, response) => {
    if (request.url === '/audio.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        response.end(fs.readFileSync(modulePath));
    } else {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><html><body><script src="/audio.js"></script></body></html>');
    }
});
const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
].find(fs.existsSync));

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const errors = [], results = [];
    async function context(mode) {
        const value = await browser.newContext();
        await value.addInitScript(mode => {
            if (mode === 'missing') Object.defineProperty(navigator, 'locks', { value: undefined });
            if (mode === 'throw' || mode === 'reject') Object.defineProperty(navigator, 'locks', { value: {
                request() {
                    window.__requests = (window.__requests || 0) + 1;
                    if (mode === 'throw') throw new Error('coordination unavailable');
                    return Promise.reject(new Error('coordination unavailable'));
                }
            } });
            window.__audio = [];
            window.Audio = class {
                constructor(src) { this.src = src; this.dataset = {}; this.paused = true; window.__audio.push(this); }
                play() { this.paused = false; return Promise.resolve(); }
                pause() { this.paused = true; }
                load() {}
                removeAttribute(name) { if (name === 'src') this.src = ''; }
            };
        }, mode);
        value.on('page', page => page.on('pageerror', error => errors.push(error.message)));
        return value;
    }
    async function page(value) {
        const result = await value.newPage(); await result.goto(url);
        await result.evaluate(() => {
            window.__preference = { bgMusic: 'bgm_Rain', whiteNoiseVolume: 50 };
            window.__player = { timerState: 'work' };
            FocusLocal.attachAudio(window.__player, window.__preference);
        });
        return result;
    }
    const active = value => value.evaluate(() => __audio.filter(audio => audio.loop && !audio.paused).length);
    const start = value => value.evaluate(() => __player.startBgm('work'));
    async function check(name, body) { await body(); results.push(name); console.log('PASS ' + name); }
    try {
        await check('missing Web Locks leaves startup silent and explains the safe downgrade once when requested', async () => {
            const value = await context('missing');
            try {
                const first = await page(value), second = await page(value);
                assert.equal(await first.locator('#focus-local-notice').count(), 0);
                await Promise.all([start(first), start(second)]);
                assert.equal(await active(first) + await active(second), 0);
                assert.match(await first.locator('#focus-local-notice').innerText(), /不支持多标签页背景音协调/);
                await first.locator('#focus-local-notice').waitFor({ state: 'detached', timeout: 8000 });
                await start(first);
                assert.equal(await first.locator('#focus-local-notice').count(), 0);
                await first.evaluate(() => { __player.startAudition('bgm_Rain.m4a', 0.5); __player.start('alarm_Bell.mp3', 1); });
                assert.equal(await first.evaluate(() => __audio.filter(audio => !audio.loop && !audio.paused).length), 2);
                await first.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                assert.equal(await first.evaluate(() => __audio.filter(audio => !audio.paused).length), 0);
            } finally { await value.close(); }
        });
        await check('queued Web Locks give one owner and immediate handoff on pagehide', async () => {
            const value = await context();
            try {
                const first = await page(value), second = await page(value);
                await start(first); await first.waitForFunction(() => __audio.some(audio => audio.loop && !audio.paused));
                await start(second);
                await second.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1);
                assert.equal(await active(first) + await active(second), 1);
                await first.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                await second.waitForFunction(() => __audio.some(audio => audio.loop && !audio.paused));
                assert.equal(await active(first), 0); assert.equal(await active(second), 1);
                await first.evaluate(() => window.dispatchEvent(new Event('pageshow')));
                await first.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1);
                await second.evaluate(() => __player.stopBgm());
                await first.waitForFunction(() => __audio.some(audio => audio.loop && !audio.paused));
                assert.equal(await active(first) + await active(second), 1);
                await first.evaluate(() => __player.startBgm('pause'));
                await first.waitForFunction(async () => (await navigator.locks.query()).held.length === 0);
                assert.equal(await active(first) + await active(second), 0);
            } finally { await value.close(); }
        });
        await check('cancelled waiter stays silent after owner closes and can request ownership again', async () => {
            const value = await context();
            try {
                const first = await page(value), second = await page(value);
                await start(first); await first.waitForFunction(() => __audio.some(audio => audio.loop && !audio.paused));
                await start(second);
                await second.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1);
                await second.evaluate(() => { __player.stopBgm(); __player.startBgm(); });
                await second.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1);
                await second.evaluate(() => __player.stopBgm());
                await second.waitForFunction(async () => (await navigator.locks.query()).pending.length === 0);
                await first.close();
                await second.waitForFunction(async () => (await navigator.locks.query()).held.length === 0);
                assert.equal(await active(second), 0);
                await start(second); await second.waitForFunction(() => __audio.some(audio => audio.loop && !audio.paused));
                assert.equal(await active(second), 1);
                await second.evaluate(() => { __preference.bgMusic = 'bgm_Forest'; __player.startBgm(); });
                await second.waitForFunction(() => __audio.some(audio => audio.loop && !audio.paused && audio.dataset.name === 'bgm_Forest'));
                assert.equal(await active(second), 1);
            } finally { await value.close(); }
        });
        for (const mode of ['throw', 'reject']) await check('lock request ' + mode + ' fails closed without an infinite retry', async () => {
            const value = await context(mode);
            try {
                const first = await page(value); await start(first);
                await first.locator('#focus-local-notice').waitFor();
                assert.match(await first.locator('#focus-local-notice').innerText(), /背景音协调不可用/);
                await first.evaluate(() => { for (let count = 0; count < 20; count++) __player.startBgm(); });
                assert.equal(await active(first), 0);
                assert.equal(await first.evaluate(() => __requests), 1);
                await first.evaluate(() => __player.startAudition('bgm_Rain.m4a', 0.5));
                assert.equal(await first.evaluate(() => __audio.filter(audio => !audio.paused).length), 1);
            } finally { await value.close(); }
        });
        assert.deepEqual(errors, [], 'No unhandled page errors');
        console.log(`Audio coordination: ${results.length} checks passed.`);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
