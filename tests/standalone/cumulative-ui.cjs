const { createStandaloneServer } = require('../../scripts/standalone-server.cjs');
const { assert, contextFor, launch, fs, path, evidence } = require('./helpers.cjs');
const { localVersion, updates } = require('../../release.json');
const prefix = 'FocusTodoStandalone.data.';

async function settingsAndUpdate(browser, origin, locale) {
    const zh = locale === 'zh-CN';
    const { page, context, errors, external } = await contextFor(browser, origin, { locale, hasTouch: true });
    try {
        await context.addInitScript(({ prefix, locale }) => localStorage.setItem(prefix + 'FocusTodo.language', locale), { prefix, locale });
        await page.goto(origin);
        await page.getByTestId('app-shell').waitFor();
        await page.locator('[data-view=settings]').click();
        for (const [tab, count] of [['pomodoro', 6], ['general', 1], ['appearance', 1]]) {
            await page.locator(`[data-settings-tab=${tab}]`).click();
            const controls = page.locator('.legacy-settings-select > select');
            assert.equal(await controls.count(), count);
            for (const select of await controls.all()) {
                const row = select.locator('xpath=../..'), title = row.locator('span').first();
                await select.scrollIntoViewIfNeeded();
                assert.equal(await select.evaluate(node => node.closest('label')?.tagName), undefined);
                await title.click();
                assert.equal(await page.getByRole('listbox').count(), 0);
                const rect = await row.boundingBox(), button = await select.boundingBox();
                const y = rect.y + 4; // Above the 30px control in the 48px row.
                assert(y < button.y);
                const target = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: button.x + 10, y });
                assert.notEqual(target, 'SELECT');
                await page.mouse.click(button.x + 10, y);
                assert.equal(await page.getByRole('listbox').count(), 0);
                await select.click();
                await page.getByRole('listbox').waitFor();
                await page.keyboard.press('Escape');
                assert.equal(await select.evaluate(node => node === document.activeElement), true);
                await select.press('ArrowDown');
                await page.getByRole('listbox').waitFor();
                await page.keyboard.press('Escape');
            }
        }
        assert.equal(await page.locator('.legacy-theme-title').innerText(), zh ? '背景' : 'Background');
        const theme = page.getByTestId('prototype-theme');
        await theme.tap();
        const dark = page.getByRole('listbox').getByRole('option', { name: zh ? '深色' : 'Dark', exact: true });
        await dark.tap();
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        await page.locator('[data-settings-tab=about]').click();
        const about = page.locator('.legacy-about');
        const versionPattern = localVersion.replaceAll('.', '\\.');
        assert.match(await about.innerText(), new RegExp(String.raw`FocusTodo-Local[\s\S]*${versionPattern}(?=\s|$)[\s\S]*Lexible[\s\S]*7\.1\.1[\s\S]*Lâm Ngọc Khương`));
        assert.equal(await about.getByText(/^(Help|Feedback|User guide|帮助|反馈|使用教程)$/).count(), 0);
        assert.equal(await about.getByRole('link', { name: /Lexible/ }).getAttribute('href'), 'https://github.com/menggou1/FocusTodo-Local');
        assert.equal(await about.getByRole('link', { name: 'MIT' }).count(), 1);
        const download = about.locator('.legacy-account-row').last().getByRole('link', { name: zh ? '官方版本下载' : 'Download the official version', exact: true });
        assert.equal(await download.getAttribute('href'), `https://www.focustodo.cn/${zh ? '?lang=zh_CN' : ''}#products`);
        await page.getByTestId('close-page').click();
        await page.setViewportSize({ width: 410, height: 292 });
        const trigger = page.locator('[data-view=notifications]');
        const open = async version => { await trigger.click(); await page.locator(`.legacy-notification-entry[data-version="${version}"]`).click(); };
        const dialog = page.locator('.legacy-release-dialog');
        const read = () => page.evaluate(prefix => localStorage.getItem(prefix + 'FocusTodo.releaseRead'), prefix);
        await open(updates[1].version);
        assert.equal(await read(), null);
        await dialog.locator('footer button').click();
        await dialog.waitFor({ state: 'hidden' });
        await open(localVersion);
        const scroll = dialog.locator('[data-local-scroll]');
        const geometry = () => dialog.evaluate(dialog => {
            const view = dialog.querySelector('[data-local-scroll]'), track = view.nextElementSibling;
            const header = dialog.querySelector('header').getBoundingClientRect(), tile = dialog.querySelector('header img').getBoundingClientRect();
            const footer = dialog.querySelector('footer button').getBoundingClientRect(), r = view.getBoundingClientRect(), outer = dialog.getBoundingClientRect();
            return { header: header.y, tile: tile.y, footer: footer.y, inside: outer.y >= 0 && outer.bottom <= innerHeight &&
                header.bottom <= r.top && footer.y >= r.bottom && footer.bottom <= outer.bottom && track.getBoundingClientRect().right <= r.right,
                overflow: view.scrollHeight - view.clientHeight, outerOverflow: dialog.scrollHeight - dialog.clientHeight, top: view.scrollTop };
        });
        await dialog.locator('.legacy-local-scroll-track').waitFor({ state: 'attached' });
        const before = await geometry();
        assert(before.inside && before.overflow > 0 && before.outerOverflow === 0 && before.top === 0, JSON.stringify(before));
        await scroll.focus();
        await page.keyboard.press('End');
        await page.waitForFunction(() => document.querySelector('.legacy-release-scroll [data-local-scroll]').scrollTop > 0);
        const after = await geometry();
        assert.deepEqual([after.header, after.tile, after.footer], [before.header, before.tile, before.footer]);
        await scroll.evaluate(view => { view.scrollTop = 0; });
        await dialog.locator('footer button').click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await read(), localVersion);
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
    } finally { await context.close(); }
}

async function timerOverflow(browser, origin, engine, deviceScaleFactor, width) {
    const { page, context } = await contextFor(browser, origin, { viewport: { width, height: 650 }, deviceScaleFactor, reducedMotion: 'no-preference' });
    const evidenceRows = [];
    try {
        await page.goto(origin);
        await page.getByTestId('app-shell').waitFor();
        const floating = page.getByTestId('timer-floating');
        await floating.hover();
        await floating.locator('.legacy-timer-float-expand').click();
        const rail = page.locator('.legacy-timer-widget-rail'), toggle = rail.locator('button.legacy-timer-widget-toggle');
        const startSample = root => page.evaluate(root => {
            const container = document.querySelector(root), frames = [];
            let frame;
            const sample = () => {
                const r = container.getBoundingClientRect();
                const offenders = container.scrollWidth > container.clientWidth ? Array.from(container.querySelectorAll('*')).filter(node =>
                    node.getBoundingClientRect().right > r.right + 1).slice(0, 12).map(node => String(node.className)) : [];
                frames.push({ client: container.clientWidth, scroll: container.scrollWidth, left: container.scrollLeft, offenders });
                frame = requestAnimationFrame(sample);
            };
            sample();
            window.stopOverflowSample = () => { cancelAnimationFrame(frame); return frames; };
        }, root);
        const stopSample = async action => {
            const frames = await page.evaluate(() => window.stopOverflowSample());
            evidenceRows.push({ action, frames });
            assert(frames.length >= 3);
            assert(frames.every(row => row.scroll === row.client && row.left === 0), JSON.stringify(frames.filter(row => row.scroll !== row.client || row.left)));
        };
        await page.locator('.domain-full-timer').evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
        const railMove = async () => {
            await toggle.click();
            await rail.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
        };
        if (await rail.getAttribute('data-expanded') !== 'true') await railMove();
        await startSample('.domain-full-timer');
        const reversedMidway = await rail.evaluate(rail => {
            const button = rail.querySelector('.legacy-timer-widget-toggle');
            button.click();
            return new Promise(resolve => {
                const timeout = setTimeout(() => resolve(false), 1000);
                const midway = () => {
                    const width = rail.getBoundingClientRect().width;
                    if (width <= 26) { clearTimeout(timeout); resolve(false); }
                    else if (width < 400) { button.click(); clearTimeout(timeout); resolve(true); }
                    else requestAnimationFrame(midway);
                };
                requestAnimationFrame(midway);
            });
        });
        assert(reversedMidway, 'The reversal was exercised during the width transition');
        await rail.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
        await railMove();
        await railMove();
        await stopSample('reverse, collapse, expand');
        await page.locator('.legacy-timer-edit-widgets button').click();
        const editor = page.locator('.legacy-widget-editor');
        const handles = editor.locator('ul:not(.workspace-drag-preview) > li button');
        await startSample('.legacy-widget-editor');
        for (let i = 0; i < 2; i++) {
            const source = handles.nth(i);
            const r = await source.boundingBox();
            const row = await source.locator('..').boundingBox();
            await page.mouse.move(r.x + 10, r.y + 18);
            await page.mouse.down();
            await page.mouse.move(r.x + 126, r.y + 26, { steps: 5 });
            const ghost = editor.locator('.workspace-drag-preview');
            assert(Math.abs((await ghost.boundingBox()).x - row.x - 116) < 1);
            await page.mouse.up();
            await ghost.waitFor({ state: 'detached' });
        }
        await editor.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)));
        await stopSample('two rightward releases');
    } finally {
        fs.mkdirSync(evidence, { recursive: true });
        fs.writeFileSync(path.join(evidence, `timer-overflow-${engine}-${deviceScaleFactor}-${width}.json`), JSON.stringify(evidenceRows));
        await context.close();
    }
}

(async () => {
    const server = createStandaloneServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    try {
        for (const engine of (process.env.FOCUS_STANDALONE_ENGINES || 'chromium').split(',')) {
            const browser = await launch(engine);
            try {
                for (const locale of ['en', 'zh-CN']) await settingsAndUpdate(browser, origin, locale);
                for (const [dpr, width] of [[1, 1280], [2, 1000]]) await timerOverflow(browser, origin, engine, dpr, width);
                console.log(`PASS ${engine}: settings click targets, bilingual about/update, and timer overflow`);
            } finally { await browser.close(); }
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
