// One-time, AST-anchored integration into the supplied legacy bundle.
// Kept as an auditable map of exactly which legacy entry points changed.
const fs = require('node:fs');
const acorn = require('acorn');
let source = fs.readFileSync('js/main.js', 'utf8');
if (source.includes('FocusLocal.attachTimer')) throw new Error('Local integration is already applied.');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });
let modules;
function walk(node, visitor) {
    if (!node || typeof node !== 'object') return;
    visitor(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, visitor));
        else if (value && typeof value === 'object') walk(value, visitor);
    }
}
walk(ast, node => { if (node.type === 'ArrayExpression' && node.elements.length > 1000) modules = node.elements; });
const edits = [];
function assignment(id, name, code) {
    let count = 0;
    walk(modules[id], node => {
        if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.type === 'ThisExpression' && node.left.property.name === name) {
            edits.push({ start: node.right.start, end: node.right.end, code }); count++;
        }
    });
    if (count !== 1) throw new Error(`Expected one ${id}.${name}, found ${count}`);
}
function method(id, name, code) {
    let count = 0;
    walk(modules[id], node => {
        if (node.type !== 'ObjectExpression') return;
        const key = node.properties.find(p => p.key && p.key.name === 'key');
        const value = node.properties.find(p => p.key && p.key.name === 'value');
        if (key && key.value.value === name && value) { edits.push({ start: value.value.start, end: value.value.end, code }); count++; }
    });
    if (count !== 1) throw new Error(`Expected one method ${id}.${name}, found ${count}`);
}
method(77, 'init', 'async function(){this.db=await window.FocusLocalData.open()}');
assignment(77, 'reset', 'async function(){await window.FocusLocalData.reset();this.db=await window.FocusLocalData.open()}');
method(24, 'updatePomodoro', 'function(e){return window.FocusLocalData.putPomodoro(e)}');
method(24, 'fetchPomodoroById', 'async function(e){var db=await window.FocusLocalData.open();return window.FocusLocalData.transaction(db,["Pomodoro"],"readonly",function(tx,done){var q=tx.objectStore("Pomodoro").get(e);q.onsuccess=function(){done(q.result)}})}');
method(65, 'syncNow', 'async function(success){if(success)success()}');
assignment(65, 'sync', 'function(){}');
assignment(32, 'refreshServerAccessInfo', 'function(){}');
assignment(32, 'resetData', 'async function(){location.reload()}');
assignment(32, 'logout', 'function(){location.reload()}');
method(1043, 'componentDidMount', `async function(){
await window.FocusLocalReady;
await this.updateTimingTask(_.default.shared.timingTaskId,_.default.shared.timingSubtaskId);
window.webBridge.changeStateTo=this.switchToState;
var self=this;window.webBridge.toggleFullScreen=function(value){self.setState({isFullscreen:value});return true};
window.webBridge.stop=this.stop;window.webBridge.resetTimer=this.resetTimer;
await this.localTimer.mount();
}`);
edits.sort((a, b) => b.start - a.start).forEach(edit => { source = source.slice(0, edit.start) + edit.code + source.slice(edit.end); });
function once(before, after) {
    if (source.split(before).length !== 2) throw new Error('Nonunique integration anchor: ' + before.slice(0, 100));
    source = source.replace(before, after);
}
once('y.default.shared.version<=0&&(window.indexedDB.deleteDatabase("PomodoroDB6"),y.default.shared.removeAccountExpiredDate()),', '');
once('case 0:return t.next=3,M();case 3:if(document.title=', 'case 0:return t.next=3,Promise.all([window.FocusLocalReady,M()]);case 3:if(document.title=');
once('E.default.shared.on(E.default.Event.THEME_CHANGED,t.refreshTheme),t}return', `E.default.shared.on(E.default.Event.THEME_CHANGED,t.refreshTheme),window.FocusLocal.attachTimer(t,{
preference:_.default.shared,
updateState:function(state){t.props.dispatch((0,P.updateTimerState)(state))},
onRecords:async function(records){
records.forEach(function(record){E.default.shared.emit(E.default.Event.POMODORO_NEW,record)});
if(t.props.task){E.default.shared.emit(E.default.Event.NEED_TO_REFRESH_PROJECT_INFO_OF_TASKS,[t.props.task]);E.default.shared.emit(E.default.Event.UPDATE_TASK_INFO,t.props.task)}
E.default.shared.emit(E.default.Event.PRJ_UPDATE_FINISHED_INFO_OF_CHECKED_PROJECT);
if(t.props.project.type===N.default.history)t.props.dispatch((0,C.addFinishedObjects)(records));
if(t.props.subtask){var sub=await I.default.shared.fetchSubtaskById(t.props.subtask.id);if(sub)t.props.dispatch((0,C.updateSubtask)(sub))}
}
}),t}return`);
once('className:d.default.version},"7.1.1")', 'className:d.default.version},"7.1.1-patch.1")');
once('this.bgmVolume=1,this.volumeTipTimer=null}', 'this.bgmVolume=1,this.volumeTipTimer=null,window.FocusLocal.attachAudio(this,l.default.shared)}');
// Telemetry images bypassed the old XHR/fetch shim. Disable the source sinks too.
source = source.replace(/[an]\.src=E\.default\.serverUrl\+"v63\/exception-report\?"\+[nt]\.join\("&"\)/g, 'void 0');
acorn.parse(source, { ecmaVersion: 'latest' });
fs.writeFileSync('js/main.js', source);
console.log('Integrated local database, timer adapter, offline sync and version label.');
