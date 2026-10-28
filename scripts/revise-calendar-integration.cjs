// Checked legacy boundaries; the calendar implementation lives in a local module.
const { load, walk } = require('./lib/bundle-editor.cjs');
const bundle = load(), { source, modules, replace } = bundle;
function attach(id, instance, code) {
    let existing, constructor;
    walk(modules[id], node => {
        if (node.type === 'CallExpression' && source.slice(node.callee.start, node.callee.end) === 'window.FocusCalendar.' + (id === 1021 ? 'attachController' : 'attachTimeline')) existing = node;
        if (node.type === 'ReturnStatement' && node.argument?.type === 'SequenceExpression' && node.argument.expressions.at(-1)?.name === instance && source.slice(node.start, node.end).includes(instance + '.state=')) constructor = node;
    });
    if (existing) replace(existing, code);
    else {
        if (!constructor) throw new Error('Calendar constructor boundary changed: ' + id);
        const last = constructor.argument.expressions.at(-1);
        bundle.edits.push({ start: last.start, end: last.start, code: code + ',' });
    }
}
if (!source.slice(modules[1021].start, modules[1021].end).includes('var focusCalendarEvents=')) {
    const position = modules[1021].body.body[0].end;
    bundle.edits.push({ start: position, end: position, code: 'var focusCalendarEvents=n(14).default,focusCalendarTasks=n(46).default;' });
}
if (!source.slice(modules[1021].start, modules[1021].end).includes('var focusCalendarNative=')) {
    const position = modules[1021].body.body[0].end;
    bundle.edits.push({ start: position, end: position, code: 'var focusCalendarNative={ReactDOM:n(22),Provider:n(27).Provider,Pomodoro:n(935).default,Project:n(964).default,DatePicker:n(277).default,Overlay:n(57).Overlay,Popover:n(57).Popover};' });
}
// The native project picker is Redux-connected. Preserve its original store
// through the public legacy context API when mounting inside the quick dialog.
let contextExport = 0;
walk(modules[1021], node => {
    if (node.type !== 'AssignmentExpression' || source.slice(node.left.start, node.left.end) !== 't.default') return;
    if (!/\bH\b/.test(source.slice(node.right.start, node.right.end))) return;
    if (!source.slice(node.right.start, node.right.end).includes('H.contextTypes=Object.assign'))
        replace(node.right, '(H.contextTypes=Object.assign({},H.contextTypes,{store:n(1).object}),H)');
    contextExport++;
});
if (contextExport !== 1) throw new Error('Calendar context boundary changed.');
attach(1021, 'G', `window.FocusCalendar.attachController(G,{React:b.default,moment:w.default,preference:L.default.shared,
taskManager:D.default.shared,subtaskManager:M.default.shared,startTask:function(task,subtask){focusCalendarTasks.shared.startTask(task,subtask)},
actions:Y,events:focusCalendarEvents.shared,eventTypes:focusCalendarEvents.Event,native:focusCalendarNative})`);
// Reuse the original rows and popovers. Only an explicit draft callback skips
// persistence; ordinary task-detail components retain their existing services.
for (const [id, name, parameters, update, close] of [
    [935, 'updateValue', 'count,minutes', '{estimatePomoNum:count,pomodoroInterval:minutes*60}', 'l.hideInput()'],
    [964, 'update', 'project', '{projectId:project.id}', 'l.setState({inputShown:false})']
]) {
    const matches = [];
    walk(modules[id], node => { if (node.type === 'AssignmentExpression' && node.left.property?.name === name) matches.push(node.right); });
    if (matches.length !== 1) throw new Error('Native draft boundary changed: ' + id + '.' + name);
    if (!source.slice(modules[id].start, modules[id].end).includes('l.inputAnchor=')) throw new Error('Native row instance changed: ' + id);
    const node = matches[0], wrapped = source.slice(node.start, node.end).includes('onLocalDraftChange');
    const original = wrapped ? source.slice(node.arguments[0].start, node.arguments[0].end) : source.slice(node.start, node.end);
    replace(node, `(function(original){return function(${parameters}){if(l.props.onLocalDraftChange){${close};return l.props.onLocalDraftChange(${update})}return original.apply(this,arguments)}})((${original}))`);
}
attach(1036, 't', 'window.FocusCalendar.attachTimeline(t,f.default,m.default)');
bundle.method(1033, 'render', 'function(){return window.FocusCalendar.renderShell(this,d.default,m.default)}');
bundle.assignment(1033, 'getTaskPaneEmptyLabel', 'function(){return ""}');
bundle.method(1036, 'render', 'function(){return window.FocusCalendar.renderDay(this,f.default,m.default)}');
bundle.method(256, 'updateSchedule', 'function(record){return window.FocusLocalData.putSchedule(record)}');
// The legacy local fork filtered the calendar out despite retaining its view.
// Restore the real system-list entry so users can reach these enhancements.
walk(modules[863], node => {
    if (node.type === 'CallExpression' && node.callee.property?.name === 'filter' &&
        source.slice(node.arguments[0]?.start, node.arguments[0]?.end) === 'function(e){return e.type!==R.default.calendar}') replace(node, source.slice(node.callee.object.start, node.callee.object.end));
});
// Keep the existing task menu, adding the official seven-calendar-day shortcut.
let menus = 0;
walk(modules[586], node => {
    if (node.type !== 'ArrayExpression' || !node.elements.some(item => item && source.slice(item.start, item.end).includes('"tsk_deadline_tomorrow"'))) return;
    if (node.elements.some(item => item?.type === 'ArrayExpression')) return;
    const existing = node.elements.find(item => item && source.slice(item.start, item.end).includes('FocusCalendar.deadlineInSevenDays'));
    if (!existing) {
        const tomorrow = node.elements.find(item => item && source.slice(item.start, item.end).includes('"tsk_deadline_tomorrow"'));
        bundle.edits.push({ start: tomorrow.end, end: tomorrow.end,
            code: ',{title:window.FocusI18n.text("下周到期"),action:function(){P.updateDeadline(window.FocusCalendar.deadlineInSevenDays())}}' });
    }
    menus++;
});
if (menus !== 1) throw new Error('Expected one task deadline menu, found ' + menus);
bundle.save();
console.log('Updated local calendar controller, timeline, schedule persistence and task shortcut.');
