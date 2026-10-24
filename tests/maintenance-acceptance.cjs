/* Dedicated no-Web-Locks maintenance acceptance; isolated origins/profiles only. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); } catch (_) { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const fixture = '<!doctype html><body><script>window.FocusRelease={version:"acceptance"}</script><script src="/js/local-timer-core.js"></script><script src="/js/local-data.js"></script>';
const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); return; }
    const file = path.resolve(root, '.' + req.url);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser = await playwright.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    let count = 0;
    async function scenario(name, body, broadcast = false) {
        const context = await browser.newContext();
        await context.addInitScript(noBroadcast => {
            Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
            if (noBroadcast) Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
        }, !broadcast);
        try { await body(context); console.log('PASS ' + name); count++; } finally { await context.close(); }
    }
    async function page(context) {
        const p = await context.newPage(); await p.goto(url); await p.evaluate(() => window.FocusLocalReady); return p;
    }
    const state = p => p.evaluate(async () => {
        const d = window.FocusLocalData, db = await d.open();
        return d.transaction(db, d.ALL, 'readonly', (tx, done) => {
            const result = {}; let left = d.ALL.length;
            d.ALL.forEach(name => { const q = tx.objectStore(name).getAll(); q.onsuccess = () => { result[name] = q.result; if (!--left) done(result); }; });
        });
    });
    async function prepare(p, name) {
        return p.evaluate(async name => {
            const d = window.FocusLocalData, backup = await d.snapshot();
            backup.indexedDB.Task = [{ id: name, name }]; backup.localStorage.AcceptanceOwner = name; return backup;
        }, name);
    }
    // Delay an already committed journal's transaction-complete callback. The
    // page stays live and retains its dedicated ownership transaction; no
    // production hooks or fake IndexedDB implementation are used.
    async function pauseAfterJournal(p) {
        await p.evaluate(() => {
            const put = IDBObjectStore.prototype.put, complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
            IDBObjectStore.prototype.put = function(value) {
                if (this.name === 'LocalMeta' && value.id === 'settings-journal' && value.phase === 'settings') this.transaction.__acceptanceJournal = true;
                return put.apply(this, arguments);
            };
            Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, get: complete.get, set(fn) {
                complete.set.call(this, event => {
                    if (this.__acceptanceJournal && !window.__acceptancePaused) {
                        window.__acceptancePaused = true; window.__acceptanceRelease = () => fn.call(this, event);
                    } else fn.call(this, event);
                });
            } });
        });
    }
    async function begin(p, target) {
        await p.evaluate(target => { window.__acceptanceOperation = window.FocusLocalData.replace(target, { backup: false }).then(() => ({ ok: true }), e => ({ ok: false, message: e.message })); }, target);
        await p.waitForFunction(() => window.__acceptancePaused);
    }
    async function release(p) { await p.evaluate(() => window.__acceptanceRelease()); return p.evaluate(() => window.__acceptanceOperation); }
    try {
        await scenario('no Web Locks: competing imports serialize without mixed rows or settings', async context => {
            const a = await page(context), b = await page(context), first = await prepare(a, 'first'), second = await prepare(b, 'second');
            await pauseAfterJournal(a); await begin(a, first);
            const marker = (await state(a)).LocalMeta.find(m => m.id === 'maintenance');
            assert.equal(marker.phase, 'settings'); assert(marker.operationId && marker.ownerId);
            await b.evaluate(target => { window.__secondDone = false; window.__second = window.FocusLocalData.replace(target, { backup: false }).then(() => { window.__secondDone = true; return true; }); }, second);
            await b.waitForTimeout(150); assert.equal(await b.evaluate(() => window.__secondDone), false);
            assert.deepEqual((await state(a)).LocalMeta.find(m => m.id === 'maintenance'), marker);
            assert.equal((await release(a)).ok, true); assert.equal(await b.evaluate(() => window.__second), true);
            assert.deepEqual((await state(b)).Task.map(t => t.id), ['second']);
            assert.equal(await b.evaluate(() => localStorage.AcceptanceOwner), 'second'); assert.equal((await state(b)).LocalMeta.length, 0);
        });
        await scenario('no Web Locks: import/reset compete and reset keeps complete prior backup', async context => {
            const a = await page(context), b = await page(context), target = await prepare(a, 'import-before-reset');
            await pauseAfterJournal(a); await begin(a, target);
            await b.evaluate(() => { window.__resetDone = false; window.__reset = window.FocusLocalData.reset().then(backup => { window.__resetDone = true; return backup; }); });
            await b.waitForTimeout(100); assert.equal(await b.evaluate(() => window.__resetDone), false);
            await release(a); const backup = await b.evaluate(() => window.__reset);
            assert.deepEqual(backup.indexedDB.Task.map(t => t.id), ['import-before-reset']);
            const after = await state(b); assert.equal(after.Task.length, 0); assert.equal(after.Project.length, 15); assert.equal(after.LocalMeta.length, 0);
        });
        await scenario('third page cannot clear active marker and legacy/timer writers stay excluded', async context => {
            const a = await page(context), b = await page(context), target = await prepare(a, 'protected');
            await pauseAfterJournal(a); await begin(a, target);
            const before = (await state(a)).LocalMeta;
            const rejected = await b.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open();
                const errors = [];
                for (const fn of [() => d.timerAction({ type: 'tick' }, Date.now()), () => d.putPomodoro({ id: 'blocked' }), () => new Promise((resolve, reject) => {
                    const tx = db.transaction('Task', 'readwrite'); tx.objectStore('Task').put({ id: 'legacy-penetration' }); tx.oncomplete = resolve; tx.onabort = () => reject(new Error('legacy aborted'));
                })]) { try { await fn(); errors.push(false); } catch (_) { errors.push(true); } }
                return errors;
            });
            assert.deepEqual(rejected, [true, true, true]);
            const third = await context.newPage(); await third.goto(url);
            await third.evaluate(() => { window.__thirdReady = false; window.FocusLocalReady.then(() => window.__thirdReady = true); });
            await third.waitForTimeout(150); assert.equal(await third.evaluate(() => window.__thirdReady), false);
            assert.deepEqual((await state(a)).LocalMeta, before);
            await release(a); await third.waitForFunction(() => window.__thirdReady);
            assert.deepEqual((await state(third)).Task.map(t => t.id), ['protected']); assert.equal((await state(third)).LocalMeta.length, 0);
        });
        await scenario('owner page close releases lock and third page completes orphaned journal', async context => {
            const owner = await page(context), target = await prepare(owner, 'owner-closed');
            await pauseAfterJournal(owner); await begin(owner, target);
            const next = await context.newPage(); await next.goto(url);
            await next.evaluate(() => { window.__ready = false; window.FocusLocalReady.then(() => window.__ready = true); });
            await next.waitForTimeout(100); assert.equal(await next.evaluate(() => window.__ready), false);
            await owner.close(); await next.waitForFunction(() => window.__ready);
            assert.deepEqual((await state(next)).Task.map(t => t.id), ['owner-closed']);
            assert.equal(await next.evaluate(() => localStorage.AcceptanceOwner), 'owner-closed'); assert.equal((await state(next)).LocalMeta.length, 0);
        });
        await scenario('settings failure rolls back complete data and allows retry after refresh', async context => {
            const p = await page(context), original = await prepare(p, 'original');
            await p.evaluate(target => window.FocusLocalData.replace(target, { backup: false }), original);
            const before = await p.evaluate(() => window.FocusLocalData.snapshot());
            const target = structuredClone(before); target.indexedDB.Task = [{ id: 'must-rollback' }]; target.localStorage.tooLarge = 'x'.repeat(12 * 1024 * 1024);
            const failure = await p.evaluate(async target => { try { await window.FocusLocalData.replace(target, { backup: false }); } catch (e) { return e.message; } }, target);
            assert.match(failure, /回滚/); assert.deepEqual((await state(p)).Task, before.indexedDB.Task);
            assert.deepEqual(await p.evaluate(() => window.FocusLocalData.storageSnapshot()), before.localStorage); assert.equal((await state(p)).LocalMeta.length, 0);
            await p.reload(); await p.evaluate(() => window.FocusLocalReady);
            const retry = await prepare(p, 'retry-success'); await p.evaluate(target => window.FocusLocalData.replace(target, { backup: false }), retry);
            assert.deepEqual((await state(p)).Task.map(t => t.id), ['retry-success']);
        });
        await scenario('rollback settings failure retains rollback journal until refresh recovery', async context => {
            const p = await context.newPage();
            await p.addInitScript(() => {
                const set = Storage.prototype.setItem;
                Storage.prototype.setItem = function(key, value) {
                    if (window.__failSettings && (key === 'TargetFail' || key === 'OriginalKeep')) throw new Error('Injected settings write failure');
                    return set.apply(this, arguments);
                };
            });
            await p.goto(url); await p.evaluate(() => window.FocusLocalReady);
            await p.evaluate(() => localStorage.setItem('OriginalKeep', 'yes'));
            const target = await prepare(p, 'rejected-target'); target.localStorage.TargetFail = 'true';
            const failure = await p.evaluate(async target => { window.__failSettings = true; try { await window.FocusLocalData.replace(target, { backup: false }); } catch (e) { return e.message; } }, target);
            assert.match(failure, /恢复日志已保留/);
            const interrupted = await state(p); assert.equal(interrupted.Task.length, 0);
            assert.equal(interrupted.LocalMeta.find(m => m.id === 'settings-journal').phase, 'rollback');
            assert.equal(interrupted.LocalMeta.find(m => m.id === 'maintenance').phase, 'rollback');
            await p.reload(); await p.evaluate(() => window.FocusLocalReady);
            assert.equal(await p.evaluate(() => localStorage.OriginalKeep), 'yes'); assert.equal(await p.evaluate(() => localStorage.TargetFail), undefined);
            assert.equal((await state(p)).LocalMeta.length, 0); assert.equal((await state(p)).Task.length, 0);
        });
        await scenario('with BroadcastChannel: active owner marker survives third page boot', async context => {
            const a = await page(context), target = await prepare(a, 'broadcast-safe');
            await pauseAfterJournal(a); await begin(a, target); const marker = (await state(a)).LocalMeta;
            const b = await context.newPage(); await b.goto(url); await b.waitForTimeout(120); assert.deepEqual((await state(a)).LocalMeta, marker);
            await release(a); await b.evaluate(() => window.FocusLocalReady); assert.equal(await b.evaluate(() => window.FocusLocalData.maintenance), false);
        }, true);
    } finally { await browser.close(); server.close(); }
    console.log(`${count} maintenance acceptance scenarios passed`);
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

