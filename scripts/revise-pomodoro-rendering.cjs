// Normalize only legacy views that consume numeric progress. History/detail
// views that filter raw records by subtask retain their record representation.
const { load, walk } = require('./lib/bundle-editor.cjs');
const bundle = load();
for (const [id, name] of [[586, 'getPomodoroList'], [976, 'getPomodoroList'], [1018, 'getPomodoroList'], [1040, 'renderPomodoros'], [1049, 'getPomodoroView'], [935, 'render']]) {
    const scopes = [];
    if (name === 'render') scopes.push(bundle.method(id, name).value);
    else walk(bundle.modules[id], node => {
        if (node.type === 'AssignmentExpression' && node.left.property?.name === name) scopes.push(node.right);
    });
    if (scopes.length !== 1) throw new Error(`Expected one renderer ${id}.${name}`);
    const scope = scopes[0];
    if (bundle.source.slice(scope.start, scope.end).includes('window.FocusLocal.pomodoroValues')) continue;
    let count = 0;
    walk(scope, node => {
        if (node.type === 'MemberExpression' && node.property.name === 'pomodoros') {
            bundle.replace(node, `window.FocusLocal.pomodoroValues(${bundle.source.slice(node.start, node.end)})`);
            count++;
        }
    });
    if (!count) throw new Error(`Missing progress array in ${id}.${name}`);
}
// Keep the list's click guard until persistence has finished, rather than
// releasing it as soon as the completion animation's timeout fires.
walk(bundle.modules[586], node => {
    if (node.type !== 'AssignmentExpression' || node.left.property?.name !== 'completeTaskAnimation') return;
    const code = bundle.source.slice(node.right.start, node.right.end);
    if (code.includes('window.FocusLocal.notice')) return;
    const needle = 't.completeTask(),t.activated=!0';
    if (code.split(needle).length !== 4) throw new Error('Completion animation boundary changed.');
    bundle.replace(node.right, code.replaceAll(needle, 't.completeTask().then(function(){t.activated=!0},function(error){t.activated=!0;window.FocusLocal.notice(error.message)})'));
});
bundle.save();
console.log('Updated numeric pomodoro renderers.');
