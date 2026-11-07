const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));
function ui(file) {
    const window = new EventTarget(), document = new EventTarget(), notices = [], scheduled = [];
    Object.assign(window, { FocusRelease: { version: 'test' }, FocusI18n: { text: value => value },
        FocusLocalReady: Promise.resolve(), FocusLocalData: { maintenance: false },
        FocusLocal: { notice: value => notices.push(value), notifyCompletion() {} } });
    vm.runInNewContext(fs.readFileSync(require.resolve('../../src/js/' + file), 'utf8'), {
        window, document, localStorage: { getItem: () => null, setItem() {} },
        IDBKeyRange: { lowerBound: () => 1 }, clearTimeout() {},
        setTimeout: (fn, delay) => { scheduled.push({ fn, delay }); return scheduled.length; }
    });
    return { window, notices, scheduled };
}
test('180,000 future reminders retain a scheduled wakeup instead of overflowing arguments', async () => {
    const { window, notices, scheduled } = ui('local-app-ui.js'), reminderDate = Date.now() + 60000;
    const rows = Array.from({ length: 180000 }, (_, id) => ({ id: String(id), state: 0, isFinished: false, reminderDate }));
    window.FocusLocalData.open = async () => ({});
    window.FocusLocalData.transaction = async () => rows;
    const header = { state: { notification: { show: false } }, setState(value) { Object.assign(this.state, value); } };
    const dispose = window.FocusAppUI.attachHeader(header); await flush(); dispose();
    assert.deepEqual(notices, []); assert.equal(scheduled.length, 1);
    assert(scheduled[0].delay > 0 && scheduled[0].delay <= 60000);
});
for (const type of ['pomodoro', 'task']) test('forest badge schedules refresh for 180,000 ' + type + ' rewards', async () => {
    const { window, notices, scheduled } = ui('local-achievements.js'), now = Date.now();
    const rows = Array.from({ length: 180000 }, (_, id) => ({ id: String(id), completedDate: now, interval: 60 }));
    const manager = { setDailyLaunchReward() {}, getLaunchSunItemData: () => [],
        getPomodoroSunItemData: async () => type === 'pomodoro' ? rows : [],
        getTaskSunItemData: async () => type === 'task' ? rows : [], TASKREWARD: 1, POMODOROMULTIPERREWARD: 1 };
    const header = { state: { forestEnabled: true }, setState(value) { Object.assign(this.state, value); } };
    const dispose = window.FocusForest.attachHeader(header, manager);
    // Run the header's debounced refresh, without running periodic work forever.
    const queued = scheduled.find(item => item.delay === 40); assert(queued); queued.fn();
    await flush(); dispose();
    assert.deepEqual(notices, []); assert.equal(header.state.forestSunlight, 0);
    assert(scheduled.some(item => item.delay > 40 && item.delay <= 60000));
});
