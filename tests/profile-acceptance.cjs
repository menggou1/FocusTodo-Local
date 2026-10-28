/* Local profile writes use isolated browser storage and genuine UI entry points. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch (_) { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser = await playwright.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    let count = 0;
    async function scenario(name, body) {
        if (process.env.FOCUS_PROFILE_FILTER && !name.includes(process.env.FOCUS_PROFILE_FILTER)) return;
        const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 } });
        const errors = [];
        await context.addInitScript(() => {
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (this === localStorage && window.__profileFail === key) throw new DOMException('Injected profile quota', 'QuotaExceededError');
                return set.apply(this, arguments);
            };
            let data;
            Object.defineProperty(window, 'FocusLocalData', { configurable: true, get: () => data, set(value) {
                data = value; const save = value.saveProfile;
                value.saveProfile = function() { window.__profileOperation = save.apply(this, arguments); return window.__profileOperation; };
            } });
            window.__profileRequests = [];
            const open = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, target) {
                if (String(target).includes('/user')) window.__profileRequests.push(String(target));
                return open.apply(this, arguments);
            };
        });
        await context.route('**/*', route => route.request().url().startsWith(url) || !/^https?:/.test(route.request().url()) ? route.continue() : route.abort());
        const page = await context.newPage(); page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
        try {
            await page.goto(url); await page.waitForFunction(() => window.FocusLocalData && document.querySelector('#root')?.innerText);
            await page.evaluate(() => window.FocusLocalReady);
            await body(page, context);
            assert.deepEqual(errors, [], 'No unhandled browser errors');
            console.log('PASS ' + name); count++;
        } finally { await context.close(); }
    }
    async function account(page) {
        await page.mouse.click(1255, 25); await page.getByText('账号', { exact: true }).click();
        const pane = page.locator('[class*="AccountSettings-root"]'); await pane.locator('input[type=text]').waitFor(); return pane;
    }
    async function rename(page, pane, name) {
        await pane.locator('input[type=text]').fill(name); await pane.locator('input[type=text]').blur();
        await page.evaluate(() => window.__profileOperation.catch(() => {}));
    }
    async function chooseAvatar(page, pane) {
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), pane.getByText('上传头像', { exact: true }).click()]);
        const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2; canvas.getContext('2d').fillRect(0, 0, 2, 2); return canvas.toDataURL().split(',')[1]; });
        await chooser.setFiles({ name: 'profile.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
        await page.waitForFunction(() => [...document.querySelectorAll('[class*="AccountSettings-root"] img')].some(img => img.src.startsWith('data:image/png')));
    }
    try {
        await scenario('local Unicode name persists through reload without a cloud request', async page => {
            const pane = await account(page); await rename(page, pane, '  本地名字 + 🙂  ');
            assert.equal(await pane.locator('input[type=text]').inputValue(), '本地名字 + 🙂');
            assert.equal(await page.evaluate(() => Base64.decode(localStorage.getItem('cookie.NAME'))), '本地名字 + 🙂');
            assert.deepEqual(await page.evaluate(() => window.__profileRequests), []);
            await page.reload(); await page.getByText('本地名字 + 🙂', { exact: true }).waitFor();
        });
        await scenario('failed name write retains the saved name and reports failure', async page => {
            const pane = await account(page); const before = await page.evaluate(() => localStorage.getItem('cookie.NAME'));
            await page.evaluate(() => window.__profileFail = 'cookie.NAME');
            await rename(page, pane, '保存失败不能变更');
            assert.equal(await page.evaluate(() => localStorage.getItem('cookie.NAME')), before);
            assert.equal(await pane.locator('input[type=text]').inputValue(), '本地用户');
            assert.match(await page.locator('#focus-local-notice').innerText(), /Injected profile quota/);
            assert.deepEqual(await page.evaluate(() => window.__profileRequests), []);
            await page.evaluate(() => window.__profileFail = null); await rename(page, pane, '重试成功');
            assert.equal(await pane.locator('input[type=text]').inputValue(), '重试成功');
        });
        await scenario('avatar UI saves and reloads the actual selected image locally', async page => {
            const pane = await account(page); await chooseAvatar(page, pane);
            const image = await pane.locator('img').first().getAttribute('src');
            await pane.locator('[class*="AccountSettings-confirmButton"]').click(); await page.evaluate(() => window.__profileOperation.catch(() => {}));
            assert.equal(await page.evaluate(() => localStorage.getItem('Portrait')), image);
            assert.deepEqual(await page.evaluate(() => window.__profileRequests), []);
            await page.reload(); const reopened = await account(page);
            assert.equal(await reopened.locator('img').first().getAttribute('src'), image);
        });
        await scenario('failed avatar save restores the previous image and permits retry', async page => {
            const pane = await account(page); const previous = await pane.locator('img').first().getAttribute('src');
            await page.evaluate(() => window.__profileFail = 'Portrait'); await chooseAvatar(page, pane);
            await pane.locator('[class*="AccountSettings-confirmButton"]').click(); await page.evaluate(() => window.__profileOperation.catch(() => {}));
            assert.equal(await page.evaluate(() => localStorage.getItem('Portrait')), null);
            assert.equal(await pane.locator('img').first().getAttribute('src'), previous);
            assert.match(await page.locator('#focus-local-notice').innerText(), /Injected profile quota/);
            await page.evaluate(() => window.__profileFail = null); await chooseAvatar(page, pane);
            await pane.locator('[class*="AccountSettings-confirmButton"]').click(); await page.evaluate(() => window.__profileOperation.catch(() => {}));
            assert.match(await page.evaluate(() => localStorage.getItem('Portrait')), /^data:image\/png;base64,/);
        });
        await scenario('profile service rejects invalid edits and respects active maintenance', async page => {
            const before = await page.evaluate(() => localStorage.getItem('cookie.NAME'));
            const failures = await page.evaluate(async () => {
                const messages = [];
                for (const [field, value] of [['name', ' '], ['avatar', 'https://invalid.example/avatar.png']]) {
                    try { await FocusLocalData.saveProfile(field, value); } catch (error) { messages.push(error.message); }
                }
                const db = await FocusLocalData.open();
                await FocusLocalData.transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').put({ id: 'maintenance', operationId: 'profile-check', ownerId: 'other' }));
                try { await FocusLocalData.saveProfile('name', '不能覆盖维护设置'); } catch (error) { messages.push(error.message); }
                return messages;
            });
            assert.equal(failures.length, 3); assert.equal(await page.evaluate(() => localStorage.getItem('cookie.NAME')), before);
        });
    } finally { await browser.close(); server.close(); }
    console.log(`${count} local profile acceptance scenarios passed`);
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
