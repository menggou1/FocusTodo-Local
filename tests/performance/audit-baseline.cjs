const { chromium } = require('playwright');
const { createServer } = require('../../scripts/server.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const baseline = 'f102da8919e810006b6611aabcef5f0159057d61';
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const changed = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src', 'public', 'scripts/server.cjs', 'scripts/runtime-layout.json'], { encoding: 'utf8' }).trim();
if (changed) throw new Error('Baseline runtime differs from ' + baseline + ': ' + changed);

(async () => {
    const output = 'dist/acceptance/audit-a';
    fs.mkdirSync(output, { recursive: true });
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && [
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe'
    ].find(fs.existsSync));
    let browser;
    try {
        browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'], ...(executablePath ? { executablePath } : {}) });
        const results = [];
        for (const locale of ['zh-CN', 'en']) for (const dark of [false, true]) for (let sample = 0; sample < 3; sample++) {
            const context = await browser.newContext({ locale, timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
            try {
                await context.addInitScript(({ locale, dark }) => {
                    localStorage.setItem('FocusTodo.language', locale);
                    localStorage.setItem('DarkMode', String(dark));
                }, { locale, dark });
                await context.route('**/*', route => /^https?:/.test(route.request().url()) && !route.request().url().startsWith(origin) ? route.abort() : route.continue());
                const page = await context.newPage(), errors = [];
                page.on('pageerror', error => errors.push(error.message));
                for (const phase of ['cold', 'reload']) {
                    await page.goto(origin + '/index.html', { waitUntil: 'commit' });
                    await page.waitForFunction(() => window.FocusLocalReady && document.querySelector('[class*=HomeHeader-forest]') && !document.documentElement.classList.contains('focus-starting'));
                    await page.evaluate(() => FocusLocalReady);
                    await page.evaluate(() => document.fonts.ready);
                    const measurement = await page.evaluate(() => ({
                        visibleMs: performance.now(), heap: performance.memory ? performance.memory.usedJSHeapSize : null,
                        metrics: Object.fromEntries(['#root', '.ProjectItem-name-3IyjO', '[class*=HomeHeader-forest]'].map(selector => {
                            const element = document.querySelector(selector);
                            if (!element) return [selector, null];
                            const style = getComputedStyle(element), rect = element.getBoundingClientRect();
                            return [selector, { font: style.font, color: style.color, background: style.backgroundColor, width: rect.width, height: rect.height }];
                        }))
                    }));
                    results.push({ locale, dark, n: sample, phase, ...measurement, errors: [...errors] });
                    if (sample === 0 && phase === 'cold') await page.screenshot({ path: `${output}/${locale}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
                }
            } finally { await context.close(); }
        }
        fs.writeFileSync(output + '/baseline.json', JSON.stringify({
            commit: baseline, browser: browser.version(), node: process.version, platform: os.release(), cpu: os.cpus()[0].model,
            method: 'Fresh context per sample, empty synthetic database, local loopback, external requests blocked, 1280x900 dpr1, 3 samples per locale/theme, same-context reload; visible time includes fonts.ready, heap is sampled JS heap not process peak.', results
        }, null, 2) + '\n');
        if (results.some(result => result.errors.length)) throw new Error('Page errors recorded in baseline.json');
        console.log(`Captured ${results.length} samples with ${browser.version()}`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
