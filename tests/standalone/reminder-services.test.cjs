const assert = require('node:assert/strict');
const test = require('node:test');
const { createHarness, MemoryStorage } = require('./core-helpers.cjs');

const readKey = 'FocusTodo.taskRemindersRead';

test('concurrent reminder acknowledgements from two tabs merge in shared storage', async t => {
    const { createReminderService } = await import('../../standalone/services/notifications.mjs');
    const { reminderState } = await import('../../standalone/domain/reports.mjs');
    const firstTab = await createHarness();
    t.after(firstTab.dispose);
    const secondTab = await createHarness({ storage: firstTab.physicalStorage, indexedDB: firstTab.indexedDB });
    t.after(secondTab.dispose);
    const now = () => 100;
    function reminder(tab, id) {
        const tasks = [{ id, state: 0, reminderDate: 100 }];
        const service = createReminderService({
            data: tab.data, storage: tab.storage, now, setTimeout() {}, clearTimeout() {},
            business: { reminders: read => reminderState(tasks, read, now()), subscribe: () => () => {} },
        });
        t.after(service.dispose);
        return service;
    }
    const first = reminder(firstTab, 'first'), second = reminder(secondTab, 'second');
    firstTab.storage.setItem(readKey, JSON.stringify([JSON.stringify(['previous', 50])]));
    await Promise.all([first.markRead(), second.markRead()]);
    assert.deepEqual(JSON.parse(secondTab.storage.getItem(readKey)).sort().map(JSON.parse),
        [['first', 100], ['previous', 50], ['second', 100]]);
    assert.deepEqual(first.refresh().unread, []);
    assert.deepEqual(second.refresh().unread, []);
});

test('a rejected native notification keeps future reminders scheduled and unread without repeated attempts', async t => {
    const { createReminderService, createNotificationService } = await import('../../standalone/services/notifications.mjs');
    const { reminderState } = await import('../../standalone/domain/reports.mjs');
    const error = new Error('Native notifications unavailable in this context');
    const attempts = [], errors = [], storage = new MemoryStorage();
    class Notification {
        static permission = 'granted';
        constructor(title, { body }) {
            attempts.push(body);
            if (body === 'First') throw error;
        }
        close() {}
    }
    const notifications = createNotificationService({ api: Notification, onError: cause => errors.push(cause) });
    let time = 100, changed, nextTimer;
    const tasks = [
        { id: 'first', name: 'First', state: 0, reminderDate: 100 },
        { id: 'second', name: 'Second', state: 0, reminderDate: 200 },
    ];
    const reminders = createReminderService({
        storage, notifications, now: () => time,
        business: {
            reminders: read => reminderState(tasks, read, time),
            subscribe: callback => { changed = callback; return () => {}; },
        },
        setTimeout(callback, delay) { nextTimer = { callback, delay }; return nextTimer; },
        clearTimeout() { nextTimer = undefined; },
    });
    t.after(() => { reminders.dispose(); notifications.dispose(); });
    assert.doesNotThrow(changed);
    assert.equal(nextTimer.delay, 100);
    assert.deepEqual(reminders.getSnapshot().unread.map(row => row.id), ['first']);
    assert.equal(storage.getItem(readKey), null);
    changed();
    changed();
    assert.deepEqual(errors, [error]);
    assert.deepEqual(attempts, ['First']);
    time = 200;
    nextTimer.callback();
    assert.deepEqual(attempts, ['First', 'Second']);
    assert.deepEqual(reminders.getSnapshot().unread.map(row => row.id), ['second', 'first']);
    assert.equal(storage.getItem(readKey), null);
    tasks[0].reminderDate = 300;
    changed();
    assert.equal(nextTimer.delay, 100);
    time = 300;
    nextTimer.callback();
    changed();
    assert.deepEqual(attempts, ['First', 'Second', 'First']);
    assert.deepEqual(errors, [error, error]);
    assert.equal(storage.getItem(readKey), null);
});
