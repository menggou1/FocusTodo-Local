// Keep reachable local profile edits out of the retired cloud API adapter.
const { load, walk } = require('./lib/bundle-editor.cjs');
const bundle = load();
function profileMethod(name, code) {
    const matches = [];
    walk(bundle.modules[32], node => {
        if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.type === 'ThisExpression' && node.left.property.name === name) matches.push(node.right);
    });
    if (matches.length !== 1) throw new Error(`Expected one local profile boundary ${name}, found ${matches.length}`);
    bundle.replace(matches[0], code);
}
profileMethod('updateUsername', 'function(name,done){return window.FocusLocalData.saveProfile("name",name).then(function(){g.default.shared.emit(g.default.Event.USERINFO_CHANGED);if(done)done()},function(error){window.FocusLocal.notice(window.FocusI18n.text("操作失败，未报告成功：")+error.message);if(done)done()})}');
profileMethod('updateAvatar', 'function(avatar,done,failed){return window.FocusLocalData.saveProfile("avatar",avatar).then(function(){g.default.shared.emit(g.default.Event.USERINFO_CHANGED);if(done)done()},function(error){window.FocusLocal.notice(window.FocusI18n.text("操作失败，未报告成功：")+error.message);if(failed)failed();if(done)done()})}');
// Profile reads already use localStorage. Retire the obsolete browser NAME cookie.
const cookieMethod=bundle.method(55,'setCookie').value;
let cookieSource=bundle.source.slice(cookieMethod.start,cookieMethod.end);
const oldNameBranch='if(e==="NAME"){window.FocusLocalData.clearLegacyNameCookie();localStorage.setItem("cookie."+e,t);return}';
if(!cookieSource.includes(oldNameBranch)) {
    const body=cookieSource.indexOf('{');
    cookieSource=cookieSource.slice(0,body+1)+oldNameBranch+cookieSource.slice(body+1);
}
bundle.replace(cookieMethod,cookieSource);
bundle.save();
console.log('Updated local name and avatar service boundaries.');
