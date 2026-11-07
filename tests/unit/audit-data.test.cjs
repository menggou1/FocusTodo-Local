const test = require('node:test'), assert = require('node:assert/strict');
const { localData } = require('../helpers/local-data.cjs');
const core = require('../../src/js/local-timer-core.js');
const now = Date.UTC(2026, 10, 6);
const copy = value => JSON.parse(JSON.stringify(value));

test('corrupt imported timer metadata is refused before replacing rows or settings', async () => {
    const { data, storage, window } = await localData();
    storage.setItem('AuditOriginal', 'keep');
    const db = await data.open();
    await data.transaction(db, ['Task'], 'readwrite', tx => tx.objectStore('Task').put({ id: 'keep', name: 'original' }));
    const before = await data.snapshot(), input = copy(before);
    input.meta.exportDate = new Date(now).toISOString();
    const s = core.create({ sessionId: 'audit-import' }, now); s.state = 'pause';
    input.indexedDB.TimerSession = [s];
    input.indexedDB.Task = [{ id: 'replacement', name: 'must not import' }];
    input.localStorage.AuditOriginal = 'overwrite';
    const mutations = [
        v => { v.indexedDB.TimerSession = null; },
        v => { v.indexedDB.TimerSession[0].sequence = 2 ** 53; },
        v => { v.indexedDB.TimerSession[0].blockSequence = 1.5; },
        v => { v.indexedDB.TimerSession[0].revision = 0.5; },
        v => { v.indexedDB.TimerSession[0].completed = 0.5; },
        v => { v.indexedDB.TimerSession[0].cursorAt = 1e100; },
        v => { v.indexedDB.TimerSession[0].taskId = {}; },
        v => { v.indexedDB.TimerSession[0].recordedSeconds = 30; },
        v => { v.indexedDB.TimerSession[0].spans = [{ start: now, end: now + 30000 }]; },
        v => { const x = v.indexedDB.TimerSession[0]; x.state = 'recovery'; x.pendingRecovery = { from: now - 1000, to: now + 60000, priorState: 'work', detectedAt: now }; },
        v => { const x = v.indexedDB.TimerSession[0]; x.state = 'recovery'; x.pendingRecovery = { from: now, to: 1e100, priorState: 'rest', detectedAt: now }; },
        v => { v.indexedDB.Pomodoro = [{ id: 'audit-import:1', endDate: now, interval: 30, pomodoroInterval: 1500 }]; },
        v => { v.indexedDB.Pomodoro = [{ id: 'bad-date', endDate: 1e100, interval: 30, pomodoroInterval: 1500 }]; }
    ];
    let maintenanceStarted = 0;
    window.addEventListener('focus-local-maintenance', () => maintenanceStarted++);
    for (const [index, mutate] of mutations.entries()) {
        const invalid = copy(input); mutate(invalid);
        await assert.rejects(data.replace(invalid, { backup: false }), error => typeof error.message === 'string', 'corrupt case ' + index);
        const after = await data.snapshot();
        assert.deepEqual(copy(after.indexedDB), copy(before.indexedDB));
        assert.deepEqual(copy(after.localStorage), copy(before.localStorage));
    }
    assert.equal(maintenanceStarted, 0);
    assert.equal(data.maintenance, false);
});

test('a valid paused timer with historical records remains importable', async () => {
    const { data } = await localData();
    const input = copy(await data.snapshot());
    let result = core.reduce(null, { type: 'start', sessionId: 'valid', config: { interval: 60 } }, now);
    result = core.reduce(result.session, { type: 'pause' }, now + 90000);
    input.indexedDB.TimerSession = [result.session]; input.indexedDB.Pomodoro = result.records;
    await data.replace(input, { backup: false });
    assert.equal((await data.session()).sequence, result.session.sequence);
    assert.deepEqual(copy((await data.snapshot()).indexedDB.Pomodoro), result.records);
});

test('stale schedule moves cannot overwrite a peer edit or resurrect a deleted plan', async () => {
    const { data } = await localData();
    const plan = { id: 'plan', state: 0, endDate: now, interval: 1500, taskId: 'task', subtaskId: '', isAllDay: false };
    await data.putSchedule(plan);
    const peer = { ...plan, endDate: now + 900000 };
    await data.putSchedule(peer, plan);
    await assert.rejects(data.putSchedule({ ...plan, endDate: now + 60000 }, plan));
    assert.deepEqual(copy((await data.snapshot()).indexedDB.Schedule), [peer]);
    await data.putSchedule({ ...peer, state: -1 }, peer);
    await assert.rejects(data.putSchedule({ ...peer, endDate: now + 1000000 }));
    await assert.rejects(data.putSchedule({ ...peer, endDate: now + 1000000 }, peer));
    assert.equal((await data.snapshot()).indexedDB.Schedule[0].state, -1);
    await data.putSchedule({ ...plan, id: 'copy' });
    assert.equal((await data.snapshot()).indexedDB.Schedule.length, 2);
});

test('schedule updates require finite, representable dates and valid intervals', async () => {
    const { data } = await localData();
    for (const invalid of [{ id: '', endDate: now, interval: 60 }, { id: 'date', endDate: 1e100, interval: 60 },
        { id: 'start', endDate: -8.64e15, interval: 60 }]) {
        await assert.rejects(data.putSchedule(invalid));
    }
});
