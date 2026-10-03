// Idempotent application UI edits at explicit legacy component boundaries.
const { load, walk } = require('./lib/bundle-editor.cjs');
const bundle = load();
const { source, modules, replace, method, assignment } = bundle;
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

// A queued project refresh can finish after reset has removed its project row.
walk(modules[863], node => {
    if (node.type !== 'AssignmentExpression' || node.left.property?.name !== 'checkProject') return;
    const original = source.slice(node.right.start, node.right.end);
    if (original.includes('if(!t||window.FocusLocalData.maintenance)')) return;
    if (!original.includes('case 0:t.type')) throw new Error('Project selection guard boundary changed.');
    replace(node.right, original.replace('case 0:t.type', 'case 0:if(!t||window.FocusLocalData.maintenance)return e.abrupt("return");t.type'));
});

method(862, 'render', 'function(){return l.default.createElement("div",{className:d.default.root+" focus-notification-panel"},l.default.createElement("div",{className:d.default.title+" larger1-font"},e.i18n.prop("tsk_notification")),window.FocusAppUI.renderUpdates(l.default),l.default.createElement(c.default,{classNames:[d.default.items],isUl:true},this.getItems()))}');
const header = method(821, 'render');
walk(header.value, node => {
    if (node.type === 'LogicalExpression' && node.operator === '&&' && source.slice(node.left.start, node.left.end).includes('this.state.notification.highlight') && source.slice(node.right.start, node.right.end).startsWith('e.backgroundImage=')) {
        let start = node.left.start, end = node.left.end;
        while (source[start - 1] === '(' && source[end] === ')') { start--; end++; }
        replace({ start, end }, '(this.state.notification.highlight||window.FocusAppUI.hasUnreadUpdates())');
    }
    if (node.type === 'ObjectExpression' && node.properties.some(p => p.key.name === 'ref' && source.slice(p.value.start, p.value.end) === 'this.notificationAnchor')) {
        replace(node, '{ref:this.notificationAnchor,onClick:this.showNotification,style:e,role:"button",tabIndex:0,"aria-label":"通知","aria-expanded":this.state.notification.show,onKeyDown:function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();event.currentTarget.click()}}}');
    }
});
const mount = method(821, 'componentDidMount');
if (!source.slice(mount.value.start, mount.value.end).includes('FocusAppUI.attachHeader')) bundle.edits.push({ start: mount.value.end - 1, end: mount.value.end - 1, code: ';this.localReleaseDispose=window.FocusAppUI.attachHeader(this)' });
const headerModuleText = source.slice(modules[821].start, modules[821].end);
if (headerModuleText.includes('key:"componentWillUnmount"')) {
    const unmount = method(821, 'componentWillUnmount');
    if (source.slice(unmount.value.start, unmount.value.end) !== 'function(){if(this.localReleaseDispose)this.localReleaseDispose()}') throw new Error('Header unmount has other behavior; preserve it before revising.');
}
else bundle.edits.push({ start: mount.node.start, end: mount.node.start, code: '{key:"componentWillUnmount",value:function(){if(this.localReleaseDispose)this.localReleaseDispose()}},' });
bundle.save();
console.log('Updated About, notification release entries and local reset entry points.');
