const { assert, path, evidence } = require('./helpers.cjs');

const when = clock => Date.parse('2026-11-12T' + clock + ':00+08:00');
const name = '阅读计划与复盘 · A long name for the planned task with several more words';
const panel = '.legacy-calendar-pane';
const toggle = '.legacy-calendar-pane-toggle';
const grid = '.domain-calendar-grid:not(.month)';
const scroll = '.legacy-calendar-scroll';
const schedule = id => '[data-event-id="' + id + '"]';
const close = (actual, expected, label) => assert(Math.abs(actual - expected) < 1.1, label + ': ' + actual + ' vs ' + expected);

async function prepare(page, locale, rows) {
    await page.clock.setFixedTime(new Date(when('08:00')));
    await page.evaluate(async ({ name, rows, today }) => {
        const db = await new Promise((resolve, reject) => {
            const opening = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
            opening.onsuccess = () => resolve(opening.result);
            opening.onerror = () => reject(opening.error);
        });
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(['Task', 'Schedule'], 'readwrite');
                tx.oncomplete = resolve;
                tx.onabort = () => reject(tx.error);
                tx.objectStore('Task').add({ id: 'calendar-task', objType: 'TASK', state: 0, name, projectId: 'id-task-tasks',
                    pomodoroInterval: 3000, estimatePomoNum: 2, deadline: today + 14 * 3600000, creationDate: today, isFinished: false });
                for (const {id, endDate, interval} of rows) {
                    tx.objectStore('Schedule').add({id, endDate, interval, objType: 'SCHEDULE', state: 0, taskId: 'calendar-task',
                        projectId: 'id-task-tasks', subtaskId: '', isAllDay: false, creationDate: today, sync: 0});
                }
            });
        } finally { db.close(); }
        sessionStorage.setItem('FocusTodo.calendarScroll', String(8 * 124));
    }, {name, today: when('08:00'), rows});
    await page.reload();
    await page.getByRole('button', {name: locale === 'en' ? 'Schedule' : '日程', exact: true}).click();
}

async function readGeometry(card) {
    return card.evaluate(el => {
        const box = el.getBoundingClientRect(), axis = el.parentElement.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 3, box.top + box.height / 2);
        return { top: box.top - axis.top, height: box.height, left: box.left - axis.left,
            z: Number(getComputedStyle(el).zIndex), painted: el.contains(hit) };
    });
}

async function drag(page, card, dx, dy, expectedTime, resize = false) {
    const target = resize ? card.locator('.domain-event-resize') : card;
    const box = await target.boundingBox();
    const x = box.x + box.width / 3, y = box.y + (resize ? box.height / 2 : 8);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, {steps: 5});
    await page.waitForFunction(expected => document.querySelector('.legacy-calendar-drag-time')?.textContent === expected, expectedTime);
}

async function holdSchedule(page, update) {
    // Keep a synthetic IDB transaction ahead of the real app write in its queue.
    await page.evaluate(update => new Promise((resolve, reject) => {
        const open = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result, tx = db.transaction('Schedule', 'readwrite'), store = tx.objectStore('Schedule');
            let released = false;
            window.releaseCalendarWrite = () => { released = true; };
            const timer = setTimeout(window.releaseCalendarWrite, 8000);
            tx.oncomplete = tx.onabort = () => { clearTimeout(timer); db.close(); };
            const tick = () => {
                const get = store.get('moving');
                get.onsuccess = () => {
                    if (!released) tick();
                    else if (update) store.put({...get.result, ...update});
                };
            };
            tick();
            resolve();
        };
    }), update);
}

async function sampleFrames(card, count) {
    return card.evaluate((node, count) => new Promise(resolve => {
        const original = node, samples = [];
        const tick = () => {
            const box = node.getBoundingClientRect(), axis = node.parentElement?.getBoundingClientRect();
            samples.push({ connected: original.isConnected, top: box.top - (axis?.top || 0), height: box.height });
            if (samples.length < count) requestAnimationFrame(tick);
            else resolve(samples);
        };
        requestAnimationFrame(tick);
    }), count);
}

const cases = [
    ['schedule drag cancelled over the completed lane or outside the viewport keeps the stored time', {}, async ({page}, {rows}) => {
        const endDate = when('09:30'), interval = 1800;
        await prepare(page, 'en', [{id: 'moving', endDate, interval}]);
        const card = page.locator(schedule('moving'));
        const box = await page.locator(scroll).boundingBox();
        const original = await rows(page, 'Schedule');
        for (const [x, y] of [[box.x + box.width * 0.75, box.y + 190], [box.x + box.width * 0.25, box.y - 5]]) {
            await drag(page, card, 0, 62, '09:30–10:00');
            await page.mouse.move(x, y);
            await page.mouse.up();
            await page.waitForFunction(() => !document.querySelector('[data-calendar-edit]'));
            assert.deepEqual(await rows(page, 'Schedule'), original);
        }
    }],
    ['calendar task pane and a single glyph animate, reverse and survive view and window changes', {reducedMotion: 'no-preference'}, async ({page}, {engine}) => {
        await prepare(page, 'en', []);
        const frames = await page.evaluate(({ panel, toggle }) => new Promise(resolve => {
            const aside = document.querySelector(panel), button = document.querySelector(toggle);
            const glyph = button.firstElementChild, axis = document.querySelector('.legacy-calendar-main');
            const result = [];
            const sample = () => {
                const transform = getComputedStyle(glyph).transform, rect = glyph.getBoundingClientRect();
                return {width: aside.getBoundingClientRect().width, axis: axis.getBoundingClientRect().width,
                    angle: transform === 'none' ? 0 : Math.atan2(new DOMMatrixReadOnly(transform).b, new DOMMatrixReadOnly(transform).a),
                    x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
                    same: glyph === button.firstElementChild && document.querySelectorAll('.legacy-calendar-pane-glyph').length === 1};
            };
            const closed = sample();
            button.focus();
            button.click();
            let reverseAt = -1;
            const tick = () => {
                const frame = sample();
                result.push(frame);
                if (reverseAt < 0 && frame.width >= 100 && frame.width <= 320) {
                    reverseAt = result.length - 1;
                    button.click();
                }
                if (result.length < 70 && (reverseAt < 0 || frame.width > 0 || result.length - reverseAt < 3)) requestAnimationFrame(tick);
                else resolve({closed, result, reverseAt, focused: document.activeElement === button});
            };
            requestAnimationFrame(tick);
        }), {panel,toggle});
        assert(frames.reverseAt >= 0, 'the panel was observed mid-open');
        assert(frames.focused && frames.result.every(frame => frame.same), 'the same button and glyph persist throughout reversal');
        for (const frame of frames.result) close(frame.axis + frame.width, frames.closed.axis, 'the adjacent timeline and panel share one width');
        const turn = frames.result[frames.reverseAt];
        assert(turn.angle > 0 && turn.angle < Math.PI / 4 && turn.x < frames.closed.x && turn.y < frames.closed.y);
        const following = frames.result[frames.reverseAt + 1];
        assert(following.width > 0 && following.width < 420 && following.angle > 0 && following.angle < Math.PI / 4, 'reverse from the painted intermediate geometry');
        close(frames.result.at(-1).width, 0, 'reverse ends at closed');
        close(frames.result.at(-1).angle, 0, 'the glyph returns to plus');

        await page.locator(toggle).click();
        await page.waitForFunction(panel => document.querySelector(panel).getBoundingClientRect().width === 420, panel);
        const angle = await page.locator(toggle+' > span').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).b);
        close(angle * 100, Math.SQRT1_2 * 100, 'the fully open glyph is rotated 45°');
        await page.screenshot({path: path.join(evidence, `calendar-pane-open-${engine}.png`)});
        await page.setViewportSize({width: 1000, height: 870});
        await page.getByLabel('Schedule view').selectOption('week');
        await page.waitForFunction(panel => document.querySelector(panel).getBoundingClientRect().width === 332, panel);
        assert.equal(await page.locator(grid+' > section').count(), 7);
        const viewSelect = await page.getByLabel('Schedule view').boundingBox();
        const paneBox = await page.locator(panel).boundingBox();
        assert(viewSelect.x + viewSelect.width <= paneBox.x, 'the view selector remains clear of the open pane at narrow widths');
        await page.emulateMedia({reducedMotion: 'reduce'});
        await page.locator(toggle).press('Space');
        assert.equal(await page.locator(panel).evaluate(el => el.getBoundingClientRect().width), 0);
        assert.equal(await page.locator(toggle+' > span').evaluate(el => getComputedStyle(el).transform), 'none');
        assert.equal(await page.locator(toggle).getAttribute('aria-expanded'), 'false');
    }],
    ['calendar drag and resize paint pending frames, persist once and roll back on conflicts and write failure', {reducedMotion: 'no-preference'}, async ({page}, {rows}) => {
        await prepare(page, 'en', [{id: 'moving', endDate: when('09:50'), interval: 3000}, {id: 'peer', endDate: when('10:40'), interval: 1200}]);
        const card = page.locator(schedule('moving')), peer = page.locator(schedule('peer')), badge = page.locator('.legacy-calendar-drag-time');
        const original = await readGeometry(card);
        await holdSchedule(page);
        await drag(page, card, 0, 62, '09:30–10:20');
        assert.equal(await badge.innerText(), '09:30–10:20');
        const live = await readGeometry(card);
        close(live.top, original.top + 62, 'time-axis move uses minute snapping');
        close(live.height, original.height, 'move preserves duration');
        assert(live.painted && live.z > (await readGeometry(peer)).z, 'the dragged card owns the top layer');
        assert.equal(await page.locator(schedule('moving')).count(), 1);
        await page.mouse.up();
        await card.locator('.domain-event-resize:disabled').waitFor({state: 'attached'});
        for (const frame of await sampleFrames(card, 6)) {
            assert(frame.connected);
            close(frame.top, live.top, 'pending move frame');
            close(frame.height, live.height, 'pending duration frame');
        }
        await page.evaluate(() => window.releaseCalendarWrite());
        await page.waitForFunction(() => !document.querySelector('[data-calendar-edit]'));
        close((await readGeometry(card)).top, live.top, 'committed move frame');
        const moved = (await rows(page, 'Schedule')).find(row => row.id === 'moving');
        assert.equal(moved.endDate, when('10:20'));
        assert.equal(moved.interval, 3000);
        assert.equal(moved.creationDate, when('08:00'));

        const handle = card.locator('.domain-event-resize');
        await card.hover();
        const handleStyle = () => handle.evaluate(el => {
            const bar = getComputedStyle(el, '::after');
            return [bar.width, bar.height, bar.borderRadius, bar.backgroundColor, getComputedStyle(el).cursor];
        });
        assert.deepEqual(await handleStyle(), ['24px','3px','3px','rgba(45, 127, 249, 0.4)','ns-resize']);
        await holdSchedule(page);
        await drag(page, card, 0, 124 / 6, '09:30–10:30', true);
        assert.equal(await badge.innerText(), '09:30–10:30');
        await page.locator(scroll).evaluate(el => { el.scrollTop += 31; });
        await page.waitForFunction(() => document.querySelector('.legacy-calendar-drag-time')?.textContent === '09:30–10:45');
        const resized = await readGeometry(card);
        close(resized.height, 155, 'resize incorporates scroll under a stationary pointer');
        await page.mouse.up();
        for (const frame of await sampleFrames(card, 5)) close(frame.height, resized.height, 'pending resize frame');
        await page.evaluate(() => window.releaseCalendarWrite());
        await page.waitForFunction(() => !document.querySelector('[data-calendar-edit]'));
        close((await readGeometry(card)).height, resized.height, 'committed resize frame');
        assert.deepEqual(await handleStyle(), ['24px','3px','3px','rgba(45, 127, 249, 0.4)','ns-resize']);
        assert.equal((await rows(page, 'Schedule')).find(row => row.id === 'moving').interval, 4500);
        assert.equal((await rows(page, 'Schedule')).length, 2, 'resize creates no extra rows');

        const latest = {endDate: when('11:00'), interval: 4500};
        await holdSchedule(page, latest);
        await drag(page, card, 0, 124, '10:30–11:45');
        const failed = await readGeometry(card);
        const axisTop = (await page.locator(scroll).boundingBox()).y;
        await page.mouse.up();
        await page.evaluate(() => window.releaseCalendarWrite());
        const rollback = await sampleFrames(card, 24);
        await page.getByRole('alert').filter({hasText: /changed in another window/i}).waitFor();
        close((await page.locator(scroll).boundingBox()).y, axisTop, 'the error notice does not displace the timeline');
        const saved = (await rows(page, 'Schedule')).find(row => row.id === 'moving');
        assert.equal(saved.endDate, latest.endDate);
        assert.equal(saved.interval, latest.interval);
        const restored = await readGeometry(card);
        close(restored.top, 9.75 * 124, 'rollback uses the concurrent saved time');
        assert(rollback.some(frame => frame.top < failed.top - 2 && frame.top > restored.top + 2), 'rollback animates from the last painted position');
        assert(rollback.every(frame => frame.connected && frame.top >= restored.top - 1 && frame.top <= failed.top + 1));

        await page.getByRole('button', {name:'Dismiss', exact:true}).click();
        await page.evaluate(() => {
            const put = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (...args) {
                const result = put.apply(this, args);
                if (this.name === 'Schedule') {
                    IDBObjectStore.prototype.put = put;
                    this.transaction.abort();
                }
                return result;
            };
        });
        await drag(page, card, 0, 62, '09:45–11:30', true);
        const unsaved = await readGeometry(card);
        await page.mouse.up();
        const shrink = await sampleFrames(card, 24);
        await page.getByRole('alert').waitFor();
        assert(shrink.some(frame => frame.height < unsaved.height - 2 && frame.height > restored.height + 2), 'failed resize animates back to saved height');
        close((await readGeometry(card)).height, restored.height, 'failed resize restores height');
        assert.deepEqual((await rows(page, 'Schedule')).find(row => row.id === 'moving'), saved);
    }],
    ...['en', 'zh-CN'].flatMap(locale => [false, true].map(dark => [
        `calendar responsive text and task drag preview in ${locale} ${dark ? 'dark' : 'light'}`,
        {locale, deviceScaleFactor: dark ? 1.25 : 1},
        async ({page}, {engine, rows}) => {
            const english = locale === 'en';
            const fixtures = [{id: 'long', endDate: when('09:50'), interval: 3000}, {id: 'short', endDate: when('10:21'), interval: 60},
                ...Array.from({length: 8}, (_,i) => ({id: 'dense-'+i, endDate: when('11:05'), interval: 60}))];
            await page.locator('[data-view="settings"]').click();
            await page.getByRole('button', {name:english?'Appearance':'外观', exact:true}).click();
            await page.getByTestId('prototype-theme').selectOption(dark?'dark':'light');
            await page.waitForFunction(dark => document.documentElement.dataset.theme === (dark?'dark':'light'), dark);
            await prepare(page, locale, fixtures);
            const long = page.locator(schedule('long')), short = page.locator(schedule('short'));
            const inspect = card => card.evaluate(el => {
                const title = el.querySelector('.legacy-event-title'), text = title.firstElementChild, time = title.lastElementChild;
                const bounds = el.getBoundingClientRect(), label = text.getBoundingClientRect();
                return {height: bounds.height, text: text.textContent, visible: getComputedStyle(text).visibility === 'visible',
                    fits: label.left >= bounds.left && label.right <= bounds.right && label.top >= bounds.top && label.bottom <= bounds.bottom,
                    ellipsis: getComputedStyle(text).textOverflow, font: parseFloat(getComputedStyle(text).fontSize), time: getComputedStyle(time).display !== 'none', tooltip: el.title};
            });
            for (const width of [1280, 1000]) {
                await page.setViewportSize({width, height:900});
                const normal = await inspect(long), tiny = await inspect(short);
                assert(normal.visible && normal.fits && normal.time && normal.text === name);
                assert(tiny.height === 18 && tiny.visible && tiny.fits && tiny.font >= 12 && !tiny.time && tiny.tooltip.includes(name));
                const dense = await Promise.all(fixtures.slice(2).map(row => inspect(page.locator(schedule(row.id)))));
                assert(dense.some(item => item.visible), 'dense cards still show the title when a readable portion fits');
                assert(dense.every(item => !item.time && item.fits && item.ellipsis === 'ellipsis'));
                await page.screenshot({path: path.join(evidence, `calendar-cards-${engine}-${locale}-${dark?'dark':'light'}-${width}.png`)});
            }
            await page.locator(toggle).click();
            const task = page.locator('.legacy-calendar-task').filter({hasText:name});
            await task.waitFor();
            const ghost = page.locator('.legacy-calendar-task-drag');
            let box = await task.boundingBox();
            await page.mouse.move(box.x + 10, box.y + 9);
            await page.mouse.down();
            await page.mouse.move(box.x + 32, box.y + 9);
            await ghost.waitFor();
            assert.equal(await ghost.getAttribute('data-placement'), 'unplaced');
            assert.equal(await ghost.locator('strong').innerText(), name);
            assert.match(await ghost.innerText(), english ? /Duration 50m/ : /时长 50m/);
            assert.match(await ghost.innerText(), /2 × 50m ≈ 1h40m/);
            // CSS zoom changes viewport pixels per timeline minute without changing the data.
            await page.locator(grid).evaluate(el => { el.style.zoom = '1.15'; });
            await page.locator(scroll).evaluate(el => { el.scrollTop = 22 * 124 * 1.15; });
            box = await page.locator(grid+' > section').boundingBox();
            const at = (h, m) => box.y + (h * 60 + m) / 1440 * box.height;
            await page.mouse.move(box.x + box.width * .8, at(23, 20));
            await page.waitForFunction(() => document.querySelector('.legacy-calendar-task-drag')?.dataset.placement === 'invalid');
            assert.equal(await page.locator('.legacy-calendar-selection').count(), 0);
            await page.mouse.move(box.x + box.width * .2, at(23, 20));
            await page.waitForFunction(() => document.querySelector('.legacy-calendar-task-drag')?.dataset.placement === 'allowed');
            assert.match(await ghost.innerText(), english ? /Starts 23:20/ : /开始 23:20/);
            await page.mouse.move(box.x + box.width * .2, at(23, 35));
            await page.waitForFunction(() => document.querySelector('.legacy-calendar-task-drag')?.textContent.includes('23:35'));
            assert.match(await ghost.innerText(), english ? /Starts 23:35/ : /开始 23:35/);
            const preview = page.locator('.legacy-calendar-selection');
            const position = await readGeometry(preview);
            assert.equal(await ghost.evaluate(el => el.parentElement === document.body && Number(getComputedStyle(el).zIndex) > 6), true);
            await page.screenshot({path: path.join(evidence, `calendar-placement-${engine}-${locale}-${dark?'dark':'light'}.png`)});
            await page.mouse.up();
            await preview.waitFor({state:'detached'});
            const saved = (await rows(page, 'Schedule')).find(row => !fixtures.some(item => item.id === row.id));
            assert.equal(saved.interval, 3000);
            assert.equal(saved.endDate, when('23:35') + 3000000, 'the displayed start and duration determine the exact cross-midnight commit');
            close((await readGeometry(page.locator(schedule(saved.id)))).top, position.top, 'placement keeps the preview position');
            // Navigation changes the time axis, so its continuation starts at midnight immediately.
            await page.emulateMedia({reducedMotion:'no-preference'});
            await page.getByRole('button', {name:english?'Next period':'下一期', exact:true}).click();
            close((await readGeometry(page.locator(schedule(saved.id)))).top, 0, 'the next day paints the continuation at midnight');
        }
    ])),
];

module.exports = {cases};
