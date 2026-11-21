const assert = require('node:assert/strict');

async function instrumentation(page) {
    await page.evaluate(() => {
        window.motions = [];
        const interrupted = new Map();
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (frames, timing) {
            const rect = this.getBoundingClientRect();
            const result = animate.call(this, frames, timing);
            const id = this.dataset.taskId || this.dataset.projectId || this.dataset.widgetType;
            if (id && this.hasAttribute('data-reorder-active')) {
                const frame = { id, resting: rect.top, start: frames[0].transform, z: getComputedStyle(this).zIndex,
                    interruptedAt: interrupted.get(id), samples: [] };
                interrupted.delete(id);
                window.motions.push(frame);
                const cancel = result.cancel.bind(result);
                result.cancel = () => {
                    const transform = getComputedStyle(this).transform;
                    if (['running', 'paused'].includes(result.playState) && transform !== 'none') {
                        interrupted.set(id, frame.resting + new DOMMatrixReadOnly(transform).m42);
                    }
                    cancel();
                };
                window.onRowMotion?.(result, frame);
                const sample = () => {
                    const r = this.getBoundingClientRect();
                    const style = getComputedStyle(this);
                    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                    frame.samples.push({ y: r.top, opacity: Number(style.opacity), painted: this.contains(hit), state: result.playState });
                    if (result.playState === 'running' || result.pending) requestAnimationFrame(sample);
                };
                sample();
            }
            return result;
        };
    });
}

async function drag(page, source, target) {
    await source.scrollIntoViewIfNeeded();
    const start = await source.boundingBox(), end = await target.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height * (start.y < end.y ? .8 : .2), { steps: 7 });
    const ghost = page.locator('.workspace-drag-preview');
    await ghost.waitFor();
    const rect = await ghost.boundingBox();
    assert.equal(await ghost.evaluate(element => Number(getComputedStyle(element).zIndex) >= 100000 &&
        getComputedStyle(element.firstElementChild).opacity === '1'), true);
    return rect;
}

async function motionStart(page, id, y) {
    await page.waitForFunction(id => window.motions.some(frame => frame.id === id), id);
    const frame = await page.evaluate(id => window.motions.find(frame => frame.id === id), id);
    const delta = /^translate\([\d.-]+px,\s*([\d.-]+)px\)$/.exec(frame.start);
    assert(delta, frame.start);
    assert(Math.abs(frame.resting + Number(delta[1]) - y) < 2, JSON.stringify({ frame, y }));
    assert.equal(frame.z, '10');
}

async function pauseWrites(page) {
    await page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
        open.onsuccess = () => {
            const db = open.result, transaction = db.transaction('Task', 'readwrite');
            const store = transaction.objectStore('Task');
            let active = true;
            const release = () => { active = false; };
            const timer = setTimeout(release, 6000);
            const keepAlive = () => { if (active) store.get('synthetic-write-lock').onsuccess = keepAlive; };
            transaction.oncomplete = () => { clearTimeout(timer); db.close(); };
            window.releaseOrderWrite = release;
            store.get('synthetic-write-lock').onsuccess = () => { keepAlive(); resolve(); };
        };
    }));
}

const cases = [
    ['completion keeps the painted row while the committed snapshot and recurrence update', 'no-preference', async ({ page, context }, { add, rows, task }) => {
        await page.locator('[data-view=tasks]').click();
        await add(page, 'Motion normal');
        await add(page, 'Motion concurrent');
        await page.evaluate(() => {
            const add = IDBObjectStore.prototype.add;
            IDBObjectStore.prototype.add = function (value, ...args) {
                if (this.name === 'Task' && value.name === 'Motion repeat') {
                    IDBObjectStore.prototype.add = add;
                    const deadline = new Date().setHours(23, 59, 59, 0);
                    value = { ...value, deadline, rFirstDeadline: deadline, rCycle: 1, rUnit: 'days', rId: 'motion-repeat-series' };
                }
                return add.call(this, value, ...args);
            };
        });
        await add(page, 'Motion repeat');
        const records = await rows(page, 'Task');
        const ids = Object.fromEntries(records.map(row => [row.name, row.id]));
        const other = await context.newPage();
        await other.goto(page.url());
        await other.getByRole('button', { name: 'Completed', exact: true }).click();
        await page.bringToFront();
        const sample = await page.evaluate(async ids => {
            const find = name => document.querySelector('[data-task-id="' + ids[name] + '"]');
            const normal = find('Motion normal'), concurrent = find('Motion concurrent'), repeat = find('Motion repeat');
            const normalTop = normal.getBoundingClientRect().top, repeatTop = repeat.getBoundingClientRect().top;
            const boxes = [normal, concurrent, repeat].map(row => row.querySelector('input[type=checkbox]'));
            const start = performance.now(), frames = [];
            for (const box of boxes) box.click();
            const immediate = boxes[0].checked && boxes[2].hasAttribute('data-completion-spin');
            const persisted = new Promise(resolve => {
                const check = () => {
                    const open = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
                    open.onsuccess = () => {
                        const db = open.result, result = db.transaction('Task').objectStore('Task').getAll();
                        result.onsuccess = () => {
                            db.close();
                            if (result.result.filter(row => row.isFinished).length === 3) resolve(performance.now() - start);
                            else if (performance.now() - start > 2200) resolve(Infinity);
                            else requestAnimationFrame(check);
                        };
                    };
                };
                check();
            });
            while (repeat.isConnected && performance.now() - start < 2200) {
                await new Promise(requestAnimationFrame);
                frames.push({ ms: performance.now() - start, normal: normal.isConnected, normalY: normal.getBoundingClientRect().top,
                    repeat: repeat.isConnected, repeatY: repeat.getBoundingClientRect().top, repeatChecked: boxes[2].checked,
                    transform: getComputedStyle(boxes[2]).transform, opacity: getComputedStyle(repeat).opacity });
            }
            return { immediate, normalTop, repeatTop, frames, savedAt: await persisted };
        }, ids);
        // React's discrete events may flush after the click stack, by its first painted frame.
        assert(sample.immediate || sample.frames.some(frame => frame.ms < 150 && frame.transform !== 'none'));
        const normalExit = sample.frames.find(frame => !frame.normal);
        assert(normalExit.ms >= 235, JSON.stringify(normalExit));
        assert(sample.frames.some(frame => frame.ms < 240 && frame.normal && Math.abs(frame.normalY - sample.normalTop) < 1));
        assert(sample.frames.some(frame => frame.ms < 250 && frame.repeat && !frame.repeatChecked && frame.transform.startsWith('matrix')));
        assert(sample.frames.some(frame => frame.ms >= 245 && frame.repeat && frame.repeatChecked && frame.opacity === '1'), JSON.stringify(sample));
        const visible = sample.frames.filter(frame => frame.repeat);
        assert(visible.slice(1).every((frame, i) => Math.abs(frame.repeatY - visible[i].repeatY) < 53), JSON.stringify(visible));
        assert(sample.frames.at(-1).ms >= 485 && !sample.frames.at(-1).repeat);
        assert(sample.savedAt < sample.frames.at(-1).ms, 'Persistence precedes the end of the repeated-task motion');
        await task(other, 'Motion normal').waitFor();
        await task(other, 'Motion normal').getByRole('checkbox').click();
        await task(page, 'Motion normal').waitFor();
        assert.equal((await rows(page, 'Task')).filter(row => row.name === 'Motion repeat').length, 2);
        await other.close();
    }],

    ['task and sidebar drag handoff, active paint, continuous rollback and subsequent reorder', 'no-preference', async ({ page }, { add, rows, task, project }) => {
        await project(page, 'Motion list A');
        await project(page, 'Motion list B');
        await project(page, 'Motion list C');
        const lists = await rows(page, 'Project');
        const a = lists.find(row => row.name === 'Motion list A'), c = lists.find(row => row.name === 'Motion list C');
        const list = id => page.locator('.sidebar-custom[data-project-id="' + id + '"]');
        await instrumentation(page);
        const sidebarGhost = await drag(page, list(a.id), list(c.id));
        await page.mouse.up();
        await motionStart(page, a.id, sidebarGhost.y);
        await page.waitForFunction(() => !document.querySelector('.workspace-add-task input')?.disabled);
        assert.notEqual((await rows(page, 'Project')).find(row => row.id === a.id).order, a.order);
        await page.locator('[data-view=tasks]').click();
        for (const name of ['Move A', 'Move B', 'Move C', 'Move D']) await add(page, name);
        const id = await task(page, 'Move D').getAttribute('data-task-id');
        const relativeY = () => task(page, 'Move D').evaluate(row => row.getBoundingClientRect().top -
            row.closest('.workspace-task-scroll').getBoundingClientRect().top);
        const initial = await relativeY();
        await page.evaluate(id => {
            const put = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (row, ...args) {
                if (this.name === 'Task' && row.id === id) {
                    IDBObjectStore.prototype.put = put;
                    throw new DOMException('Synthetic order write failure', 'QuotaExceededError');
                }
                return put.call(this, row, ...args);
            };
        }, id);
        const ghost = await drag(page, task(page, 'Move D'), task(page, 'Move A'));
        const crop = { x: Math.ceil(ghost.x + 10), y: Math.ceil(ghost.y + 2), width: 170, height: 27 };
        const painted = await page.screenshot({ clip: crop });
        const hide = await page.addStyleTag({ content: '.workspace-drag-preview{visibility:hidden!important}' });
        const unpainted = await page.screenshot({ clip: crop });
        await hide.evaluate(element => element.remove());
        assert.notDeepEqual(painted, unpainted, 'The floating task is present in rendered pixels');
        await pauseWrites(page);
        await page.mouse.up();
        await motionStart(page, id, ghost.y);
        await page.waitForFunction(id => {
            const active = document.querySelector('[data-task-id="' + id + '"]');
            return document.querySelector('.workspace-add-task input').disabled && active === document.querySelector('.workspace-tasks>li:last-child') &&
                !active.getAnimations().length;
        }, id);
        assert(await relativeY() > initial, 'The proposed position stays painted while the write is pending');
        await page.evaluate(() => window.releaseOrderWrite());
        await page.getByRole('alert').waitFor();
        await page.waitForFunction(id => window.motions.filter(frame => frame.id === id).some(frame =>
            frame.samples.some(sample => sample.opacity === 1 && sample.painted && sample.state === 'running')), id);
        await page.waitForFunction(id => !document.querySelector('[data-task-id="' + id + '"]').getAnimations().length, id);
        assert(Math.abs(await relativeY() - initial) < 1);
        const before = (await rows(page, 'Task')).find(row => row.id === id).order;
        await drag(page, task(page, 'Move D'), task(page, 'Move A'));
        await pauseWrites(page);
        await page.mouse.up();
        await page.waitForFunction(id => {
            const active = document.querySelector('[data-task-id="' + id + '"]');
            return document.querySelector('.workspace-add-task input').disabled && !active.getAnimations().length;
        }, id);
        await drag(page, task(page, 'Move B'), task(page, 'Move D'));
        await page.mouse.up();
        await page.evaluate(() => window.releaseOrderWrite());
        await page.waitForFunction(() => !document.querySelector('.workspace-add-task input')?.disabled);
        const saved = (await rows(page, 'Task')).sort((a, b) => a.order - b.order);
        assert(saved.find(row => row.id === id).order > before);
        assert.deepEqual(saved.map(row => row.name), ['Move C', 'Move A', 'Move D', 'Move B']);
    }],

    ['reduced motion commits task completion without retaining an animated row', 'reduce', async ({ page }, { add, rows, task }) => {
        await page.locator('[data-view=tasks]').click();
        await add(page, 'Reduced motion task');
        const row = task(page, 'Reduced motion task');
        await row.getByRole('checkbox').click();
        await row.waitFor({ state: 'detached' });
        assert.equal((await rows(page, 'Task'))[0].isFinished, true);
        assert.equal(await page.locator('[data-completion-spin],[data-reorder-active]').count(), 0);
    }],

    ['system list held and reversed directional input serializes moves and preserves focus', 'no-preference', async ({ page }, { rows, settings }) => {
        await settings(page, 'Projects');
        await instrumentation(page);
        const selector = '[data-project-group=presetProjects]';
        const presets = page.locator(selector);
        const initial = await presets.evaluateAll(elements => elements.map(e => e.dataset.projectId));
        const id = initial[0];
        await presets.first().locator('button').focus();
        await page.keyboard.press('ArrowUp'); // Boundary, no write.
        const commands = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowUp', 'ArrowUp'];
        await page.evaluate(({ commands, id }) => {
            window.projectWrites = 0;
            const put = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (...args) {
                if (this.name === 'Project') window.projectWrites++;
                return put.apply(this, args);
            };
            const handle = document.activeElement;
            const press = key => handle.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true }));
            window.onRowMotion = (animation, frame) => {
                if (frame.id !== id) return;
                window.onRowMotion = undefined;
                // Hold a real intermediate transform so slow hosts still
                // exercise retargeting during the burst of subsequent keys.
                animation.pause();
                animation.currentTime = 60;
                requestAnimationFrame(() => commands.slice(1).forEach(press));
            };
            press(commands[0]);
        }, { commands, id });
        const expected = [...initial];
        expected.splice(1, 0, expected.shift());
        await page.waitForFunction(({ selector, expected, writes }) =>
            window.projectWrites === writes && !document.querySelector('.legacy-settings-project-toggle input')?.disabled &&
            JSON.stringify(Array.from(document.querySelectorAll(selector), element => element.dataset.projectId)) === JSON.stringify(expected),
        { selector, expected, writes: commands.length * initial.length });
        await page.waitForFunction(id => window.motions.filter(frame => frame.id === id).some(frame =>
            frame.samples.some(sample => sample.opacity === 1 && sample.state === 'running')), id);
        const persisted = (await rows(page, 'Project')).filter(row => initial.includes(row.id)).sort((a, b) => a.order - b.order);
        assert.deepEqual(persisted.map(row => row.id), expected);
        assert.equal(await page.locator(':focus').evaluate(element => element.closest('[data-project-id]').dataset.projectId), id);
        const motions = await page.evaluate(id => window.motions.filter(frame => frame.id === id).map(frame => ({
            ...frame, startY: frame.resting + new DOMMatrixReadOnly(frame.start).m42,
        })), id);
        assert(motions.length > 1);
        const retargeted = motions.filter(frame => frame.interruptedAt !== undefined);
        assert(retargeted.length > 0);
        assert(retargeted.every(frame => Math.abs(frame.startY - frame.interruptedAt) < 1), JSON.stringify(retargeted));
    }],

    ['timer widget editor pointer layer, reverse keyboard movement and cancel preserve settings', 'no-preference', async ({ page }, { expand }) => {
        await expand(page);
        const editor = page.locator('.legacy-widget-editor');
        const trigger = page.locator('.legacy-timer-edit-widgets');
        await trigger.click();
        const widgets = editor.locator('ul:not(.workspace-drag-preview)>li');
        const initial = await widgets.evaluateAll(elements => elements.map(element => element.dataset.widgetType));
        const before = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => /widget/i.test(key)));
        await instrumentation(page);
        const ghost = await drag(page, widgets.first(), widgets.last());
        await page.mouse.up();
        await motionStart(page, initial[0], ghost.y);
        assert.deepEqual(await widgets.evaluateAll(elements => elements.map(element => element.dataset.widgetType)), [...initial.slice(1), initial[0]]);
        await widgets.last().locator('button').focus();
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(id => window.motions.filter(frame => frame.id === id).length >= 3, initial[0]);
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        await editor.waitFor({ state: 'detached' });
        assert.deepEqual(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => /widget/i.test(key))), before);
        await trigger.click();
        assert.deepEqual(await widgets.evaluateAll(elements => elements.map(element => element.dataset.widgetType)), initial);
        await page.setViewportSize({ width: 1280, height: 210 });
        await editor.hover();
        await page.mouse.wheel(0, 180);
        await page.waitForFunction(() => document.querySelector('.legacy-widget-editor').scrollTop > 0);
        assert.deepEqual(await widgets.evaluateAll(elements => elements.map(element => element.dataset.widgetType)), initial);
    }],

    ['completed chart draws the task category above an earlier custom-list index', 'reduce', async ({ page }, { add, project, rows }) => {
        await project(page, 'Chart list');
        const id = (await rows(page, 'Project')).find(row => row.name === 'Chart list').id;
        await page.locator('[data-view=tasks]').click();
        await add(page, 'Chart task');
        await page.evaluate(id => new Promise((resolve, reject) => {
            const open = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const db = open.result, tx = db.transaction(['Project', 'Task'], 'readwrite');
                const projects = tx.objectStore('Project'), tasks = tx.objectStore('Task');
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onabort = () => { db.close(); reject(tx.error); };
                const setList = (id, order, color) => {
                    const get = projects.get(id);
                    get.onsuccess = () => projects.put({ ...get.result, order, color });
                };
                setList('id-task-tasks', 20000, 'D42251');
                setList(id, -20000, '2669D8');
                const get = tasks.getAll();
                get.onsuccess = () => {
                    const row = { ...get.result[0], isFinished: true, finishedDate: Date.now() };
                    tasks.put(row);
                    tasks.put({ ...row, id: 'chart-custom-task', projectId: id });
                };
            };
        }), id);
        await page.reload();
        await page.locator('[data-view=reports]').click();
        const chart = page.getByRole('img', { name: 'Completed tasks chart', exact: true });
        await chart.scrollIntoViewIfNeeded();
        assert.equal(JSON.parse(await chart.getAttribute('data-series')).at(-1), 2);
        const [taskTop, projectTop] = await chart.evaluate(canvas => {
            const x = (canvas.clientWidth - 8) * devicePixelRatio;
            const { data } = canvas.getContext('2d').getImageData(x, 0, 1, canvas.height);
            const find = (r, g, b) => {
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] === 255) return i / 4;
                }
                return -1;
            };
            return [find(212, 34, 81), find(38, 105, 216)];
        });
        assert(taskTop >= 0 && projectTop > taskTop, JSON.stringify({taskTop,projectTop}));
    }],

    ['export dialog uses the application thumb within symmetric corners on wheel and keyboard scroll', 'reduce', async ({ page }) => {
        await page.locator('[data-view=settings]').click();
        await page.getByRole('button', { name: 'Profile', exact: true }).click();
        await page.getByRole('button', { name: 'Export data', exact: true }).click();
        const dialog = page.locator('.legacy-backup-export');
        const form = dialog.locator('form');
        const track = dialog.locator('.legacy-local-scroll-track');
        await dialog.locator('.legacy-backup-analysis').waitFor();
        for (const dark of [false, true]) {
            await page.setViewportSize({ width: dark ? 390 : 640, height: 390 });
            await page.evaluate(dark => {
                document.documentElement.style.zoom = dark ? '125%' : '100%';
                document.documentElement.dataset.theme = dark ? 'dark' : 'light';
            }, dark);
            await track.waitFor({ state: 'visible' });
            const layout = await dialog.evaluate(element => {
                const style = getComputedStyle(element), border = element.getBoundingClientRect();
                const view = element.querySelector('form'), content = view.getBoundingClientRect();
                const track = element.querySelector('.legacy-local-scroll-track'), thumb = track.firstElementChild;
                const rect = track.getBoundingClientRect();
                return { corners: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius],
                    left: content.left - border.left, right: border.right - content.right,
                    overflow: style.overflowY, scrollbar: getComputedStyle(thumb).backgroundColor,
                    trackInset: border.right - rect.right, scroll: view.scrollHeight - view.clientHeight };
            });
            assert.deepEqual(layout.corners, ['14px', '14px', '14px', '14px']);
            assert(Math.abs(layout.left - layout.right) < 1 && layout.trackInset > 14 && layout.scroll > 0, JSON.stringify(layout));
            assert.equal(layout.overflow, 'hidden');
            assert.match(layout.scrollbar, /rgba\(200, 200, 200, 0\.5\)|rgba\(174, 174, 174, 0\.7\)/);
            await form.focus();
            await page.keyboard.press('End');
            assert(await form.evaluate(el => Math.abs(el.scrollTop - (el.scrollHeight - el.clientHeight)) < 2));
            await page.keyboard.press('Home');
            assert.equal(await form.evaluate(el => el.scrollTop), 0);
            await form.hover();
            await page.mouse.wheel(0, 300);
            await page.waitForFunction(() => document.querySelector('.legacy-backup-export form').scrollTop > 10);
        }
    }],
];

module.exports = { cases };
