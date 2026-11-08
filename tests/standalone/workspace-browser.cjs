/* D01/D02: real commands on fresh temporary origins; no production profile or private data. */
const { assert, fs, path, root, evidence, launch, contextFor, assertNoLegacyRuntime } = require('./helpers.cjs');
const { createStandaloneServer } = require('../../scripts/standalone-server.cjs');
const typography = require('../fixtures/sidebar-typography-cfd6449.json').metrics;
const auditViews = require('../../docs/acceptance/2.0.0-a/views/views.json');
const results = [], versions = {};
const ready = page => page.getByTestId('app-shell').waitFor();
const task = (page, name) => page.getByTestId('task-row').filter({ has: page.getByRole('button', { name, exact: true }) });
function assertTypography(metrics) {
    for (const [key, legacy] of [['name', '.ProjectItem-name-3IyjO'], ['count', '.ProjectItem-taskQuantity-2TAGR'], ['nav', '.ProjectItem-root-1iGkr'], ['search', '.SearchItem-searchContainer-33crx'], ['input', '.SearchItem-searchInput-a6ypV']]) {
        for (const prop of ['height', 'fontSize', 'fontWeight', 'lineHeight']) assert.equal(typeof metrics[key][prop] === 'number' ? metrics[key][prop] + 'px' : metrics[key][prop], typography[legacy][prop], key + '.' + prop);
    }
}
async function add(page, name) {
    const input = page.locator('.workspace-add-task input');
    await input.fill(name); await input.press('Enter'); await task(page, name).waitFor();
    await input.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.workspace-add-task input').disabled);
    await page.waitForFunction(() => document.activeElement === document.querySelector('.workspace-add-task input'));
}
async function open(page, name) { await task(page, name).getByRole('button', { name, exact: true }).click(); }
async function save(page) {
    await page.locator('.workspace-details').getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.workspace-details fieldset').disabled);
    await page.locator('.workspace-details').getByText('Saved', { exact: true }).waitFor();
}
async function rows(page, store) {
    return page.evaluate(store => new Promise((resolve, reject) => {
        const request = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result, tx = db.transaction(store, 'readonly'), get = tx.objectStore(store).getAll();
            get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); tx.oncomplete = () => db.close();
        };
    }), store);
}
async function createProject(page, name, folder = false, parent) {
    await page.getByRole('button', { name: folder ? 'Create folder' : /Create list/ }).click();
    const dialog = page.getByRole('dialog'); await dialog.getByLabel('Name', { exact: true }).fill(name);
    if (parent) await dialog.getByLabel('Folder', { exact: true }).selectOption({ label: parent });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
}

(async () => {
    fs.mkdirSync(evidence, { recursive: true });
    const server = createStandaloneServer({ root: path.join(root, 'dist/standalone/site'), basePath: '/FocusTodo-Local/' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port, url = origin + '/FocusTodo-Local/';
    const engines = process.env.FOCUS_STANDALONE_ENGINES?.split(',').map(value => value.trim()).filter(Boolean) || ['chromium', 'firefox', 'webkit'];
    assert(engines.length && engines.every(engine => ['chromium', 'firefox', 'webkit'].includes(engine)));
    async function run(browser, engine, name, body, options = {}) {
        const h = await contextFor(browser, origin, { locale: 'en', ...options });
        try {
            await h.page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(h.page);
            const detail = await body(h);
            assert.deepEqual(h.errors, []); assert.deepEqual(h.external, []); await assertNoLegacyRuntime(h.page, h.requests);
            results.push({ engine, name, passed: true, ...detail }); console.log('PASS ' + engine + ': ' + name);
        } catch (error) {
            await h.page.screenshot({ path: path.join(evidence, `workspace-failure-${engine}-${results.length}.png`) }).catch(() => {});
            results.push({ engine, name, passed: false, error: error.stack }); console.error('FAIL ' + engine + ': ' + name + '\n' + error.stack);
        } finally { await h.context.close(); }
    }
    try {
        for (const engine of engines) {
            const browser = await launch(engine); versions[engine] = browser.version();
            try {
                await run(browser, engine, 'task fields, subtasks, note search, completion/undo and persistence', async ({ page }) => {
                    await add(page, 'Audit task'); await open(page, 'Audit task');
                    const detail = page.locator('.workspace-details');
                    await detail.getByLabel('Notes', { exact: true }).fill('Searchable note');
                    await detail.getByLabel('Priority', { exact: true }).selectOption('3');
                    await detail.getByLabel('Estimated pomodoros', { exact: true }).fill('3');
                    await detail.getByLabel('Pomodoro length (minutes)', { exact: true }).fill('30');
                    await save(page);
                    await detail.getByLabel('Add a subtask', { exact: true }).fill('Child sample');
                    await detail.getByLabel('Add a subtask', { exact: true }).press('Enter');
                    await detail.getByRole('button', { name: 'Edit subtask: Child sample', exact: true }).waitFor();
                    await detail.getByRole('checkbox', { name: 'Toggle subtask completion: Child sample' }).click();
                    await page.waitForFunction(() => !document.querySelector('.workspace-subtask input').disabled);
                    await detail.getByRole('button', { name: 'Edit subtask: Child sample', exact: true }).click();
                    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Renamed child');
                    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
                    await page.getByRole('dialog').waitFor({ state: 'hidden' });
                    const stored = (await rows(page, 'Task')).find(row => row.name === 'Audit task');
                    assert.equal(stored.remark, 'Searchable note'); assert.equal(stored.priority, 3); assert.equal(stored.estimatePomoNum, 3); assert.equal(stored.pomodoroInterval, 1800);
                    const child = (await rows(page, 'Subtask')).find(row => row.taskId === stored.id); assert.equal(child.name, 'Renamed child'); assert.equal(child.isFinished, true);
                    await page.getByRole('searchbox').fill('searchable'); await task(page, 'Audit task').waitFor();
                    await page.getByRole('searchbox').fill('Renamed child'); await task(page, 'Audit task').waitFor();
                    await page.getByRole('searchbox').fill('unmatched'); assert.equal(await page.getByTestId('task-row').count(), 0);
                    await page.locator('[data-view="tasks"]').click();
                    await task(page, 'Audit task').getByRole('checkbox').click();
                    await page.waitForFunction(() => document.querySelector('[data-testid="completed-total"]').textContent === '1');
                    await page.getByRole('button', { name: 'Hide completed tasks', exact: true }).click();
                    assert.equal(await page.getByTestId('completed-total').innerText(), '1');
                    assert.equal(await page.getByTestId('task-row').count(), 0);
                    await page.getByRole('button', { name: 'Completed', exact: true }).click();
                    await task(page, 'Audit task').getByRole('checkbox').click();
                    await page.locator('[data-view="tasks"]').click(); await task(page, 'Audit task').waitFor();
                    await page.reload(); await ready(page); await open(page, 'Audit task');
                    assert.equal(await page.getByLabel('Notes', { exact: true }).inputValue(), 'Searchable note');
                    assert(await page.getByRole('checkbox', { name: 'Toggle subtask completion: Renamed child' }).isChecked());
                });
                await run(browser, engine, 'folders, list edit/hide/reveal, pointer and keyboard ordering, focus and confirmation', async ({ page }) => {
                    await createProject(page, 'Folder sample', true); await createProject(page, 'List alpha', false, 'Folder sample'); await createProject(page, 'List beta');
                    await page.getByRole('button', { name: 'List alpha', exact: true }).click(); await add(page, 'Nested task');
                    await page.getByRole('button', { name: 'Folder sample', exact: true }).click();
                    await page.getByRole('button', { name: 'List alpha', exact: true }).waitFor({ state: 'hidden' });
                    await page.getByRole('button', { name: 'Folder sample', exact: true }).click();
                    await page.getByRole('button', { name: 'Manage lists', exact: true }).click();
                    const dialog = page.getByRole('dialog');
                    await dialog.getByRole('checkbox', { name: 'Visible: List alpha', exact: true }).click();
                    await page.waitForFunction(() => !document.querySelector('.workspace-project-manager input').disabled);
                    await dialog.getByRole('checkbox', { name: 'Visible: List alpha', exact: true }).click();
                    await page.waitForFunction(() => !document.querySelector('.workspace-project-manager input').disabled);
                    const manager = page.locator('.workspace-project-manager');
                    const order = await manager.locator('[data-project-id]').evaluateAll(items => items.map(item => item.dataset.projectId));
                    const first = manager.locator('[data-project-id]').first();
                    await first.locator('.workspace-handle').focus(); await page.keyboard.press('ArrowDown');
                    await page.waitForFunction(id => document.querySelector('.workspace-project-manager [data-project-id]').dataset.projectId !== id, order[0]);
                    assert.equal(await page.locator(':focus').evaluate(element => element.closest('[data-project-id]').dataset.projectId), order[0]);
                    await manager.locator('[data-project-id]').first().locator('.workspace-handle').dragTo(manager.locator('[data-project-id]').nth(1));
                    await page.waitForFunction(id => document.querySelector('.workspace-project-manager [data-project-id]').dataset.projectId === id, order[0]);
                    await dialog.getByRole('button', { name: 'Edit: List beta', exact: true }).click();
                    const editor = page.getByRole('dialog').last(); await editor.getByLabel('Name', { exact: true }).fill('List renamed');
                    await editor.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 1);
                    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
                    await page.getByRole('button', { name: 'List renamed', exact: true }).waitFor();
                    await page.getByRole('button', { name: 'Manage lists', exact: true }).click(); await page.keyboard.press('Escape');
                    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Manage lists');
                    await page.getByRole('button', { name: 'List alpha', exact: true }).click(); await open(page, 'Nested task');
                    await page.locator('.workspace-details').getByRole('button', { name: 'Delete', exact: true }).click();
                    await page.keyboard.press('Escape'); assert(await task(page, 'Nested task').isVisible());
                    await page.locator('.workspace-details').getByRole('button', { name: 'Delete', exact: true }).click();
                    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
                    await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(await page.getByTestId('task-row').count(), 0);
                    assert.equal((await rows(page, 'Task')).find(row => row.name === 'Nested task').state, -1);
                });
                await run(browser, engine, 'task pointer/keyboard ordering and reload', async ({ page }) => {
                    await page.locator('[data-view="tasks"]').click(); await add(page, 'Order A'); await add(page, 'Order B'); await add(page, 'Order C');
                    const names = () => page.getByTestId('task-row').locator('.workspace-task-name').allTextContents();
                    assert.deepEqual(await names(), ['Order C', 'Order B', 'Order A']);
                    await task(page, 'Order C').locator('.workspace-handle').focus(); await page.keyboard.press('ArrowDown');
                    await page.waitForFunction(() => document.querySelector('.workspace-task-name').textContent === 'Order B');
                    await task(page, 'Order A').locator('.workspace-handle').dragTo(task(page, 'Order B'));
                    await page.waitForFunction(() => document.querySelector('.workspace-task-name').textContent === 'Order A');
                    await page.reload(); await ready(page); await page.locator('[data-view="tasks"]').click();
                    assert.deepEqual(await names(), ['Order A', 'Order B', 'Order C']);
                });
                await run(browser, engine, 'repeat completion generates the next task and preserves child association', async ({ page }) => {
                    await add(page, 'Repeat sample'); await open(page, 'Repeat sample');
                    await page.getByLabel('Due date', { exact: true }).fill('2026-11-20');
                    await page.getByLabel('Repeat', { exact: true }).selectOption('days');
                    await page.getByLabel('Every', { exact: true }).fill('2'); await save(page);
                    await page.locator('.workspace-details').getByLabel('Add a subtask', { exact: true }).fill('Repeat child');
                    await page.locator('.workspace-details').getByLabel('Add a subtask', { exact: true }).press('Enter');
                    await page.getByRole('button', { name: 'Edit subtask: Repeat child' }).waitFor();
                    await page.locator('[data-view="tasks"]').click(); await task(page, 'Repeat sample').getByRole('checkbox').click();
                    await page.waitForFunction(() => !document.querySelector('.workspace-add-task input').disabled);
                    const tasks = (await rows(page, 'Task')).filter(row => row.name === 'Repeat sample');
                    assert.equal(tasks.length, 2); assert.equal(tasks.filter(row => row.isFinished).length, 1);
                    const next = tasks.find(row => !row.isFinished); assert.equal(new Date(next.deadline).getDate(), 22);
                    assert((await rows(page, 'Subtask')).some(row => row.taskId === next.id && row.name === 'Repeat child'));
                });
                await run(browser, engine, 'storage failure retains task input and retry commits once', async ({ page }) => {
                    await page.evaluate(() => {
                        const add = IDBObjectStore.prototype.add;
                        IDBObjectStore.prototype.add = function(value, ...rest) {
                            if (this.name === 'Task') { IDBObjectStore.prototype.add = add; throw new DOMException('Synthetic write failure', 'QuotaExceededError'); }
                            return add.call(this, value, ...rest);
                        };
                    });
                    const input = page.locator('.workspace-add-task input'); await input.fill('Retained task'); await input.press('Enter');
                    await page.getByRole('alert').waitFor(); assert.equal(await input.inputValue(), 'Retained task'); assert.equal(await page.getByTestId('task-row').count(), 0);
                    assert.equal((await rows(page, 'Task')).length, 0);
                    await input.press('Enter'); await task(page, 'Retained task').waitFor(); assert.equal((await rows(page, 'Task')).length, 1);
                });
                await run(browser, engine, 'cross-tab conflict preserves draft and requires reopening the new revision', async ({ page, context }) => {
                    await add(page, 'Shared task'); await open(page, 'Shared task'); await page.getByLabel('Notes', { exact: true }).fill('Unsaved draft');
                    const other = await context.newPage(); await other.goto(url); await ready(other); await open(other, 'Shared task');
                    await other.getByLabel('Name', { exact: true }).fill('Remote title'); await save(other);
                    await task(page, 'Remote title').waitFor();
                    await page.locator('.workspace-details').getByRole('button', { name: 'Save', exact: true }).click();
                    await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /changed in another window/);
                    assert.equal(await page.getByLabel('Notes', { exact: true }).inputValue(), 'Unsaved draft');
                    const stored = (await rows(page, 'Task'))[0]; assert.equal(stored.name, 'Remote title'); assert.equal(stored.remark, '');
                    await page.locator('.workspace-details').getByRole('button', { name: 'Close', exact: true }).click();
                    await open(page, 'Remote title'); assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Remote title');
                    await other.close();
                });
                await run(browser, engine, 'incompatible storage stops UI writes and preserves existing data', async ({ page }) => {
                    await add(page, 'Preserved task');
                    await page.evaluate(() => {
                        const add = IDBObjectStore.prototype.add;
                        IDBObjectStore.prototype.add = function(value, ...rest) {
                            if (this.name === 'Task') { IDBObjectStore.prototype.add = add; throw new DOMException('Synthetic incompatible storage', 'VersionError'); }
                            return add.call(this, value, ...rest);
                        };
                    });
                    const input = page.locator('.workspace-add-task input'); await input.fill('Blocked task'); await input.press('Enter');
                    await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /Writing has stopped/);
                    assert(await input.isDisabled()); assert.equal((await rows(page, 'Task')).length, 1);
                    assert.equal(await input.inputValue(), 'Blocked task'); await page.getByRole('button', { name: 'Reload', exact: true }).click();
                    await ready(page); await task(page, 'Preserved task').waitFor(); assert.equal((await rows(page, 'Task')).length, 1);
                });
                await run(browser, engine, 'editing a name preserves unknown fields and sub-minute reminder timestamps', async ({ page }) => {
                    await page.evaluate(() => {
                        const add = IDBObjectStore.prototype.add;
                        IDBObjectStore.prototype.add = function(value, ...rest) {
                            if (this.name === 'Task') { IDBObjectStore.prototype.add = add; value = { ...value, reminderDate: new Date('2026-12-01T12:34:56.789+08:00').getTime(), compatibleUnknown: { retained: true } }; }
                            return add.call(this, value, ...rest);
                        };
                    });
                    await add(page, 'Compatibility task'); const before = (await rows(page, 'Task'))[0]; await open(page, 'Compatibility task');
                    await page.getByLabel('Name', { exact: true }).fill('Edited compatibility task'); await save(page);
                    const after = (await rows(page, 'Task'))[0]; assert.deepEqual(after, { ...before, name: 'Edited compatibility task', sync: 0 });
                });
                await run(browser, engine, 'tags, colors, grouping, sidebar width and cross-list task dragging', async ({ page }) => {
                    await createProject(page, 'Destination list');
                    await page.getByRole('button', { name: 'Create tag', exact: true }).click();
                    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Urgent tag');
                    await page.getByRole('dialog').getByLabel('Color', { exact: true }).fill('#ee3366');
                    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
                    await page.locator('[data-view="tasks"]').click(); await add(page, 'Move sample');
                    await open(page, 'Move sample'); await page.locator('.workspace-tags').getByRole('checkbox', { name: 'Urgent tag' }).click(); await save(page);
                    const childInput = page.getByLabel('Add a subtask', { exact: true });
                    for (const name of ['Order child A', 'Order child B']) { await childInput.fill(name); await childInput.press('Enter'); await page.getByRole('button', { name: 'Edit subtask: ' + name, exact: true }).waitFor(); }
                    const children = page.locator('.workspace-subtask');
                    await children.first().locator('.workspace-handle').focus(); await page.keyboard.press('ArrowDown');
                    await page.waitForFunction(() => document.querySelector('.workspace-subtask .workspace-task-name').textContent === 'Order child B');
                    await children.last().locator('.workspace-handle').dragTo(children.first());
                    await page.waitForFunction(() => document.querySelector('.workspace-subtask .workspace-task-name').textContent === 'Order child A');
                    const tag = (await rows(page, 'Project')).find(row => row.name === 'Urgent tag'); assert.equal(tag.color, 'EE3366');
                    await page.getByRole('button', { name: 'Urgent tag', exact: true }).click(); await task(page, 'Move sample').waitFor();
                    await page.getByRole('combobox', { name: 'Order tasks by', exact: true }).selectOption('2');
                    await page.waitForFunction(() => !document.querySelector('.workspace-sort select').disabled);
                    assert(await page.locator('.workspace-task-group h2').filter({ hasText: 'Normal' }).isVisible());
                    await page.locator('[data-view="tasks"]').click();
                    await task(page, 'Move sample').locator('.workspace-handle').dragTo(page.getByRole('button', { name: 'Destination list', exact: true }));
                    await page.getByRole('button', { name: 'Destination list', exact: true }).click(); await task(page, 'Move sample').waitFor();
                    assert.equal((await rows(page, 'Task')).find(row => row.name === 'Move sample').projectId, (await rows(page, 'Project')).find(row => row.name === 'Destination list').id);
                    const separator = page.getByRole('separator', { name: 'Sidebar width' }); await separator.focus(); await page.keyboard.press('ArrowRight');
                    await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width === 290);
                    await page.reload(); await ready(page); assert.equal(await page.locator('.workspace-sidebar').evaluate(element => element.getBoundingClientRect().width), 290);
                });
                await run(browser, engine, 'timer task/subtask start, pause/resume, finish, mode and persisted history', async ({ page }) => {
                    await page.clock.install();
                    await add(page, 'Timer sample'); await open(page, 'Timer sample');
                    await page.getByLabel('Add a subtask', { exact: true }).fill('Timer child'); await page.getByLabel('Add a subtask', { exact: true }).press('Enter');
                    await page.getByRole('button', { name: 'Start subtask: Timer child' }).click();
                    await page.locator('[data-testid="timer-expanded"][data-state="work"]').waitFor();
                    assert.equal((await rows(page, 'TimerSession'))[0].subtaskId, (await rows(page, 'Subtask'))[0].id);
                    await page.clock.fastForward(30000);
                    await page.locator('[data-view="timer"]').click();
                    const timer = page.getByTestId('timer-expanded');
                    await timer.getByRole('button', { name: 'Pause', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="pause"]').waitFor();
                    assert.equal(Math.round((await rows(page, 'Pomodoro')).reduce((total, row) => total + row.interval, 0)), 30);
                    await timer.getByRole('button', { name: 'Continue', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="work"]').waitFor();
                    await page.clock.fastForward(10000); await timer.getByRole('button', { name: 'Pause', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="pause"]').waitFor(); await timer.getByRole('button', { name: 'Stop', exact: true }).click();
                    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
                    assert.equal(Math.round((await rows(page, 'Pomodoro')).reduce((total, row) => total + row.interval, 0)), 30, 'A separate resumed 10-second span is below the legacy 25-second threshold');
                    await timer.getByRole('button', { name: 'Countdown', exact: true }).click();
                    await timer.getByRole('button', { name: 'Stopwatch', exact: true }).waitFor();
                    await page.reload(); await ready(page); await page.locator('[data-view="timer"]').click(); await page.getByTestId('timer-expanded').getByRole('button', { name: 'Stopwatch', exact: true }).waitFor();
                    assert.equal((await rows(page, 'Pomodoro')).length, 1);
                });
                await run(browser, engine, 'timer interrupted gap recovery and unsupported mini fallback remain operable', async ({ page }) => {
                    await page.clock.install();
                    await page.locator('[data-view="timer"]').click(); const timer = page.getByTestId('timer-expanded');
                    await timer.getByRole('button', { name: 'Start', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="work"]').waitFor();
                    await page.clock.fastForward(360000); await page.getByRole('dialog', { name: 'Confirm interrupted time', exact: true }).waitFor();
                    await page.getByRole('dialog').getByRole('button', { name: 'Exclude interrupted time', exact: true }).click();
                    await page.locator('[data-testid="timer-expanded"][data-state="pause"]').waitFor(); assert.equal((await rows(page, 'Pomodoro')).length, 0);
                    await page.evaluate(() => Object.defineProperty(window, 'documentPictureInPicture', { configurable: true, value: undefined }));
                    await timer.getByRole('button', { name: 'Mini timer', exact: true }).click(); await timer.getByText(/floating timer remains available/).waitFor();
                    await timer.getByRole('button', { name: 'Continue', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="work"]').waitFor();
                    await timer.getByRole('button', { name: 'Sound', exact: true }).click(); const sound = page.getByRole('dialog', { name: 'Sound', exact: true });
                    await sound.getByRole('combobox').first().selectOption('bgm_Rain');
                    await page.waitForFunction(() => localStorage.getItem('FocusTodoStandalone.data.BgMusic') === 'bgm_Rain');
                    await sound.getByRole('button', { name: 'Stop preview', exact: true }).click(); await sound.getByRole('button', { name: 'Close', exact: true }).last().click();
                    await page.getByTestId('timer-expanded').getByRole('button', { name: 'Pause', exact: true }).click();
                    await page.locator('[data-testid="timer-expanded"][data-state="pause"]').waitFor();
                });
                await run(browser, engine, 'countdown work completion exposes the legacy break/start and break/complete actions', async ({ page }) => {
                    await page.clock.install(); await page.locator('[data-view="timer"]').click(); const timer = page.getByTestId('timer-expanded');
                    await timer.getByLabel('Pomodoro length (minutes)', { exact: true }).fill('1');
                    await page.waitForFunction(() => localStorage.getItem('FocusTodoStandalone.data.WorkInterval') === '60' && !document.querySelector('.workspace-timer-expanded input').disabled);
                    await timer.getByRole('button', { name: 'Start', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="work"]').waitFor();
                    await page.clock.fastForward(61000); await page.locator('[data-testid="timer-expanded"][data-state="waitingForRest"]').waitFor();
                    await timer.getByRole('button', { name: 'Start break', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="rest"]').waitFor();
                    await timer.getByRole('button', { name: 'Complete', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="initial"]').waitFor();
                    assert.equal(Math.round((await rows(page, 'Pomodoro')).reduce((total, row) => total + row.interval, 0)), 60);
                });
                if (engine === 'chromium') await run(browser, engine, 'native mini window renders the shared timer and controls without a second writer', async ({ page, context }) => {
                    assert(await page.evaluate(() => !!window.documentPictureInPicture?.requestWindow));
                    await page.locator('[data-view="timer"]').click(); await page.getByTestId('timer-expanded').getByRole('button', { name: 'Mini timer', exact: true }).click();
                    await page.waitForFunction(() => documentPictureInPicture.window?.document.querySelector('.workspace-mini-native'));
                    const mini = context.pages().find(other => other !== page); assert(mini);
                    const miniErrors = []; mini.on('pageerror', error => miniErrors.push(error.message));
                    await mini.getByRole('button', { name: 'Start', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="work"]').waitFor();
                    await mini.getByRole('button', { name: 'Pause', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="pause"]').waitFor();
                    await mini.getByRole('button', { name: 'Stop', exact: true }).click(); await page.locator('[data-testid="timer-expanded"][data-state="initial"]').waitFor();
                    await mini.getByRole('button', { name: 'Close mini timer', exact: true }).click();
                    await page.waitForFunction(() => !documentPictureInPicture.window);
                    assert.equal((await rows(page, 'TimerSession')).length, 1);
                    assert.deepEqual(miniErrors, []);
                });
                for (const locale of ['zh-CN', 'en']) for (const dark of [false, true]) {
                    await run(browser, engine, `${locale} ${dark ? 'dark' : 'light'}: baseline geometry, typography, screenshot, keyboard and narrow viewport`, async ({ page }) => {
                        await page.locator('[data-view="settings"]').click();
                        await page.getByTestId('prototype-theme').selectOption(dark ? 'dark' : 'light');
                        await page.waitForFunction(dark => document.documentElement.dataset.theme === (dark ? 'dark' : 'light'), dark);
                        await page.locator('[data-project-id="id-deadline-today"]').click();
                        await add(page, 'Audit sample'); await open(page, 'Audit sample');
                        await page.evaluate(() => document.fonts.ready);
                        const metrics = await page.evaluate(() => {
                            const metric = selector => { const element = document.querySelector(selector), style = getComputedStyle(element), rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight, color: style.color, background: style.backgroundColor }; };
                            return { header: metric('.workspace-header'), sidebar: metric('.workspace-sidebar'), name: metric('.workspace-nav-name'), count: metric('.workspace-nav-count'), nav: metric('.workspace-nav'), search: metric('.workspace-search'), input: metric('.workspace-search input'), clipping: document.documentElement.scrollWidth > innerWidth };
                        });
                        assert.equal(metrics.header.height, 50); assert.equal(metrics.sidebar.width, 280); assert.equal(metrics.clipping, false);
                        assertTypography(metrics);
                        const baseline = auditViews.results.find(row => row.locale === locale && row.dark === dark && row.scene === 'task-detail').metrics['[class*=HomeHeader-root]'];
                        assert.equal(metrics.header.background, baseline.background);
                        assert.equal(metrics.header.color, baseline.color);
                        await page.screenshot({ path: path.join(evidence, `workspace-${engine}-${locale}-${dark ? 'dark' : 'light'}.png`) });
                        await page.locator('[data-view="timer"]').click();
                        assert(await page.getByTestId('timer-expanded').isVisible());
                        assert.equal(await page.getByTestId('timer-expanded').evaluate(element => element.getBoundingClientRect().top < innerHeight && element.getBoundingClientRect().top >= 50), true, 'Expanded timer must render in the first visible viewport');
                        await page.screenshot({ path: path.join(evidence, `workspace-${engine}-${locale}-${dark ? 'dark' : 'light'}-timer.png`) });
                        await page.locator('[data-project-id="id-deadline-today"]').click(); await open(page, 'Audit sample');
                        const injected = await page.addStyleTag({ content: '.workspace-nav-name {font-size:30px!important}' });
                        const badSize = await page.locator('.workspace-nav-name').first().evaluate(element => getComputedStyle(element).fontSize);
                        assert.throws(() => assertTypography({ ...metrics, name: { ...metrics.name, fontSize: badSize } }), /name.fontSize/);
                        await injected.evaluate(element => element.remove());
                        await page.setViewportSize({ width: 375, height: 812 });
                        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                        assert(await page.getByLabel(locale === 'en' ? 'Notes' : '备注', { exact: true }).isVisible());
                        await page.locator('.workspace-header .workspace-mobile-toggle').click();
                        const target = page.locator('[data-project-id="id-deadline-tomorrow"]'); await target.waitFor({ state: 'visible' }); await target.focus(); await page.keyboard.press('Enter');
                        await page.waitForFunction(() => document.querySelector('[data-project-id="id-deadline-tomorrow"]').getAttribute('aria-current') === 'page');
                        await page.waitForFunction(() => document.activeElement.tagName === 'H1');
                        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                        await page.screenshot({ path: path.join(evidence, `workspace-${engine}-${locale}-${dark ? 'dark' : 'light'}-narrow.png`) });
                        await page.locator('[data-view="timer"]').click();
                        assert.equal(await page.getByTestId('timer-expanded').evaluate(element => element.getBoundingClientRect().top < innerHeight && element.getBoundingClientRect().top >= 50), true, 'Narrow timer must open above the fold');
                        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                        await page.screenshot({ path: path.join(evidence, `workspace-${engine}-${locale}-${dark ? 'dark' : 'light'}-timer-narrow.png`) });
                        return { metrics, reference: 'A views + cfd6449 sidebar fixture; partial geometry/typography comparison, not whole-view visual parity' };
                    }, { locale });
                }
            } finally { await browser.close(); }
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.writeFileSync(path.join(evidence, 'standalone-workspace-results.json'), JSON.stringify({ method: 'Isolated production candidate, synthetic data, external network blocked, DPR 1, reduced motion, Asia/Shanghai. Real pointer/keyboard, IndexedDB reads, two tabs. Partial A geometry/typography; WebKit is not Safari.', engines, versions, results }, null, 2) + '\n');
    }
    if (results.some(row => !row.passed)) throw new Error('Workspace acceptance failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
