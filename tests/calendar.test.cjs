const test = require('node:test'), assert = require('node:assert/strict');
const { layoutEvents, deadlineInSevenDays } = require('../js/local-calendar.js');
const minute = 60000;
test('overlap groups share columns while touching and disconnected events reuse space', () => {
    const events = [[0, 60], [15, 45], [30, 90], [90, 120], [150, 180]].map(([start, end], id) => ({ id, start: start * minute, end: end * minute }));
    const rows = layoutEvents(events, 0, 1440 * minute, 1);
    assert.deepEqual(rows.map(row => [row.column, row.columns]), [[0, 3], [1, 3], [2, 3], [0, 1], [0, 1]]);
});
test('midnight clipping, out-of-day exclusion and short display collisions preserve source timestamps', () => {
    const events = [{ id: 'cross', start: -10 * minute, end: 20 * minute }, { id: 'short', start: 21 * minute, end: 22 * minute },
        { id: 'next', start: 23 * minute, end: 24 * minute }, { id: 'gone', start: -30 * minute, end: 0 }];
    const rows = layoutEvents(events, 0, 1440 * minute, 1);
    assert.deepEqual(rows.map(row => row.event.id), ['cross', 'short', 'next']);
    assert.equal(rows[0].start, 0); assert.equal(events[0].start, -10 * minute);
    assert.equal(rows[1].columns, 2); assert.equal(rows[2].columns, 2);
});
test('next week means seven local calendar days at the end of that day', () => {
    const date = new Date(2026, 11, 28, 12), result = new Date(deadlineInSevenDays(date.getTime()));
    assert.deepEqual([result.getFullYear(), result.getMonth(), result.getDate(), result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()], [2027, 0, 4, 23, 59, 59, 999]);
});

test('day headers use the real translation catalog for today and other dates in Chinese and English', () => {
    const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
    for (const locale of ['en', 'zh-CN']) {
        const window = {}, context = vm.createContext({ window,
            localStorage: { getItem: () => locale }, navigator: { languages: [locale] },
            document: { documentElement: {} } });
        for (const file of ['local-i18n-catalog.js', 'local-i18n.js', 'local-calendar.js']) {
            vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
        }
        const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
        for (const today of [true, false]) {
            const date = { isSame: () => today, format: pattern => ({
                dddd: locale === 'en' ? 'Wednesday' : '星期三', 'MMM D': 'Nov 4', 'M月D日': '11月4日'
            })[pattern] };
            const view = { props: { date: '2026-11-04' }, getMoment: () => date,
                renderAllDaySection() {}, renderTimeline() {}, shouldUseDualColumn: () => false };
            const tree = window.FocusCalendar.renderDay(view, React, {});
            const label = tree.children[0].children[0].children[0];
            const expected = locale === 'en'
                ? (today ? 'Today' : 'Nov 4') + ' Wednesday'
                : (today ? '今天' : '11月4日') + ' 星期三';
            assert.equal(label, expected);
            assert(!label.includes('unavailable'));
        }
    }
});
