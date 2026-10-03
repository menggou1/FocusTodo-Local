/* Runs against an ephemeral loopback server and fresh browser profile only. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
function playwright() {
    try { return require('playwright'); } catch (_) {
        const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
        return require(bundled);
    }
}
const root = path.resolve(__dirname, '..');
const release = require('../release.json');
const releaseVersion = release.officialVersion + '-local.' + release.localVersion;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
const server = http.createServer((request, response) => {
    let name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (name === '/') name = '/index.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const executablePath = process.env.FOCUS_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await playwright().chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const failures = [], results = [];
    fs.mkdirSync(path.join(root, 'docs/acceptance'), { recursive: true });
    async function app(testBody, beforeLoad, baseUrl = url) {
        const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 } });
        const errors = [], external = [];
        await context.addInitScript(() => {
            let api;
            Object.defineProperty(window, 'FocusLocal', { configurable: true, get: () => api, set(value) {
                api = value; const attach = value.attachTimer;
                value.attachTimer = function(timer, options) { window.__acceptanceTimer = timer; window.__acceptanceOptions = options; return attach(timer, options); };
                const audio = value.attachAudio;
                value.attachAudio = function(player, preference) { window.__acceptanceAudio = { player, preference }; return audio(player, preference); };
            } });
        });
        await context.route('**/*', route => {
            if (!route.request().url().startsWith(baseUrl) && /^https?:/.test(route.request().url())) { external.push(route.request().url()); return route.abort(); }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.stack || error.message));
        page.on('dialog', dialog => dialog.accept());
        try {
            if (beforeLoad) { await page.goto(baseUrl + '/tests/storage-fixture.html'); await beforeLoad(page); }
            await page.goto(baseUrl);
            await page.waitForFunction(() => window.__acceptanceTimer && document.querySelector('#root').children.length > 0);
            await page.evaluate(() => window.FocusLocalReady);
            await testBody(page, context, errors, external);
            assert.deepEqual(errors, [], 'No unhandled browser errors');
        } finally { await context.close(); }
    }
    async function check(name, fn) {
        if (process.env.FOCUS_TEST_FILTER && !name.includes(process.env.FOCUS_TEST_FILTER)) return;
        const started = Date.now();
        try { await fn(); console.log('PASS ' + name); results.push({ name, passed: true, ms: Date.now() - started }); }
        catch (error) { console.error('FAIL ' + name + ': ' + error.stack); failures.push(name + ': ' + error.message); results.push({ name, passed: false, error: error.message }); }
    }
    async function begin(page) {
        await page.evaluate(() => window.__acceptanceTimer.localTimer.run('start', { mode: 'countup', taskId: '', subtaskId: '', config: { interval: 3600 } }));
    }
    async function age(page, minutes) {
        return page.evaluate(async minutes => {
            const data = window.FocusLocalData, db = await data.open(), anchor = Date.now() - minutes * 60000;
            await data.transaction(db, ['TimerSession'], 'readwrite', tx => {
                const store = tx.objectStore('TimerSession'), req = store.get('active');
                req.onsuccess = () => { const s = req.result; s.cursorAt = anchor; s.observedAt = anchor; store.put(s); };
            });
            return anchor;
        }, minutes);
    }
    const snapshot = page => page.evaluate(() => window.FocusLocalData.snapshot());
    try {
        await check('fresh app starts without external requests', () => app(async (page, context, errors, external) => {
            await page.waitForTimeout(1200);
            assert.match(await page.locator('body').innerText(), /本地用户/); assert.deepEqual(external, []);
            await page.screenshot({ path: path.join(root, 'docs/acceptance/app.png'), fullPage: true });
        }));
        await check('production loopback server boots the app and serves seekable local M4A audio', async () => {
            const production = require('../scripts/server.cjs').createServer();
            await new Promise(resolve => production.listen(0, '127.0.0.1', resolve));
            const address = `http://127.0.0.1:${production.address().port}`;
            try {
                await app(async (page, context, errors, external) => {
                    assert.match(await page.locator('body').innerText(), /本地用户/);
                    assert.deepEqual(external, []);
                    const name = fs.readdirSync(path.join(root, 'audio')).find(name => name.endsWith('.m4a'));
                    const response = await context.request.get(address + '/audio/' + name, { headers: { Range: 'bytes=0-15' } });
                    assert.equal(response.status(), 206); assert.equal(response.headers()['content-type'], 'audio/mp4');
                    assert.deepEqual(await response.body(), fs.readFileSync(path.join(root, 'audio', name)).subarray(0, 16));
                }, null, address);
            } finally { await new Promise(resolve => production.close(resolve)); }
        });
        await check('About displays canonical versions and Git remote; rating and update notes are absent', () => app(async (page, context) => {
            await page.mouse.click(1255, 25);
            await page.getByText('关于', { exact: true }).click();
            await page.locator('#lexible-about-info-row').waitFor();
            assert((await page.locator('[class*="AboutSettings-root"]').innerText()).includes(releaseVersion));
            assert.match(await page.locator('#lexible-about-info-row').innerText(), /Lexible · 2026-10-03/);
            assert.match(await page.locator('#lexible-about-info-row').innerText(), /官方 7\.1\.1 · 本地 1\.1\.0/);
            const repository = page.locator('#lexible-about-info-row a');
            assert.equal(await repository.getAttribute('href'), 'https://github.com/menggou1/FocusTodo-Local');
            assert.equal(await repository.getAttribute('rel'), 'noopener noreferrer');
            assert.equal(await repository.getAttribute('title'), 'https://github.com/menggou1/FocusTodo-Local');
            assert.equal(await repository.locator('img').getAttribute('src'), 'img/github.svg');
            assert.equal(await repository.locator('img').getAttribute('alt'), 'GitHub');
            assert.doesNotMatch(await page.locator('[class*="AboutSettings-root"]').innerText(), /给予好评|立即评分|更新内容/);
            assert.equal(await page.locator('.lexible-release-notes').count(), 0);
            await page.screenshot({ path: path.join(root, 'docs/acceptance/about.png'), fullPage: true });
            await context.route('https://github.com/menggou1/FocusTodo-Local', route => route.fulfill({ contentType: 'text/html', body: '<title>Repository link acceptance</title>' }));
            const opened = page.waitForEvent('popup'); await repository.click(); const popup = await opened;
            await popup.waitForLoadState(); assert.equal(popup.url(), 'https://github.com/menggou1/FocusTodo-Local'); await popup.close();
        }));
        await check('notification bell contains update details and preserves task reminders', () => app(async page => {
            const input = page.getByPlaceholder(/添加一个任务/); await input.fill('原任务提醒保留'); await input.press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            await page.evaluate(async () => {
                const data = window.FocusLocalData, db = await data.open();
                const task = (await data.snapshot()).indexedDB.Task[0]; task.reminderDate = Date.now() - 60000;
                await data.transaction(db, ['Task'], 'readwrite', tx => tx.objectStore('Task').put(task));
            });
            const bell = page.getByRole('button', { name: '通知', exact: true });
            await bell.focus(); await bell.press('Enter');
            await page.locator('#notification-popover').waitFor();
            assert.match(await page.locator('#notification-popover').innerText(), /原任务提醒保留/);
            const panel = await page.locator('.focus-notification-panel').boundingBox();
            const reminders = await page.locator('[class*="NotificationDialog-items"]').boundingBox();
            assert(panel && reminders && reminders.y + reminders.height <= panel.y + panel.height + 1, 'Reminders remain inside the resized notification panel');
            assert.equal(await page.locator('.focus-release-entry').count(), release.updates.length);
            assert(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()));
            await page.waitForTimeout(400);
            await page.screenshot({ path: path.join(root, 'docs/acceptance/notifications.png'), fullPage: true });
            await page.getByRole('button', { name: /通知中心与本地数据管理更新/ }).click();
            await page.locator('#focus-update-dialog').waitFor();
            assert((await page.locator('#focus-update-dialog').innerText()).includes(releaseVersion));
            assert.match(await page.locator('#focus-update-dialog').innerText(), /等待 5 秒/);
            assert.equal(await page.locator('#focus-update-dialog a').count(), 0, 'User-facing updates do not expose maintenance reports');
            assert.doesNotMatch(await page.locator('#focus-update-dialog').innerText(), /Markdown|验收报告/);
            assert.equal(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()), false);
            await page.screenshot({ path: path.join(root, 'docs/acceptance/update-details.png'), fullPage: true });
            await page.getByRole('button', { name: '关闭', exact: true }).click();
            await page.locator('#focus-update-dialog').waitFor({ state: 'detached' });
            await page.reload(); await page.waitForFunction(() => window.FocusAppUI && window.__acceptanceTimer);
            assert.equal(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()), false);
        }));
        await check('older update details close on Escape and do not mark the latest update as read', () => app(async page => {
            await page.getByRole('button', { name: '通知', exact: true }).click();
            await page.getByRole('button', { name: /计时恢复与数据安全修补/ }).click();
            await page.locator('#focus-update-dialog').waitFor();
            assert(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()));
            await page.keyboard.press('Escape');
            await page.locator('#focus-update-dialog').waitFor({ state: 'detached' });
            await page.getByRole('button', { name: '通知', exact: true }).click();
            await page.getByRole('button', { name: /通知中心与本地数据管理更新/ }).click();
            await page.locator('#focus-update-dialog').waitFor();
            await page.keyboard.press('Shift+Tab');
            const focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, inDialog: !!document.activeElement.closest('#focus-update-dialog') }));
            assert.equal(focused.tag, 'BUTTON'); assert(focused.inDialog);
        }));
        async function openReset(page) {
            await page.mouse.click(1255, 25);
            await page.getByText('账号', { exact: true }).click();
            await page.locator('[class*="AccountSettings-root"]').getByText('删除数据', { exact: true }).click();
            await page.locator('#focus-reset-dialog').waitFor();
        }
        await check('UI delete waits five seconds, needs no password, and cancel preserves data', () => app(async page => {
            await page.getByPlaceholder(/添加一个任务/).fill('删除取消验收');
            await page.getByPlaceholder(/添加一个任务/).press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            const before = await snapshot(page);
            await openReset(page);
            assert.equal(await page.locator('#focus-reset-dialog input').count(), 0);
            const confirm = page.locator('#focus-reset-dialog .focus-app-danger'); assert(await confirm.isDisabled());
            // Even a synthetic click must not bypass the deadline.
            await confirm.dispatchEvent('click');
            assert.deepEqual((await snapshot(page)).indexedDB.Task, before.indexedDB.Task);
            await page.waitForTimeout(4100); assert(await confirm.isDisabled());
            await page.getByRole('button', { name: '取消', exact: true }).click();
            await page.locator('#focus-reset-dialog').waitFor({ state: 'detached' });
            assert.deepEqual((await snapshot(page)).indexedDB.Task, before.indexedDB.Task);
            await page.locator('[class*="AccountSettings-root"]').getByText('删除数据', { exact: true }).click();
            assert.match(await page.locator('#focus-reset-dialog .focus-app-danger').innerText(), /5 秒/);
            await page.screenshot({ path: path.join(root, 'docs/acceptance/reset-confirm.png'), fullPage: true });
        }));
        await check('UI delete downloads a full backup before clearing and reloads only after success', () => app(async page => {
            await createActiveTask(page, 'countup');
            await page.evaluate(() => window.__acceptanceTimer.zoomDown());
            await openReset(page);
            const confirm = page.locator('#focus-reset-dialog .focus-app-danger');
            await page.waitForFunction(() => !document.querySelector('#focus-reset-dialog .focus-app-danger').disabled);
            const downloaded = page.waitForEvent('download');
            await confirm.click();
            const download = await downloaded; const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
            assert.equal(saved.meta.app, 'FocusTodo'); assert.equal(saved.meta.patch, releaseVersion);
            assert.equal(saved.indexedDB.Task.length, 1); assert.equal(saved.indexedDB.TimerSession.length, 1);
            await page.waitForFunction(() => window.__acceptanceTimer && !document.getElementById('focus-reset-dialog'));
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 0);
            const after = await snapshot(page);
            assert.equal(after.indexedDB.Pomodoro.length, 0); assert.equal(after.indexedDB.TimerSession.length, 0);
            assert.equal(await page.locator('input[type=password]').count(), 0);
        }));
        await check('failed UI delete reports failure, keeps the dialog and rolls data back', () => app(async page => {
            await createActiveTask(page, 'countup'); await page.evaluate(() => window.__acceptanceTimer.zoomDown());
            const original = await snapshot(page); await openReset(page);
            await page.waitForFunction(() => !document.querySelector('#focus-reset-dialog .focus-app-danger').disabled);
            await page.evaluate(() => {
                const clear = IDBObjectStore.prototype.clear;
                IDBObjectStore.prototype.clear = function() { if (this.name === 'Task') throw new Error('Injected reset abort'); return clear.apply(this, arguments); };
                window.__restoreResetClear = () => { IDBObjectStore.prototype.clear = clear; };
            });
            await page.locator('#focus-reset-dialog .focus-app-danger').click();
            await page.getByText(/删除未完成，请重试：Injected reset abort/).waitFor();
            assert.deepEqual((await snapshot(page)).indexedDB.Task, original.indexedDB.Task);
            assert.equal(await page.locator('#focus-reset-dialog').count(), 1);
            await page.evaluate(() => window.__restoreResetClear());
            await page.getByRole('button', { name: '取消', exact: true }).click();
        }));
        await check('task creation, switching intervals and completing the active task through legacy UI', () => app(async page => {
            const input = page.getByPlaceholder(/添加一个任务/);
            await input.fill('验收任务 A'); await input.press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            await input.fill('验收任务 B'); await input.press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 2);
            const ids = await page.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open(), tasks = (await d.snapshot()).indexedDB.Task;
                const a = tasks.find(t => t.name === '验收任务 A'), b = tasks.find(t => t.name === '验收任务 B');
                a.pomodoroInterval = 3600; b.pomodoroInterval = 1500;
                await d.transaction(db, ['Task'], 'readwrite', tx => { tx.objectStore('Task').put(a); tx.objectStore('Task').put(b); });
                await window.__acceptanceTimer.localTimer.run('mode', { mode: 'countup' });
                await window.__acceptanceTimer.startForTask(a, null);
                return { a: a.id, b: b.id };
            });
            await age(page, 20);
            await page.evaluate(async () => {
                await window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 });
                const b = (await window.FocusLocalData.snapshot()).indexedDB.Task.find(t => t.name === '验收任务 B');
                await window.__acceptanceTimer.startForTask(b, null);
            });
            let s = await snapshot(page);
            assert.equal(s.indexedDB.Pomodoro[0].taskId, ids.a);
            assert(s.indexedDB.Pomodoro[0].interval >= 1200 && s.indexedDB.Pomodoro[0].interval < 1205);
            assert.equal(s.indexedDB.TimerSession[0].config.interval, 1500);
            await age(page, 25);
            await page.evaluate(async () => { await window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }); await window.__acceptanceTimer.completeTask(); });
            s = await snapshot(page);
            assert(s.indexedDB.Pomodoro.some(r => r.taskId === ids.b && r.interval === 1500));
            assert(s.indexedDB.Task.find(t => t.id === ids.b).isFinished);
            assert.equal(s.indexedDB.TimerSession[0].taskId, '');
        }));
        async function createActiveTask(page, mode) {
            const input = page.getByPlaceholder(/添加一个任务/);
            await input.fill('停止回归任务'); await input.press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            const id = await page.evaluate(async mode => {
                const timer = window.__acceptanceTimer, task = (await window.FocusLocalData.snapshot()).indexedDB.Task[0];
                await timer.localTimer.run('mode', { mode });
                await timer.startForTask(task, null); return task.id;
            }, mode);
            await age(page, 2);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            return id;
        }
        async function stopThroughUI(page) {
            await page.locator('[class*="FullscreenTimer-actionWithoutBackground"]').click();
            await page.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'pause');
            await page.locator('[class*="FullscreenTimer-stop-"]').click();
            await page.getByText('停止', { exact: true }).last().click();
            await page.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'initial' && window.__acceptanceTimer.state.timerInfo.elapse === 0);
        }
        for (const mode of ['countup', 'countdown']) {
            await check(mode + ' stopped timer stays zero when task completion circle is clicked', () => app(async page => {
                const id = await createActiveTask(page, mode); await stopThroughUI(page);
                const before = (await snapshot(page)).indexedDB.Pomodoro;
                assert(before.reduce((n, r) => n + r.interval, 0) >= 120);
                await page.locator('[class*="FullscreenTimer-complete-"]').click();
                await page.waitForFunction(() => !window.__acceptanceTimer.props.task && window.__acceptanceTimer.localTimer.session.state === 'initial');
                const after = await snapshot(page);
                assert(after.indexedDB.Task.find(t => t.id === id).isFinished);
                assert.deepEqual(after.indexedDB.Pomodoro, before);
                assert.equal(timerTotal(after), 0);
                await page.reload();
                await page.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session);
                assert.equal(await page.evaluate(() => window.__acceptanceTimer.state.timerInfo.elapse), 0);
            }));
            await check(mode + ' task cancel cross clears selection and does not resurrect stopped time', () => app(async page => {
                const id = await createActiveTask(page, mode); await stopThroughUI(page);
                const before = (await snapshot(page)).indexedDB.Pomodoro;
                await page.locator('[class*="FullscreenTimer-delete-"]').click();
                await page.waitForFunction(() => !window.__acceptanceTimer.props.task && !window.__acceptanceTimer.localTimer.session.taskId);
                const after = await snapshot(page);
                assert(!after.indexedDB.Task.find(t => t.id === id).isFinished);
                assert.deepEqual(after.indexedDB.Pomodoro, before);
                assert.equal(timerTotal(after), 0);
                assert.equal(await page.evaluate(() => window.__acceptanceOptions.preference.timingTaskId), '');
                await page.reload();
                await page.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session);
                assert.equal(await page.evaluate(() => window.__acceptanceTimer.state.timerInfo.elapse), 0);
            }));
        }
        function timerTotal(snapshot) { return snapshot.indexedDB.TimerSession[0].totalSeconds; }
        await check('active task cancel saves elapsed once; event start uses the current adapter', () => app(async page => {
            const id = await createActiveTask(page, 'countup');
            await page.locator('[class*="FullscreenTimer-delete-"]').click();
            await page.waitForFunction(() => !window.__acceptanceTimer.props.task);
            let s = await snapshot(page);
            assert(s.indexedDB.Pomodoro.every(r => r.taskId === id));
            assert(s.indexedDB.Pomodoro.reduce((n, r) => n + r.interval, 0) >= 120);
            assert.equal(s.indexedDB.TimerSession[0].state, 'initial');
            await page.evaluate(async () => {
                const options = window.__acceptanceOptions, task = (await window.FocusLocalData.snapshot()).indexedDB.Task[0];
                const event = options.subscriptions.find(([, name]) => name === 'startForTask')[0];
                options.events.emit(event, task, null);
            });
            await page.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'work' && !!window.__acceptanceTimer.props.task);
            s = await snapshot(page); assert.equal(s.indexedDB.TimerSession[0].taskId, id);
            assert(s.indexedDB.TimerSession[0].totalSeconds < 5);
        }));
        await check('normal boundaries notify once; restored history and partial stops stay silent', () => app(async page => {
            await page.evaluate(() => {
                window.__notifications = []; window.__alarms = [];
                window.Notification = class { static permission = 'granted'; constructor(title, options) { window.__notifications.push({ title, body: options.body }); } close() {} };
                window.__acceptanceTimer.playWorkAlarm = () => window.__alarms.push('work');
                window.__acceptanceTimer.playBreakAlarm = () => window.__alarms.push('break');
            });
            await begin(page); await age(page, 60);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick'));
            assert.equal(await page.evaluate(() => window.__notifications.length), 1, (await page.locator('#focus-local-notice').allTextContents()).join(' '));
            await age(page, 120);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick'));
            await page.getByRole('button', { name: '全部计入', exact: true }).click();
            await page.locator('#focus-recovery').waitFor({ state: 'detached' });
            assert.equal(await page.evaluate(() => window.__notifications.length), 1);
            await page.evaluate(async () => {
                const t = window.__acceptanceTimer;
                await t.localTimer.run('stop');
                await t.localTimer.run('start', { mode: 'countdown', config: { interval: 60, shortBreak: 60, autoBreak: true } });
            });
            await age(page, 1);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            await age(page, 1);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            assert.deepEqual(await page.evaluate(() => window.__alarms), ['work', 'break']);
            assert.equal(await page.evaluate(() => window.__notifications.length), 3);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('stop'));
            assert.equal(await page.evaluate(() => window.__notifications.length), 3);
        }));
        await check('legacy unmount disposes polling, all timer subscriptions and bridge callbacks', () => app(async page => {
            await begin(page);
            const result = await page.evaluate(async () => {
                const timer = window.__acceptanceTimer, options = window.__acceptanceOptions;
                const counts = options.subscriptions.map(([event]) => options.events.listenerCount(event));
                const view = JSON.stringify(timer.state.timerInfo);
                timer.componentWillUnmount();
                const cleaned = options.subscriptions.map(([event]) => options.events.listenerCount(event));
                options.events.emit(options.subscriptions.find(([, name]) => name === 'refreshWorkInterval')[0]);
                await new Promise(resolve => setTimeout(resolve, 1100));
                return { counts, cleaned, disposed: timer.localTimer.disposed, unchanged: view === JSON.stringify(timer.state.timerInfo), bridgeRemoved: !window.webBridge.changeStateTo && !window.webBridge.stop && !window.webBridge.resetTimer };
            });
            assert(result.disposed && result.unchanged && result.bridgeRemoved);
            assert.deepEqual(result.cleaned, result.counts.map(n => n - 1));
        }));
        await check('peer tab refreshes task progress and report events for newly committed records', () => app(async (page, context) => {
            const id = await createActiveTask(page, 'countup');
            const other = await context.newPage(); const peerErrors = [];
            other.on('pageerror', error => peerErrors.push(error.message));
            await other.goto(url);
            await other.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session);
            await other.evaluate(() => {
                window.__peerRows = [];
                window.__acceptanceOptions.events.on('pomodoro_new', row => window.__peerRows.push(row));
            });
            await age(page, 60);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            await other.waitForFunction(() => window.__peerRows.length >= 2 && window.__acceptanceTimer.props.task.pomodoros.reduce((n, v) => n + v, 0) > 1.999999);
            const peer = await other.evaluate(() => ({ rows: window.__peerRows, task: window.__acceptanceTimer.props.task, session: window.__acceptanceTimer.localTimer.session }));
            assert(peer.rows.every(row => row.taskId === id));
            assert(Math.abs(peer.rows.reduce((n, row) => n + row.interval, 0) - 3000) < 0.001);
            assert.equal(new Set(peer.rows.map(row => row.blockId)).size, 2);
            assert.equal(new Set(peer.rows.map(row => row.id)).size, peer.rows.length);
            assert(peer.session.totalSeconds >= 3600);
            assert.deepEqual(peerErrors, []);
        }));
        await check('background audio resumes after short reload and pagehide; only one tab owns playback', () => app(async (page, context) => {
            await page.evaluate(() => {
                const p = window.__acceptanceOptions.preference; p.bgMusic = 'bgm_Rain'; p.whiteNoiseVolume = 50;
            });
            await begin(page);
            await page.waitForFunction(() => window.__fakeAudio.some(a => a.loop && !a.paused));
            await page.reload();
            await page.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session && window.__fakeAudio.some(a => a.loop && !a.paused));
            const other = await context.newPage(); await other.goto(url);
            await other.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session);
            await other.waitForTimeout(150);
            assert.equal(await other.evaluate(() => window.__fakeAudio.filter(a => a.loop && !a.paused).length), 0);
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            assert.equal(await page.evaluate(() => window.__fakeAudio.filter(a => a.loop && !a.paused).length), 0);
            await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
            await page.waitForFunction(() => window.__fakeAudio.some(a => a.loop && !a.paused));
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('pause'));
            await page.waitForFunction(() => window.__fakeAudio.every(a => !a.loop || a.paused));
            await other.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'pause');
            assert.equal(await other.evaluate(() => window.__fakeAudio.filter(a => a.loop && !a.paused).length), 0);
        }, async page => {
            await page.context().addInitScript(() => {
                window.__fakeAudio = [];
                window.Audio = class {
                    constructor(src) { this.src = src; this.dataset = {}; this.paused = true; window.__fakeAudio.push(this); }
                    play() { this.paused = false; return Promise.resolve(); }
                    pause() { this.paused = true; }
                    load() {}
                    removeAttribute(name) { if (name === 'src') this.src = ''; }
                };
            });
        }));
        await check('waiting rest and manual rest completion keep idle work time zero', () => app(async page => {
            await page.evaluate(async () => { window.__acceptanceTimer.zoomUp(); await window.__acceptanceTimer.localTimer.run('start', { mode: 'countdown', config: { interval: 60, shortBreak: 60 } }); });
            await age(page, 1);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            await page.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'waitingForRest');
            await page.locator('[class*="FullscreenTimer-action-"]').click();
            await page.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'rest');
            await page.locator('[class*="FullscreenTimer-actionWithoutBackground-"]').click();
            await page.waitForFunction(() => window.__acceptanceTimer.localTimer.session.state === 'initial');
            const s = await snapshot(page);
            assert.equal(s.indexedDB.Pomodoro.length, 1); assert.equal(timerTotal(s), 0);
            assert.equal(await page.evaluate(() => window.__acceptanceTimer.state.timerInfo.elapse), 0);
        }));
        await check('subtask cancellation and completion clear both timing IDs without losing saved work', () => app(async page => {
            const id = await createActiveTask(page, 'countup');
            await page.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open(), task = (await d.snapshot()).indexedDB.Task[0];
                const subtask = { id: 'acceptance-subtask', objType: 'SUBTASK', taskId: task.id, name: '验收子任务', state: 0, isFinished: false, sync: 0 };
                await d.transaction(db, ['Subtask'], 'readwrite', tx => tx.objectStore('Subtask').put(subtask));
                await window.__acceptanceTimer.startForTask(task, subtask);
            });
            await age(page, 2);
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 }));
            await stopThroughUI(page);
            const before = (await snapshot(page)).indexedDB.Pomodoro;
            await page.locator('[class*="FullscreenTimer-delete-"]').click();
            await page.waitForFunction(() => !window.__acceptanceTimer.props.task && !window.__acceptanceTimer.props.subtask);
            const cleared = await page.evaluate(() => ({ task: window.__acceptanceOptions.preference.timingTaskId, sub: window.__acceptanceOptions.preference.timingSubtaskId }));
            assert.deepEqual(cleared, { task: '', sub: '' });
            assert.deepEqual((await snapshot(page)).indexedDB.Pomodoro, before);
            await page.evaluate(async () => {
                const s = await window.FocusLocalData.snapshot();
                await window.__acceptanceTimer.startForTask(s.indexedDB.Task[0], s.indexedDB.Subtask[0]);
            });
            await page.locator('[class*="FullscreenTimer-complete-"]').click();
            await page.waitForFunction(() => !window.__acceptanceTimer.props.task);
            const s = await snapshot(page);
            assert(s.indexedDB.Subtask[0].isFinished); assert(!s.indexedDB.Task.find(t => t.id === id).isFinished);
            assert.equal(s.indexedDB.TimerSession[0].state, 'initial');
            assert(s.indexedDB.Pomodoro.some(row => row.subtaskId === 'acceptance-subtask' && row.interval >= 120));
        }));
        await check('two tabs without Web Locks serialize timer records in IndexedDB', () => app(async (page, context) => {
            await begin(page); await age(page, 120);
            const other = await context.newPage(); await other.goto(url);
            await other.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session);
            await Promise.all([page, other].map(p => p.evaluate(() => window.FocusLocalData.timerAction({ type: 'resolve' }, Date.now()))));
            const s = await snapshot(page);
            assert.equal(s.indexedDB.Pomodoro.length, 2);
            assert.equal(new Set(s.indexedDB.Pomodoro.map(row => row.id)).size, 2);
            assert.equal(s.indexedDB.Pomodoro.reduce((n, r) => n + r.interval, 0), 7200);
        }, async page => {
            await page.context().addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
        }));
        await check('120-minute reload, confirmation, historical records and retry deduplication', () => app(async page => {
            await begin(page); const anchor = await age(page, 120);
            await page.reload(); await page.locator('#focus-recovery').waitFor();
            assert.match(await page.locator('.focus-recovery-summary').innerText(), /补记 2 段，共 120 分钟/);
            await page.screenshot({ path: path.join(root, 'docs/acceptance/recovery.png'), fullPage: true });
            assert.equal((await snapshot(page)).indexedDB.Pomodoro.length, 0);
            await page.getByRole('button', { name: '全部计入', exact: true }).click();
            await page.locator('#focus-recovery').waitFor({ state: 'detached' });
            let s = await snapshot(page); assert.equal(s.indexedDB.Pomodoro.length, 2);
            assert.deepEqual(s.indexedDB.Pomodoro.map(r => r.endDate), [anchor + 3600000, anchor + 7200000]);
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.localTimer.session);
            s = await snapshot(page); assert.equal(s.indexedDB.Pomodoro.length, 2);
        }));
        await check('145-minute recovery retains remainder; pending dialog survives another reload', () => app(async page => {
            await begin(page); await age(page, 145); await page.reload(); await page.locator('#focus-recovery').waitFor();
            const before = (await snapshot(page)).indexedDB.TimerSession[0].pendingRecovery;
            await page.reload(); await page.locator('#focus-recovery').waitFor();
            assert.deepEqual((await snapshot(page)).indexedDB.TimerSession[0].pendingRecovery, before);
            await page.getByRole('button', { name: '全部计入', exact: true }).click();
            await page.locator('#focus-recovery').waitFor({ state: 'detached' });
            const s = await snapshot(page); assert.equal(s.indexedDB.Pomodoro.length, 2);
            const pending = s.indexedDB.TimerSession[0].spans.reduce((n, span) => n + (span.end - span.start) / 1000, 0);
            assert(pending >= 1500 && pending < 1503);
        }));
        await check('reject recovery excludes interruption and pauses when requested', () => app(async page => {
            await begin(page); await age(page, 120); await page.reload(); await page.locator('#focus-recovery').waitFor();
            await page.locator('#focus-recovery input[type=checkbox]').uncheck();
            await page.getByRole('button', { name: '不计入中断部分' }).click();
            await page.locator('#focus-recovery').waitFor({ state: 'detached' });
            const s = await snapshot(page); assert.equal(s.indexedDB.Pomodoro.length, 0); assert.equal(s.indexedDB.TimerSession[0].state, 'pause');
        }));
        await check('IndexedDB failure rolls records and cursor back; retry commits exactly once', () => app(async page => {
            await begin(page); await age(page, 120);
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData, now = Date.now(); await d.timerAction({ type: 'tick' }, now);
                const add = IDBObjectStore.prototype.add; let calls = 0, message = '';
                IDBObjectStore.prototype.add = function(record) { if (this.name === 'Pomodoro' && ++calls === 2) throw new DOMException('Injected write failure', 'QuotaExceededError'); return add.apply(this, arguments); };
                try { await d.timerAction({ type: 'resolve' }, now); } catch (e) { message = e.message; }
                finally { IDBObjectStore.prototype.add = add; }
                const failed = await d.snapshot();
                await d.timerAction({ type: 'resolve' }, now);
                const success = await d.snapshot();
                return { message, failed, success };
            });
            assert.match(result.message, /Injected/); assert.equal(result.failed.indexedDB.Pomodoro.length, 0);
            assert.equal(result.failed.indexedDB.TimerSession[0].recordedSeconds, 0);
            assert.equal(result.failed.indexedDB.TimerSession[0].state, 'recovery');
            assert.equal(result.success.indexedDB.Pomodoro.length, 2);
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer);
            assert.equal((await snapshot(page)).indexedDB.Pomodoro.length, 2);
        }));
        await check('two tabs resolving one session cannot create duplicate records', () => app(async (page, context) => {
            await begin(page); await age(page, 120);
            await page.evaluate(() => window.FocusLocalData.timerAction({ type: 'tick' }, Date.now()));
            const other = await context.newPage(); other.on('dialog', d => d.accept()); await other.goto(url);
            await other.waitForFunction(() => window.__acceptanceTimer);
            await Promise.all([page, other].map(p => p.evaluate(() => window.FocusLocalData.timerAction({ type: 'resolve' }, Date.now()))));
            assert.equal((await snapshot(page)).indexedDB.Pomodoro.length, 2);
            await other.close();
        }));
        await check('v2 database migrates without Version setting or lost records', () => app(async page => {
            const s = await snapshot(page); assert(s.indexedDB.Pomodoro.some(row => row.id === 'legacy-kept'));
            assert.equal(await page.evaluate(async () => (await window.FocusLocalData.open()).version), 3);
        }, async page => page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                const r = indexedDB.open('PomodoroDB6', 2);
                r.onupgradeneeded = () => { for (const name of ['Project','Task','Subtask','Pomodoro','Schedule','Group','GroupUser','Message']) r.result.createObjectStore(name, { keyPath: name === 'Group' ? 'groupId' : name === 'Message' ? 'messageId' : 'id' }); };
                r.onsuccess = () => { const db = r.result, tx = db.transaction('Pomodoro', 'readwrite'); tx.objectStore('Pomodoro').put({ id: 'legacy-kept', objType: 'POMODORO', state: 0, interval: 3600, pomodoroInterval: 3600, endDate: Date.now(), taskId: '', subtaskId: '', sync: 1 }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); }; r.onerror = () => reject(r.error);
            });
            localStorage.removeItem('Version');
        })));
        await check('complete backup validates; malformed imports leave all data intact', () => app(async page => {
            await begin(page);
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData, original = await d.snapshot();
                d.validate(original);
                const bad = structuredClone(original); bad.indexedDB.Task = [{ id: 'duplicate' }, { id: 'duplicate' }];
                let message; try { await d.replace(bad, { backup: false }); } catch (e) { message = e.message; }
                const onlySettings = { meta: original.meta, localStorage: original.localStorage };
                let rejected = false; try { d.validate(onlySettings); } catch (_) { rejected = true; }
                return { original, after: await d.snapshot(), message, rejected };
            });
            assert.match(result.message, /重复/); assert(result.rejected);
            assert.deepEqual(result.after.indexedDB, result.original.indexedDB);
        }));
        await check('import is atomic on failure and legacy backup clears running sessions', () => app(async page => {
            await begin(page);
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData, original = await d.snapshot(), target = structuredClone(original);
                target.meta.exportVersion = 1; target.meta.dbVersion = 2; delete target.indexedDB.TimerSession;
                target.indexedDB.Task = [{ id: 'imported-task', name: 'Imported', state: 0 }];
                const add = IDBObjectStore.prototype.add;
                IDBObjectStore.prototype.add = function(value) { if (this.name === 'Task') throw new Error('Injected import abort'); return add.apply(this, arguments); };
                let message; try { await d.replace(target, { backup: false }); } catch (e) { message = e.message; }
                finally { IDBObjectStore.prototype.add = add; }
                const failed = await d.snapshot();
                const backup = await d.replace(target, { backup: false });
                return { original, failed, backup, success: await d.snapshot(), message };
            });
            assert.match(result.message, /Injected/); assert.deepEqual(result.failed.indexedDB.Task, result.original.indexedDB.Task);
            assert.deepEqual(result.failed.indexedDB.Project, result.original.indexedDB.Project);
            assert.equal(result.success.indexedDB.Task[0].id, 'imported-task');
            assert.equal(result.success.indexedDB.TimerSession.length, 0);
            assert.equal(result.success.localStorage.Version, '6.5');
            assert(Array.isArray(result.backup.indexedDB.Pomodoro));
        }));
        await check('settings failure during import rolls database and settings back', () => app(async page => {
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData, original = await d.snapshot(), target = structuredClone(original);
                target.indexedDB.Task = [{ id: 'must-not-remain', name: 'temporary' }];
                target.localStorage['oversize-acceptance'] = 'x'.repeat(12 * 1024 * 1024);
                let message; try { await d.replace(target, { backup: false }); } catch (e) { message = e.message; }
                return { original, after: await d.snapshot(), message };
            });
            assert.match(result.message, /回滚/);
            assert.deepEqual(result.after.indexedDB.Task, result.original.indexedDB.Task);
            assert.deepEqual(result.after.localStorage, result.original.localStorage);
        }));
        await check('new backup preserves unfinished spans without automatically running on import', () => app(async page => {
            await begin(page); await age(page, 145);
            const r = await page.evaluate(async () => {
                const d = window.FocusLocalData; await d.timerAction({ type: 'tick' }, Date.now()); await d.timerAction({ type: 'resolve' }, Date.now());
                const backup = await d.snapshot(); await d.replace(backup, { backup: false });
                return d.snapshot();
            });
            assert.equal(r.indexedDB.Pomodoro.length, 2);
            assert.equal(r.indexedDB.TimerSession[0].state, 'recovery');
            assert.equal(r.indexedDB.TimerSession[0].pendingRecovery.source, 'import');
            const pending = r.indexedDB.TimerSession[0].spans.reduce((n, span) => n + (span.end - span.start) / 1000, 0);
            assert(pending >= 1500 && pending < 1505);
            await page.reload(); await page.locator('#focus-recovery').waitFor();
            assert.equal(await page.locator('#focus-recovery input[type=checkbox]').isChecked(), false);
        }));
        await check('interrupted import journal completes safely on next app load', () => app(async page => {
            await page.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open(), backup = await d.snapshot();
                await d.transaction(db, ['LocalMeta'], 'readwrite', tx => {
                    tx.objectStore('LocalMeta').put({ id: 'settings-journal', backup, target: { ...backup.localStorage, AcceptanceRecovered: 'yes' } });
                    tx.objectStore('LocalMeta').put({ id: 'maintenance', startedAt: Date.now() });
                });
            });
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer);
            assert.equal(await page.evaluate(() => localStorage.getItem('AcceptanceRecovered')), 'yes');
            const metadata = await page.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open(); return d.transaction(db, ['LocalMeta'], 'readonly', (tx, done) => {
                    const q = tx.objectStore('LocalMeta').getAll(); q.onsuccess = () => done(q.result);
                });
            });
            assert.equal(metadata.length, 0);
        }));
        await check('interrupted import with full settings storage rolls back and still boots', () => app(async page => {
            const before = await snapshot(page);
            await page.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open(), backup = await d.snapshot();
                await d.transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').put({ id: 'settings-journal', backup, target: { ...backup.localStorage, tooLarge: 'x'.repeat(12 * 1024 * 1024) } }));
            });
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer);
            const after = await snapshot(page); assert.deepEqual(after.indexedDB.Project, before.indexedDB.Project);
            assert.equal(await page.evaluate(() => localStorage.getItem('tooLarge')), null);
        }));
        await check('theme storage failure is visible and does not activate the failed theme', () => app(async page => {
            const messages = []; page.on('dialog', dialog => messages.push(dialog.message()));
            await page.mouse.click(1255, 25); await page.getByText('外观', { exact: true }).click();
            await page.locator('input[data-lexible-upload]').waitFor({ state: 'attached' });
            const before = await page.evaluate(() => ({ active: localStorage.getItem('lexible-active-custom-theme'), theme: localStorage.getItem('Theme') }));
            await page.evaluate(() => {
                const set = window.FocusLocalData.rawSet;
                let key = 0;
                for (const size of [1024 * 1024, 1024, 1]) {
                    while (true) { try { set('quota-test-' + (++key), 'x'.repeat(size)); } catch (_) { break; } }
                }
            });
            await page.locator('input[data-lexible-upload]').setInputFiles({ name: 'acceptance.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64') });
            await page.waitForTimeout(700);
            assert(messages.some(text => /存储空间|保存失败/.test(text)), JSON.stringify(messages));
            const after = await page.evaluate(() => ({ active: localStorage.getItem('lexible-active-custom-theme'), theme: localStorage.getItem('Theme') }));
            assert.deepEqual(after, before);
            await page.evaluate(() => { Object.keys(localStorage).filter(key => key.startsWith('quota-test-')).forEach(window.FocusLocalData.rawRemove); });
        }));
        await check('reset resolves after stores are cleared and preserves a full backup', () => app(async page => {
            await begin(page);
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData; const backup = await d.reset();
                return { backup, after: await d.snapshot() };
            });
            assert(result.backup.indexedDB.Project.length > 0);
            assert.equal(result.after.indexedDB.Project.length, 0);
            assert.equal(result.after.indexedDB.TimerSession.length, 0);
        }));
        await check('Request and URL inputs cannot bypass exact network allowlist', () => app(async (page, context, errors, external) => {
            const rejected = await page.evaluate(async () => {
                const values = ['https://example.invalid/?www.bing.com', new URL('https://www.bing.com.evil.invalid/'), new Request('https://example.invalid/')];
                return Promise.all(values.map(async value => { try { await fetch(value); return false; } catch (_) { return true; } }));
            });
            assert.deepEqual(rejected, [true, true, true]); assert.deepEqual(external, []);
        }));
    } finally { await browser.close(); server.close(); }
    fs.writeFileSync(path.join(root, 'docs/acceptance/' + (process.env.FOCUS_TEST_FILTER ? 'results-filtered.json' : 'results.json')), JSON.stringify({ version: releaseVersion, date: release.date, results }, null, 2));
    if (failures.length) throw new Error(failures.join('\n'));
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
