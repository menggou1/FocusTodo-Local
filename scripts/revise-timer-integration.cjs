// Idempotent AST update of the timer's explicit integration boundary.
// Does not rebuild the legacy application or rerun the one-time upgrade scripts.
const { load, walk } = require('./lib/bundle-editor.cjs');
const bundle = load();
const { source, modules, edits } = bundle;
const methods = new Map();
if (!source.slice(modules[1043].start, modules[1043].end).includes('var focusTimerI18n=')) {
    let boundary;
    walk(modules[1043], node => {
        if (node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.name === 'Y')) boundary = node.start;
    });
    if (!boundary) throw new Error('Timer class declaration changed.');
    edits.push({ start: boundary, end: boundary, code: 'var focusTimerI18n=e.i18n;' });
}
let attachCount = 0;
walk(modules[1043], node => {
    if (node.type === 'ObjectExpression') {
        const key = node.properties.find(p => p.key && p.key.name === 'key');
        const value = node.properties.find(p => p.key && p.key.name === 'value');
        if (key && value) methods.set(key.value.value, { node, value: value.value });
    }
    if (node.type !== 'CallExpression' || !node.callee.property || node.callee.property.name !== 'attachTimer') return;
    attachCount++;
    const options = node.arguments[1];
    edits.push({ start: options.start, end: options.end, code: `{
preference:_.default.shared,
events:E.default.shared,
subscriptions:[
[E.default.Event.TSK_DID_DELETE,"deleteTask",t.deleteTask],
[E.default.Event.ST_DID_DELETE,"deleteSubtask",t.deleteSubtask],
[E.default.Event.START_TIMER_FOR_TASK,"startForTask",t.startForTask],
[E.default.Event.TSK_DID_COMPLETE,"taskDidComplete",t.taskDidComplete],
[E.default.Event.ST_DID_COMPLETE,"subtaskDidComplete",t.subtaskDidComplete],
[E.default.Event.POMODORO_WORK_INTERVAL_CHNAGED,"refreshWorkInterval",t.refreshWorkInterval],
[E.default.Event.POMODORO_REST_INTERVAL_CHANGED,"refreshRestInteral",t.refreshRestInteral],
[E.default.Event.POMODORO_WHITE_NOISE_CHANGED,"refreshBgMusic",t.refreshBgMusic],
[E.default.Event.POMO_RELOAD_POMODOROS,"resetTaskPomodoros",t.resetTaskPomodoros],
[E.default.Event.THEME_CHANGED,"refreshTheme",t.refreshTheme]
],
clearTask:function(){t.props.dispatch((0,P.initTimingTask)(null,null))},
updateState:function(state){t.props.dispatch((0,P.updateTimerState)(state))},
notifyWork:function(session){
var title=session.mode==="countup"?focusTimerI18n.prop("tmr_count_pomo_title",session.totalSeconds.secondsToLocalHH_MM()):focusTimerI18n.prop("tmr_pomo_title");
var message=focusTimerI18n.prop(session.mode==="countup"?"tmr_count_pomo_msg":"tmr_pomo_msg");
window.FocusLocal.notifyCompletion(title,message,function(){D.default.shared.postNotification(title,message)})
},
notifyBreak:function(){var title=focusTimerI18n.prop("tmr_break_title"),message=focusTimerI18n.prop("tmr_break_msg");window.FocusLocal.notifyCompletion(title,message,function(){D.default.shared.postNotification(title,message)})},
disposeBridge:function(){
var bridge=window.webBridge;
if(bridge.changeStateTo===t.switchToState)delete bridge.changeStateTo;
if(bridge.stop===t.stop)delete bridge.stop;
if(bridge.resetTimer===t.resetTimer)delete bridge.resetTimer;
if(bridge.toggleFullScreen===t.localToggleFullScreen)delete bridge.toggleFullScreen;
},
onRecords:async function(records){
records.forEach(function(record){E.default.shared.emit(E.default.Event.POMODORO_NEW,record)});
var ids=Array.from(new Set(records.map(function(record){return record.taskId}).filter(Boolean)));
var tasks=(await Promise.all(ids.map(function(id){return y.default.shared.fetchTaskById(id)}))).filter(Boolean);
if(tasks.length)E.default.shared.emit(E.default.Event.NEED_TO_REFRESH_PROJECT_INFO_OF_TASKS,tasks);
tasks.forEach(function(task){E.default.shared.emit(E.default.Event.UPDATE_TASK_INFO,task)});
E.default.shared.emit(E.default.Event.PRJ_UPDATE_FINISHED_INFO_OF_CHECKED_PROJECT);
if(t.props.project.type===N.default.history)t.props.dispatch((0,C.addFinishedObjects)(records));
if(t.props.subtask){var sub=await I.default.shared.fetchSubtaskById(t.props.subtask.id);if(sub)t.props.dispatch((0,C.updateSubtask)(sub))}
}
}` });
});
if (attachCount !== 1 || !methods.has('componentDidMount')) throw new Error('Timer integration is not unique.');
const mount = methods.get('componentDidMount');
edits.push({ start: mount.value.start, end: mount.value.end, code: `async function(){
await window.FocusLocalReady;
if(this.localTimer.disposed)return;
await this.updateTimingTask(_.default.shared.timingTaskId,_.default.shared.timingSubtaskId);
if(this.localTimer.disposed)return;
window.webBridge.changeStateTo=this.switchToState;
var self=this;this.localToggleFullScreen=function(value){if(self.localTimer.disposed)return false;self.setState({isFullscreen:value});return true};
window.webBridge.toggleFullScreen=this.localToggleFullScreen;
window.webBridge.stop=this.stop;window.webBridge.resetTimer=this.resetTimer;
await this.localTimer.mount();
}` });
const unmountCode = 'function(){if(this.localTimer)this.localTimer.dispose()}';
if (methods.has('componentWillUnmount')) {
    const method = methods.get('componentWillUnmount').value;
    edits.push({ start: method.start, end: method.end, code: unmountCode });
} else edits.push({ start: mount.node.start, end: mount.node.start, code: '{key:"componentWillUnmount",value:' + unmountCode + '},' });
bundle.save();
console.log('Updated timer event bindings, notifications, statistics and lifecycle.');
