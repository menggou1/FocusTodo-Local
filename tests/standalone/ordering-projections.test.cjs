const test = require('node:test');
const assert = require('node:assert/strict');
const { createApplication } = require('./core-helpers.cjs');

test('completed chart keeps independent task and custom-list ordering domains', async () => {
    const { completionStacks } = await import('../../standalone/domain/reports.mjs');
    const projects = [
        { id: 'tasks', type: 7005, order: Number.MAX_VALUE },
        { id: 'small', type: 1000, order: -Number.MAX_VALUE },
        { id: 'missing', type: 1000 },
        { id: 'same-a', type: 1000, order: 1 },
        { id: 'same-b', type: 1000, order: 1 },
    ];
    const task = (id, projectId, priority, order, finishedDate = 50) =>
        ({ id, projectId, priority, order, finishedDate, isFinished: true, state: 0 });
    const tasks = [
        task('regular', 'tasks', 0, -Number.MAX_VALUE),
        task('orphan', '', 3, Number.MAX_VALUE),
        task('missing-order', 'old-project', 3),
        task('same-order', 'another-old-project', 3, 0),
        ...projects.slice(1).map(row => task(row.id, row.id, 3, -Number.MAX_VALUE)),
        task('deleted', 'small', 0, 0, 50),
        task('later', 'same-a', 0, 0, 100),
        task('invalid-date', 'same-a', 0, 0, '120'),
    ];
    tasks.find(row => row.id === 'deleted').state = -1;
    const ranges = [{ start: 1, end: 100 }, { start: 100, end: 200 }];
    const ids = rows => rows.map(row => row.id);
    const original = structuredClone({ tasks, projects });
    const [first, second] = completionStacks(tasks, projects, ranges);
    assert.deepEqual(ids(first), ['old-project', 'another-old-project', 'null', 'tasks', 'small', 'missing', 'same-a', 'same-b']);
    assert.deepEqual(second, [{ id: 'same-a', value: 1, kind: 'project' }]);
    assert(first.every(row => row.value === 1));
    assert.deepEqual({ tasks, projects }, original);
    projects[1].order = Number.MAX_VALUE;
    projects[0].order = -Number.MAX_VALUE;
    const [reordered] = completionStacks([...tasks, task('extra', 'same-b', 3, -Number.MAX_VALUE)], projects, ranges);
    assert.deepEqual(ids(reordered), [...ids(first.slice(0, 4)), 'missing', 'same-a', 'same-b', 'small']);
    assert.equal(reordered.find(row => row.id === 'same-b').value, 2);
    tasks[0].priority = 3;
    const [prioritized] = completionStacks(tasks, projects, ranges);
    assert.deepEqual(ids(prioritized.slice(0, 4)), ['tasks', 'old-project', 'another-old-project', 'null']);
    assert.deepEqual(ids(prioritized.slice(4)), ids(reordered.slice(4)));
});

test('folder composer commits direct-list membership and falls back after moves, hides or removal', async t => {
    const { app, dispose } = await createApplication();
    t.after(dispose);
    const { business } = app;
    const addProject = (id, type, parentId = '') => business.command({ type: 'addProject', values: { id, name: id, type, parentId } });
    await addProject('f1', 2000);
    await addProject('f2', 2000, 'f1');
    await addProject('first', 1000, 'f1');
    await addProject('second', 1000, 'f2');
    const create = (projectId, folderId = 'f1') => business.command({ type: 'addTask', folderId, values: { name: 'Created task', projectId } });
    assert.equal((await create('first')).projectId, 'first');
    assert.equal((await create('second')).projectId, 'id-task-tasks');
    await business.command({ type: 'updateProject', id: 'first', changes: { name: 'Renamed' } });
    assert.equal((await create('first')).projectId, 'first');
    const move = business.command({ type: 'updateProject', id: 'first', changes: { parentId: 'f2' } });
    await move;
    assert.equal((await create('first')).projectId, 'id-task-tasks');
    assert.equal((await create('first', 'f2')).projectId, 'first');
    await business.command({ type: 'setProjectHidden', id: 'first', hidden: true });
    assert.equal((await create('first', 'f2')).projectId, 'id-task-tasks');
    await business.command({ type: 'removeProject', id: 'second' });
    assert.equal((await create('second', 'f2')).projectId, 'id-task-tasks');
    assert.equal((await business.command({ type: 'addTask', values: { name: 'Other entry', projectId: 'first' } })).projectId, 'first');
});

test('task reorder resolves occupied and extreme slots, and never uses stale neighbors', async t => {
    const { app, dispose } = await createApplication();
    t.after(dispose);
    const { business } = app;
    for (const [id, order] of [['a', 0], ['b', 0], ['c', Number.MAX_VALUE]]) {
        await business.command({ type: 'addTask', values: { id, name: id, order, projectId: 'id-task-tasks' } });
    }
    const { orderedTasks } = await import('../../standalone/domain/task-order.mjs');
    const snapshot = business.getSnapshot().tasks;
    await business.command({ type: 'reorderTasks', from: 'c', to: 'a', after: true, snapshot });
    assert.deepEqual(orderedTasks(business.getSnapshot().tasks).map(row => row.id), ['a', 'c', 'b']);
    await assert.rejects(business.command({ type: 'reorderTasks', from: 'a', to: 'c', after: true, snapshot }), { code: 'conflict' });
    assert.deepEqual(orderedTasks(business.getSnapshot().tasks).map(row => row.id), ['a', 'c', 'b']);
});

test('queued reordering awaits the published snapshot when another refresh supersedes the commit read', async t => {
    const { app, dispose } = await createApplication();
    t.after(dispose);
    const { createBusinessService } = await import('../../standalone/services/business.mjs');
    const repository = app.repository;
    const firstRead = Promise.withResolvers(), releaseFirst = Promise.withResolvers();
    const secondRead = Promise.withResolvers(), releaseSecond = Promise.withResolvers();
    let reads = 0, check = false;
    const business = createBusinessService({
        settings: app.settings,
        data: {
            ...repository,
            async read(...args) {
                const number = check ? ++reads : 0;
                const result = await repository.read(...args);
                if (number === 1) { firstRead.resolve(); await releaseFirst.promise; }
                if (number === 2) { secondRead.resolve(); await releaseSecond.promise; }
                return result;
            },
        },
    });
    t.after(() => { releaseFirst.resolve(); releaseSecond.resolve(); business.dispose(); });
    await business.refresh();
    const initial = business.getSnapshot().projects.filter(row => row.type >= 4000).map(({ id, order }) => ({ id, order }));
    check = true;
    let completed = false;
    const first = business.command({ type: 'reorderProjects', from: initial[0].id, to: initial[1].id, snapshot: initial })
        .then(() => { completed = true; });
    await firstRead.promise;
    const overlap = business.refresh();
    await secondRead.promise;
    releaseFirst.resolve();
    await new Promise(setImmediate);
    assert.equal(completed, false);
    releaseSecond.resolve();
    await Promise.all([first, overlap]);
    assert.equal(business.getSnapshot().projects[0].id, initial[1].id);
});
