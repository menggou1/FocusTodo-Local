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
// Cloud groups/rankings and the old server-backed forest stay out of the local
// product, including after importing an old preference that enabled them.
walk(modules[13],node=>{
    if(node.type!=='ObjectExpression')return;
    const key=node.properties.find(p=>p.key?.name==='key');
    if(!key||!['groupEnabled','forestEnabled','rankingListEnabled'].includes(key.value.value))return;
    const getter=node.properties.find(p=>p.key?.name==='get');
    if(getter)replace(getter.value,'function(){return false}');
});
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

method(862, 'render', 'function(){return l.default.createElement("div",{className:d.default.root+" focus-notification-panel"},l.default.createElement("div",{className:d.default.title+" larger1-font"},e.i18n.prop("tsk_notification")),l.default.createElement("div",{className:"focus-notification-content"},window.FocusAppUI.renderUpdates(l.default),l.default.createElement("ul",{className:"focus-task-reminders"},this.getItems())))}');
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
replace(mount.value,'function(){this.initNotification();this.localReleaseDispose=window.FocusAppUI.attachHeader(this)}');
const headerModuleText = source.slice(modules[821].start, modules[821].end);
if (headerModuleText.includes('key:"componentWillUnmount"')) {
    const unmount = method(821, 'componentWillUnmount');
    if (source.slice(unmount.value.start, unmount.value.end) !== 'function(){if(this.localReleaseDispose)this.localReleaseDispose()}') throw new Error('Header unmount has other behavior; preserve it before revising.');
}
else bundle.edits.push({ start: mount.node.start, end: mount.node.start, code: '{key:"componentWillUnmount",value:function(){if(this.localReleaseDispose)this.localReleaseDispose()}},' });
bundle.save();
console.log('Updated About, notification release entries and local reset entry points.');
