const test = require('node:test'), assert = require('node:assert/strict');
const { load, walk } = require('../../scripts/lib/bundle-editor.cjs');
test('all six legacy schedule edits pass their original row to the conflict check', async () => {
    const { source, modules, method } = load();
    let edits = 0;
    for (const id of [256, 1021, 1042]) walk(modules[id], node => {
        if (node.type !== 'CallExpression' || node.callee.property?.name !== 'updateSchedule') return;
        const clone = node.arguments[0];
        if (clone?.type !== 'CallExpression' || clone.arguments.length !== 3 ||
            clone.arguments[0].type !== 'ObjectExpression' || clone.arguments[0].properties.length ||
            clone.arguments[1].type !== 'Identifier' || clone.arguments[2].type !== 'ObjectExpression') return;
        assert.equal(node.arguments.length, 2);
        assert.equal(source.slice(node.arguments[1].start, node.arguments[1].end), source.slice(clone.arguments[1].start, clone.arguments[1].end));
        edits++;
    });
    assert.equal(edits, 6);
    const original = { id: 'original' }, record = { id: 'changed' }, calls = [], notices = [];
    const window = { FocusLocalData: { putSchedule: (...args) => { calls.push(args); return Promise.resolve(record); } },
        FocusLocal: { notice: value => notices.push(value) } };
    const value = method(256, 'updateSchedule').value;
    const update = Function('window', 'return (' + source.slice(value.start, value.end) + ')')(window);
    assert.equal(await update(record, original), record);
    assert.deepEqual(calls, [[record, original]]);
    window.FocusLocalData.putSchedule = () => Promise.reject(new Error('conflict'));
    await assert.rejects(update(record, original), /conflict/);
    assert.deepEqual(notices, ['conflict']);
});
