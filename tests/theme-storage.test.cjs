const test = require('node:test');
const assert = require('node:assert/strict');
const { create, JOURNAL_KEY, KEYS } = require('../js/local-theme-storage.js');

function storage(initial = {}, options = {}) {
    const values = new Map(Object.entries(initial));
    const env = { values, fail: () => false, maxJournalBytes: 0, writes: 0 };
    env.ops = {
        get: key => values.has(key) ? values.get(key) : null,
        set(key, value) {
            if (key === JOURNAL_KEY) env.maxJournalBytes = Math.max(env.maxJournalBytes, value.length);
            if (env.fail('set', key, value)) throw new Error('Injected set failure');
            if (options.quota && [...values].reduce((n, [k, v]) => n + k.length + (k === key ? value.length : v.length), values.has(key) ? 0 : key.length + value.length) > options.quota) throw new Error('Quota exceeded');
            values.set(key, value); env.writes++;
        },
        remove(key) { if (env.fail('remove', key)) throw new Error('Injected remove failure'); values.delete(key); env.writes++; }
    };
    env.store = create(env.ops); return env;
}
const original = { [KEYS.themes]: '{"custom_a":{"dataUrl":"data:image/png;base64,YQ=="}}', [KEYS.active]: 'custom_a', [KEYS.theme]: 'custom_a' };
const target = { themes: '{"custom_b":{"dataUrl":"data:image/png;base64,Yg=="}}', active: 'custom_b', theme: 'custom_b' };
const old = { themes: original[KEYS.themes], active: 'custom_a', theme: 'custom_a' };

test('commits the complete legacy key group and removes the internal journal', () => {
    const env = storage(original);
    assert.deepEqual(env.store.commit(target), target); assert.deepEqual(env.store.read(), target);
    assert.equal(env.values.has(JOURNAL_KEY), false);
    env.store.commit({ active: null, theme: 'Leaf' });
    assert.deepEqual(env.store.read(), { themes: target.themes, active: null, theme: 'Leaf' });
});
test('a failed metadata write restores theme contents and both previous metadata keys', () => {
    const env = storage(original); env.fail = (op, key, value) => key === KEYS.theme && value === 'custom_b';
    assert.throws(() => env.store.commit(target), error => error.rolledBack === true);
    assert.deepEqual(env.store.read(), old); assert.equal(env.values.has(JOURNAL_KEY), false);
});
test('a failed rollback keeps a small log and a new instance recovers the original group', () => {
    const env = storage(original);
    env.fail = (op, key, value) => key === KEYS.theme && value === 'custom_b' || key === KEYS.active && value === 'custom_a';
    assert.throws(() => env.store.commit(target), error => error.recoveryRequired === true);
    assert.equal(JSON.parse(env.values.get(JOURNAL_KEY)).phase, 'rollback');
    env.fail = () => false;
    const fresh = create(env.ops); assert.equal(fresh.recover(), true); assert.deepEqual(fresh.read(), old);
    assert.equal(env.values.has(JOURNAL_KEY), false);
});
test('a crash after the atomic JSON write finishes its matching new metadata on restart', () => {
    const env = storage(original); let committedJournal;
    env.fail = (op, key, value) => {
        if (key === KEYS.active && value === 'custom_b') committedJournal = env.values.get(JOURNAL_KEY);
        return key === KEYS.active && value === 'custom_b';
    };
    assert.throws(() => env.store.commit(target));
    env.fail = () => false;
    // Recreate the durable state at the interrupted write boundary; there is
    // no original JSON copy in the journal.
    env.values.set(KEYS.themes, target.themes); env.values.set(JOURNAL_KEY, committedJournal);
    const fresh = create(env.ops); assert(fresh.recover()); assert.deepEqual(fresh.read(), target);
});
test('metadata-only interrupted rollback recovers the old pair instead of the target pair', () => {
    const env = storage(original);
    env.fail = (op, key, value) => key === KEYS.theme && value === 'Leaf' || key === KEYS.active && value === 'custom_a';
    assert.throws(() => env.store.commit({ active: null, theme: 'Leaf' }), error => error.recoveryRequired === true);
    env.fail = () => false; const fresh = create(env.ops); fresh.recover(); assert.deepEqual(fresh.read(), old);
});
test('large image JSON is not copied into the journal or the storage quota', () => {
    const image = 'data:image/png;base64,' + 'a'.repeat(1000000);
    const env = storage({ [KEYS.themes]: JSON.stringify({ custom_a: { dataUrl: image } }), [KEYS.active]: 'custom_a', [KEYS.theme]: 'custom_a', unrelated: 'x'.repeat(3000000) }, { quota: 4100000 });
    env.store.commit({ themes: JSON.stringify({ custom_b: { dataUrl: image } }), active: 'custom_b', theme: 'custom_b' });
    assert(env.maxJournalBytes < 600); assert.equal(env.values.has(JOURNAL_KEY), false);
});
test('unrelated settings replacements cannot be overwritten using a mismatched old journal', () => {
    const env = storage(original); let journal;
    env.fail = (op, key, value) => { if (key === KEYS.theme && value === 'custom_b') journal = env.values.get(JOURNAL_KEY); return key === KEYS.theme && value === 'custom_b'; };
    assert.throws(() => env.store.commit(target)); env.fail = () => false;
    env.values.set(JOURNAL_KEY, journal); env.values.set(KEYS.themes, '{"imported":{}}');
    const before = [...env.values]; assert.throws(() => create(env.ops).recover(), error => error.recoveryRequired === true);
    assert.deepEqual([...env.values], before);
});
test('pending recovery completes before a later change, while identical changes do not write', () => {
    const env = storage(original); const count = env.writes;
    env.store.commit(old); assert.equal(env.writes, count);
    env.fail = (op, key, value) => key === KEYS.theme && value === 'custom_b' || key === KEYS.active && value === 'custom_a';
    assert.throws(() => env.store.commit(target)); env.fail = () => false;
    assert.deepEqual(create(env.ops).commit({ active: null, theme: 'Ocean' }), { themes: old.themes, active: null, theme: 'Ocean' });
});
