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
const evidence = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || path.join(root, 'docs/acceptance'));
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
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser = await playwright().chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const failures = [], results = [];
    fs.mkdirSync(evidence, { recursive: true });
    async function app(testBody, beforeLoad, baseUrl = url, locale = 'zh-CN') {
        const context = await browser.newContext({ locale, timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 } });
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
    async function commitElapsed(page, minutes) {
        const seeded = await page.evaluate(async minutes => {
            // Seed and reduce inside the real timer transaction. No tab can see
            // an aged cursor before its intended commit and enter recovery.
            const original = FocusTimerCore.reduce;
            let injected = false;
            FocusTimerCore.reduce = function(session, action, now) {
                if (!injected && action.type === 'tick' && action.gapMs === 1e9) {
                    if (session.state !== 'work') throw new Error('Expected a running fixture');
                    injected = true;
                    session = { ...session, cursorAt: now - minutes * 60000, observedAt: now - minutes * 60000,
                        phaseElapsed: 0, totalSeconds: 0, recordedSeconds: 0, spans: [], pendingRecovery: null };
                }
                return original(session, action, now);
            };
            try {
                // Leave the real polling loops active while preparing the seed.
                await new Promise(resolve => setTimeout(resolve, 1100));
                const result = await window.__acceptanceTimer.localTimer.run('tick', { gapMs: 1e9 });
                return { result, injected };
            } finally { FocusTimerCore.reduce = original; }
        }, minutes);
        assert(seeded.injected, 'Elapsed-time fixture was applied within the commit');
        return seeded.result;
    }
    const snapshot = page => page.evaluate(() => window.FocusLocalData.snapshot());
    async function themeFixture(page, bing = false) {
        await page.evaluate(bing => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
            const themes = {};
            for (const [id, color] of [['custom_a', '#ff0000'], ['custom_b', '#0000ff'], ['__bing_daily__', '#00ff00']]) {
                canvas.getContext('2d').fillStyle = color; canvas.getContext('2d').fillRect(0, 0, 2, 2);
                const dataUrl = canvas.toDataURL(); themes[id] = { name: id, dataUrl, thumbnail: dataUrl, createdAt: 1, updatedAt: 1 };
            }
            localStorage.setItem('lexible-custom-themes', JSON.stringify(themes));
            localStorage.setItem('Theme', bing ? '__bing_daily__' : 'Leaf');
            if (bing) localStorage.setItem('lexible-active-custom-theme', '__bing_daily__');
        }, bing);
    }
    async function appearance(page) {
        await page.mouse.click(1255, 25); await page.getByText('外观', { exact: true }).click();
        await page.locator('[data-theme-id="custom_a"]').waitFor();
    }
    async function delayedBing(page) {
        let release, requested;
        const gate = new Promise(resolve => { release = resolve; });
        const started = new Promise(resolve => { requested = resolve; });
        await page.route('https://bing.biturl.top/**', async route => {
            requested(); await gate;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://www.bing.com/theme-acceptance.png' }) });
        });
        await page.route('https://www.bing.com/theme-acceptance.png', route => route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64') }));
        return { started, release };
    }
    try {
        await check('list management reorders within groups, persists and uses one scroll area', () => app(async page => {
            await page.evaluate(async () => {
                const db=await FocusLocalData.open();
                await FocusLocalData.transaction(db,['Project'],'readwrite',tx=>{
                    const store=tx.objectStore('Project');
                    for(let i=0;i<24;i++) store.put({id:'accept-list-'+i,objType:1,creationDate:Date.now(),state:0,name:'List '+String(i).padStart(2,'0'),order:10000+i*10000,color:'AEBDC3',isDefault:false,parentId:'',orderingRule:0,type:1000,imageName:'',expanded:true,sync:0});
                });
            });
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer && document.querySelector('#root').children.length > 0); await page.evaluate(() => window.FocusLocalReady);
            await page.mouse.click(1255,25); await page.getByText('清单管理',{exact:true}).click();
            const preset=page.locator('[class*="PresetProjectItem-root"]'), custom=page.locator('[class*="CustomProjectItem-root"]');
            await custom.first().waitFor();
            const firstPreset=await preset.first().innerText(), secondPreset=await preset.nth(1).innerText();
            await preset.first().dragTo(preset.nth(1));
            await page.waitForFunction(name=>document.querySelector('[class*="PresetProjectItem-root"]')?.innerText===name,secondPreset);
            assert.equal(await custom.first().getAttribute('draggable'),'false');
            assert.equal(await custom.locator('.focus-project-handle').count(),0);
            const scroller=page.locator('.ProjectManagement-content--kCla .ScrollView-root-1KhMW');
            await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
            const dimensions=await page.locator('.ProjectManagement-content--kCla').evaluate(el=>({top:el.scrollTop,overflow:getComputedStyle(el).overflowY,inner:el.querySelector('ul').scrollTop}));
            assert.equal(dimensions.top,0); assert.equal(dimensions.overflow,'hidden'); assert(dimensions.inner>0);
            assert.equal((await custom.first().innerText()).trim(),'List 00');
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer && document.querySelector('#root').children.length > 0); await page.evaluate(() => window.FocusLocalReady);
            await page.mouse.click(1255,25); await page.getByText('清单管理',{exact:true}).click();
            assert.equal(await preset.first().innerText(),secondPreset);
            assert.equal(await preset.nth(1).innerText(),firstPreset);
            assert.equal((await custom.first().innerText()).trim(),'List 00');
        }));
        await check('compatibility modules install once and retain isolated storage boundaries', () => app(async page => {
            const result = await page.evaluate(async () => {
                const before = { set: Storage.prototype.setItem, remove: Storage.prototype.removeItem, xhr: XMLHttpRequest, fetch, ready: FocusLocalReady, themes: FocusThemes };
                const identity = FocusLocalData.installIdentity();
                FocusLocalNetwork.install(identity); FocusLocalBackup.installUI();
                FocusSettings.installCompatibility(identity); FocusThemeStorage.installUI(identity);
                const same = before.set === Storage.prototype.setItem && before.remove === Storage.prototype.removeItem && before.xhr === XMLHttpRequest && before.fetch === fetch && before.ready === FocusLocalReady && before.themes === FocusThemes;
                const name = localStorage.getItem('cookie.NAME');
                localStorage.removeItem('cookie.NAME'); localStorage.setItem('cookie.NAME', '');
                sessionStorage.setItem('cookie.NAME', 'temporary'); sessionStorage.removeItem('cookie.NAME');
                return { same, namePreserved: name === localStorage.getItem('cookie.NAME'), sessionRemoved: sessionStorage.getItem('cookie.NAME') === null, jquery: typeof window.jQuery, debug: typeof window.testSetUsername };
            });
            assert.deepEqual(result, { same: true, namePreserved: true, sessionRemoved: true, jquery: 'undefined', debug: 'undefined' });
        }));
        await check('language settings switch to complete English and notifications are opt-in', () => app(async page => {
            await page.mouse.click(1255,25); await page.getByText('通用',{exact:true}).click();
            assert.deepEqual(await page.locator('#focus-language option').evaluateAll(nodes=>nodes.map(x=>x.value)),['auto','zh-CN','en']);
            const loaded=page.waitForEvent('load');await page.locator('#focus-language').selectOption('en');await loaded;
            await page.waitForFunction(()=>window.__acceptanceTimer);
            await page.mouse.click(1255,25);await page.getByText('General',{exact:true}).click();
            assert.equal(await page.locator('#focus-language').inputValue(),'en');
            assert.equal(await page.evaluate(()=>window.__permissionRequests),0);
            await page.getByRole('button',{name:'Enable notifications',exact:true}).click();
            assert.equal(await page.evaluate(()=>window.__permissionRequests),1);
            await page.getByRole('button',{name:'Send a test notification',exact:true}).click();
            assert.equal(await page.evaluate(()=>window.__testNotifications),1);
            await page.getByText('Account',{exact:true}).click();await page.getByRole('button',{name:'Export data',exact:true}).click();
            await page.getByRole('button',{name:'Create and download',exact:true}).waitFor();
            assert(!/[\u3400-\u9fff]/.test(await page.locator('#focus-backup-dialog').innerText()));
            await page.screenshot({path:path.join(evidence, 'english-backup.png')});
            await page.getByRole('button',{name:'Close',exact:true}).click();
            await page.locator('[class^="Settings-close-"]').click();
            await page.getByRole('button',{name:'Notifications',exact:true}).click();
            await page.locator('.focus-release-entry').first().click();
            assert(!/[\u3400-\u9fff]/.test(await page.locator('#focus-update-dialog').innerText()));
        },page=>page.addInitScript(()=>{
            window.__permissionRequests=0;window.__testNotifications=0;
            function Notification(){window.__testNotifications++;this.close=()=>{};}
            Notification.permission='default';Notification.requestPermission=async()=>{window.__permissionRequests++;Notification.permission='granted';return 'granted';};window.Notification=Notification;
        })));
        await check('language unsupported system locale falls back to English without key names', () => app(async page=>{
            assert.equal(await page.evaluate(()=>window.FocusI18n.locale),'en');
            const strings=await page.evaluate(()=>[FocusI18n.legacyText('cmm_cancel'),FocusI18n.legacyText('missing_internal_example_key')]);
            assert.deepEqual(strings,['Cancel','Text unavailable']);
            await page.mouse.click(1255,25);await page.getByText('Appearance',{exact:true}).click();
            await page.getByText('Bing daily',{exact:true}).waitFor();
            assert.equal(await page.getByText('Upload image',{exact:true}).count(),1);
        },null,url,'ar-SA'));
        await check('language regional partial translation is system-only with usable local controls', () => app(async page=>{
            assert.equal(await page.evaluate(()=>window.FocusI18n.locale),'fr');
            await page.mouse.click(1255,25);
            await page.locator('[class*="Settings-menuName"]').filter({hasText:/Général|General/}).click();
            assert.equal(await page.locator('#focus-language').inputValue(),'auto');
            assert.equal(await page.locator('#focus-language option[value="fr"]').count(),0);
        },null,url,'fr-CA'));
        await check('theme journal recovers before rendering and is excluded from backups', () => app(async page => {
            assert.equal(await page.evaluate(() => localStorage.getItem('Theme')), 'Ocean');
            assert.equal(await page.evaluate(() => localStorage.getItem('FocusTodo.themeJournal')), null);
            assert.match(await page.locator('[class*="Timer-bgi"]').getAttribute('style'), /timer-bg-ocean\.jpg/);
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData, backup = await d.snapshot();
                backup.localStorage['FocusTodo.themeJournal'] = '{"not":"an imported journal"}';
                return { validated: d.validate(backup), keys: Object.keys(await d.snapshot()) };
            });
            assert.equal(result.validated.localStorage['FocusTodo.themeJournal'], undefined);
        }, async page => {
            await themeFixture(page);
            await page.addScriptTag({ url: '/js/local-theme-storage.js' });
            await page.evaluate(() => {
                let prepared;
                const api = window.FocusThemeStorage;
                api.create({ get: key => localStorage.getItem(key), remove: key => localStorage.removeItem(key), set(key, value) {
                    if (key === api.JOURNAL_KEY) prepared = value;
                    localStorage.setItem(key, value);
                } }).commit({ active: null, theme: 'Ocean' });
                // Durable boundary after the small intent log but before the
                // metadata pair: startup must finish Ocean before React boots.
                localStorage.setItem('Theme', 'Leaf'); localStorage.setItem(api.JOURNAL_KEY, prepared);
            });
        }));
        await check('Bing cache switches immediately without downloading again', () => app(async page => {
            let requests = 0;
            await page.route('https://bing.biturl.top/**', route => { requests++; return route.abort(); });
            await appearance(page);
            await page.locator('[data-theme-id="__bing_daily__"]').click();
            await page.locator('img[src="img/timer-bg-ocean-shortcut.jpg"]').click();
            await page.locator('[data-theme-id="__bing_daily__"]').click();
            assert.equal(await page.evaluate(() => localStorage.getItem('Theme')), '__bing_daily__');
            assert.equal(requests, 0);
            assert.equal(await page.getByText('下载中...', { exact: true }).count(), 0);
        }, async page => {
            await themeFixture(page);
            await page.evaluate(() => { const themes = JSON.parse(localStorage.getItem('lexible-custom-themes')); themes.__bing_daily__.updatedAt = Date.now(); localStorage.setItem('lexible-custom-themes', JSON.stringify(themes)); });
        }));
        await check('Bing selection survives closing settings during its first download', () => app(async page => {
            const bing = await delayedBing(page); await appearance(page);
            await page.locator('[data-theme-id="__bing_daily__"]').click(); await bing.started;
            await page.locator('[class^="Settings-close-"]').click();
            await page.locator('[class^="Settings-root-"]').waitFor({ state: 'detached' });
            await appearance(page);
            await page.getByText('下载中...', { exact: true }).waitFor();
            await page.locator('[class^="Settings-close-"]').click();
            await page.locator('[class^="Settings-root-"]').waitFor({ state: 'detached' });
            bing.release();
            await page.waitForFunction(() => localStorage.getItem('lexible-active-custom-theme') === '__bing_daily__');
            assert.match(await page.locator('[class*="Timer-bgi"]').getAttribute('style'), /data:image/);
        }, async page => {
            await themeFixture(page);
            await page.evaluate(() => { const themes = JSON.parse(localStorage.getItem('lexible-custom-themes')); delete themes.__bing_daily__; localStorage.setItem('lexible-custom-themes', JSON.stringify(themes)); });
        }));
        await check('theme switching preserves the later classic choice after Bing downloads', () => app(async page => {
            const bing = await delayedBing(page); await appearance(page);
            await page.locator('[data-theme-id="__bing_daily__"]').click(); await bing.started;
            await page.getByText('下载中...', { exact: true }).waitFor();
            await page.locator('img[src="img/timer-bg-ocean-shortcut.jpg"]').click();
            bing.release();
            await page.waitForFunction(() => JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.updatedAt > 1);
            await page.getByText('Bing 每日', { exact: true }).waitFor();
            assert.equal(await page.evaluate(() => localStorage.getItem('Theme')), 'Ocean');
            assert.equal(await page.evaluate(() => localStorage.getItem('lexible-active-custom-theme')), null);
            assert.match(await page.locator('[class*="Timer-bgi"]').getAttribute('style'), /timer-bg-ocean\.jpg/);
        }, page => themeFixture(page)));
        await check('theme switching restores the same classic and all indicators in one frame', () => app(async page => {
            await appearance(page);
            for (const [classic, custom] of [['Leaf', 'custom_a'], ['Ocean', 'custom_b'], ['Leaf', 'custom_a']]) {
                const image = `img/timer-bg-${classic.toLowerCase()}-shortcut.jpg`;
                await page.locator(`img[src="${image}"]`).click();
                await page.locator(`[data-theme-id="${custom}"]`).click();
                assert.match(await page.locator('[class*="Timer-bgi"]').getAttribute('style'), /data:image/);
                const result = await page.evaluate(async image => {
                    document.querySelector(`img[src="${image}"]`).click();
                    await new Promise(requestAnimationFrame);
                    const td = document.querySelector(`img[src="${image}"]`).closest('td');
                    return { active: localStorage.getItem('lexible-active-custom-theme'), background: document.querySelector('[class*="Timer-bgi"]').style.backgroundImage,
                        border: getComputedStyle(td.querySelector('[class*="imgWrapper"]')).borderTopColor,
                        checked: [...td.querySelectorAll('[class*="chkImg"]')].some(el => getComputedStyle(el).display !== 'none') };
                }, image);
                assert.equal(result.active, null); assert.match(result.background, new RegExp('timer-bg-' + classic.toLowerCase() + '\\.jpg'));
                assert.notEqual(result.border, 'rgba(0, 0, 0, 0)'); assert(result.checked);
            }
            await page.locator('img[src="img/timer-bg-ocean-shortcut.jpg"]').click();
            await page.locator('[data-theme-id="custom_b"]').click();
            await page.locator('[data-theme-id="custom_b"] [title="删除此主题"]').click();
            assert.equal(await page.evaluate(() => localStorage.getItem('Theme')), 'Leaf');
            assert.match(await page.locator('[class*="Timer-bgi"]').getAttribute('style'), /timer-bg-leaf\.jpg/);
        }, page => themeFixture(page)));
        await check('theme switching ignores an obsolete automatic Bing refresh', () => app(async page => {
            const bing = await delayedBing(page); await appearance(page); await bing.started;
            await page.locator('[data-theme-id="custom_b"]').click(); bing.release();
            await page.waitForFunction(() => JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.updatedAt > 1);
            await page.getByText('Bing 每日', { exact: true }).waitFor();
            assert.equal(await page.evaluate(() => localStorage.getItem('Theme')), 'custom_b');
            const image = await page.evaluate(() => JSON.parse(localStorage.getItem('lexible-custom-themes')).custom_b.dataUrl);
            assert((await page.locator('[class*="Timer-bgi"]').getAttribute('style')).includes(image));
        }, page => themeFixture(page, true)));
        await check('fresh app starts without external requests', () => app(async (page, context, errors, external) => {
            await page.waitForTimeout(1200);
            assert.match(await page.locator('body').innerText(), /本地用户/); assert.deepEqual(external, []);
            await page.screenshot({ path: path.join(evidence, 'app.png'), fullPage: true });
        }));
        await check('empty projects with an existing version recover system navigation on startup', () => app(async page => {
            const after = await snapshot(page);
            assert.equal(after.indexedDB.Project.length, 15);
            assert.equal(after.indexedDB.Task.length, 0);
            await page.getByPlaceholder(/添加一个任务/).fill('恢复后的新任务');
            await page.getByPlaceholder(/添加一个任务/).press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            const existing = await page.evaluate(async () => {
                const d = window.FocusLocalData, db = await d.open();
                const today = (await d.snapshot()).indexedDB.Project.find(p => p.id === 'id-deadline-today');
                today.order = -2200; today.color = 'F4B357';
                const custom = { ...today, id: 'custom-preserved', name: '保留的清单', type: 1000 };
                await d.transaction(db, ['Project'], 'readwrite', tx => {
                    const store = tx.objectStore('Project');
                    store.put(today); store.put(custom); store.delete('id-priority-low');
                });
                return { today, custom };
            });
            await page.reload();
            await page.getByText('恢复后的新任务', { exact: true }).waitFor();
            const repaired = (await snapshot(page)).indexedDB.Project;
            assert.equal(repaired.length, 16);
            assert.deepEqual(repaired.find(p => p.id === existing.today.id), existing.today);
            assert.deepEqual(repaired.find(p => p.id === existing.custom.id), existing.custom);
            assert(repaired.some(p => p.id === 'id-priority-low'));
        }, async page => {
            await page.evaluate(() => localStorage.setItem('Version', '6.5'));
        }));
        await check('focus below 25 seconds is excluded in both timer modes', () => app(async page => {
            for (const mode of ['countup', 'countdown']) {
                await page.evaluate(async mode => {
                    const timer = window.__acceptanceTimer.localTimer;
                    await timer.run('start', { mode, config: { interval: 1500 } });
                }, mode);
                await age(page, 10 / 60);
                await page.evaluate(() => window.__acceptanceTimer.localTimer.run('pause'));
                assert.equal((await snapshot(page)).indexedDB.Pomodoro.length, 0);
                await page.evaluate(() => window.__acceptanceTimer.localTimer.run('stop'));
                await page.reload();
                await page.waitForFunction(() => window.__acceptanceTimer);
                assert.equal((await snapshot(page)).indexedDB.Pomodoro.length, 0);
            }
        }));
        await check('appearance controls theme notifications, local dialogs and account buttons', () => app(async page => {
            for (const theme of ['深色', '浅色']) {
                await page.mouse.click(1255, 25);
                await page.getByText('外观', { exact: true }).click();
                await page.locator('[class*="AppearanceSettings-darkMode"]').locator('[class$="-control"]').click();
                await page.getByText(theme, { exact: true }).last().click();
                await page.waitForFunction(dark => document.body.classList.contains('dark') === dark, theme === '深色');
                await page.locator('[class^="Settings-close-"]').click();
                await page.locator('[class^="Settings-root-"]').waitFor({ state: 'detached' });
                const isDark = theme === '深色';
                async function checkSurface(selector) {
                    const style = await page.locator(selector).evaluate(el => {
                        const css = getComputedStyle(el); return { background: css.backgroundColor, color: css.color, border: css.borderColor };
                    });
                    const channel = Number(style.background.match(/\d+/)[0]);
                    assert(isDark ? channel < 100 : channel > 200, JSON.stringify(style));
                    assert.notEqual(style.color, style.background);
                    return style;
                }
                await page.getByRole('button', { name: '通知', exact: true }).click();
                await checkSurface('.focus-release-entry:first-of-type');
                await page.waitForTimeout(400);
                await page.screenshot({ path: path.join(evidence, `notifications-${isDark ? 'dark' : 'light'}.png`), fullPage: true });
                await page.locator('.focus-release-entry').first().click();
                await checkSurface('.focus-app-dialog');
                await page.getByRole('button', { name: '关闭', exact: true }).click();
                // Dismiss the notification panel before opening the account tab.
                const bell = page.getByRole('button', { name: '通知', exact: true });
                if (await bell.getAttribute('aria-expanded') === 'true') await bell.click();
                await page.mouse.click(1255, 25);
                await page.getByText('账号', { exact: true }).click();
                for (const id of ['#lexible-export-btn', '#lexible-import-btn']) {
                    await page.locator(id).waitFor();
                    assert.equal(await page.locator(id).evaluate(el => el.tagName), 'BUTTON');
                    await checkSurface(id);
                    const height = await page.locator(id).evaluate(el => getComputedStyle(el).height);
                    assert.equal(height, '30px');
                }
                await page.waitForTimeout(400);
                await page.screenshot({ path: path.join(evidence, `account-${isDark ? 'dark' : 'light'}.png`), fullPage: true });
                await page.locator('[class*="AccountSettings-root"]').getByText('删除数据', { exact: true }).click();
                await checkSurface('.focus-app-dialog');
                await page.getByRole('button', { name: '取消', exact: true }).click();
                await page.locator('[class^="Settings-close-"]').click();
                await page.locator('[class^="Settings-root-"]').waitFor({ state: 'detached' });
            }
        }));
        await check('account backup buttons support keyboard export and full import', () => app(async page => {
            await page.getByPlaceholder(/添加一个任务/).fill('按钮备份验收');
            await page.getByPlaceholder(/添加一个任务/).press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            await page.mouse.click(1255, 25); await page.getByText('账号', { exact: true }).click();
            const exported = page.waitForEvent('download', { timeout: 15000 });
            await page.getByRole('button', { name: '导出数据', exact: true }).focus(); await page.keyboard.press('Enter');
            await page.getByRole('button', { name: '生成并下载', exact: true }).click();
            const download = await exported;
            const savedPath = path.join(root, 'dist/backup-downloads', download.suggestedFilename());
            await download.saveAs(savedPath);
            const buffer = fs.readFileSync(savedPath);
            assert.match(download.suggestedFilename(), /-full-.*\.json\.gz$/);
            assert.equal((await require('../js/local-backup.js').decode(buffer)).data.indexedDB.Task.length, 1);
            await page.getByRole('button', { name: '关闭', exact: true }).click();
            const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
            await page.getByRole('button', { name: '导入数据', exact: true }).click();
            await (await chooser).setFiles(savedPath);
            const reloaded = page.waitForEvent('load', { timeout: 15000 });
            await page.getByRole('button', { name: '确认覆盖并导入', exact: true }).click();
            await reloaded;
            await page.getByText('按钮备份验收', { exact: true }).waitFor();
            await page.waitForFunction(() => window.__acceptanceTimer);
            assert.equal((await snapshot(page)).indexedDB.Task.length, 1);
        }));
        await check('wallpaper scope restores Leaf and automatic safety backup remains complete', () => app(async page => {
            await page.getByPlaceholder(/添加一个任务/).fill('壁纸范围验收');
            await page.getByPlaceholder(/添加一个任务/).press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            await page.waitForFunction(() => document.querySelector('[class*="Timer-bgi"]').style.backgroundImage.includes('data:image/'));
            // Establish an idle session before comparing snapshots; the first
            // timer poll may otherwise initialize it while the dialog opens.
            await page.evaluate(() => window.__acceptanceTimer.localTimer.run('stop'));
            const before = await snapshot(page);
            await page.mouse.click(1255, 25); await page.getByText('账号', { exact: true }).click();
            await page.getByRole('button', { name: '导出数据', exact: true }).click();
            await page.getByRole('checkbox', { name: /包含壁纸图片/ }).uncheck();
            const exported = page.waitForEvent('download');
            await page.getByRole('button', { name: '生成并下载', exact: true }).click();
            const download = await exported, buffer = fs.readFileSync(await download.path());
            const decoded = await require('../js/local-backup.js').decode(buffer);
            assert.equal(decoded.scope, 'without-wallpapers');
            assert.deepEqual(decoded.data.indexedDB, before.indexedDB);
            await page.getByRole('button', { name: '关闭', exact: true }).click();
            const chooser = page.waitForEvent('filechooser');
            await page.getByRole('button', { name: '导入数据', exact: true }).click();
            await (await chooser).setFiles({ name: 'content-sniff.json', mimeType: 'application/json', buffer });
            await page.locator('#focus-import-dialog').getByText(/不含壁纸（恢复后使用默认 Leaf 主题）/).waitFor();
            const safetyDownload = page.waitForEvent('download'), reloaded = page.waitForEvent('load');
            await page.getByRole('button', { name: '确认覆盖并导入', exact: true }).click();
            const safety = JSON.parse(fs.readFileSync(await (await safetyDownload).path(), 'utf8'));
            assert.equal(safety.localStorage['lexible-custom-themes'], before.localStorage['lexible-custom-themes']);
            await reloaded; await page.waitForFunction(() => window.__acceptanceTimer);
            const after = await snapshot(page);
            assert.equal(after.localStorage.Theme, 'Leaf');
            assert.equal(after.localStorage['lexible-active-custom-theme'], undefined);
            assert.equal(after.localStorage['lexible-custom-themes'], undefined);
            assert.deepEqual(after.indexedDB.Task, before.indexedDB.Task);
            assert(!(await page.locator('[class*="Timer-bgi"]').getAttribute('style')).includes('data:image/'));
        }, async page => page.evaluate(() => {
            const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
            localStorage.setItem('lexible-custom-themes', JSON.stringify({ custom_acceptance: { name: '生成主题', dataUrl: image, thumbnail: image, type: 'custom', createdAt: 1 } }));
            localStorage.setItem('lexible-active-custom-theme', 'custom_acceptance'); localStorage.setItem('Theme', 'custom_acceptance');
        })));
        await check('missing compression API exports JSON and backup dialog fits narrow dark viewport', () => app(async page => {
            await page.mouse.click(1255, 25); await page.getByText('账号', { exact: true }).click();
            await page.getByRole('button', { name: '导出数据', exact: true }).click();
            await page.locator('#focus-backup-dialog').getByText(/当前浏览器不支持压缩 API/).waitFor();
            const exported = page.waitForEvent('download');
            await page.getByRole('button', { name: '生成并下载', exact: true }).click();
            const download = await exported;
            assert.match(download.suggestedFilename(), /\.json$/);
            assert.equal(JSON.parse(fs.readFileSync(await download.path(), 'utf8')).meta.scope, 'full');
            await page.evaluate(() => document.body.classList.add('dark'));
            await page.setViewportSize({ width: 375, height: 600 });
            const box = await page.locator('.focus-backup-dialog').boundingBox();
            assert(box.x >= 0 && box.x + box.width <= 376 && box.y >= 0 && box.y + box.height <= 601, JSON.stringify(box));
            await page.screenshot({ path: path.join(evidence, 'backup-narrow-dark.png') });
            await page.keyboard.press('Escape');
            await page.locator('#focus-backup-dialog').waitFor({ state: 'detached' });
        }, async page => page.addInitScript(() => { window.CompressionStream = undefined; window.BroadcastChannel = undefined; })));
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
            assert((await page.locator('#lexible-about-info-row').innerText()).includes(release.author + ' · ' + release.date));
            assert((await page.locator('#lexible-about-info-row').innerText()).includes('官方 ' + release.officialVersion + ' · 本地 ' + release.localVersion));
            const repository = page.locator('#lexible-about-info-row a');
            assert.equal(await repository.getAttribute('href'), 'https://github.com/menggou1/FocusTodo-Local');
            assert.equal(await repository.getAttribute('rel'), 'noopener noreferrer');
            assert.equal(await repository.getAttribute('title'), 'https://github.com/menggou1/FocusTodo-Local');
            assert.equal(await repository.locator('img').getAttribute('src'), 'img/github.svg');
            assert.equal(await repository.locator('img').getAttribute('alt'), 'GitHub');
            assert.doesNotMatch(await page.locator('[class*="AboutSettings-root"]').innerText(), /给予好评|立即评分|更新内容/);
            assert.equal(await page.locator('.lexible-release-notes').count(), 0);
            await page.screenshot({ path: path.join(evidence, 'about.png'), fullPage: true });
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
            const remindersList = page.locator('.focus-task-reminders');
            await remindersList.scrollIntoViewIfNeeded();
            const reminders = await remindersList.boundingBox();
            assert(panel && reminders && reminders.y + reminders.height <= panel.y + panel.height + 1, 'Reminders are reachable in the shared scroll area');
            assert.equal(await page.locator('.focus-release-entry').count(), release.updates.length);
            assert(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()));
            await page.waitForTimeout(400);
            await page.screenshot({ path: path.join(evidence, 'notifications.png'), fullPage: true });
            await page.locator('.focus-release-entry').filter({ hasText: release.updates[0].title }).click();
            await page.locator('#focus-update-dialog').waitFor();
            assert((await page.locator('#focus-update-dialog').innerText()).includes(releaseVersion));
            for (const item of release.updates[0].items) assert((await page.locator('#focus-update-dialog').innerText()).includes(item));
            assert.equal(await page.locator('#focus-update-dialog a').count(), 0, 'User-facing updates do not expose maintenance reports');
            assert.doesNotMatch(await page.locator('#focus-update-dialog').innerText(), /Markdown|验收报告/);
            assert.equal(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()), false);
            await page.screenshot({ path: path.join(evidence, 'update-details.png'), fullPage: true });
            await page.getByRole('button', { name: '关闭', exact: true }).click();
            await page.locator('#focus-update-dialog').waitFor({ state: 'detached' });
            await page.reload(); await page.waitForFunction(() => window.FocusAppUI && window.__acceptanceTimer);
            assert.equal(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()), false);
        }));
        await check('notification panel scrolls all updates without an empty reminder spacer at small sizes and zoom', () => app(async page => {
            for (const [width, height, zoom] of [[1280, 900, 1], [1024, 600, 1.25], [800, 450, 1]]) {
                // Browser page zoom reduces the CSS viewport; CSS `zoom` does not
                // change viewport units and is not equivalent to browser zoom.
                await page.setViewportSize({ width: Math.floor(width / zoom), height: Math.floor(height / zoom) });
                await page.getByRole('button', { name: '通知', exact: true }).click();
                const scroll = page.locator('.focus-notification-content');
                await scroll.waitFor();
                const geometry = await scroll.evaluate(el => {
                    const panel = el.parentElement, title = panel.firstElementChild;
                    return { bottom: panel.getBoundingClientRect().bottom, viewport: innerHeight,
                        empty: panel.querySelector('.focus-task-reminders').getBoundingClientRect().height,
                        height: el.clientHeight, total: el.scrollHeight, title: title.getBoundingClientRect().top };
                });
                assert(geometry.bottom <= geometry.viewport, JSON.stringify(geometry));
                assert.equal(geometry.empty, 0, 'No blank reminder area when there are no reminders');
                assert(geometry.total > geometry.height, 'Long history scrolls within available space');
                const last = page.locator('.focus-release-entry').last();
                await last.scrollIntoViewIfNeeded();
                const hint = last.locator('.focus-release-hint');
                const point = await hint.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
                assert(await hint.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), point), 'Last update link is unobscured');
                assert.equal(await page.locator('.focus-notification-panel > :first-child').evaluate(el => el.getBoundingClientRect().top), geometry.title, 'Title stays fixed while scrolling');
                await page.screenshot({ path: path.join(evidence, `notifications-${width}-${zoom}.png`) });
                await last.click();
                assert((await page.locator('#focus-update-dialog').innerText()).includes(release.updates.at(-1).version));
                await page.getByRole('button', { name: '关闭', exact: true }).click();
                const bell = page.getByRole('button', { name: '通知', exact: true });
                if (await bell.getAttribute('aria-expanded') === 'true') await bell.click();
            }
        }));
        await check('older update details close on Escape and do not mark the latest update as read', () => app(async page => {
            await page.getByRole('button', { name: '通知', exact: true }).click();
            await page.getByRole('button', { name: /计时恢复与数据安全修补/ }).click();
            await page.locator('#focus-update-dialog').waitFor();
            assert(await page.evaluate(() => window.FocusAppUI.hasUnreadUpdates()));
            await page.keyboard.press('Escape');
            await page.locator('#focus-update-dialog').waitFor({ state: 'detached' });
            await page.getByRole('button', { name: '通知', exact: true }).click();
            await page.locator('.focus-release-entry').filter({ hasText: release.updates[0].title }).click();
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
            await page.screenshot({ path: path.join(evidence, 'reset-confirm.png'), fullPage: true });
        }));
        await check('UI delete downloads a full backup before clearing and reloads only after success', () => app(async page => {
            await createActiveTask(page, 'countup');
            await page.evaluate(() => window.__acceptanceTimer.zoomDown());
            await openReset(page);
            // The account entry saves directly through the local profile service.
            await page.getByRole('button', { name: '取消', exact: true }).click();
            const account = page.locator('[class*="AccountSettings-root"]');
            const username = account.locator('input[type=text]');
            await username.fill('待删除的用户名'); await username.blur();
            await page.waitForFunction(() => localStorage.getItem('cookie.NAME') !== btoa(unescape(encodeURIComponent('本地用户'))));
            await page.reload(); await page.waitForFunction(() => window.__acceptanceTimer);
            await page.getByText('待删除的用户名', { exact: true }).waitFor();
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
            assert.equal(after.indexedDB.Pomodoro.length, 0);
            // The restarted adapter may already have persisted its empty idle
            // session. Assert reset semantics instead of racing that write.
            assert(after.indexedDB.TimerSession.length <= 1);
            for (const session of after.indexedDB.TimerSession) {
                assert.equal(session.state, 'initial');
                assert.equal(session.taskId, ''); assert.equal(session.subtaskId, '');
                assert.equal(session.totalSeconds, 0); assert.equal(session.recordedSeconds, 0);
                assert.equal(session.phaseElapsed, 0); assert.deepEqual(session.spans, []);
                assert.equal(session.pendingRecovery, null);
            }
            assert.equal(after.indexedDB.Project.length, 15);
            assert(after.indexedDB.Project.some(p => p.id === 'id-deadline-today' && p.state === 0));
            assert(after.indexedDB.Project.some(p => p.id === 'id-task-tasks' && p.state === 0));
            await page.getByText('本地用户', { exact: true }).waitFor();
            await page.getByPlaceholder(/添加一个任务/).fill('重置后仍可添加');
            await page.getByPlaceholder(/添加一个任务/).press('Enter');
            await page.waitForFunction(async () => (await window.FocusLocalData.snapshot()).indexedDB.Task.length === 1);
            await page.reload(); await page.getByText('重置后仍可添加', { exact: true }).waitFor();
            await page.mouse.click(1255, 25); await page.getByText('账号', { exact: true }).click();
            await page.getByRole('button', { name: '导出数据', exact: true }).waitFor();
            await page.getByRole('button', { name: '导入数据', exact: true }).waitFor();
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
        for (const surface of ['list', 'timer']) {
            await check(surface + ' rapid task completion with six focus records keeps app rendered', () => app(async page => {
                const id = await createActiveTask(page, 'countup'); await stopThroughUI(page);
                await page.evaluate(async id => {
                    const data = window.FocusLocalData, db = await data.open();
                    const record = (await data.snapshot()).indexedDB.Pomodoro[0];
                    await data.transaction(db, ['Pomodoro'], 'readwrite', tx => {
                        tx.objectStore('Pomodoro').clear();
                        for (let i = 0; i < 6; i++) tx.objectStore('Pomodoro').put({ ...record, id: 'completion-' + i, blockId: 'completion-' + i, taskId: id, interval: 750, pomodoroInterval: 1500 });
                    });
                }, id);
                await page.reload();
                await page.waitForFunction(() => window.__acceptanceTimer && window.__acceptanceTimer.props.task);
                if (surface === 'timer') await page.evaluate(() => window.__acceptanceTimer.zoomUp());
                const before = (await snapshot(page)).indexedDB.Pomodoro;
                const selector = surface === 'timer' ? '[class*="FullscreenTimer-complete-"]' : '[class*="TaskItem-complete-"]';
                await page.locator(selector).first().evaluate(node => { for (let i = 0; i < 10; i++) node.click(); });
                await page.waitForFunction(async id => (await window.FocusLocalData.snapshot()).indexedDB.Task.find(t => t.id === id).isFinished, id);
                await page.waitForTimeout(800);
                assert(await page.locator('#root').innerText(), 'App remains rendered after completion');
                assert.equal(await page.locator('#focus-local-notice').count(), 0);
                assert.deepEqual((await snapshot(page)).indexedDB.Pomodoro, before);
                await page.reload();
                await page.waitForFunction(() => window.__acceptanceTimer && document.querySelector('#root').innerText.length > 0);
                assert((await snapshot(page)).indexedDB.Task.find(t => t.id === id).isFinished);
            }));
        }
        await check('raw focus record refresh renders numeric task progress without toMaxFixed crash', () => app(async page => {
            await createActiveTask(page, 'countup'); await stopThroughUI(page);
            await page.evaluate(async () => {
                const task = (await window.FocusLocalData.snapshot()).indexedDB.Task[0];
                // Reproduce the event payload during legacy completion/hydration.
                task.pomodoros = Array.from({ length: 6 }, () => ({ interval: 750, pomodoroInterval: 1500 }));
                window.__acceptanceTimer.props.dispatch({ type: 'UPDATE_TASK', task });
            });
            await page.waitForTimeout(300);
            assert(await page.locator('#root').innerText(), 'Record refresh must not unmount the app');
            assert.equal(await page.locator('[class*="TaskItem-morePomodoros"]').first().innerText(), '3');
            await page.evaluate(() => window.__acceptanceTimer.zoomDown());
            await page.getByText('停止回归任务', { exact: true }).first().click();
            await page.waitForTimeout(300);
            assert.equal(await page.locator('#focus-local-notice').count(), 0);
        }));
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
            await begin(page); await commitElapsed(page, 60);
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
            await commitElapsed(page, 60);
            try {
                await other.waitForFunction(() => window.__peerRows.length >= 2 && window.__acceptanceTimer.props.task.pomodoros.reduce((n, v) => n + v, 0) > 1.999999);
            } catch (error) {
                console.error('Cross-tab refresh diagnostic:', JSON.stringify(await other.evaluate(() => ({ rows: window.__peerRows, session: window.__acceptanceTimer.localTimer.session, task: window.__acceptanceTimer.props.task }))));
                throw error;
            }
            const peer = await other.evaluate(() => ({ rows: window.__peerRows, task: window.__acceptanceTimer.props.task, session: window.__acceptanceTimer.localTimer.session }));
            assert(peer.rows.every(row => row.taskId === id));
            assert(Math.abs(peer.rows.reduce((n, row) => n + row.interval, 0) - 3000) < 0.001);
            assert.equal(new Set(peer.rows.map(row => row.blockId)).size, 2);
            assert.equal(new Set(peer.rows.map(row => row.id)).size, peer.rows.length);
            assert(peer.session.totalSeconds >= 3600);
            assert.deepEqual(peerErrors, []);
        }));
        await check('peer tab receives records committed while timer initialization is pending', () => app(async (page, context) => {
            const id = await createActiveTask(page, 'countup');
            const other = await context.newPage();
            await other.addInitScript(() => {
                window.__receivedRecords = [];
                window.addEventListener('focus-local-timer-changed', event => window.__receivedRecords.push(...(event.detail.records || [])));
                let service;
                Object.defineProperty(window, 'FocusLocalData', { configurable: true, get: () => service, set(value) {
                    service = value;
                    const action = value.timerAction;
                    let firstTick = true;
                    value.timerAction = async function(input, now) {
                        const result = await action(input, now);
                        if (input.type === 'tick' && firstTick) {
                            firstTick = false;
                            window.__mountTickHeld = true;
                            await new Promise(resolve => { window.__releaseMountTick = resolve; });
                        }
                        return result;
                    };
                } });
            });
            await other.goto(url);
            await other.waitForFunction(() => window.__mountTickHeld);
            await other.evaluate(() => {
                window.__peerRows = [];
                window.__acceptanceOptions.events.on('pomodoro_new', row => window.__peerRows.push(row));
            });
            const committed = await commitElapsed(page, 60);
            assert.equal(committed.session.state, 'work');
            assert.equal(new Set(committed.records.map(row => row.blockId)).size, 2);
            await other.waitForFunction(expected => window.__receivedRecords.length === expected, committed.records.length);
            await other.evaluate(() => window.__releaseMountTick());
            try {
                await other.waitForFunction(expected => window.__peerRows.length === expected
                    && window.__acceptanceTimer.props.task
                    && window.__acceptanceTimer.props.task.pomodoros.reduce((sum, value) => sum + value, 0) > 1.999999, committed.records.length);
            }
            catch (error) {
                console.error('Cross-tab initialization diagnostic:', JSON.stringify(await other.evaluate(() => ({ received: window.__receivedRecords.length, rendered: window.__peerRows.length, session: window.__acceptanceTimer.localTimer.session }))));
                throw error;
            }
            const peer = await other.evaluate(() => ({ rows: window.__peerRows, task: window.__acceptanceTimer.props.task }));
            assert(peer.rows.every(row => row.taskId === id));
            assert.deepEqual(peer.rows.map(row => row.id).sort(), committed.records.map(row => row.id).sort());
            assert(peer.task.pomodoros.reduce((sum, value) => sum + value, 0) > 1.999999);
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
            // pagehide releases the shared audio lock; either visible tab may
            // acquire it next. Verify resumed playback and exclusivity together.
            let playing = 0;
            for (let attempt = 0; attempt < 50; attempt++) {
                playing = await page.evaluate(() => window.__fakeAudio.filter(a => a.loop && !a.paused).length)
                    + await other.evaluate(() => window.__fakeAudio.filter(a => a.loop && !a.paused).length);
                if (playing > 0) break;
                await page.waitForTimeout(100);
            }
            assert.equal(playing, 1, 'One tab resumes playback after the audio lock is released');
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
            await page.screenshot({ path: path.join(evidence, 'recovery.png'), fullPage: true });
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
        await check('reset restores system lists and preserves a full backup', () => app(async page => {
            await begin(page);
            const result = await page.evaluate(async () => {
                const d = window.FocusLocalData; const backup = await d.reset();
                return { backup, after: await d.snapshot() };
            });
            assert(result.backup.indexedDB.Project.length > 0);
            assert.equal(result.after.indexedDB.Project.length, 15);
            assert.equal(result.after.indexedDB.TimerSession.length, 0);
        }));
        await check('reused XHR allows same-origin requests after a blocked request', () => app(async page => {
            const result=await page.evaluate(async () => {
                const xhr=new XMLHttpRequest();
                const send=(url)=>new Promise((resolve,reject)=>{
                    xhr.onload=()=>resolve(xhr.responseText); xhr.onerror=()=>reject(new Error('XHR failed'));
                    xhr.open('GET',url); xhr.send();
                });
                await send('https://example.invalid/blocked');
                return send(new URL('/release.json',location.href).href);
            });
            assert.equal(JSON.parse(result).localVersion,release.localVersion);
        }));
        await check('Request and URL inputs cannot bypass exact network allowlist', () => app(async (page, context, errors, external) => {
            const rejected = await page.evaluate(async () => {
                const values = ['https://example.invalid/?www.bing.com', new URL('https://www.bing.com.evil.invalid/'), new Request('https://example.invalid/')];
                return Promise.all(values.map(async value => { try { await fetch(value); return false; } catch (_) { return true; } }));
            });
            assert.deepEqual(rejected, [true, true, true]); assert.deepEqual(external, []);
        }));
    } finally { await browser.close(); server.close(); }
    fs.writeFileSync(path.join(evidence, '' + (process.env.FOCUS_TEST_FILTER ? 'results-filtered.json' : 'results.json')), JSON.stringify({ version: releaseVersion, date: release.date, results }, null, 2));
    if (failures.length) throw new Error(failures.join('\n'));
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
