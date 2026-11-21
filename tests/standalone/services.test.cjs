const test = require('node:test'), assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const { createHarness, MemoryStorage, rows, seed } = require('./core-helpers.cjs');
const legacyTimer = require(require('../helpers/legacy-runtime.cjs').file('src/js/local-timer-core.js'));
const legacyBackup = require(require('../helpers/legacy-runtime.cjs').file('src/js/local-backup.js'));
const { localData } = require('../helpers/local-data.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const recoveryRows = async data => (await rows(data, 'LocalMeta')).filter(row => row.id !== 'client-protocol');

test('migrated timer matches legacy states, records, events and errors for deterministic action traces', async () => {
    const { createTimerCore } = await import('../../standalone/domain/timer-core.mjs');
    const core = createTimerCore();
    const startAt = Date.UTC(2026, 10, 8);
    for (const mode of ['countup', 'countdown']) for (const autoBreak of [false, true]) {
        let previous = null, now = startAt, random = 391;
        const actions = ['tick', 'tick', 'pause', 'resume', 'start', 'rest', 'flush', 'stop', 'switchTask', 'detach', 'mode', 'configure', 'resolve', 'unknown'];
        for (let index = 0; index < 600; index++) {
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            now += [-120000, 1000, 24000, 25000, 60000, 299000, 400000][random % 7];
            const action = { type: index ? actions[random % actions.length] : 'start', sessionId: 'trace-' + index, mode,
                taskId: 'task-' + index % 3, subtaskId: 'subtask-' + index % 2,
                config: { interval: 60, shortBreak: 30, longBreak: 120, longEvery: 2, autoBreak, autoWork: autoBreak },
                ...(index % 13 === 0 ? { expectedSession: 'stale' } : {}) };
            if (action.type === 'resolve' && previous?.pendingRecovery) action.cutoff = previous.pendingRecovery.to;
            const input = clone(previous), original = previous;
            let expected, actual, failure;
            try { expected = legacyTimer.reduce(previous, action, now); } catch (error) { failure = error; }
            if (failure) assert.throws(() => core.reduce(previous, action, now), { message: failure.message });
            else {
                actual = core.reduce(previous, action, now);
                assert.deepEqual(actual, expected);
                assert.deepEqual(core.view(actual.session, now), legacyTimer.view(expected.session, now));
                previous = actual.session;
            }
            assert.deepEqual(clone(original), input, 'reduce must not mutate its input');
        }
    }
});

test('candidate database schema/indexes, logical backup keys and unknown compatibility fields remain intact', async t => {
    const h = await createHarness(); t.after(h.dispose);
    h.physicalStorage.setItem('WorkInterval', 'legacy-sentinel');
    h.physicalStorage.setItem('FocusTodoStandalone.language', 'en');
    h.storage.setItem('WorkInterval', '900');
    h.storage.setItem('Unknown.compatibility', 'preserve');
    await seed(h.data, 'Group', [{ groupId: 'old-group', unknown: { future: true } }]);
    await seed(h.data, 'Task', [{ id: 'task', name: 'synthetic', unknownField: 'preserve' }]);
    const backup = await h.data.snapshot();
    assert.equal(backup.meta.dbName, 'PomodoroDB6');
    assert.equal(backup.meta.dbVersion, 3);
    assert.equal(backup.localStorage.WorkInterval, '900');
    assert.equal(backup.localStorage['Unknown.compatibility'], 'preserve');
    assert.equal(backup.localStorage['FocusTodoStandalone.language'], undefined);
    assert.equal(h.physicalStorage.getItem('WorkInterval'), 'legacy-sentinel');
    assert.deepEqual(backup.indexedDB.Group, [{ groupId: 'old-group', unknown: { future: true } }]);
    const request = h.indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
        assert.deepEqual([...db.objectStoreNames], [...h.data.ALL].sort());
        const task = db.transaction('Task').objectStore('Task');
        assert.deepEqual([...task.indexNames], ['deadline', 'finishedDate', 'projectId', 'reminderDate', 'sync']);
        assert.equal(db.transaction('Group').objectStore('Group').keyPath, 'groupId');
    } finally { db.close(); }
});

test('timer persistence publishes only after an atomic records/session commit and allows retry after an abort', async t => {
    let fail = false;
    const h = await createHarness({ capabilities: { fault(point) { if (fail && point === 'timer-commit') throw new Error('injected timer abort'); } } });
    t.after(h.dispose);
    let publishes = 0;
    h.timer.subscribe(() => publishes++);
    await seed(h.data, 'Task', [{id:'task',name:'Synthetic task',state:0,isFinished:false}]);
    await h.timer.command({ type: 'start', taskId: 'task', config: { interval: 60 } });
    const snapshot = h.timer.getSnapshot();
    h.clock.value += 90000; fail = true;
    await assert.rejects(h.timer.command({ type: 'pause' }), /injected timer abort/);
    assert.strictEqual(h.timer.getSnapshot(), snapshot);
    assert.deepEqual(await h.data.session(), clone(snapshot));
    assert.deepEqual(await rows(h.data, 'Pomodoro'), []);
    assert.equal(publishes, 1);
    fail = false;
    await h.timer.command({ type: 'pause' });
    assert.equal((await rows(h.data, 'Pomodoro')).reduce((sum, row) => sum + row.interval, 0), 90);
    const restored = h.timer.getSnapshot();
    assert.equal(restored.recordedSeconds, 90);
    assert(Object.isFrozen(restored)); assert(Object.isFrozen(restored.config));
    await h.timer.command({ type: 'pause' });
    assert.equal((await rows(h.data, 'Pomodoro')).reduce((sum, row) => sum + row.interval, 0), 90);
});

test('reload recovery retains paused rest and never counts a backwards clock interval', async t => {
    const indexedDB = new IDBFactory(), storage = new MemoryStorage();
    const h = await createHarness({ indexedDB, storage }); t.after(h.dispose);
    await h.timer.command({ type: 'start', mode: 'countdown', config: { interval: 60, shortBreak: 600, autoBreak: true } });
    h.clock.value += 70000;
    await h.timer.command({ type: 'pause' });
    h.dispose();
    const next = await createHarness({ indexedDB, storage, clock: h.clock }); t.after(next.dispose);
    await next.timer.recover();
    assert.equal(next.timer.getSnapshot().pausedFrom, 'rest');
    await next.timer.command({ type: 'resume' });
    assert.equal(next.timer.getSnapshot().state, 'rest');
    next.clock.value -= 120000;
    await next.timer.command({ type: 'tick' });
    const recovery = next.timer.getSnapshot().pendingRecovery;
    assert.equal(recovery.clockChanged, true); assert.equal(recovery.to, recovery.from);
    await next.timer.command({ type: 'resolve', continue: false });
    assert.equal(next.timer.getSnapshot().pausedFrom, 'rest');
    assert.equal((await rows(next.data, 'Pomodoro')).reduce((sum, row) => sum + row.interval, 0), 60);
});

test('pre-import backup failure and row-transaction abort preserve both original datasets', async t => {
    let faultPoint;
    const h = await createHarness({ capabilities: { fault(point) { if (point === faultPoint) throw new Error('injected ' + point); } } });
    t.after(h.dispose);
    await seed(h.data, 'Task', [{ id: 'original' }]);
    h.storage.setItem('Keep', 'original');
    const original = await h.data.snapshot(), replacement = clone(original);
    replacement.indexedDB.Task = [{ id: 'replacement' }]; replacement.localStorage.Keep = 'replacement';
    for (const point of ['pre-import-snapshot', 'replacement-rows']) {
        faultPoint = point;
        await assert.rejects(h.data.replace(replacement), /injected/);
        faultPoint = undefined;
        const after = await h.data.snapshot();
        assert.deepEqual(after.indexedDB, original.indexedDB); assert.deepEqual(after.localStorage, original.localStorage);
        assert.deepEqual(await recoveryRows(h.data), []); assert.equal(h.data.maintenance, false);
    }
    await h.data.replace(replacement);
    assert.equal(h.backups.at(-1).localStorage.Keep, 'original');
    assert.equal((await rows(h.data, 'Task'))[0].id, 'replacement');
});

test('interrupted replacement keeps a durable journal, blocks writes, and resumes settings after recreation', async t => {
    let crash = false;
    const h = await createHarness({ capabilities: { fault(point) { if (crash && point === 'replacement-committed') throw new Error('injected crash'); } } });
    t.after(h.dispose);
    const replacement = clone(await h.data.snapshot());
    replacement.indexedDB.Task = [{ id: 'replacement' }]; replacement.localStorage.FutureKey = 'preserve';
    replacement.localStorage['FocusTodo.externalNetwork'] = 'true';
    crash = true;
    await assert.rejects(h.data.replace(replacement), /injected crash/);
    assert.equal(h.data.maintenance, true);
    assert.equal((await recoveryRows(h.data)).length, 2);
    await assert.rejects(h.timer.command({ type: 'start' }), /维护/);
    h.dispose();
    const next = await createHarness({ indexedDB: h.indexedDB, storage: h.physicalStorage }); t.after(next.dispose);
    assert.equal(next.storage.getItem('FutureKey'), 'preserve');
    assert.equal(next.storage.getItem('FocusTodo.externalNetwork'), null);
    assert.deepEqual(await rows(next.data, 'Task'), [{ id: 'replacement' }]);
    assert.deepEqual(await recoveryRows(next.data), []);
});

test('a journal with missing target settings rolls back rows and local consent', async t => {
    const h = await createHarness();
    t.after(h.dispose);
    const key = 'FocusTodo.externalNetwork';
    h.storage.setItem(key, 'true');
    await seed(h.data, 'Task', [{ id: 'keep', name: 'Original' }]);
    const backup = await h.data.snapshot();
    await seed(h.data, 'Task', [{ id: 'keep', name: 'Replaced' }]);
    const owner = { operationId: 'fixture-operation', ownerId: 'fixture-owner', phase: 'settings' };
    await seed(h.data, 'LocalMeta', [
        { id: 'settings-journal', ...owner, backup },
        { id: 'maintenance', ...owner },
    ]);
    h.dispose();
    const next = await createHarness({ indexedDB: h.indexedDB, storage: h.physicalStorage });
    t.after(next.dispose);
    assert.deepEqual(await rows(next.data, 'Task'), backup.indexedDB.Task);
    assert.equal(next.storage.getItem(key), 'true');
    assert.deepEqual(await recoveryRows(next.data), []);
});

test('a failed or missing pre-import backup sink cancels replacement before writing target rows', async t => {
    for (const saveBackup of [undefined, async () => { throw new Error('backup sink failed'); }]) {
        const h = await createHarness({ capabilities: { saveBackup } }); t.after(h.dispose);
        await seed(h.data, 'Task', [{ id: 'original' }]);
        const before = await h.data.snapshot(), target = clone(before);
        target.indexedDB.Task = [{ id: 'discard' }];
        await assert.rejects(h.data.replace(target), /backup/);
        assert.deepEqual((await h.data.snapshot()).indexedDB, before.indexedDB);
        assert.equal(h.data.maintenance, false);
    }
});

test('repository business reads and writes reject an orphan maintenance marker', async t => {
    const h = await createHarness(); t.after(h.dispose);
    await seed(h.data, 'LocalMeta', [{ id: 'maintenance', operationId: 'orphan', ownerId: 'orphan' }]);
    await assert.rejects(seed(h.data, 'Task', [{ id: 'discard' }]), /维护/);
    await assert.rejects(h.data.putPomodoro({ id: 'discard' }), /导入/);
    await assert.rejects(rows(h.data, 'Task'), /维护/);
    await assert.rejects(rows(h.data, 'Pomodoro'), /维护/);
    assert.deepEqual(await recoveryRows(h.data), [{ id: 'maintenance', operationId: 'orphan', ownerId: 'orphan' }]);
});

test('settings quota failure restores the original rows and settings; rollback failures remain recoverable', async t => {
    const h = await createHarness(); t.after(h.dispose);
    await seed(h.data, 'Task', [{ id: 'keep' }]); h.storage.setItem('Keep', 'original');
    h.storage.setItem('FocusTodo.externalNetwork', 'true');
    const before = await h.data.snapshot(), target = clone(before);
    target.indexedDB.Task = [{ id: 'discard' }]; target.localStorage.Keep = 'replacement';
    let failures = 1;
    h.physicalStorage.fault = (method, key, value) => {
        if (method === 'set' && key.endsWith('.Keep') && value === 'replacement' && failures-- > 0) throw new Error('quota');
    };
    await assert.rejects(h.data.replace(target), error => error.rolledBack === true);
    assert.deepEqual((await h.data.snapshot()).indexedDB, before.indexedDB);
    assert.equal(h.storage.getItem('Keep'), 'original');
    assert.equal(h.storage.getItem('FocusTodo.externalNetwork'), 'true');
    h.physicalStorage.fault = method => { if (method === 'set') throw new Error('quota persists'); };
    await assert.rejects(h.data.replace(target), /恢复与回滚未完成/);
    const journal = (await recoveryRows(h.data)).find(row => row.id === 'settings-journal');
    assert.equal(journal.phase, 'rollback');
    h.dispose(); h.physicalStorage.fault = () => {};
    const next = await createHarness({ indexedDB: h.indexedDB, storage: h.physicalStorage }); t.after(next.dispose);
    assert.equal(next.storage.getItem('Keep'), 'original');
    assert.equal(next.storage.getItem('FocusTodo.externalNetwork'), 'true');
    assert.deepEqual(await rows(next.data, 'Task'), before.indexedDB.Task);
    assert.deepEqual(await recoveryRows(next.data), []);
});

test('two instances without Web Locks serialize maintenance and reject writes during import', async t => {
    let release, entered;
    const held = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
    const first = await createHarness({ capabilities: { saveBackup: async () => { entered(); await held; } } });
    const second = await createHarness({ indexedDB: first.indexedDB, storage: first.physicalStorage });
    t.after(() => { release(); first.dispose(); second.dispose(); });
    const target = await first.data.snapshot();
    const replacing = first.data.replace(target);
    await started;
    await assert.rejects(second.timer.command({ type: 'start' }), /待恢复的数据导入/);
    await assert.rejects(seed(second.data, 'Task', [{ id: 'must-not-write' }]), /维护/);
    let exported = false;
    const queued = second.data.snapshot().then(value => { exported = true; return value; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(exported, false);
    release(); await replacing; await queued;
    assert.deepEqual(await rows(first.data, 'Task'), []);
});

test('old/new backup codecs and validation agree for v1/v2, JSON/Gzip, scope and invalid inputs', async t => {
    const h = await createHarness(); t.after(h.dispose);
    const legacy = await localData();
    const original = await h.data.snapshot();
    original.indexedDB.Task = [{ id: 'fixture', unknown: { preserve: true } }];
    original.localStorage.CustomUnknown = '中文';
    original.localStorage['lexible-custom-themes'] = JSON.stringify({ custom_fixture: {
        dataUrl: 'data:image/png;base64,AA==', thumbnail: 'data:image/png;base64,AA==',
    } });
    original.localStorage['lexible-active-custom-theme'] = 'custom_fixture';
    original.localStorage.Theme = 'custom_fixture';
    for (const exportVersion of [1, 2]) for (const format of ['json', 'gzip']) for (const includeWallpapers of [true, false]) {
        const input = clone(original); input.meta.exportVersion = exportVersion;
        const expected = await legacyBackup.encode(input, { format, includeWallpapers });
        const actual = await h.codec.encode(input, { format, includeWallpapers });
        assert.deepEqual(actual.data, expected.data);
        assert.deepEqual(actual.bytes, expected.bytes);
        const decoded = await h.codec.decode(actual.bytes);
        assert.deepEqual(decoded, await legacyBackup.decode(expected.bytes));
        assert.deepEqual(h.data.validate(decoded.data), clone(legacy.data.validate(decoded.data)));
        assert.deepEqual(h.codec.analyze(actual.data), legacyBackup.analyze(expected.data));
    }
    const mutations = [
        value => { value.meta.dbVersion = 4; }, value => { value.meta.exportVersion = 3; },
        value => { delete value.indexedDB.Project; }, value => { value.indexedDB.Task.push({ id: 'fixture' }); },
        value => { value.localStorage.WorkInterval = '0'; }, value => { value.localStorage['FocusTodo.themeJournal'] = 'not backed up'; },
    ];
    for (const mutate of mutations) {
        const input = clone(original); mutate(input);
        let expected, error;
        try { expected = clone(legacy.data.validate(input)); } catch (failure) { error = failure; }
        if (error) assert.throws(() => h.data.validate(input), { message: error.message });
        else assert.deepEqual(h.data.validate(input), expected);
    }
    await assert.rejects(h.codec.decode(new Uint8Array([0xff, 0xfe])), /UTF-8/);
    await assert.rejects(h.codec.decode('{"long":"synthetic"}', { maxBytes: 5 }), /大小限制/);
    const { createBackupCodec } = await import('../../standalone/services/backup-codec.mjs');
    const noCompression = createBackupCodec();
    assert.equal((await noCompression.encode(original)).fallback, true);
    const gzip = await h.codec.encode(original, { format: 'gzip' });
    await assert.rejects(noCompression.decode(gzip.bytes), /不支持 Gzip/);
    const expanded = clone(original); expanded.localStorage.LongSyntheticValue = 'synthetic'.repeat(10000);
    const compact = await h.codec.encode(expanded, { format: 'gzip' });
    await assert.rejects(h.codec.decode(compact.bytes, { maxBytes: compact.bytes.byteLength + 100 }), /解码后超过/);
    const missingImage = clone(original); delete missingImage.localStorage['lexible-custom-themes'];
    assert.throws(() => h.data.validate(missingImage), /缺失图片/);
});

test('migrated calendar task/plan transactions match legacy fields and reject stale edits', async t => {
    const h = await createHarness(); t.after(h.dispose);
    const old = await localData();
    const normalize = result => ({
        task: { ...result.task, id: 'task', creationDate: 0 },
        schedules: result.schedules.map(row => ({ ...row, id: 'plan', taskId: 'task', creationDate: 0 })),
    });
    const input = { name: 'Synthetic calendar task', count: 3, interval: 900,
        shortBreak: 60, startTime: h.clock.value, projectId: 'id-task-tasks', addToTop: true };
    const actual = await h.data.createCalendarTask(input), expected = await old.data.createCalendarTask(input);
    assert.deepEqual(normalize(actual), clone(normalize(expected)));
    const original = actual.schedules[0], edited = { ...original, endDate: original.endDate + 60000 };
    await h.data.putSchedule(edited, original);
    await assert.rejects(h.data.putSchedule({ ...original, state: -1 }, original), /另一个标签页/);
    assert.deepEqual((await rows(h.data, 'Schedule')).find(row => row.id === original.id), edited);
    await assert.rejects(h.data.createCalendarTask({ ...input, interval: 0 }), /有效的任务/);
});

test('calendar creation aborts task and planned blocks together on a storage constraint failure', async t => {
    const { createDataService } = await import('../../standalone/services/data.mjs');
    const h = await createHarness(); t.after(h.dispose);
    // A deterministic duplicate ID makes the third schedule add fail inside
    // the same real transaction, after the task and first plan were requested.
    const data = createDataService({ indexedDB: h.indexedDB, storage: h.storage,
        databaseName: 'FocusTodoStandalone.PomodoroDB6', now: () => h.clock.value,
        randomUUID: () => 'duplicate', timerCore: h.core, backupCodec: h.codec,
        appVersion: 'test', encodeBase64: value => Buffer.from(value).toString('base64') });
    t.after(data.dispose);
    await data.initialize();
    await assert.rejects(data.createCalendarTask({ name: 'Synthetic', count: 3, interval: 900,
        startTime: h.clock.value, projectId: 'id-task-tasks' }), { name: 'ConstraintError' });
    assert.deepEqual(await rows(h.data, 'Task'), []); assert.deepEqual(await rows(h.data, 'Schedule'), []);
});

test('reset saves a readable pre-reset backup, keeps language and restores default projects', async t => {
    const h = await createHarness(); t.after(h.dispose);
    await seed(h.data, 'Task', [{ id: 'before-reset', unknown: 'preserve-in-backup' }]);
    h.storage.setItem('FocusTodo.language', 'en'); h.storage.setItem('UnknownSetting', 'backed-up');
    const backup = await h.data.reset();
    assert.equal(backup.indexedDB.Task[0].unknown, 'preserve-in-backup');
    assert.equal(h.backups.at(-1).localStorage.UnknownSetting, 'backed-up');
    assert.doesNotThrow(() => h.data.validate(h.backups.at(-1)));
    assert.deepEqual(await rows(h.data, 'Task'), []);
    assert.equal(h.storage.getItem('FocusTodo.language'), 'en');
    assert.equal(h.storage.getItem('UnknownSetting'), null);
    assert.equal((await rows(h.data, 'Project')).length, 15);
    assert.equal(h.storage.getItem('Version'), '6.5');
});

test('theme journal differential preserves images, recovers interrupted metadata and rolls back quota errors', async t => {
    const h = await createHarness(); t.after(h.dispose);
    const legacyThemes = require(require('../helpers/legacy-runtime.cjs').file('src/js/local-theme-storage.js'));
    const memory = new MemoryStorage(), legacy = legacyThemes.create({
        get: key => memory.getItem(key), set: (key, value) => memory.setItem(key, value), remove: key => memory.removeItem(key),
    });
    const image = JSON.stringify({ custom_fixture: { dataUrl: 'data:image/png;base64,AA==' } });
    for (const change of [{ themes: image, active: 'custom_fixture', theme: 'Leaf' }, { active: null, theme: 'Sea' }, { themes: null }]) {
        assert.deepEqual(h.themes.commit(change), legacy.commit(change));
        assert.deepEqual(h.themes.read(), legacy.read());
    }
    h.themes.commit({ themes: image, active: 'custom_fixture', theme: 'Leaf' });
    const before = h.themes.read();
    let attempts = 0;
    h.physicalStorage.fault = (method, key) => { if (method === 'set' && key.endsWith('.Theme') && ++attempts === 1) throw new Error('quota'); };
    assert.throws(() => h.themes.commit({ theme: 'Sea' }), error => error.rolledBack === true);
    assert.deepEqual(h.themes.read(), before);
    assert.equal(h.storage.getItem('FocusTodo.themeJournal'), null);
});

test('schema versionchange and disposed instances reject future writes without deleting data', async t => {
    const h = await createHarness(); t.after(h.dispose);
    await seed(h.data, 'Task', [{ id: 'keep' }]);
    const request = h.indexedDB.open('FocusTodoStandalone.PomodoroDB6', 4);
    const newer = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    newer.close();
    assert(h.events.some(event => event.type === 'versionchange'));
    await assert.rejects(h.timer.command({ type: 'start' }), /invalidated/);
    h.dispose();
    await assert.rejects(h.data.session(), /closed/);
    await assert.rejects(createHarness({ indexedDB: h.indexedDB, storage: h.physicalStorage }), { name: 'VersionError' });
});
