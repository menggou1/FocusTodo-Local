const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

const root = path.resolve(__dirname, '../..');
const evidence = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || path.join(root, 'dist/acceptance'));

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

async function launch(engine) {
    const executablePath = engine === 'chromium' && (process.env.FOCUS_TEST_BROWSER ||
        (!process.env.FOCUS_TEST_BUNDLED_BROWSER && [
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files/Google/Chrome/Application/chrome.exe'
        ].find(fs.existsSync)));
    return playwright[engine].launch({ headless: true, ...(engine==='chromium'?{args:['--mute-audio']}:{ }), ...(executablePath ? { executablePath } : {}) });
}

async function contextFor(browser, origin, options = {}) {
    const context = await browser.newContext({
        locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce', deviceScaleFactor: 1, ...options
    });
    // Headless UI checks must not play alarms or background music on the host.
    // Keep native playback and volume semantics; mute only the output.
    await context.addInitScript(() => {
        const prototype = HTMLMediaElement.prototype;
        const muted = Object.getOwnPropertyDescriptor(prototype, 'muted');
        const play = prototype.play;
        if (muted?.set) {
            Object.defineProperty(prototype, 'muted', { ...muted, set() { muted.set.call(this, true); } });
            prototype.play = function (...args) { muted.set.call(this, true); return play.apply(this, args); };
        }
    });
    const external = [];
    await context.route(url => ['http:', 'https:'].includes(url.protocol) && url.origin !== origin,
        route => { external.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [], requests = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    page.on('requestfailed', request => failed.push({ url: request.url(), error: request.failure()?.errorText }));
    return { context, page, errors, requests, failed, external };
}

function collectFiles(directory, prefix = '') {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const relative = prefix + entry.name;
        return entry.isDirectory() ? collectFiles(path.join(directory, entry.name), relative + '/') : [relative];
    });
}

async function assertNoLegacyRuntime(page, requests) {
    assert.equal(requests.some(url => /\/(?:js\/main\.js|patch\.js)(?:[?#]|$)/.test(url)), false);
    const globals = await page.evaluate(() => Object.keys(window).filter(key => /^Focus(?:Local|Calendar|Settings|Timer|Backup|AppUI|Network)/.test(key)));
    assert.deepEqual(globals, [], 'The candidate must not install legacy runtime globals');
}

module.exports = { assert, fs, path, root, evidence, deferred, launch, contextFor, collectFiles, assertNoLegacyRuntime };
