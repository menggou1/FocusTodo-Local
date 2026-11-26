const assert = require('node:assert/strict');

const now = '2026-11-20T12:00:00+08:00';
const end = date => Date.parse(date + 'T23:59:59.999+08:00');
const prefs = 'FocusTodoStandalone.data.';
const list = (page, id) => page.locator('.sidebar-item[data-project-id="' + id + '"]');
const nav = (page, id) => list(page, id).locator('.sidebar-nav-main');
const activePopup = page => page.locator('.workspace-picker-surface:not(.is-closing) .legacy-date-picker');

async function seed(page, tables) {
    await page.evaluate(tables => new Promise((resolve, reject) => {
        const request = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(Object.keys(tables), 'readwrite');
            for (const [table, entries] of Object.entries(tables)) {
                const store = transaction.objectStore(table);
                for (const entry of entries) {
                    const read = store.get(entry.id);
                    read.onsuccess = () => store.put({ ...read.result, ...entry });
                }
            }
            transaction.oncomplete = () => { db.close(); resolve(); };
            transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
    }), tables);
    await page.reload();
    await page.getByTestId('app-shell').waitFor();
}

async function selectedShortcut(popup, index) {
    const buttons = popup.locator('.legacy-date-quick button');
    assert.deepEqual(await buttons.evaluateAll(items => items.map(item => item.getAttribute('aria-pressed'))),
        ['0', '1', '2', '3'].map(value => String(Number(value) === index)));
    assert.equal(await buttons.nth(index).locator('img').getAttribute('class'), 'workspace-nav-icon');
    return buttons;
}

async function composer({ page }, { rows, task }, dark, zh) {
    const oldDeadline = end('2026-09-29');
    await page.evaluate(({ prefs, oldDeadline }) => localStorage.setItem(prefs + 'DefaultDeadline', String(oldDeadline)), { prefs, oldDeadline });
    await page.reload();
    await nav(page, 'id-task-tasks').click();
    const form = page.locator('.workspace-add-task'), input = form.locator('input');
    const plus = form.locator('button.workspace-plus');
    const summary = form.locator('.workspace-quick-deadline-picker summary');
    await input.fill('   ');
    await plus.click();
    assert.equal((await rows(page, 'Task')).length, 0);
    assert.equal(await page.locator('.workspace-error').count(), 0);
    await input.fill('Someday via plus');
    assert.equal(await input.evaluate(el => getComputedStyle(el).color), dark ? 'rgb(232, 232, 235)' : 'rgb(82, 82, 82)');
    assert.equal(await summary.getAttribute('title'), '2026-09-29');

    await summary.click();
    let popup = activePopup(page);
    await popup.waitFor();
    assert.equal(await popup.locator('[data-selected]').getAttribute('aria-label'), '2026-09-29');
    let buttons = await selectedShortcut(popup, 0);
    assert.equal(await buttons.nth(2).getAttribute('title'), zh ? '未来七天' : 'Next 7 Days');
    await buttons.nth(1).click();
    await selectedShortcut(popup, 1);
    await page.keyboard.press('Escape');
    await summary.click();
    await popup.waitFor();
    assert.equal(await popup.locator('[data-selected]').getAttribute('aria-label'), '2026-09-29', 'Cancel discards the picker draft');
    await buttons.nth(3).click();
    await selectedShortcut(popup, 3);
    await popup.locator('.primary').click();
    await popup.waitFor({ state: 'hidden' });
    await page.waitForFunction(key => localStorage.getItem(key) === '0', prefs + 'DefaultDeadline');
    await plus.dblclick();
    await task(page, 'Someday via plus').waitFor();
    assert.deepEqual((await rows(page, 'Task')).map(({ name, deadline }) => [name, deadline]), [['Someday via plus', 0]]);

    await nav(page, 'id-deadline-today').click();
    await nav(page, 'id-task-tasks').click();
    await page.reload();
    await nav(page, 'id-task-tasks').click();
    await summary.click();
    await popup.waitFor();
    await selectedShortcut(popup, 3);
    await page.keyboard.press('Escape');
    await input.fill('Someday via Enter');
    await input.press('Enter');
    await task(page, 'Someday via Enter').waitFor();
    assert.equal((await rows(page, 'Task')).find(row => row.name === 'Someday via Enter').deadline, 0);

    await task(page, 'Someday via plus').locator('.workspace-task-name').click();
    const details = page.locator('.workspace-details'), detailDate = details.locator('.legacy-detail-deadline summary');
    await detailDate.click();
    await popup.waitFor();
    buttons = await selectedShortcut(popup, 3);
    for (const index of [0, 1, 2, 3, 1]) {
        await buttons.nth(index).click();
        await selectedShortcut(popup, index);
    }
    await popup.locator('.primary').click();
    await popup.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.workspace-details')?.dataset.pending === '0');
    assert.equal((await rows(page, 'Task')).find(row => row.name === 'Someday via plus').deadline, end('2026-11-21'));

    const child = page.locator('#new-subtask'), childPlus = details.locator('.legacy-detail-subtasks button[type=submit]');
    await child.fill('   ');
    await childPlus.click();
    assert.equal((await rows(page, 'Subtask')).length, 0);
    await child.fill('Child via plus');
    await childPlus.dblclick();
    await details.locator('.workspace-subtask').getByText('Child via plus', { exact: true }).waitFor();
    await child.fill('Child via Enter');
    await child.press('Enter');
    await details.locator('.workspace-subtask').getByText('Child via Enter', { exact: true }).waitFor();
    assert.deepEqual((await rows(page, 'Subtask')).map(row => row.name).sort(), ['Child via Enter', 'Child via plus']);
}

const taskFixture = (id, projectId, order, deadline) => ({
    id, name: id, projectId, order, deadline, state: 0, isFinished: false, finishedDate: 0,
    creationDate: Date.parse(now), priority: 0, tags: '', remark: '', estimatePomoNum: 0, pomodoroInterval: 1500, sync: 0,
});

async function startDrag(page, from) {
    const box = await from.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 8, y);
    await page.locator('.workspace-drag-preview').waitFor();
}

async function hoverDrop(page, locator, height = .5) {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * height, { steps: 7 });
}

async function settled(page) {
    await page.locator('.workspace-drag-preview').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-task-drop],[data-sort-blocked],.workspace-sort-hint').count(), 0);
    await page.waitForFunction(() => !document.querySelector('.workspace-add-task input')?.disabled &&
        !document.querySelector('.workspace-task-scroll').getAnimations({ subtree: true }).some(animation => animation.playState === 'running'));
}

async function dragAndMotion({ page }, { rows, task }) {
    await seed(page, {
        Project: [
            { id: 'exam', name: '考研', type: 2000, expanded: true, state: 0, order: 10 },
            { id: 'math', name: '数学', parentId: 'exam', type: 1000, orderingRule: 3, state: 0, order: 20 },
            { id: 'english', name: '英语', parentId: 'exam', type: 1000, orderingRule: 3, state: 0, order: 30 },
            { id: 'id-deadline-upcoming', state: 0 },
        ],
        Task: [
            taskFixture('Math first', 'math', 10, end('2026-11-20')),
            taskFixture('Math second', 'math', 20, end('2026-11-21')),
            taskFixture('English task', 'english', 30, end('2026-11-21')),
        ],
    });
    await nav(page, 'exam').click();
    const first = task(page, 'Math first'), second = task(page, 'Math second'), english = task(page, 'English task');
    const saved = () => rows(page, 'Task');
    const original = await saved();
    await startDrag(page, first);
    await list(page, 'math').and(page.locator('[data-task-drop=available]')).waitFor();
    for (const id of ['math', 'english', 'id-deadline-today', 'id-task-tasks']) {
        assert.equal(await list(page, id).getAttribute('data-task-drop'), 'available');
    }
    for (const id of ['exam', 'id-deadline-upcoming', 'id-task-schedule']) {
        assert.equal(await list(page, id).getAttribute('data-task-drop'), null);
    }
    assert.equal(await second.getAttribute('data-sort-blocked'), null);
    assert.equal(await english.getAttribute('data-sort-blocked'), 'true');
    assert.notEqual(await english.evaluate(el => getComputedStyle(el, '::after').backgroundColor), 'rgba(0, 0, 0, 0)');
    await hoverDrop(page, second, .8);
    await page.waitForFunction(() => document.querySelector('[data-sort-group=math] li:last-child')?.dataset.taskId === 'Math first');
    await hoverDrop(page, english);
    await page.locator('.workspace-sort-hint').waitFor();
    assert.equal(await page.locator('.workspace-sort-hint').innerText(), '请拖动至左侧清单上以进入此清单。');
    await page.mouse.up();
    await settled(page);
    assert.deepEqual(await saved(), original, 'Workspace cross-list release writes no order or membership');

    await startDrag(page, first);
    await hoverDrop(page, list(page, 'exam'));
    assert.equal(await list(page, 'exam').getAttribute('data-task-drop'), null);
    await page.mouse.up();
    await settled(page);
    assert.deepEqual(await saved(), original, 'Releasing on a folder writes no order or membership');

    await startDrag(page, first);
    await hoverDrop(page, second, .8);
    await page.waitForFunction(() => document.querySelector('[data-sort-group=math] li:last-child')?.dataset.taskId === 'Math first');
    await page.mouse.up();
    await settled(page);
    const reordered = await saved();
    assert(reordered.find(row => row.id === 'Math first').order > 20);
    assert.deepEqual(reordered.filter(row => row.id !== 'Math first'), original.filter(row => row.id !== 'Math first'));
    assert.equal(reordered.find(row => row.id === 'Math first').projectId, 'math');

    await page.evaluate(() => {
        window.workspaceAnimations = [];
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (keyframes, timing) {
            const id = this.matches('.workspace-drag-preview') ? 'exit' : this.dataset.taskMotionId;
            if (id) window.workspaceAnimations.push({ id, keyframes, timing, top: this.getBoundingClientRect().top });
            return animate.call(this, keyframes, timing);
        };
    });
    await nav(page, 'id-deadline-upcoming').click();
    await startDrag(page, first);
    assert.equal(await page.locator('.workspace-tasks>li[data-sort-blocked]').count(), 3);
    await hoverDrop(page, second);
    await page.mouse.up();
    await settled(page);
    assert.deepEqual(await saved(), reordered);

    await startDrag(page, second);
    await list(page, 'id-deadline-today').and(page.locator('[data-task-drop=available]')).waitFor();
    assert.equal(await nav(page, 'id-deadline-today').evaluate(button => getComputedStyle(button).outlineStyle), 'dashed');
    await hoverDrop(page, list(page, 'id-deadline-today'));
    await list(page, 'id-deadline-today').and(page.locator('[data-task-drop=over]')).waitFor();
    assert.equal(await list(page, 'id-deadline-today').getAttribute('data-task-drop'), 'over');
    assert.equal(await nav(page, 'id-deadline-today').evaluate(button => getComputedStyle(button).outlineStyle), 'solid');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await settled(page);
    assert.deepEqual(await saved(), reordered);

    await startDrag(page, second);
    await hoverDrop(page, list(page, 'id-deadline-today'));
    await page.mouse.up();
    await settled(page);
    assert.equal(await second.isVisible(), true);
    assert.deepEqual((await saved()).find(row => row.id === 'Math second'), {
        ...reordered.find(row => row.id === 'Math second'), deadline: end('2026-11-20'),
    });

    await nav(page, 'math').click();
    const beforeFailure = await saved();
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (row, ...args) {
            if (this.name === 'Task' && row.id === 'Math second') {
                IDBObjectStore.prototype.put = put;
                throw new DOMException('Synthetic sidebar write failure', 'QuotaExceededError');
            }
            return put.call(this, row, ...args);
        };
    });
    await startDrag(page, second);
    await hoverDrop(page, list(page, 'english'));
    await list(page, 'english').and(page.locator('[data-task-drop=over]')).waitFor();
    assert.equal(await list(page, 'english').getAttribute('data-task-drop'), 'over');
    await page.mouse.up();
    await page.locator('.workspace-error').waitFor();
    await settled(page);
    assert.equal(await second.isVisible(), true);
    assert.deepEqual(await saved(), beforeFailure);
    assert.deepEqual(await page.evaluate(() => window.workspaceAnimations.filter(entry => entry.id === 'exit')), []);
    await page.locator('.workspace-error button').click();

    await startDrag(page, second);
    await hoverDrop(page, list(page, 'english'));
    await page.mouse.up();
    await second.waitFor({ state: 'detached' });
    await settled(page);
    const [exit] = await page.evaluate(() => window.workspaceAnimations.filter(entry => entry.id === 'exit'));
    assert.deepEqual(exit.timing, { duration: 180, easing: 'ease-out' });
    assert.deepEqual(exit.keyframes.map(frame => frame.opacity), [1, 0]);
    assert.match(exit.keyframes[1].transform, /translate\(-[\d.]+px,[-\d.]+px\)$/);
    assert.deepEqual((await saved()).find(row => row.id === 'Math second'), {
        ...beforeFailure.find(row => row.id === 'Math second'), projectId: 'english',
    });
    await nav(page, 'english').click();
    await second.waitFor();

    await nav(page, 'exam').click();
    const header = page.locator('[data-sort-group=english] h2');
    const before = (await header.boundingBox()).y;
    await first.getByRole('checkbox').click();
    await first.waitFor({ state: 'detached' });
    const frames = await page.evaluate(() => window.workspaceAnimations);
    const heading = frames.find(entry => entry.id === 'active-heading:english');
    const row = frames.find(entry => entry.id === 'task:English task');
    assert(heading && row, 'Heading and task both use the row layout animation');
    assert.deepEqual(heading.timing, row.timing);
    assert.deepEqual(heading.keyframes, row.keyframes);
    const firstY = Number(/,([\d.-]+)px\)$/.exec(heading.keyframes[0].transform)[1]);
    assert(firstY > 0);
    assert(Math.abs(heading.top + firstY - before) < 1);
}

async function reportHover({ page }, _, zh) {
    await seed(page, { Pomodoro: [
        { id: 'today', interval: 3650, pomodoroInterval: 7200, endDate: Date.parse(now) - 60000, state: 0 },
        { id: 'week', interval: 1500, pomodoroInterval: 1500, endDate: Date.parse(now) - 86400000, state: 0 },
        { id: 'older', interval: 1800, pomodoroInterval: 3600, endDate: Date.parse(now) - 6 * 86400000, state: 0 },
    ] });
    await page.locator('[data-view=reports]').click();
    const stats = page.locator('.legacy-report-stat');
    const visible = async card => ({
        label: await card.locator('div').innerText(),
        value: await card.locator('p').textContent(),
        units: await card.locator('small').allTextContents(),
        color: await card.locator('strong').first().evaluate(el => getComputedStyle(el).color),
    });
    const durations = zh ? ['1小时56分钟', '1小时26分钟', '1小时1分钟'] : ['1h56m', '1h26m', '1h1m'];
    const titles = zh ? ['总完成番茄数', '本周完成番茄数', '今日完成番茄数'] :
        ['Total Completed Pomodoros', 'Pomodoros Completed This Week', 'Pomodoros Completed Today'];
    for (let index = 0; index < 3; index++) {
        const card = stats.nth(index);
        const before = await visible(card);
        assert.equal(before.value, durations[index]);
        await card.hover();
        await card.getByText(titles[index], { exact: true }).waitFor();
        assert.deepEqual(await visible(card), { label: titles[index], value: ['2','1.5','0.5'][index], units: [], color: before.color });
        await stats.nth(3).hover();
        await card.getByText(before.label, { exact: true }).waitFor();
        assert.deepEqual(await visible(card), before);
    }
    assert.equal(await page.getByTestId('report-total').textContent(), '60.83');
}

async function searchWorkspace({ page }, { task }, zh) {
    const alpha = { id: 'search-alpha', name: 'Alpha', state: 0, type: 1000, order: 20000 };
    const beta = { id: 'search-beta', name: 'Beta', state: 0, type: 1000, order: 10000 };
    const tag = { id: 'search-label', name: 'Needle', state: 0, type: 3000, order: 30000 };
    const deadline = end('2026-11-20');
    await seed(page, {
        Project: [alpha, beta, tag],
        Task: [
            taskFixture('Needle title', alpha.id, 10000, deadline),
            { ...taskFixture('Note result', alpha.id, 30000, deadline), remark: 'Needle in notes' },
            { ...taskFixture('Tagged result', beta.id, 20000, deadline), tags: tag.id },
            { ...taskFixture('Completed result', beta.id, 10000, deadline), isFinished: true, finishedDate: deadline },
            taskFixture('Needle detached', 'deleted-list', 0, deadline),
            { ...taskFixture('Reminder target', 'id-task-tasks', 0, deadline), reminderDate: Date.parse(now) - 60000 },
        ],
        Subtask: [{ id: 'search-child', taskId: 'Completed result', name: '中文 Needle', state: 0 }],
    });

    const search = page.getByRole('searchbox'), heading = page.locator('.workspace-view-heading h1');
    const details = page.locator('.workspace-details');
    await nav(page, alpha.id).click();
    await search.fill(' Needle ');
    assert.equal(await heading.textContent(), 'Alpha');
    await page.waitForFunction(() => !document.querySelector('.workspace-add-task'));
    const resultHeading = zh ? '搜索结果' : 'Search Results';
    assert.equal(await heading.textContent(), resultHeading);
    assert.equal(await page.locator('.workspace-summary,.workspace-sort,.workspace-add-task').count(), 0);
    const groups = page.locator('.workspace-task-group');
    assert.deepEqual(await groups.evaluateAll(nodes => nodes.map(group => Array.from(group.querySelectorAll('.workspace-task-name'), row => row.getAttribute('aria-label')))), [
        ['Completed result', 'Tagged result'], ['Needle title', 'Note result'], ['Needle detached'],
    ]);
    assert.deepEqual(await groups.locator('h2').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.firstChild.textContent)), ['Beta', 'Alpha']);
    await task(page, 'Note result').locator('.workspace-task-name').click();
    await details.waitFor();
    await search.fill('Needle in notes');
    assert.equal(await groups.count(), 3);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=task-row]').length === 1);
    assert.equal(await task(page, 'Note result').getAttribute('data-selected'), 'true');
    assert.equal(await details.count(), 1);

    await search.fill('中文');
    await search.press('Enter');
    await task(page, 'Completed result').waitFor();
    assert.equal(await details.count(), 0);
    await search.fill('');
    await search.press('Escape');
    assert.equal(await heading.textContent(), 'Alpha');
    assert.equal(await search.evaluate(input => input === document.activeElement), true);

    await search.fill('Needle');
    await page.locator('[data-view=settings]').dispatchEvent('click');
    await page.waitForTimeout(350);
    assert.equal(await heading.textContent(), 'Alpha');
    assert.equal(await search.inputValue(), '');
    await page.keyboard.press('Escape');
    await page.locator('.legacy-settings').waitFor({ state: 'hidden' });

    await page.locator('[data-view=notifications]').click();
    const reminder = page.locator('.legacy-notification-popover').getByRole('button', { name: 'Reminder target' });
    await reminder.waitFor();
    await search.fill('Needle');
    await reminder.dispatchEvent('click');
    await page.waitForTimeout(350);
    assert.equal(await nav(page, 'id-task-tasks').getAttribute('aria-current'), 'page');
    assert.equal(await task(page, 'Reminder target').getAttribute('data-selected'), 'true');
    assert.equal(await search.inputValue(), '');

    await search.focus();
    await search.dispatchEvent('compositionstart', { data: '' });
    await search.evaluate(input => {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setValue.call(input, '中文');
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '中文', isComposing: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', isComposing: true }));
    });
    await page.waitForTimeout(350);
    assert.equal(await nav(page, 'id-task-tasks').getAttribute('aria-current'), 'page');
    await search.dispatchEvent('compositionend', { data: '中文' });
    assert.equal(await nav(page, 'id-task-tasks').getAttribute('aria-current'), 'page');
    await task(page, 'Completed result').waitFor();
    assert.equal(await heading.textContent(), resultHeading);
    await search.fill('no match');
    await search.press('Enter');
    await page.locator('.workspace-empty[data-search]').waitFor();
    assert.equal(await page.locator('.workspace-empty-desc').count(), 0);
}

module.exports = [
    ...[false, true].flatMap(dark => [false, true].map(zh => [
        '2.2 composer dates and submit controls ' + (zh ? 'zh' : 'en') + (dark ? ' dark' : ' light'),
        { locale: zh ? 'zh-CN' : 'en', colorScheme: dark ? 'dark' : 'light', fixedTime: now },
        (handle, fixtures) => composer(handle, fixtures, dark, zh),
    ])),
    ['2.2 folder drag boundaries, sidebar write and completion headings',
        { locale: 'zh-CN', reducedMotion: 'no-preference', fixedTime: now }, dragAndMotion],
    ...[false, true].map(zh => ['2.2 report hover values and units ' + (zh ? 'zh' : 'en'),
        { locale: zh ? 'zh-CN' : 'en', colorScheme: zh ? 'dark' : 'light', fixedTime: now },
        (handle, fixtures) => reportHover(handle, fixtures, zh)]),
    ...[false, true].map(zh => ['2.2 search grouping, navigation, selection and IME ' + (zh ? 'zh dark' : 'en light'),
        { locale: zh ? 'zh-CN' : 'en', colorScheme: zh ? 'dark' : 'light', fixedTime: now },
        (handle, fixtures) => searchWorkspace(handle, fixtures, zh)]),
];
