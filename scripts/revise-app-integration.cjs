// Idempotent application UI edits at explicit legacy component boundaries.
const { load, walk } = require('./lib/bundle-editor.cjs');
const bundle = load();
const { source, modules, replace, method, assignment } = bundle;
// The old loader leaves an undefined regional filename in its queue for short
// language codes. Its synchronous path hid that bug; async completion must skip it.
let localeQueue = 0;
walk(modules[91], node => {
    if (node.type !== 'CallExpression' || node.arguments.length !== 2 || node.arguments[1]?.name !== 'n') return;
    const queue = source.slice(node.arguments[0].start, node.arguments[0].end);
    if (queue === '[r,o,i]') { replace(node.arguments[0], '[r,o,i].filter(Boolean)'); localeQueue++; }
    else if (queue === '[r,o,i].filter(Boolean)') localeQueue++;
});
if (localeQueue !== 1) throw new Error('Locale file queue boundary changed.');
// A failed optional translation file must finish its queue slot as well. The
// fallback catalog supplies missing text even when the request fails offline.
walk(modules[91], node => {
    if (node.type === 'LogicalExpression' && source.slice(node.left.start, node.left.end) === '404===e.status' && source.slice(node.right.start, node.right.end) === 'a.totalFiles-=1') replace(node, '(a.totalFiles-=1)');
});
// Keep the legacy formatter, but resolve missing text through complete fallback
// catalogs instead of exposing an internal translation key.
walk(modules[91], node => {
    if(node.type !== 'AssignmentExpression' || node.left.type !== 'MemberExpression') return;
    if(node.left.property.name === 'normaliseLanguageCode') replace(node, 'e.i18n.normaliseLanguageCode=(window.FocusI18n.attachLegacy(e.i18n),function(){return window.FocusI18n.legacyLanguage})');
    if(node.left.property.name === 'prop') {
        const text = source.slice(node.right.start,node.right.end);
        const old = 'r=e.i18n.map[t]';
        if(text.includes(old)) replace(node.right,text.replace(old,'r=window.FocusI18n.lookupLegacy(t,e.i18n.map[t])'));
    }
});
walk(modules[692], node => {
    if(node.type==='CallExpression' && source.slice(node.callee.start,node.callee.end).includes('normalizeLanguageCode') && source.slice(node.start,node.end).includes('navigator.language')) replace(node.arguments[0],'window.FocusI18n.locale');
});
// Resolve complete local languages from the existing catalog. Other locales
// retain the legacy parser and formatter, using asynchronous file requests.
const localeStartup = [];
walk(modules[692], node => {
    if (node.type === 'FunctionDeclaration' && node.id.name === 'M') localeStartup.push(node);
});
if (localeStartup.length !== 1 || !/e\.i18n\.properties|FocusI18n\.loadLegacy/.test(source.slice(localeStartup[0].start, localeStartup[0].end))) throw new Error('Locale startup boundary changed.');
replace(localeStartup[0], 'function M(){return window.FocusI18n.loadLegacy(e.i18n)}');
// Optional browser persistence permission must not delay core startup. Preserve
// the original data migration and render order, requesting persistence once.
const boots=[];
walk(modules[692],node=>{if(node.type==='VariableDeclarator'&&node.id.name==='d'&&source.slice(node.init.start,node.init.end).includes('document.getElementById("root")'))boots.push(node.init)});
if(boots.length!==1)throw Error('Application bootstrap boundary changed');
replace(boots[0],'async function(){await Promise.all([window.FocusLocalReady,M()]);document.title=e.i18n.prop("app_name");E.default.shared.initServerUrl();E.default.shared.refreshServerAccessInfo();S();h.default.locale((0,m.normalizeLanguageCode)(window.FocusI18n.locale));window.FocusAppUI.requestStoragePersistence();await l();await(new k.default).upgrade();var store=(0,g.createStore)(v.default);(0,f.render)(c.default.createElement(p.Provider,{store:store},c.default.createElement(b.default,null)),document.getElementById("root"))}');
// Cloud groups and rankings stay disabled, including imported preferences.
walk(modules[13],node=>{
    if(node.type!=='ObjectExpression')return;
    const key=node.properties.find(p=>p.key?.name==='key');
    if(!key||!['groupEnabled','rankingListEnabled'].includes(key.value.value))return;
    const getter=node.properties.find(p=>p.key?.name==='get');
    if(getter)replace(getter.value,'function(){return false}');
});
// Restore the original forest preference, switch, and component; only its
// point-service calls are adapted to the existing local data service.
walk(modules[13], node => {
    if (node.type !== 'ObjectExpression') return;
    const key=node.properties.find(p=>p.key?.name==='key')?.value?.value;
    if (key==='forestEnabled') {
        const getter=node.properties.find(p=>p.key?.name==='get');
        replace(getter.value, 'function(){var e=localStorage.getItem("Forest");return!e||"true"===String(e)}');
    }
    const fields={sunlight:'Sunlight',launchReward:'LaunchReward',dailyTaskReward:'DailyTaskReward',pomodoroReward:'PomodoroReward',taskReward:'TaskReward'};
    if (Object.prototype.hasOwnProperty.call(fields,key)) {
        const get=node.properties.find(p=>p.key?.name==='get'), set=node.properties.find(p=>p.key?.name==='set');
        replace(get.value, 'function(){return window.FocusLocalData.forestGet('+JSON.stringify(fields[key])+')}');
        replace(set.value, 'function(e){window.FocusLocalData.forestSet('+JSON.stringify(fields[key])+',e)}');
    }
});
walk(modules[821], node=>{if(node.type==='ObjectExpression' && node.properties.some(p=>p.key?.name==='forestSunlight') && node.properties.some(p=>p.key?.name==='forestEnabled')){const field=node.properties.find(p=>p.key?.name==='forestEnabled');replace(field.value,'h.default.shared.forestEnabled')}});
const general=method(1153,'render'), emptyBodies=[];
walk(general.value,node=>{if(node.type==='CallExpression' && node.arguments[0]?.value==='tbody' && node.arguments.length===2)emptyBodies.push(node)});
if(emptyBodies.length===1) bundle.edits.push({start:emptyBodies[0].end-1,end:emptyBodies[0].end-1,code:','+"l.default.createElement(\"tr\",null,l.default.createElement(\"td\",{className:d.default.title},e.i18n.prop(\"frt\")),l.default.createElement(\"td\",{className:d.default.value},l.default.createElement(c.default,{onChange:this.switchForest,checked:this.state.forestEnabled,checkedIcon:!1,uncheckedIcon:!1,height:18,width:36,handleDiameter:14,onColor:FTColor.themeRed,offColor:FTColor.bgSwitcherOff,activeBoxShadow:\"0 0 0 0 #000\"})))"});
else if(emptyBodies.length!==0 || !source.slice(general.value.start,general.value.end).includes('this.switchForest'))throw Error('General forest switch boundary changed.');
function ownAssignment(id,name,code){const nodes=[];walk(modules[id],n=>{if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.property?.name===name&&n.left.object.type==='ThisExpression')nodes.push(n.right)});if(nodes.length!==1)throw Error('Forest method boundary changed: '+name);replace(nodes[0],code)}
ownAssignment(106,'getForestInfo','function(success,fail){try{if(success)success({status:0,totalPoints:window.FocusLocalData.forestGet("Sunlight"),pointHistoryRecord:{}})}catch(error){if(fail)fail(error)}}');
ownAssignment(106,'uploadRewardRecords','function(){}');
method(679,'componentWillUnmount','function(){}');
assignment(1181,'handleCollect','function(id,item){if(Date.now()-item.date<864e5){var left=p.getLeftHourAndMin(item.date);p.showTip(k.default.i18n.prop("frt_sun_tip",left[0],left[1]))}else return window.FocusForest.collect(p,id,item)}');
assignment(1181,'getSunlight','function(){return window.FocusForest.refresh(p)}');
assignment(1181,'fetchForestDataFromServer','function(){return window.FocusForest.refresh(p)}');
// Badge totals use the same per-item rounding and streak cap as the original forest.
for(const [name,before,after] of [['getPomodoroRewards','this.POMODOROMULTIPERREWARD*f/60','this.POMODOROMULTIPERREWARD*Math.max(Math.floor(f/60),1)'],['getContinueLaunchReward','this.CONTINUELAUNCHMULTIPERREWARD*d','this.CONTINUELAUNCHMULTIPERREWARD*Math.min(d,80)']]){
    const target=method(106,name),text=source.slice(target.value.start,target.value.end);
    if(text.includes(before))replace(target.value,text.replace(before,after));
    else if(!text.includes(after))throw Error('Forest badge boundary changed: '+name);
}
method(1181,'componentDidMount','function(){var e=this;this.localAchievementRefresh=function(){e.setState(e.loadLocalForestState)};window.addEventListener("focus-local-achievements-changed",this.localAchievementRefresh);try{w.default.shared.setDailyLaunchReward()}catch(error){window.FocusLocal.notice(error.message)}window.FocusForest.mount(this)}');
// Reuse the original forest drawer and ranking styles for offline achievements.
const forestRender=method(1181,'render');let buttonGroup;
walk(forestRender.value,node=>{if(node.type==='CallExpression'&&node.arguments[0]?.value==='div'&&node.arguments[1]?.properties?.some(p=>p.key?.name==='className'&&source.slice(p.value.start,p.value.end)==='g.default.buttonGroup'))buttonGroup=node});
if(!buttonGroup)throw Error('Forest button boundary changed');
if(buttonGroup.arguments[2]?.type==='Literal'&&buttonGroup.arguments[2].value===null)replace(buttonGroup.arguments[2],'m.default.createElement("img",{draggable:"false",src:"img/forest-badge.png",className:g.default.imageButton+" focus-achievement-button",title:window.FocusI18n.text("成就"),alt:window.FocusI18n.text("成就"),onClick:function(){return e.props.openDrawer("ranking")}})');
else if(source.slice(buttonGroup.arguments[2].start,buttonGroup.arguments[2].end).includes('img/forest-badge.png')){const old=source.slice(buttonGroup.arguments[2].start,buttonGroup.arguments[2].end);if(!old.includes('focus-achievement-button'))replace(buttonGroup.arguments[2],old.replace('className:g.default.imageButton,','className:g.default.imageButton+" focus-achievement-button",'));}
else throw Error('Forest achievement button changed');
method(1190,'renderContent','function(){var e=this.props.type;return"guide"===e?l.default.createElement(c.default,null):"ranking"===e?window.FocusAchievements.render(l.default,n(1463)):null}');
// Task writes notify only after the existing IndexedDB transaction commits.
const taskUpdate=method(23,'updateTask'),taskUpdateText=source.slice(taskUpdate.value.start,taskUpdate.value.end);
if(!taskUpdateText.includes('focus-local-achievements-input')){if(!taskUpdateText.includes('r.onsuccess='))throw Error('Task update boundary changed');replace(taskUpdate.value,taskUpdateText.replace('r.onsuccess=', 'r.transaction.addEventListener("complete",function(){window.dispatchEvent(new Event("focus-local-achievements-input"))});r.onsuccess='));}
method(1181,'componentWillUnmount','function(){window.FocusForest.unmount(this);window.removeEventListener("focus-local-achievements-changed",this.localAchievementRefresh);M.default.shared.off(M.default.Event.USERINFO_CHANGED,this.refresh)}');

assignment(821,'onWindowsFocused','function(){}');
const about = method(1147, 'render');
let versionRow, versionText, rating;
walk(about.value, node => {
    const text = source.slice(node.start, node.end);
    if (node.type === 'CallExpression' && node.arguments[0]?.value === 'tr' && text.includes('"abt_version"')) versionRow = node;
    if (node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression' && node.arguments[1].properties.some(p => p.key.name === 'className' && source.slice(p.value.start, p.value.end) === 'd.default.version')) versionText = node.arguments[2];
    if (node.type === 'LogicalExpression' && source.slice(node.left.start, node.left.end).includes('isSupportRating') && text.includes('"abt_rate"')) rating = node;
});
if (!versionRow || !versionText) throw new Error('About version boundary changed.');
replace(versionText, 'window.FocusRelease.version');
if (rating) replace(rating, 'null');
if (!source.slice(about.value.start, about.value.end).includes('FocusAppUI.renderAbout')) bundle.edits.push({ start: versionRow.end, end: versionRow.end, code: ',window.FocusAppUI.renderAbout(l.default)' });

assignment(1148, 'showDeleteDataAlert', 'function(){window.FocusAppUI.confirmReset()}');
assignment(1148, 'showDeleteDataPassowrdConfirmDialog', 'function(){window.FocusAppUI.confirmReset()}');
assignment(1148, 'deleteData', 'function(){window.FocusAppUI.confirmReset()}');

// Clear custom overlays during the actual classic-theme selection, including
// reselecting the classic theme retained by the legacy PureComponent.
assignment(1154, 'selectTheme', 'function(e){if(m.default.premiumItems.includes(e)&&!i.hasPermission())return;if(!window.FocusThemes.selectClassic(e))return;m.default.shared.name=e;i.setState({theme:e},window.FocusThemes.refresh);v.default.shared.emit(v.default.Event.THEME_CHANGED)}');

// Local storage is the account authority. Old browser cookies can survive a
// reset/import and otherwise shadow the restored name and identity.
method(55, 'getCookie', 'function(e){return window.FocusI18n.accountCookie(e,localStorage.getItem("cookie."+e)||"")}');

// A queued project refresh can finish after reset has removed its project row.
walk(modules[863], node => {
    if (node.type !== 'AssignmentExpression' || node.left.property?.name !== 'checkProject') return;
    const original = source.slice(node.right.start, node.right.end);
    if (original.includes('if(!t||window.FocusLocalData.maintenance)')) return;
    if (!original.includes('case 0:t.type')) throw new Error('Project selection guard boundary changed.');
    replace(node.right, original.replace('case 0:t.type', 'case 0:if(!t||window.FocusLocalData.maintenance)return e.abrupt("return");t.type'));
});

method(862, 'render', 'function(){return l.default.createElement("div",{className:d.default.root+" focus-notification-panel"},l.default.createElement("div",{className:d.default.title+" larger1-font"},e.i18n.prop("tsk_notification")),window.FocusAppUI.renderReminderSummary(l.default,this.props.items),l.default.createElement("div",{className:"focus-notification-content"},l.default.createElement("ul",{className:"focus-task-reminders"},this.getItems()),window.FocusAppUI.renderUpdates(l.default)))}');
assignment(862,'getItems','function(){return s.props.items.map(function(item){return l.default.createElement("li",{className:d.default.item+" small-font",key:item.id},l.default.createElement("div",{className:"type"},window.FocusI18n.text("任务到时提醒")),l.default.createElement("div",{className:d.default.content},item.name),l.default.createElement("time",{className:d.default.date,dateTime:new Date(item.reminderDate).toISOString()},new Date(item.reminderDate).toLocaleString(window.FocusI18n.locale)))} )}');
assignment(821,'initNotification','function(){return window.FocusAppUI.refreshReminders(d)}');
assignment(821,'triggerNotification','function(){return window.FocusAppUI.refreshReminders(d,false,true)}');
assignment(821,'updateNextReminder','function(){return window.FocusAppUI.refreshReminders(d,false,true)}');
assignment(821,'showNotification','function(){if(!d.state.notification.show)return window.FocusAppUI.refreshReminders(d,true)}');
// Guard the legacy extension-only resize persistence in ordinary browsers.
walk(modules[254], node => {
    if (node.type !== 'AssignmentExpression' || node.left.type !== 'MemberExpression' || node.left.object.name !== 'window' || node.left.property.name !== 'onresize') return;
    const original = source.slice(node.right.start, node.right.end);
    const old = 'var e=l.default.shared.isChromium?window.chrome.storage:window.browser.storage;e&&e.sync.set';
    if (original.includes(old)) replace(node.right, original.replace(old, 'var e=window.chrome&&window.chrome.runtime&&window.chrome.runtime.id?window.chrome.storage:window.browser&&window.browser.runtime&&window.browser.runtime.id?window.browser.storage:null;e&&e.sync&&typeof e.sync.set==="function"&&e.sync.set'));
});
const header = method(821, 'render');
walk(header.value, node => {
    if (node.type === 'LogicalExpression' && node.operator === '&&' && source.slice(node.left.start, node.left.end).includes('this.state.notification.highlight') && source.slice(node.right.start, node.right.end).startsWith('e.backgroundImage=')) {
        let start = node.left.start, end = node.left.end;
        while (source[start - 1] === '(' && source[end] === ')') { start--; end++; }
        replace({ start, end }, '(this.state.notification.highlight||window.FocusAppUI.hasUnreadUpdates())');
    }
    if (node.type === 'ObjectExpression' && node.properties.some(p => p.key.name === 'ref' && source.slice(p.value.start, p.value.end) === 'this.notificationAnchor')) {
        replace(node, '{ref:this.notificationAnchor,onClick:this.showNotification,style:e,role:"button",tabIndex:0,"aria-label":window.FocusI18n.text("通知"),"aria-expanded":this.state.notification.show,onKeyDown:function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();event.currentTarget.click()}}}');
    }
});
const mount = method(821, 'componentDidMount');
replace(mount.value,'function(){window.FocusLocalReady.then(function(){if(h.default.shared.forestEnabled)P.default.shared.setDailyLaunchReward()}).catch(function(e){window.FocusLocal.notice(e.message)});this.localReleaseDispose=window.FocusAppUI.attachHeader(this,function(){C.default.shared.start("Notification"+(S.default.shared.isWin7?".ogg":".m4a"))})}');
const headerModuleText = source.slice(modules[821].start, modules[821].end);
if (headerModuleText.includes('key:"componentWillUnmount"')) {
    const unmount = method(821, 'componentWillUnmount');
    if (source.slice(unmount.value.start, unmount.value.end) !== 'function(){if(this.localReleaseDispose)this.localReleaseDispose()}') throw new Error('Header unmount has other behavior; preserve it before revising.');
}
else bundle.edits.push({ start: mount.node.start, end: mount.node.start, code: '{key:"componentWillUnmount",value:function(){if(this.localReleaseDispose)this.localReleaseDispose()}},' });
bundle.save();
console.log('Updated About, notification release entries and local reset entry points.');
