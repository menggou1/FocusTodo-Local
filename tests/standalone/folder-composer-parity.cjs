const { paired, copyFixture, metrics, assert, fs, path } = require('./ui-restore-helpers.cjs');
const { evidence } = require('./helpers.cjs');

const output = path.join(evidence, 'folder-composer');
const oldComposer = '[class*=TaskNewItem-root]';
const newComposer = '.workspace-add-task';
const oldProject = '[class*=TaskNewItem-prjPopoverAnchor]';
const oldDeadline = '[class*=TaskNewItem-deadline] > span';
const newProject = '.workspace-quick-project';
const newDeadline = '.workspace-add-task .workspace-quick-deadline-picker summary';
const oldMenu = '#project-selection-popover.in';
const newMenu = '.workspace-picker-surface.workspace-quick-project-picker:not(.is-closing)';
const oldDate = '#deadline-selection-popover.in';
const newDate = '.workspace-picker-surface.workspace-quick-deadline-picker:not(.is-closing)';
const projectButton = (page, id) => page.locator('button[data-project-id="' + id + '"]');
const oldNav = (page, name) => page.locator('[class*=ProjectItem-name]').filter({ hasText: new RegExp('^' + name + '$') });

async function seed(pair) {
    await pair.old.evaluate(async () => {
        const data = FocusLocalData;
        await data.createCalendarTask({ name: 'Default-list seed', count: 1, interval: 1500,
            startTime: Date.now(), projectId: 'id-task-tasks', shortBreak: 300, addToTop: true });
        const backup = await data.snapshot();
        const baseProject = backup.indexedDB.Project.find(project => project.type === 7005);
        const baseTask = backup.indexedDB.Task.find(task => task.name === 'Default-list seed');
        const projects = [
            ['folder', 'Oracle Folder', 2000, '', 100, 0],
            ['beta', 'Oracle Beta', 1000, 'folder', 300, 0],
            ['alpha', 'Oracle Alpha', 1000, 'folder', 200, 0],
            ['nested', 'Oracle Nested Folder', 2000, 'folder', 400, 0],
            ['nested-list', 'Oracle Nested List', 1000, 'nested', 500, 0],
            ['other', 'Oracle Other', 1000, '', 600, 0],
            ['tag', 'Oracle Tag', 3000, '', 700, 0],
            ['hidden', 'Oracle Hidden', 1000, 'folder', 350, 1],
        ];
        const tasks = [
            ['Alpha later', 'alpha', 30, 0, false],
            ['Alpha high', 'alpha', 20, 3, false],
            ['Beta medium', 'beta', 10, 2, false],
            ['Beta completed', 'beta', 0, 0, true],
            ['Nested task', 'nested-list', 1, 0, false],
            ['Outside task', 'other', 5, 0, false],
            ['Hidden task', 'hidden', 0, 0, false],
            ['Orphaned folder task', 'folder', 0, 0, false],
        ];
        const db = await data.open();
        await data.transaction(db, ['Project', 'Task'], 'readwrite', tx => {
            const projectStore = tx.objectStore('Project');
            for (const [id, name, type, parentId, order, state] of projects) {
                projectStore.put({ ...baseProject, id, name, type, parentId, order, state,
                    expanded: true, color: '58A8EC', orderingRule: type === 1000 ? 3 : 0 });
            }
            for (const preset of backup.indexedDB.Project.filter(project => project.type >= 4000)) {
                projectStore.put({ ...preset, state: 0 });
            }
            const taskStore = tx.objectStore('Task');
            for (const [name, projectId, order, priority, isFinished] of tasks) {
                taskStore.put({ ...baseTask, id: name, name, projectId, order, priority, isFinished,
                    finishedDate: isFinished ? Date.now() : 0, deadline: 0, estimatePomoNum: 2 });
            }
        });
    });
    await pair.old.reload();
    await oldNav(pair.old, 'Oracle Folder').waitFor();
    return copyFixture(pair);
}

function near(a, b, keys) {
    assert(a && b);
    for (const key of keys) assert(Math.abs(a[key] - b[key]) <= 1, key + ' ' + a[key] + ' vs ' + b[key]);
}

async function groups(page, legacy) {
    const root = legacy ? '[class*=TaskGroup-group]' : '.workspace-task-group';
    const title = legacy ? '[class*=TaskGroup-title]' : 'h2';
    const task = legacy ? '[class*=TaskItem-name-]' : '.workspace-task-name';
    return page.locator(root).evaluateAll((nodes, { title, task }) => nodes
        .filter(node => node.querySelectorAll(task).length)
        .map(node => [
            node.querySelector(title)?.textContent.split('•')[0].trim(),
            [...node.querySelectorAll(task)].map(item => item.textContent.trim()),
        ]), { title, task });
}

async function checkMatrix(pair, backup) {
    const { old, new: page } = pair;
    const matrix = [];
    const legacyLabels = {
        'id-task-tasks': 'Tasks', 'id-task-all': 'All', 'id-task-history': 'Completed', 'id-task-schedule': 'Schedule',
        'id-deadline-today': 'Today', 'id-deadline-tomorrow': 'Tomorrow', 'id-deadline-week': 'This Week',
        'id-deadline-upcoming': 'Planned', 'id-deadline-someday': 'Someday', 'id-deadline-overdue': 'Overdue',
        'id-deadline-last7days': 'Next 7 Days', 'id-priority-high': 'High Priority',
        'id-priority-medium': 'Medium Priority', 'id-priority-low': 'Low Priority',
    };
    for (const row of backup.indexedDB.Project.filter(row => row.state === 0 && row.type !== 7002 && row.id !== 'nested-list')) {
        const legacyName = legacyLabels[row.id] || row.name;
        await oldNav(old, legacyName).click();
        await projectButton(page, row.id).click();
        const expected = [7001, 7003].includes(row.type) ? []
            : [1000, 7005].includes(row.type) ? ['deadline']
            : row.type >= 4000 && row.type < 5000 ? ['project'] : ['project', 'deadline'];
        const visible = async (page, composer, project, deadline) => {
            if (!await page.locator(composer).isVisible()) return [];
            const buttons = [];
            for (const [key, selector] of [['project', project], ['deadline', deadline]]) {
                const control = page.locator(selector);
                const box = await control.isVisible() ? await control.boundingBox() : null;
                if (box) buttons.push([key, box.x]);
            }
            return buttons.sort((a, b) => a[1] - b[1]).map(([key]) => key);
        };
        const oldControls = await visible(old, oldComposer, oldProject, oldDeadline);
        const newControls = await visible(page, newComposer, newProject, newDeadline);
        assert.deepEqual(oldControls, expected, legacyName + ' legacy controls');
        assert.deepEqual(newControls, expected, legacyName + ' React controls');
        matrix.push({ page: legacyName, oldControls, newControls });
    }
    return matrix;
}

async function checkFolder(pair, key, locale) {
    const { old, new: page } = pair;
    await oldNav(old, 'Oracle Folder').click();
    await projectButton(page, 'folder').click();
    const expected = [['Oracle Alpha', ['Alpha high', 'Alpha later']], ['Oracle Beta', ['Beta medium']]];
    assert.deepEqual(await groups(old, true), expected);
    assert.deepEqual(await groups(page, false), expected);
    const completedToggle = page.locator('.workspace-completed-toggle');
    const legacyToggle = old.getByText(locale==='en'?'Show Completed Tasks':'显示已完成任务', {exact:false});
    await legacyToggle.click();
    await completedToggle.click();
    for (const view of [old, page]) await view.getByText('Beta completed', {exact:true}).waitFor();
    await old.getByText(locale==='en'?'Hide Completed Tasks':'隐藏已完成任务', {exact:false}).click();
    await completedToggle.click();
    await page.locator('h1').first().blur();
    const before = await metrics(old, { composer: oldComposer, icon: oldProject + ' span', date: oldDeadline, group: '[class*=TaskGroup-title]' });
    const after = await metrics(page, { composer: newComposer, icon: newProject + ' img', date: newDeadline + ' img', group: '.workspace-task-group h2' });
    for (const field of ['composer', 'icon', 'date', 'group']) near(before[field], after[field], ['x','y','width','height']);
    for (const [side, view] of [['old', old], ['new', page]]) {
        await view.screenshot({ path: path.join(output, key+'-folder-'+side+'.png') });
    }

    await old.locator(oldProject).click();
    await page.locator(newProject).click();
    await old.locator(oldMenu).waitFor();
    await page.locator(newMenu).waitFor();
    const menuMetrics = {
        old: await metrics(old, { menu: oldMenu, row: oldMenu+' [class*=ProjectSelection-option]', icon: oldMenu+' [class*=ProjectSelection-color]' }),
        new: await metrics(page, { menu: newMenu, row: newMenu+' [role=option]', icon: newMenu+' [role=option]>img' }),
    };
    const oldOptions = old.locator(oldMenu+' [class*=ProjectSelection-option]');
    const scopedOptions = page.locator(newMenu).getByRole('option');
    assert.deepEqual(await scopedOptions.allTextContents(), [locale==='en' ? 'Tasks' : '任务', 'Oracle Alpha', 'Oracle Beta']);
    const removedRows = await oldOptions.count() - await scopedOptions.count();
    near({ ...menuMetrics.old.menu, height: menuMetrics.old.menu.height - removedRows * menuMetrics.old.row.height },
        menuMetrics.new.menu, ['width','height']);
    near(menuMetrics.old.row, menuMetrics.new.row, ['width','height']);
    near(menuMetrics.old.icon, menuMetrics.new.icon, ['width','height']);
    assert.equal(menuMetrics.old.row.lineHeight, menuMetrics.new.row.lineHeight);
    assert.equal(menuMetrics.old.row.padding, menuMetrics.new.row.padding);
    await old.locator(oldMenu).getByText('Oracle Beta', { exact: true }).click();
    await page.locator(newMenu).getByRole('option', { name: 'Oracle Beta', exact: true }).click();
    await old.locator(oldMenu).waitFor({ state: 'hidden' });
    await page.locator(newMenu).waitFor({ state: 'hidden' });

    await page.locator(newProject).press('Enter');
    await page.locator(newMenu).waitFor();
    await page.locator(newProject).click();
    await page.locator(newMenu).waitFor({ state: 'hidden' });
    await page.locator(newProject).click();
    await page.locator(newMenu).waitFor();
    await page.keyboard.press('Escape');
    await page.locator(newMenu).waitFor({ state: 'hidden' });
    assert(await page.locator(newProject).evaluate(node => node === document.activeElement));
    await page.locator(newProject).click();
    await page.locator(newMenu).waitFor();
    await page.locator(newDeadline).click();
    await page.locator(newMenu).waitFor({ state: 'hidden' });
    await page.locator(newDate).waitFor();
    await old.locator(oldDeadline).click();
    await old.locator(oldDate).waitFor();
    await old.locator(oldDate+' [class*=DeadlineSelection-tomorrow]').click();
    await page.locator(newDate+' .legacy-date-quick button').nth(1).click();
    assert(await page.locator(newDate).isVisible());
    await old.locator(oldDate+' [class*=DeadlineSelection-confirm]').click();
    await page.locator(newDate+' footer .primary').click();
    await page.locator(newDate).waitFor({ state: 'hidden' });
    const deadline = await old.evaluate(() => localStorage.getItem('DefaultDeadline'));
    assert.equal(await page.evaluate(() => localStorage.getItem('FocusTodoStandalone.data.DefaultDeadline')), deadline);

    const bell = page.locator('[data-view=notifications]');
    const panel = page.locator('.legacy-notification-popover');
    await bell.click();
    await panel.locator('header').click();
    assert(await panel.isVisible());
    await bell.click();
    await panel.waitFor({ state: 'hidden' });
    await bell.click();
    await panel.waitFor();
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    await bell.click();
    const composerInput = page.locator(newComposer+' input');
    await composerInput.click();
    await panel.waitFor({ state: 'hidden' });
    assert(await composerInput.evaluate(node => node === document.activeElement));
    await page.locator(newProject).click();
    await page.locator(newMenu).waitFor();
    await bell.click();
    await page.locator(newMenu).waitFor({ state: 'hidden' });
    await panel.locator('[data-version]').first().click();
    const release = page.locator('.legacy-release-dialog');
    await release.waitFor();
    const tile = release.locator('header .legacy-dialog-tile');
    await tile.evaluate(image => image.decode());
    const tileShape = await tile.evaluate(image => {
        const box = image.getBoundingClientRect();
        return { width: box.width, height: box.height, source: image.currentSrc, dpr: devicePixelRatio };
    });
    assert.equal(tileShape.width, 44);
    assert.equal(tileShape.height, 44);
    assert.match(tileShape.source, tileShape.dpr > 1 ? /focus-app_120-/ : /focus-app_48-/);
    await release.locator('footer button').click();
    await release.waitFor({ state: 'hidden' });
    await bell.click();
    assert.equal(await panel.locator('[data-version]').first().getAttribute('data-unread'), null);
    await panel.waitFor();
    await page.locator('[data-view=settings]').click();
    await page.getByTestId('settings-page').waitFor();
    assert.equal(await panel.count(), 0);
    assert.equal(await page.getByTestId('settings-page').locator('.legacy-dialog-tile').count(), 0);
    await page.getByTestId('close-page').click();
    await page.getByTestId('settings-page').waitFor({ state: 'hidden' });

    const name = 'Folder composition';
    for (const [view, selector] of [[old, oldComposer], [page, newComposer]]) {
        const input = view.locator(selector+' input').first();
        await input.fill(name);
        await input.press('Enter');
        await view.getByText(name, { exact: true }).waitFor();
    }
    const stored = async (view, old, taskName=name) => view.evaluate(({ old, name }) => new Promise((resolve, reject) => {
        const open = indexedDB.open(old ? 'PomodoroDB6' : 'FocusTodoStandalone.PomodoroDB6', 3);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const request = db.transaction('Task').objectStore('Task').getAll();
            request.onsuccess = () => { db.close(); resolve(request.result.filter(task => task.name === name)); };
            request.onerror = () => reject(request.error);
        };
    }), { old, name:taskName });
    for (const [view, legacy] of [[old, true], [page, false]]) {
        const [task] = await stored(view, legacy);
        assert.equal(task.projectId, 'beta');
        assert.equal(String(task.deadline), deadline);
    }
    const created = page.getByTestId('task-row').filter({ hasText: name });
    await created.getByRole('checkbox').click();
    await created.waitFor({ state: 'hidden' });
    await completedToggle.click();
    await created.waitFor();
    assert.equal((await stored(page, false))[0].isFinished, true);
    await completedToggle.click();

    // Move a row away and back through the detail picker, keeping its stored ID.
    const beta = page.locator('[data-task-id="Beta medium"]');
    const detail = page.locator('.workspace-details');
    async function move(betaRow, destination) {
        await betaRow.locator('.workspace-task-name').click();
        await detail.locator('details').filter({ has: page.locator('summary>img[src*=detail-project]') }).locator('summary').click();
        await page.locator('.workspace-picker-surface .legacy-project-options').getByRole('option', {name:destination,exact:true}).click();
    }
    await move(beta, 'Oracle Other');
    await beta.waitFor({state:'hidden'});
    assert.equal((await stored(page,false,'Beta medium'))[0].projectId,'other');
    await projectButton(page,'other').click();
    await move(beta, 'Oracle Beta');
    await beta.waitFor({state:'hidden'});
    await projectButton(page,'folder').click();
    await beta.waitFor();
    const editor = beta.locator('.workspace-task-name');
    await editor.click();
    await editor.fill('Beta renamed');
    await editor.press('Enter');
    const renamed = page.getByTestId('task-row').filter({ hasText:'Beta renamed' });
    await renamed.getByRole('button',{name:'Beta renamed',exact:true}).waitFor();
    const [data] = await stored(page,false,'Beta renamed');
    assert.equal(data.id, 'Beta medium');
    assert.equal(data.projectId, 'beta');
    assert.equal(data.priority, 2);
    await detail.locator('.legacy-detail-bottom button').last().click();
    await page.locator('.legacy-task-delete .primary').click();
    await renamed.waitFor({state:'hidden'});
    assert.equal((await stored(page,false,'Beta renamed'))[0].state,-1);

    // The composer remains on the folder while a list loses membership.
    await page.locator(newProject).click();
    await page.locator(newMenu).getByRole('option', {name:'Oracle Beta',exact:true}).click();
    await page.locator(newMenu).waitFor({state:'hidden'});
    await projectButton(page,'folder').click({button:'right'});
    await page.getByRole('menuitem', {name:locale==='en'?'Edit Folder':'编辑清单夹',exact:true}).click();
    const folderEditor = page.getByRole('dialog').last();
    await folderEditor.locator('.legacy-folder-lists label').filter({hasText:'Oracle Beta'}).getByRole('checkbox').uncheck();
    await folderEditor.locator('footer .primary').click();
    await folderEditor.waitFor({state:'hidden'});
    await page.locator(newProject).click();
    await page.locator(newMenu).waitFor();
    const options = page.locator(newMenu).getByRole('option');
    assert.deepEqual(await options.allTextContents(), [locale==='en'?'Tasks':'任务','Oracle Alpha']);
    assert.equal(await options.first().getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    const input = page.locator(newComposer+' input').first();
    await input.fill('Folder default fallback');
    await input.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.workspace-add-task input').value);
    assert.equal((await stored(page,false,'Folder default fallback'))[0].projectId,'id-task-tasks');
    return { groups: expected, before, after, menuMetrics, tileShape, storedProject: 'beta', deadline };
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const results = [];
    for (const options of [{ locale:'en' }, { locale:'zh-CN', dark:true, width:1100, height:760, deviceScaleFactor:2 }]) {
        const pair = await paired(options);
        try {
            const backup = await seed(pair);
            const matrix = options.locale === 'en' ? await checkMatrix(pair, backup) : [];
            const folder = await checkFolder(pair, options.locale, options.locale);
            assert.deepEqual(pair.handles[1].errors, []);
            results.push({ baseline: pair.baseline, options, matrix, folder });
            console.log('PASS folder aggregation, composer and notification interaction', options.locale);
        } finally { await pair.close(); }
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
