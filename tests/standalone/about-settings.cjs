const {paired, assert, fs, path, root} = require('./ui-restore-helpers.cjs');
const release = require('../../release.json');

const repository = 'https://github.com/menggou1/FocusTodo-Local';
const official = 'https://www.focustodo.cn/';
const near = (actual, expected, name) => assert(Math.abs(actual - expected) <= 1, name + ': ' + actual + ' vs ' + expected);
const properties = link => link.evaluate(node => {
    const style = getComputedStyle(node);
    return {
        background: style.backgroundColor,
        radius: style.borderRadius,
        outline: style.outlineStyle + ' ' + style.outlineWidth + ' ' + style.outlineColor,
        transition: style.transitionDuration
    };
});

async function openRepository(page, link) {
    const context = page.context();
    const destination = url => url.href === repository;
    await context.route(destination, route => route.fulfill({body: 'Repository destination fixture'}));
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
    try {
        await popup.waitForURL(repository, {waitUntil: 'domcontentloaded'});
        assert.equal(await popup.evaluate(() => window.opener), null);
    } finally {
        await popup.close();
        await context.unroute(destination);
    }
}

async function checkKeyboardActivation(link, destination) {
    // Record the trusted click from Enter before preventing real store navigation.
    await link.evaluate(node => node.addEventListener('click', event => {
        if (!event.defaultPrevented && event.isTrusted) node.dataset.keyboardDestination = node.href;
        event.preventDefault();
    }, {once: true}));
    await link.press('Enter');
    assert.equal(await link.getAttribute('data-keyboard-destination'), destination);
}
async function check(locale, dark, output) {
    const zh = locale === 'zh-CN';
    const pair = await paired({locale, dark, reducedMotion: dark ? 'reduce' : 'no-preference'});
    try {
        await pair.old.locator('img[src="img/header-setting.png"]').evaluate(node => node.click());
        await pair.old.locator('[class*=Settings-menuName]').filter({hasText: zh ? /^关于$/ : /^About$/}).click();
        await pair.new.locator('[data-view=settings]').click();
        await pair.new.locator('[data-settings-tab=about]').click();
        const about = pair.new.locator('.legacy-about');
        const rows = about.locator('.legacy-account-row');
        assert.equal(await rows.count(), 8);
        assert.equal(await about.locator('h1,h2,header').count(), 0);
        assert.match(await rows.nth(0).innerText(), new RegExp(release.localVersion.replaceAll('.', '\\.') + ' · ' + release.date));
        assert((await rows.nth(1).innerText()).includes(release.author));
        assert.equal(await rows.nth(2).getByRole('link').innerText(), 'FocusTodo 7.1.1 · Lâm Ngọc Khương');
        assert.equal(await rows.nth(2).getByRole('link').getAttribute('href'), 'https://github.com/lamngockhuong/focustodo');
        assert.equal(await rows.nth(3).getByRole('link', {name:'MIT', exact:true}).getAttribute('href'), repository + '/blob/main/LICENSE');
        assert.equal(await rows.nth(3).getByRole('link').last().getAttribute('href'), repository + '/blob/main/THIRD-PARTY-NOTICES.txt');
        assert.match(await rows.nth(4).innerText(), zh ? /保存在当前浏览器中/ : /stored in this browser/);
        assert.match(await rows.nth(7).innerText(), zh ? /感谢原作者的工作，欢迎通过官方渠道支持正版 Focus To-Do/ : /We thank its creators and encourage you to support Focus To-Do through its official channels/);
        const website = rows.nth(6).getByRole('link', {name:'www.focustodo.cn'});
        assert.equal(await website.getAttribute('href'), official);
        assert.equal(await website.evaluate(node => getComputedStyle(node).color), 'rgb(24, 144, 255)');

        const github = rows.nth(1).getByRole('link', {name:/GitHub/});
        const oldGithub = pair.old.locator('.focus-repository-link');
        const downloadLabel = rows.nth(5).locator(':scope > span');
        assert.equal(await downloadLabel.innerText(), zh ? '下载官方版本' : 'Download the official version');
        assert.equal(await downloadLabel.getAttribute('tabindex'), null);
        assert.equal(await downloadLabel.evaluate(node => getComputedStyle(node).color),
            await rows.nth(0).locator(':scope > span').first().evaluate(node => getComputedStyle(node).color));
        const platforms = rows.nth(5).locator('.legacy-platforms a');
        const oldPlatforms = pair.old.locator('[class*=AboutSettings-appDownload] img');
        assert.equal(await platforms.count(), 6);
        assert.equal(await oldPlatforms.count(), 6);

        await pair.old.evaluate(() => document.fonts.ready);
        await pair.new.evaluate(() => document.fonts.ready);
        const oldRow = await oldPlatforms.first().locator('xpath=ancestor::tr[1]').boundingBox();
        const bounds = await rows.evaluateAll(nodes => nodes.map(row => {
            const box = node => node.getBoundingClientRect();
            return {x:box(row).x, y:box(row).y, height:box(row).height, content:box(row.lastElementChild).x,
                font:getComputedStyle(row).fontSize};
        }));
        near(bounds[0].x, oldRow.x, 'Label column start');
        for (const [i, row] of bounds.entries()) {
            near(row.content, bounds[0].content + (i === 5 ? -4 : 0), 'Aligned content column');
            assert.equal(row.font, '14px');
            assert(row.height >= oldRow.height - 1);
            if (i > 0) near(row.y, bounds[i-1].y + bounds[i-1].height, 'Contiguous rows');
        }

        for (const [index, name] of ['Apple', 'Android', 'Windows', 'macOS', 'Chrome', 'Edge'].entries()) {
            const link = platforms.nth(index);
            assert.equal(await link.getAttribute('aria-label'), zh ? name + ' 官方版本下载' : 'Official ' + name + ' download');
            const image = link.locator('img');
            const [oldBox, box, target] = await Promise.all([oldPlatforms.nth(index).boundingBox(), image.boundingBox(), link.boundingBox()]);
            near(box.x, oldBox.x, name + ' artwork column');
            near(box.y - bounds[5].y - bounds[5].height / 2, oldBox.y - oldRow.y - oldRow.height / 2, name + ' centered artwork');
            assert.deepEqual([box.width, box.height, target.width, target.height], [20, 20, 28, 28]);
            assert.equal(await link.getAttribute('href'), [
                'https://itunes.apple.com/' + (zh ? 'CN' : 'US') + '/app/id966057213?mt=8',
                zh ? 'https://sj.qq.com/myapp/detail.htm?apkName=com.superelement.pomodoro'
                    : 'https://play.google.com/store/apps/details?id=com.superelement.pomodoro',
                'https://www.microsoft.com/store/apps/9N8GPB2TK8GB',
                'https://itunes.apple.com/' + (zh ? 'CN' : 'US') + '/app/id1258530160?mt=12',
                'https://chrome.google.com/webstore/detail/ngceodoilcgpmkijopinlkmohnfifjfb',
                'https://microsoftedge.microsoft.com/addons/detail/ffhiojdfkpecinnmmbhmijmgffknaokd'
            ][index]);
        }
        const artwork = await github.locator('img').boundingBox();
        const oldArtwork = await oldGithub.locator('img').boundingBox();
        assert.deepEqual([artwork.width, artwork.height], [oldArtwork.width, oldArtwork.height]);
        assert.deepEqual([artwork.width, artwork.height], [24, 24]);
        const glyph = await github.locator('img').evaluate(async node => (await fetch(node.src)).text());
        assert.equal(glyph.trim(), fs.readFileSync(path.join(root, 'public/img/github.svg'), 'utf8').trim());
        await oldGithub.hover();
        const legacyHover = await properties(oldGithub);
        await pair.new.mouse.move(0, 0);
        for (const link of [github, ...await platforms.all()]) {
            const url = await link.getAttribute('href');
            assert.equal(new URL(url).protocol, 'https:');
            assert.equal(await link.getAttribute('target'), '_blank');
            assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
            const before = await link.boundingBox();
            const normal = await properties(link);
            await link.hover();
            const hover = await properties(link);
            assert.equal(hover.background, legacyHover.background);
            assert.equal(hover.radius, legacyHover.radius);
            assert.notEqual(hover.background, normal.background);
            assert.equal(hover.transition, '0s');
            assert.deepEqual(await link.boundingBox(), before);
        }
        await pair.new.keyboard.press('Tab');
        await github.focus();
        assert.equal((await properties(github)).outline, 'solid 3px rgb(66, 149, 196)');
        await checkKeyboardActivation(github, repository);
        await openRepository(pair.new, github);
        await rows.nth(3).getByRole('link').last().focus();
        for (const link of await platforms.all()) {
            await pair.new.keyboard.press('Tab');
            assert(await link.evaluate(node => node === document.activeElement && node.matches(':focus-visible')));
            assert.equal((await properties(link)).outline, 'solid 3px rgb(66, 149, 196)');
            await checkKeyboardActivation(link, await link.getAttribute('href'));
        }
        await pair.new.keyboard.press('Tab');
        assert(await website.evaluate(node => node === document.activeElement));
        await checkKeyboardActivation(website, official);
        await pair.new.mouse.move(0, 0);
        await pair.new.screenshot({path:path.join(output, locale + '-' + dark + '-about.png')});
        await pair.old.screenshot({path:path.join(output, locale + '-' + dark + '-archive.png')});

        await pair.new.setViewportSize({width:375, height:320});
        const scroller = pair.new.locator('.legacy-settings-content');
        const compact = await rows.evaluateAll(nodes => nodes.every(row => {
            const [label, content] = [...row.children].map(node => node.getBoundingClientRect());
            return label.right <= content.left && content.right <= row.getBoundingClientRect().right + 1;
        }));
        assert(compact, 'Narrow rows stay in their columns');
        assert(await scroller.evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight > node.clientHeight));
        const close = pair.new.getByTestId('close-page');
        const headerBefore = await close.boundingBox();
        assert(headerBefore.y >= 0 && headerBefore.y + headerBefore.height <= 320);
        await rows.last().scrollIntoViewIfNeeded();
        assert.deepEqual(await close.boundingBox(), headerBefore);
        assert(await scroller.evaluate(node => node.scrollTop > 0));
        await pair.new.screenshot({path:path.join(output, locale + '-' + dark + '-compact.png')});
        await pair.new.locator('[data-settings-tab=pomodoro]').click();
        assert.equal(await scroller.evaluate(node => node.scrollTop), 0);
        // A 200% desktop zoom halves the CSS viewport width.
        await pair.new.setViewportSize({width:640,height:450});
        await pair.new.locator('[data-settings-tab=about]').click();
        assert(await scroller.evaluate(node => node.scrollWidth <= node.clientWidth));
        for (const handle of pair.handles) {
            assert.deepEqual(handle.errors, []);
            assert.deepEqual(handle.external, []);
        }
        console.log('About settings passed: ' + locale + ', ' + (dark ? 'dark' : 'light'));
    } finally {
        await pair.close();
    }
}

(async () => {
    const output = path.join(process.env.FOCUS_ACCEPTANCE_DIR || 'dist/acceptance', 'about-settings');
    fs.mkdirSync(output, {recursive:true});
    for (const locale of ['zh-CN', 'en']) {
        for (const dark of [false, true]) await check(locale, dark, output);
    }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
