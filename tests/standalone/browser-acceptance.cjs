/* Independent origins, fresh browser contexts, and generated data only. */
const { assert, fs, path, root, evidence, launch, contextFor, collectFiles, assertNoLegacyRuntime } = require('./helpers.cjs');
const { createStandaloneServer } = require('../../scripts/standalone-server.cjs');
const { createRenderErrorServer } = require('./render-error-server.cjs');
const site = path.join(root, 'dist/standalone/site');
const results = [];
const ready = page => page.getByTestId('app-shell').waitFor();
const startupError = page => page.locator('#prototype-startup[data-state="error"]').waitFor();

async function run(browser, origin, url, name, body, options = {}) {
    const started = Date.now();
    const harness = await contextFor(browser, origin, options.context);
    try {
        await body(harness);
        if (!options.expectedErrors) assert.deepEqual(harness.errors, []);
        assert.deepEqual(harness.external, [], 'The candidate must not request remote runtime resources');
        await assertNoLegacyRuntime(harness.page, harness.requests);
        results.push({ name, passed: true, ms: Date.now() - started });
        console.log('PASS ' + name);
    } catch (error) {
        const diagnostic = await harness.page.evaluate(() => ({
            url: location.href, startup: document.querySelector('#prototype-startup')?.textContent,
            state: document.querySelector('#prototype-startup')?.getAttribute('data-state'),
            root: document.querySelector('#prototype-root')?.textContent?.slice(0, 1000)
        })).catch(() => null);
        results.push({ name, passed: false, error: error.stack, diagnostic, errors: harness.errors, failedRequests: harness.failed });
        await harness.page.screenshot({ path: path.join(evidence, 'standalone-failure-' + results.length + '.png'), timeout: 2000 }).catch(() => {});
        console.error('FAIL ' + name + ': ' + error.stack);
    } finally { await harness.context.close(); }
}

async function main() {
    fs.mkdirSync(evidence, { recursive: true });
    const files = collectFiles(site);
    assert(files.includes('index.html'));
    assert(!files.some(name => name.endsWith('.map')), 'Production maps belong outside the served candidate');
    const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
    const criticalJS = /<script\b[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
    const criticalCSS = /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/.exec(html)?.[1];
    assert(criticalJS && criticalCSS, 'A built module entry and stylesheet are required for startup-failure tests');
    const versions = {};
    const engines = process.env.FOCUS_STANDALONE_ENGINES ? process.env.FOCUS_STANDALONE_ENGINES.split(',').map(value => value.trim()).filter(Boolean) : ['chromium', 'firefox', 'webkit'];
    assert(engines.length && engines.every(engine => ['chromium', 'firefox', 'webkit'].includes(engine)), 'FOCUS_STANDALONE_ENGINES must name chromium, firefox and/or webkit');
    const renderServer = await createRenderErrorServer();
    await new Promise(resolve => renderServer.listen(0, '127.0.0.1', resolve));
    const renderOrigin = 'http://127.0.0.1:' + renderServer.address().port;
    try {
        for (const engine of engines) {
            const browser = await launch(engine);
            versions[engine] = browser.version();
            try {
                for (const basePath of ['/', '/FocusTodo-Local/']) {
                    const server = createStandaloneServer({ root: site, basePath });
                    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
                    const origin = 'http://127.0.0.1:' + server.address().port;
                    const url = origin + basePath;
                    try {
                        for (const locale of ['zh-CN', 'en']) {
                            await run(browser, origin, url, `${engine} ${basePath} ${locale}: cold start without external network`, async ({ page, requests }) => {
                                await page.goto(url, { waitUntil: 'domcontentloaded' });
                                await ready(page);
                                await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
                                assert(await page.locator('.workspace-add-task input').isVisible()); assert.equal(await page.getByTestId('task-row').count(),0);
                                assert.equal(await page.locator('html').getAttribute('lang'), locale);
                                assert.equal(await page.locator('#prototype-startup').isVisible(), false);
                                assert(!requests.some(request => !new URL(request).pathname.startsWith(basePath)), 'Relative resources remain within the mounted project path');
                                const databases = await page.evaluate(() => indexedDB.databases());
                                assert.deepEqual(databases.map(database => [database.name, database.version]).sort(), [
                                    ['FocusTodoStandalone.PomodoroDB6', 3], ['FocusTodoStandalone.PomodoroDB6-maintenance-lock', 1]
                                ], 'Core services open only their isolated schema and ownership databases');
                                assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => !key.startsWith('FocusTodoStandalone.'))), false);
                                await page.screenshot({ path: path.join(evidence, `standalone-${engine}-${locale}-${basePath === '/' ? 'root' : 'subpath'}.png`) });
                            }, { context: { locale } });
                        }

                        if (basePath !== '/') continue;
                        await run(browser, origin, url, engine + ': persisted page lifecycle keeps the restored preview interactive', async ({ page }) => {
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await ready(page);
                            await page.evaluate(() => {
                                dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
                                dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
                            });
                            assert(await page.getByTestId('app-shell').isVisible());
                            await page.locator('[data-view="settings"]').click();
                            await page.locator('.legacy-settings>nav>button').filter({hasText:/^(通用|General)$/}).click(); await page.getByTestId('prototype-language').selectOption('en');
                            await page.waitForFunction(() => document.documentElement.lang === 'en');
                            assert.equal(await page.evaluate(() => localStorage.getItem('FocusTodoStandalone.data.FocusTodo.language')), 'en');
                        });
                        await run(browser, origin, url, engine + ': language, theme, keyboard navigation and reload continuity', async ({ page }) => {
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await ready(page);
                            await page.locator('[data-view="settings"]').focus();
                            await page.keyboard.press('Enter');
                            assert.equal(await page.locator('[data-view="settings"]').getAttribute('aria-current'), 'page');
                            await page.locator('.legacy-settings>nav>button').filter({hasText:/^(通用|General)$/}).click(); await page.getByTestId('prototype-language').selectOption('en');
                            await page.waitForFunction(() => document.documentElement.lang === 'en');
                            if(!await page.getByTestId('prototype-theme').isVisible())await page.getByRole('button',{name:/^(Appearance|外观)$/}).click(); await page.getByTestId('prototype-theme').selectOption('dark');
                            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
                            const darkColor = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
                            await page.getByTestId('prototype-theme').selectOption('light');
                            await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
                            const lightColor = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
                            assert.notEqual(darkColor, lightColor);
                            await page.getByTestId('prototype-theme').selectOption('dark');
                            // C settings commit asynchronously; reload only after the committed snapshot is visible.
                            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && !document.querySelector('[data-testid="prototype-theme"]').disabled);
                            await page.reload({ waitUntil: 'domcontentloaded' });
                            await ready(page);
                            await page.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.dataset.theme === 'dark');
                            assert(await page.locator('.workspace-add-task input').isVisible()); assert.equal(await page.getByTestId('task-row').count(),0);
                            assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => !key.startsWith('FocusTodoStandalone.data.')).sort()), []);
                            await page.screenshot({ path: path.join(evidence, 'standalone-' + engine + '-dark.png') });
                        });
                        await run(browser, origin, url, engine + ': narrow viewport preserves original 1000px desktop canvas', async ({ page }) => {
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await ready(page);
                            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === 1000), true);
                            await page.setViewportSize({width:1280,height:812}); await page.locator('[data-view="settings"]').click();
                            await page.locator('.legacy-settings>nav>button').filter({hasText:/^(通用|General)$/}).click(); await page.getByTestId('prototype-language').selectOption('en');
                            assert(await page.getByTestId('prototype-language').isVisible());
                            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === 1280), true);
                            await page.screenshot({ path: path.join(evidence, 'standalone-' + engine + '-narrow.png') });
                        }, { context: { viewport: { width: 375, height: 812 } } });
                        await run(browser, origin, url, engine + ': unavailable fonts never block usable navigation', async ({ page }) => {
                            await page.route(/\.ttf(?:[?#]|$)/, route => route.abort());
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await ready(page);
                            await page.locator('[data-view="settings"]').click(); await page.locator('.legacy-settings>nav>button').filter({hasText:/^(通用|General)$/}).click();
                            assert(await page.getByTestId('prototype-language').isVisible());
                        });
                        await run(browser, origin, url, engine + ': existing legacy settings are preserved and blocked', async ({ page }) => {
                            await page.addInitScript(() => localStorage.setItem('WorkInterval', '1500'));
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await startupError(page);
                            assert.equal(await page.getByTestId('app-shell').count(), 0);
                            assert.equal(await page.evaluate(() => localStorage.getItem('WorkInterval')), '1500');
                            assert(await page.locator('#prototype-retry').isVisible());
                        });
                        await run(browser, origin, url, engine + ': existing IndexedDB remains unchanged and blocked', async ({ page }) => {
                            // Seed from the same temporary origin before loading any candidate scripts.
                            await page.goto(origin + '/__prototype/session.json');
                            await page.evaluate(() => new Promise((resolve, reject) => {
                                const request = indexedDB.open('PomodoroDB6', 3);
                                request.onupgradeneeded = () => request.result.createObjectStore('sentinel');
                                request.onerror = () => reject(request.error);
                                request.onsuccess = () => {
                                    const db = request.result;
                                    const transaction = db.transaction('sentinel', 'readwrite');
                                    transaction.objectStore('sentinel').put('preserve', 'test');
                                    transaction.oncomplete = () => { db.close(); resolve(); };
                                    transaction.onerror = () => reject(transaction.error);
                                };
                            }));
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await startupError(page);
                            assert.equal(await page.getByTestId('app-shell').count(), 0);
                            assert.equal(await page.evaluate(() => new Promise((resolve, reject) => {
                                const request = indexedDB.open('PomodoroDB6', 3);
                                request.onerror = () => reject(request.error);
                                request.onsuccess = () => {
                                    const db = request.result;
                                    const transaction = db.transaction('sentinel', 'readonly');
                                    const read = transaction.objectStore('sentinel').get('test');
                                    read.onsuccess = () => resolve(read.result);
                                    transaction.oncomplete = () => db.close();
                                };
                            })), 'preserve');
                        });
                        await run(browser, origin, url, engine + ': missing session attestation blocks an ordinary static origin', async ({ page }) => {
                            await page.route('**/__prototype/session.json', route => route.fulfill({ status: 404, body: 'not a prototype origin' }));
                            await page.goto(url, { waitUntil: 'domcontentloaded' });
                            await startupError(page);
                            assert.equal(await page.getByTestId('app-shell').count(), 0);
                        });
                        for (const [kind, resource] of [['module', criticalJS], ['stylesheet', criticalCSS]]) {
                            await run(browser, origin, url, `${engine}: failed ${kind} exposes recovery; reload succeeds`, async ({ page }) => {
                                let fail = true;
                                await page.route(new URL(resource, url).href, route => fail ? route.abort() : route.continue());
                                await page.goto(url, { waitUntil: 'domcontentloaded' });
                                await startupError(page);
                                assert(await page.locator('#prototype-retry').isVisible());
                                assert.equal(await page.getByTestId('app-shell').count(), 0);
                                fail = false;
                                await page.locator('#prototype-retry').click();
                                await ready(page);
                            }, { expectedErrors: true });
                        }
                    } finally { await new Promise(resolve => server.close(resolve)); }
                }
                await run(browser, renderOrigin, renderOrigin + '/', engine + ': React render boundary exposes retry and recovers', async ({ page }) => {
                    await page.goto(renderOrigin + '/', { waitUntil: 'domcontentloaded' });
                    await page.getByTestId('error-boundary').waitFor();
                    assert(!/preview|预览/i.test(await page.getByTestId('error-boundary').innerText()), 'Production recovery wording must not describe an unfinished preview');
                    assert(await page.getByTestId('error-boundary').getByRole('button').isVisible());
                    await page.getByTestId('error-boundary').getByRole('button').click();
                    await page.getByTestId('boundary-recovered').waitFor();
                    assert.equal(await page.getByTestId('error-boundary').count(), 0);
                }, { expectedErrors: true });
            } finally { await browser.close(); }
        }
    } finally {
        await new Promise(resolve => renderServer.close(resolve));
        fs.writeFileSync(path.join(evidence, 'standalone-results.json'), JSON.stringify({
            method: 'Temporary loopback origins and fresh contexts; only external networking is blocked. No service-worker or first-visit Internet-origin offline guarantee. WebKit automation is not real Safari.',
            engines, versions, results
        }, null, 2) + '\n');
    }
    if (results.some(result => !result.passed)) throw new Error('Standalone acceptance failed; see standalone-results.json');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
