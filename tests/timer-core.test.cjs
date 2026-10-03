const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/local-timer-core.js');
const START = Date.UTC(2026, 9, 3, 1);
const minute = n => START + n * 60000;
function start(extra = {}) {
    return core.reduce(null, { type: 'start', sessionId: 'test-session', mode: 'countup', taskId: 'a', config: { interval: 3600 }, ...extra }, START).session;
}
function recover(s, minutes, extra = {}) {
    const gap = core.reduce(s, { type: 'tick' }, minute(minutes));
    assert.equal(gap.session.state, 'recovery');
    assert.equal(gap.records.length, 0);
    return core.reduce(gap.session, { type: 'resolve', ...extra }, minute(minutes));
}
const sum = rows => rows.reduce((n, r) => n + r.interval, 0);
test('120 minutes: two 60 minute records with historical boundaries', () => {
    const result = recover(start(), 120);
    assert.deepEqual(result.records.map(r => r.interval), [3600, 3600]);
    assert.deepEqual(result.records.map(r => r.endDate), [minute(60), minute(120)]);
    assert.equal(result.session.recordedSeconds, 7200);
});
test('145 minutes: preserve 25 minute remainder and complete at 180', () => {
    let r = recover(start(), 145);
    assert.equal(sum(r.records), 7200); assert.equal(core.pendingSeconds(r.session), 1500);
    r = core.reduce(r.session, { type: 'tick', gapMs: 1e9 }, minute(180));
    assert.equal(sum(r.records), 3600); assert.equal(core.pendingSeconds(r.session), 0);
    assert.equal(r.records[0].endDate, minute(180));
});
test('already recorded time is never regenerated', () => {
    let r = core.reduce(start(), { type: 'tick', gapMs: 1e9 }, minute(60));
    assert.equal(r.records.length, 1);
    r = recover(r.session, 180); assert.equal(r.records.length, 2);
    const again = core.reduce(r.session, { type: 'tick' }, minute(180));
    assert.equal(again.records.length, 0);
});
test('pending confirmation survives serialization and does not grow', () => {
    const pending = core.reduce(start(), { type: 'tick' }, minute(120)).session;
    const next = core.reduce(JSON.parse(JSON.stringify(pending)), { type: 'tick' }, minute(240));
    assert.deepEqual(next.session.pendingRecovery, pending.pendingRecovery);
    assert.equal(next.records.length, 0);
});
test('rejecting the gap keeps previous work and excludes dialog waiting', () => {
    let r = core.reduce(start(), { type: 'tick', gapMs: 1e9 }, minute(70));
    r = core.reduce(r.session, { type: 'tick' }, minute(190));
    r = core.reduce(r.session, { type: 'resolve', cutoff: minute(70) }, minute(200));
    assert.equal(r.session.totalSeconds, 4200); assert.equal(sum(r.records), 0);
    r = core.reduce(r.session, { type: 'tick', gapMs: 1e9 }, minute(250));
    assert.equal(sum(r.records), 3600);
    assert.deepEqual(r.records.map(p => [p.endDate - p.interval * 1000, p.endDate]), [[minute(60), minute(70)], [minute(200), minute(250)]]);
    assert.equal(new Set(r.records.map(p => p.blockId)).size, 1);
});
test('custom recovery cutoff and continue=false', () => {
    const r = recover(start(), 145, { cutoff: minute(90), continue: false });
    assert.equal(sum(r.records), 5400); assert.equal(r.session.state, 'pause');
    assert.equal(r.session.totalSeconds, 5400);
});
test('invalid recovery cutoff does not mutate previous state', () => {
    const s = core.reduce(start(), { type: 'tick' }, minute(120)).session;
    const before = JSON.stringify(s);
    assert.throws(() => core.reduce(s, { type: 'resolve', cutoff: minute(121) }, minute(122)), /截止时间/);
    assert.equal(JSON.stringify(s), before);
});
test('pause records fractions and never includes pause in timestamps', () => {
    let r = core.reduce(start(), { type: 'pause', gapMs: 1e9 }, minute(30));
    assert.equal(sum(r.records), 1800); assert.equal(r.records[0].endDate, minute(30));
    r = core.reduce(r.session, { type: 'resume' }, minute(50));
    r = core.reduce(r.session, { type: 'stop', gapMs: 1e9 }, minute(80));
    assert.equal(sum(r.records), 1800);
    assert.equal(r.records[0].endDate - r.records[0].interval * 1000, minute(50));
    assert.equal(r.session.totalSeconds, 0);
});
test('task switch settles old task and adopts new task interval', () => {
    let r = core.reduce(start(), { type: 'switchTask', sessionId: 'b-session', taskId: 'b', config: { interval: 1500 }, gapMs: 1e9 }, minute(20));
    assert.equal(sum(r.records), 1200); assert.equal(r.records[0].taskId, 'a');
    r = core.reduce(r.session, { type: 'tick', gapMs: 1e9 }, minute(45));
    assert.equal(r.records[0].taskId, 'b'); assert.equal(r.records[0].interval, 1500);
});
test('countdown without auto advance stops at waitingForRest', () => {
    const r = recover(start({ mode: 'countdown' }), 120);
    assert.equal(sum(r.records), 3600); assert.equal(r.session.state, 'waitingForRest');
});
test('countdown auto break / auto work preserves rest intervals', () => {
    const r = recover(start({ mode: 'countdown', config: { interval: 3600, shortBreak: 300, autoBreak: true, autoWork: true } }), 130);
    assert.equal(sum(r.records), 7200);
    assert.deepEqual(r.records.map(p => p.endDate), [minute(60), minute(125)]);
    assert.equal(r.session.state, 'work'); assert.equal(r.session.phaseElapsed, 0);
});
test('countdown auto work with no breaks catches up multiple cycles', () => {
    const r = recover(start({ mode: 'countdown', config: { interval: 3600, banBreak: true, autoWork: true } }), 145);
    assert.equal(sum(r.records), 7200); assert.equal(r.session.phaseElapsed, 1500);
    assert.equal(core.pendingSeconds(r.session), 1500);
});
test('long break after configured number of cycles', () => {
    const r = recover(start({ mode: 'countdown', config: { interval: 60, shortBreak: 60, longBreak: 180, longEvery: 2, autoBreak: true, autoWork: true } }), 7);
    assert.equal(r.session.completed, 3); assert.equal(r.session.state, 'rest');
    assert.equal(sum(r.records), 180);
});
test('cross-midnight records keep original boundary dates', () => {
    const begin = Date.UTC(2026, 9, 3, 15, 30);
    const s = core.reduce(null, { type: 'start', sessionId: 'night', config: { interval: 3600 } }, begin).session;
    const r = core.reduce(s, { type: 'tick', gapMs: 1e9 }, begin + 7200000);
    assert.deepEqual(r.records.map(p => p.endDate), [begin + 3600000, begin + 7200000]);
});
test('system clock rollback requests confirmation without negative duration', () => {
    const r = core.reduce(start(), { type: 'tick' }, START - 120000);
    assert.equal(r.session.state, 'recovery'); assert.equal(r.session.pendingRecovery.clockChanged, true);
    const fixed = core.reduce(r.session, { type: 'resolve' }, START - 60000);
    assert.equal(sum(fixed.records), 0); assert.equal(fixed.session.cursorAt, START - 60000);
});
test('stop keeps short work instead of silently losing it', () => {
    const r = core.reduce(start(), { type: 'stop' }, START + 25000);
    assert.equal(sum(r.records), 25); assert.equal(r.session.state, 'initial');
});
test('mode switch settles existing work first', () => {
    const r = core.reduce(start(), { type: 'mode', mode: 'countdown', gapMs: 1e9 }, minute(20));
    assert.equal(sum(r.records), 1200); assert.equal(r.session.mode, 'countdown'); assert.equal(r.session.state, 'initial');
});
test('configuration bounds prevent invalid or infinite timer intervals', () => {
    for (const interval of [0, -1, Infinity, NaN, 999999]) assert.equal(core.settings({ interval }).interval, 1500);
});
test('stop resets persisted elapsed; detach, flush and reload cannot resurrect it', () => {
    let r = core.reduce(start(), { type: 'stop', gapMs: 1e9 }, minute(80));
    assert.equal(sum(r.records), 4800);
    const firstSequence = r.session.sequence;
    for (const type of ['tick', 'flush', 'detach', 'tick']) {
        r = core.reduce(JSON.parse(JSON.stringify(r.session)), { type }, minute(81));
        assert.equal(r.records.length, 0);
        assert.equal(core.view(r.session, minute(81)).elapse, 0);
        assert.equal(r.session.state, 'initial');
        assert.equal(r.session.sequence, firstSequence);
    }
    assert.equal(r.session.taskId, '');
});
test('detaching active work saves it once and leaves an idle unassigned timer', () => {
    const r = core.reduce(start(), { type: 'detach', config: { interval: 1500 } }, minute(2));
    assert.equal(sum(r.records), 120); assert.equal(r.records[0].taskId, 'a');
    assert.equal(r.session.state, 'initial'); assert.equal(r.session.totalSeconds, 0);
    assert.equal(r.session.config.interval, 1500); assert.equal(r.session.taskId, '');
    assert.equal(core.reduce(r.session, { type: 'detach' }, minute(3)).records.length, 0);
});
test('completion events distinguish work, rest and partial records', () => {
    let s = start({ mode: 'countdown', config: { interval: 60, shortBreak: 60, autoBreak: true } });
    let r = core.reduce(s, { type: 'pause' }, START + 30000);
    assert.deepEqual(r.events, []);
    s = core.reduce(r.session, { type: 'resume' }, START + 50000).session;
    r = core.reduce(s, { type: 'tick' }, START + 80000);
    assert.deepEqual(r.events, [{ type: 'work', at: START + 80000 }]);
    r = core.reduce(r.session, { type: 'tick' }, START + 140000);
    assert.deepEqual(r.events, [{ type: 'break', at: START + 140000 }]);
    assert.equal(core.reduce(r.session, { type: 'tick' }, START + 140000).events.length, 0);
});
test('idle configuration changes persist while active work keeps its original duration', () => {
    let s = core.reduce(start(), { type: 'stop' }, minute(1)).session;
    s = core.reduce(s, { type: 'configure', config: { interval: 1200 } }, minute(2)).session;
    assert.equal(s.config.interval, 1200);
    s = core.reduce(s, { type: 'start', sessionId: 'next', config: s.config }, minute(3)).session;
    s = core.reduce(s, { type: 'configure', config: { interval: 1800 } }, minute(4)).session;
    assert.equal(s.config.interval, 1200);
});
