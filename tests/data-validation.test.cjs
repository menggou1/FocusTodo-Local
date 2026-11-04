const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../js/local-timer-core.js');
const backup = require('../js/local-backup.js');

// Exercise the actual data-service validation without starting a browser or
// altering a real IndexedDB database. Its asynchronous open is left pending.
function dataService() {
    class Storage { setItem() {} removeItem() {} }
    class IDBDatabase { transaction() {} }
    const window = { FocusTimerCore: core, FocusLocalBackup: backup, FocusRelease: { version: 'test' }, dispatchEvent() {} };
    const context = vm.createContext({ window, Storage, IDBDatabase, localStorage: {}, navigator: {},
        crypto: { randomUUID: () => 'test-owner' }, indexedDB: { open: () => ({}) } });
    vm.runInContext(fs.readFileSync(require.resolve('../js/local-data.js'), 'utf8'), context);
    return window.FocusLocalData;
}
const t = Date.UTC(2026, 9, 3, 1);
function snapshot(session, exportAt) {
    const indexedDB = Object.fromEntries(['Project', 'Task', 'Subtask', 'Pomodoro', 'Schedule', 'Group', 'GroupUser', 'Message'].map(name => [name, []]));
    indexedDB.TimerSession = [session];
    return { meta: { app: 'FocusTodo', exportVersion: 2, dbVersion: 3, exportDate: new Date(exportAt).toISOString() }, indexedDB, localStorage: {} };
}
function start() { return core.reduce(null, { type: 'start', sessionId: 'clock-test', config: { interval: 3600 } }, t).session; }

test('a backup remains restorable after a clock rollback creates overlapping wall-clock spans', async () => {
    let s = core.reduce(start(), { type: 'tick' }, t + 120000).session;
    s = core.reduce(s, { type: 'tick' }, t + 60000).session;
    s = core.reduce(s, { type: 'resolve' }, t + 60000).session;
    s = core.reduce(s, { type: 'tick' }, t + 90000).session;
    assert(s.spans[1].start < s.spans[0].end);
    const encoded = await backup.encode(snapshot(s, t + 90000), { format: 'json' });
    const validated = dataService().validate((await backup.decode(encoded.bytes)).data);
    assert.equal(core.pendingSeconds(validated.indexedDB.TimerSession[0]), 150);
    assert.equal(validated.indexedDB.TimerSession[0].state, 'recovery');
});

test('a backup immediately after clock rollback enters recovery without adding future time', () => {
    const s = core.reduce(start(), { type: 'tick' }, t + 120000).session;
    const result = dataService().validate(snapshot(s, t + 60000)).indexedDB.TimerSession[0];
    assert.equal(result.state, 'recovery');
    assert.equal(result.pendingRecovery.from, t + 120000);
    assert.equal(result.pendingRecovery.to, t + 120000);
    assert.equal(result.pendingRecovery.clockChanged, true);
    const resumed = core.reduce(result, { type: 'resolve', continue: false }, t + 60000);
    assert.equal(resumed.records.reduce((sum, row) => sum + row.interval, 0), 120);
    assert.equal(resumed.session.state, 'pause');
});

test('invalid spans remain rejected even when wall-clock order can change', () => {
    for (const span of [null, { start: t, end: t - 1 }, { start: -1, end: t }, { start: t, end: Infinity }]) {
        const s = start(); s.state = 'pause'; s.spans = [span];
        assert.throws(() => dataService().validate(snapshot(s, t)), /无效专注区间/);
    }
});

test('paused-rest metadata is rejected outside a paused rest session', () => {
    for (const [state, pausedFrom] of [['work', 'rest'], ['pause', 'work']]) {
        const s = { ...start(), state, pausedFrom };
        assert.throws(() => dataService().validate(snapshot(s, t)), /计时会话字段无效/);
    }
});

test('a paused break survives backup validation and resumes as a break', () => {
    let s = core.reduce(null, { type: 'start', sessionId: 'paused-rest', mode: 'countdown',
        config: { interval: 60, shortBreak: 600, autoBreak: true } }, t).session;
    s = core.reduce(s, { type: 'tick' }, t + 70000).session;
    s = core.reduce(s, { type: 'pause' }, t + 80000).session;
    const restored = dataService().validate(snapshot(s, t + 80000)).indexedDB.TimerSession[0];
    assert.equal(restored.pausedFrom, 'rest'); assert.equal(restored.phaseElapsed, 20);
    const resumed = core.reduce(restored, { type: 'start' }, t + 90000).session;
    assert.equal(resumed.state, 'rest'); assert.equal(resumed.phaseElapsed, 20);
    assert.equal(resumed.pausedFrom, undefined);
});
