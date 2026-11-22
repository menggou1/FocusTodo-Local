const { paired, copyFixture, assert, fs, path } = require('./ui-restore-helpers.cjs');

const output = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || 'dist/acceptance/report-scroll');

async function seed(pair) {
    await pair.old.evaluate(async () => {
        const db = await FocusLocalData.open(), now = new Date();
        now.setHours(12, 0, 0, 0);
        await FocusLocalData.transaction(db, ['Pomodoro'], 'readwrite', tx => {
            for (let day = 0; day < 365; day++) for (let i = 0; i < 8; i++) {
                const date = new Date(now);
                date.setDate(now.getDate() - day);
                date.setHours(3 + i, 30);
                tx.objectStore('Pomodoro').put({ id: `scroll-${day}-${i}`, objType: 'POMODORO', state: 0,
                    endDate: +date, creationDate: +date, interval: 1500, pomodoroInterval: 1500,
                    taskId: '', subtaskId: '', isManual: true });
            }
        });
    });
    await pair.old.reload();
    await pair.old.evaluate(() => FocusLocalReady);
    await copyFixture(pair);
}

async function trace(page, inner) {
    await inner.hover();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(row => [row.name, row.value]));
    const tracing = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    const events = [];
    cdp.on('Tracing.dataCollected', data => events.push(...data.value));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline', options: 'record-as-much-as-possible' });
    const before = await metrics();
    await page.evaluate(() => {
        const view = document.querySelector('.legacy-review-scroll');
        const canvas = view.querySelector('canvas');
        const outer = document.querySelector('.legacy-report-overlay>.domain-overlay-body');
        const sample = window.reviewSample = { frames: [], redraws: 0, tasks: [] };
        const observer = new MutationObserver(records => { sample.redraws += records.length; });
        observer.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
        const tasks = new PerformanceObserver(list => sample.tasks.push(...list.getEntries().map(entry => entry.duration)));
        tasks.observe({ type: 'longtask' });
        let frame;
        function read(time) { sample.frames.push({ time, inner: view.scrollTop, outer: outer.scrollTop }); frame = requestAnimationFrame(read); }
        frame = requestAnimationFrame(read);
        window.finishReviewSample = () => { cancelAnimationFrame(frame); observer.disconnect(); tasks.disconnect(); return sample; };
    });
    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 120);
    await page.waitForFunction(() => document.querySelector('.legacy-review-scroll').scrollTop >= 3400);
    const sample = await page.evaluate(() => window.finishReviewSample());
    const after = await metrics();
    await cdp.send('Tracing.end');
    await tracing;
    await cdp.detach();
    const gaps = sample.frames.slice(1).map((row, i) => row.time - sample.frames[i].time);
    const timings = Object.fromEntries(['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'].map(key => [key, after[key] - before[key]]));
    return { ...sample, timings, paints: events.filter(event => event.name === 'Paint').length,
        framesOver33ms: gaps.filter(gap => gap > 33.5).length, maxFrameGapMs: Math.max(...gaps) };
}

async function editAndSample(page, inner) {
    await inner.evaluate(view => { view.scrollTop = 0; });
    const record = inner.locator('canvas');
    const point = await record.evaluate(canvas => {
        const left = Number(canvas.dataset.chartLeft), r = canvas.getBoundingClientRect();
        return { x: r.left + left + (r.width - left) * 3.25 / 24, y: r.top + 9 };
    });
    await page.mouse.click(point.x, point.y);
    const editor = page.getByRole('dialog', { name: 'Edit Pomodoro Record', exact: true });
    await editor.waitFor();
    await editor.locator('.legacy-record-duration-text').click();
    await editor.getByRole('option', { name: '26 Minutes', exact: true }).click();
    await record.evaluate(canvas => {
        window.recordRevealDuringEdit = [];
        const observer = new MutationObserver(entries => {
            window.recordRevealDuringEdit.push(...entries.map(entry => entry.oldValue), canvas.dataset.reveal);
        });
        observer.observe(canvas, { attributes: true, attributeFilter: ['data-reveal'], attributeOldValue: true });
    });
    await editor.locator('footer button.primary').click();
    await editor.waitFor({ state: 'hidden' });
    const reveal = await page.evaluate(() => window.recordRevealDuringEdit);
    return reveal;
}

(async () => {
    const pair = await paired({ locale: 'en', dark: true, width: 900, height: 700, reducedMotion: 'no-preference' });
    try {
        await seed(pair);
        await pair.old.locator('[class*=HomeHeader-report]').click();
        await pair.new.locator('[data-view=reports]').click();
        const page = pair.new, inner = page.locator('.legacy-review-scroll');
        await page.waitForFunction(() => document.querySelector('.legacy-review-scroll canvas')?.dataset.reveal === '1');
        const old = await pair.old.locator('[class*=ReviewChart-root]').evaluate(node => Array.from(node.querySelectorAll('div'), el => ({
            name: el.className, overflow: getComputedStyle(el).overflow, height: el.clientHeight, scroll: el.scrollHeight
        })).filter(row => row.scroll > row.height && row.overflow !== 'visible'));
        const outer = page.locator('.legacy-report-overlay>.domain-overlay-body');
        const result = await trace(page, inner);
        const bounds = await inner.evaluate(view => {
            const track = view.nextElementSibling, r = view.getBoundingClientRect(), t = track.getBoundingClientRect();
            return { local: track.classList.contains('legacy-local-scroll-track'), top: t.top-r.top, bottom: t.bottom-r.bottom,
                right: t.right-r.right, recordCount: Number(view.querySelector('canvas').dataset.recordCount) };
        });
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'report-scroll.json'), JSON.stringify({ old, bounds, ...result }, null, 2));
        console.log(JSON.stringify({ old, bounds, timings: result.timings, paints: result.paints, redraws: result.redraws,
            frames: result.frames.length, framesOver33ms: result.framesOver33ms, maxFrameGapMs: result.maxFrameGapMs }));
        if (process.argv.includes('--measure-before')) {
            const reveal = await editAndSample(page, inner);
            assert(reveal.some(value => Number(value) < 1), JSON.stringify(reveal));
            fs.writeFileSync(path.join(output, 'report-scroll.json'), JSON.stringify({ old, bounds, ...result, revealDuringEdit: reveal }, null, 2));
            console.log('Baseline replayed the reveal when the record changed');
            return;
        }
        assert.equal(bounds.recordCount, 2920);
        assert(bounds.local && bounds.top >= 0 && bounds.bottom <= 0 && bounds.right <= 0);
        assert.equal(result.redraws, 0, 'Scrolling must not reset the record bitmap');
        assert(result.frames.every((row, i) => !i || row.inner >= result.frames[i - 1].inner && row.outer === result.frames[0].outer));
        await inner.evaluate(view => { view.scrollTop = view.scrollHeight; });
        await inner.hover();
        await page.mouse.wheel(0, 100);
        await page.waitForFunction(() => document.querySelector('.legacy-report-overlay>.domain-overlay-body').scrollTop > 0);
        await outer.evaluate(view => { view.scrollTop = 0; });
        await inner.focus();
        await page.keyboard.press('Home');
        await page.waitForFunction(() => document.querySelector('.legacy-review-scroll').scrollTop === 0);
        const track = inner.locator('xpath=following-sibling::*[1]');
        const box = await inner.boundingBox();
        await page.mouse.move(box.x + box.width - 5, box.y + 12);
        const thumb = await track.locator('.legacy-scroll-thumb').boundingBox();
        await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
        await page.mouse.down();
        await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + 95, { steps: 8 });
        await page.mouse.up();
        assert((await inner.evaluate(view => view.scrollTop)) > 0);
        assert.equal(await outer.evaluate(view => view.scrollTop), 0);
        await page.setViewportSize({ width: 720, height: 590 });
        const narrow = await track.evaluate(track => {
            const view = track.previousElementSibling.getBoundingClientRect(), rail = track.getBoundingClientRect();
            return rail.top >= view.top && rail.bottom <= view.bottom && rail.right <= view.right;
        });
        assert(narrow);
        const reveal = await editAndSample(page, inner);
        assert(reveal.length > 0 && reveal.every(value => value === '1'), JSON.stringify(reveal));
        fs.writeFileSync(path.join(output, 'report-scroll.json'), JSON.stringify({ old, bounds, ...result, revealDuringEdit: reveal }, null, 2));
        console.log('PASS wheel handoff, keyboard, thumb drag, narrow clipping, and editing without replaying the chart reveal');
    } finally { await pair.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
