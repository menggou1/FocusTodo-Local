const { createStandaloneServer } = require('../../scripts/standalone-server.cjs');
const { assert, contextFor, evidence, fs, launch, path } = require('./helpers.cjs');

const railSelector = '.legacy-timer-widget-rail';
const toggleSelector = '.legacy-timer-widget-toggle';
const editorSelector = '.legacy-widget-editor';
const rowSelector = 'ul:not(.workspace-drag-preview)>li[data-widget-type]';

async function startServer(root) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'prototype-build.json'), 'utf8')).kind, 'isolated-prototype');
    const server = createStandaloneServer({ root });
    do {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        if (server.address().port >= 11000) return server;
        await new Promise(resolve => server.close(resolve));
    } while (true);
}

async function railTrace(page, reverse = false) {
    return page.locator(railSelector).evaluate((rail, { reverse, toggleSelector }) => new Promise((resolve, reject) => {
        const toggle = rail.querySelector(toggleSelector);
        const timer = rail.closest('dialog');
        const main = timer.querySelector('.legacy-timer-main');
        const runs = [];
        const observer = new MutationObserver(onRun);
        const timeout = setTimeout(() => { observer.disconnect(); reject(Error('Rail transition did not run')); }, 2000);
        async function onRun() {
            try {
                const motion = rail.getAnimations().find(a => a.transitionProperty === 'width');
                if (!motion) throw Error('The rail state changed without a width transition');
                const pan = main.getAnimations().find(a => a.transitionProperty === 'margin-right');
                const step = [motion, pan].filter(Boolean);
                step.forEach(a => { a.pause(); a.currentTime = 0; });
                await Promise.all(step.map(a => a.ready));
                const timing = motion.effect.getTiming();
                const reversing = reverse && runs.length === 0;
                const frames = (reversing ? [0, 38, 75] : [0, .15, .3, .5, .7, .85, .99].map(t => t * timing.duration)).map(time => {
                    step.forEach(a => { a.currentTime = time; });
                    const view = rail.querySelector('.legacy-timer-widgets');
                    const card = view.querySelector('section');
                    const rect = element => {
                        const { x, y, width, height } = element.getBoundingClientRect();
                        return [x, y, width, height];
                    };
                    return { time, widths: [timer.clientWidth, timer.scrollWidth], scrollLeft: timer.scrollLeft,
                        rail: rect(rail), pane: rect(view), card: rect(card), toggle: rect(toggle), main: rect(main),
                        opacity: getComputedStyle(card).opacity, inert: view.inert };
                });
                runs.push({ duration: timing.duration, easing: motion.effect.getKeyframes().map(frame => frame.easing), frames });
                if (reversing) {
                    toggle.click();
                    return;
                }
                step.forEach(a => a.finish());
                clearTimeout(timeout);
                observer.disconnect();
                resolve(runs);
            } catch (error) { clearTimeout(timeout); observer.disconnect(); reject(error); }
        }
        observer.observe(rail, { attributeFilter: ['data-expanded'] });
        toggle.click();
    }), { reverse, toggleSelector });
}

async function widgetTrace(page) {
    const editor = page.locator(editorSelector);
    const rows = editor.locator(rowSelector);
    await page.locator('.legacy-timer-edit-widgets button').click();
    await editor.evaluate(node => Promise.all(node.getAnimations().map(a => a.finished)));
    const initial = await rows.evaluateAll(elements => elements.map(node => node.dataset.widgetType));
    await page.evaluate(editorSelector => {
        window.rowTweens = [];
        const animate = Element.prototype.animate;
        let pending = [];
        function sampleBatch() {
            const batch = pending;
            pending = [];
            for (const time of [0, 30, 60, 90, 120, 150, 179]) {
                batch.forEach(({ tween }) => { tween.currentTime = time; });
                for (const { node, editor, result } of batch) {
                    const { x, y, width, height } = node.getBoundingClientRect();
                    const style = getComputedStyle(node);
                    const hit = document.elementFromPoint(x + width / 2, y + height / 2);
                    result.frames.push({ time, x, y, opacity: style.opacity, z: style.zIndex, hit: node.contains(hit),
                        widths: [editor.clientWidth, editor.scrollWidth], scrollLeft: editor.scrollLeft });
                }
            }
            for (const { tween, initialTime, result } of batch) {
                tween.currentTime = initialTime;
                window.rowTweens.push(result);
            }
        }
        Element.prototype.animate = function (...args) {
            const tween = animate.apply(this, args);
            const editor = this.closest(editorSelector);
            if (!editor || !this.matches('[data-widget-type]')) return tween;
            const { duration, easing } = tween.effect.getTiming();
            const active = this.hasAttribute('data-reorder-active');
            // Sample the entire React commit at the same animation time so
            // hit testing sees all moving peers together.
            if (!pending.length) queueMicrotask(sampleBatch);
            pending.push({ node: this, editor, tween, initialTime: tween.currentTime ?? 0,
                result: { id: this.dataset.widgetType, active, duration, easing,
                    transforms: tween.effect.getKeyframes().map(frame => frame.transform), frames: [] } });
            return tween;
        };
    }, editorSelector);
    const waitForRows = () => editor.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(a => a.finished)));
    const drag = async (accept, dx) => {
        const source = await rows.first().boundingBox();
        const target = await rows.last().boundingBox();
        const start = { x: source.x + 55, y: source.y + source.height / 2 };
        await page.evaluate(() => { window.rowTweens = []; });
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        const previews = [];
        for (const [x, y] of [[start.x + 12, start.y + 7], [start.x + dx, accept ? target.y + target.height * .82 : start.y + 16]]) {
            await page.mouse.move(x, y);
            const ghost = editor.locator('.workspace-drag-preview');
            await ghost.waitFor();
            previews.push(await ghost.evaluate(node => {
                const { x, y, width, height } = node.getBoundingClientRect();
                return { x, y, width, height, opacity: getComputedStyle(node.firstElementChild).opacity, z: getComputedStyle(node).zIndex };
            }));
            assert(Math.abs(previews.at(-1).x - source.x - (x - start.x)) < 1);
            assert(Math.abs(previews.at(-1).y - source.y - (y - start.y)) < 1);
        }
        // Let peers finish the live reorder so their release samples have the
        // same start times in both browser contexts.
        await waitForRows();
        await page.mouse.up();
        await editor.locator('.workspace-drag-preview').waitFor({ state: 'detached' });
        const tweens = await page.evaluate(() => window.rowTweens);
        await waitForRows();
        return { previews, tweens };
    };
    const accepted = await drag(true, 48);
    assert.deepEqual(await rows.evaluateAll(elements => elements.map(node => node.dataset.widgetType)), [...initial.slice(1), initial[0]]);
    const edge = await drag(false, 294);
    assert.deepEqual(await rows.evaluateAll(elements => elements.map(node => node.dataset.widgetType)), [...initial.slice(1), initial[0]]);
    await editor.locator('footer button.primary').click();
    await editor.waitFor({ state: 'detached' });
    const saved = await page.evaluate(() => localStorage.getItem('FocusTodoStandalone.data.AllWidgets').split(',').map(Number));
    assert.deepEqual(saved, [...initial.slice(1), initial[0]].map(Number));
    return { accepted, edge, saved };
}

async function sample(browser, server, viewport, deviceScaleFactor) {
    const origin = 'http://127.0.0.1:' + server.address().port;
    const { page, context, errors, external } = await contextFor(browser, origin, { locale: 'en', viewport, deviceScaleFactor, reducedMotion: 'no-preference' });
    try {
        await context.addInitScript(() => {
            localStorage.setItem('FocusTodoStandalone.data.WidgetExpanded', 'true');
            localStorage.setItem('FocusTodoStandalone.data.DarkMode', 'false');
        });
        await page.goto(origin);
        await page.getByTestId('app-shell').waitFor();
        await page.getByTestId('timer-floating').hover();
        await page.locator('.legacy-timer-float-expand').click();
        await page.locator('.domain-full-timer').evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(a => a.finished)));
        const collapse = await railTrace(page);
        await page.locator('.legacy-timer-widgets').waitFor({ state: 'detached' });
        const expand = await railTrace(page);
        const reversal = await railTrace(page, true);
        const reorder = await widgetTrace(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        return { rail: { collapse, expand, reversal }, reorder };
    } finally { await context.close(); }
}

function visualGeometry(result) {
    // The baseline transient scroll extent is the bug. Compare every other
    // sampled property, including hit testing, opacity and starting positions.
    return JSON.parse(JSON.stringify(result, (key, value) => key === 'widths' ? undefined : value));
}

function assertMotion(result) {
    const { collapse, expand, reversal } = result.rail;
    for (const runs of [collapse, expand, reversal]) for (const run of runs) {
        assert(run.frames.every(f => f.widths[0] === f.widths[1] && f.scrollLeft === 0));
        assert(run.frames.every(f => f.card[2] === 330 && f.opacity === '1'));
        assert(run.easing.every(easing => easing === 'linear'));
    }
    assert.equal(collapse[0].duration, 150);
    assert.equal(expand[0].duration, 150);
    assert(collapse[0].frames.at(-1).card[0] - collapse[0].frames[0].card[0] > 300);
    assert(expand[0].frames[0].card[0] - expand[0].frames.at(-1).card[0] > 300);
    assert(Math.abs(reversal[0].frames.at(-1).rail[0] - reversal[1].frames[0].rail[0]) < 1);
    for (const drag of Object.values({ accepted: result.reorder.accepted, edge: result.reorder.edge })) {
        assert(drag.previews.every(f => f.opacity === '1' && f.z === '100000'));
        const row = drag.tweens.find(tween => tween.active);
        const { x, y } = drag.previews.at(-1);
        assert(Math.abs(row.frames[0].x - x) < 1 && Math.abs(row.frames[0].y - y) < 1);
        assert(drag.tweens.every(t => t.duration === 180 && t.easing === 'ease-out'));
        assert(drag.tweens.every(t => t.frames.every(f => f.widths[0] === f.widths[1] && f.scrollLeft === 0)));
        assert(row.frames.every(f => f.opacity === '1' && f.z === '10'));
    }
    assert(result.reorder.accepted.tweens.filter(t => !t.active && t.frames.some(f => Math.abs(f.y - t.frames[0].y) > 40)).length >= 2);
}

(async () => {
    const baseline = process.env.FOCUS_MOTION_BASELINE_SITE;
    const regression = process.env.FOCUS_MOTION_REGRESSION_SITE;
    assert(!regression || baseline, 'Supply both snapshots for the negative control');
    const sites = [...(baseline ? [['baseline', baseline]] : []), ...(regression ? [['regression', regression]] : []),
        ['current', path.resolve('dist/standalone/site')]];
    const servers = [];
    fs.mkdirSync(evidence, { recursive: true });
    try {
        for (const [label, site] of sites) servers.push([label, await startServer(site)]);
        for (const engine of (process.env.FOCUS_STANDALONE_ENGINES || 'chromium').split(',')) {
            const browser = await launch(engine);
            try {
                for (const [width, deviceScaleFactor] of [[1280, 1], [1000, 2]]) {
                    const result = {};
                    for (const [label, server] of servers) result[label] = await sample(browser, server, { width, height: 650 }, deviceScaleFactor);
                    fs.writeFileSync(path.join(evidence, `timer-widget-motion-${engine}-${width}-${deviceScaleFactor}.json`), JSON.stringify(result, null, 2));
                    assertMotion(result.current);
                    if (result.baseline) assert.deepEqual(visualGeometry(result.current), visualGeometry(result.baseline));
                    if (result.regression) {
                        assert.notDeepEqual(visualGeometry(result.regression.rail), visualGeometry(result.baseline.rail));
                        const release = result.regression.reorder.accepted;
                        const start = release.tweens.find(tween => tween.active).frames[0];
                        assert(Math.abs(start.x - release.previews.at(-1).x) > 40);
                    }
                    console.log(`PASS ${engine} ${width} DPR ${deviceScaleFactor}: rail, reversal, diagonal handoff, peers, persistence and overflow`);
                }
            } finally { await browser.close(); }
        }
    } finally { await Promise.all(servers.map(([, server]) => new Promise(resolve => server.close(resolve)))); }
})().catch(error => { console.error(error); process.exitCode = 1; });
