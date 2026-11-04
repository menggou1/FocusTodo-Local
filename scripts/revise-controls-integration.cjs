// Shared settings control configuration at checked legacy AST boundaries.
const {load,walk}=require('./lib/bundle-editor.cjs');
const bundle=load(),{source,modules,replace}=bundle;
const text=node=>source.slice(node.start,node.end);
for(const id of [1145,1154]) {
    const styles=[];
    walk(modules[id],node=>{if(node.type==='AssignmentExpression'&&node.left.property?.name==='customStyles')styles.push(node.right)});
    if(styles.length!==1||!/(?:control:function|FocusSettings.selectStyles)/.test(text(styles[0])))throw Error('Settings select boundary changed: '+id);
    replace(styles[0],'window.FocusSettings.selectStyles('+(id===1154?'true':'')+')');
}
const general=bundle.method(1153,'render').value;
// Install at webpack module scope; its require parameter is shadowed by the
// legacy class name inside render(). Never invoke that class as a loader.
const previous='window.FocusSettings.installControls(l.default,n(22),n(304).default,n(304).components);';
if(text(general).includes(previous)){
    const start=source.indexOf(previous,general.start);bundle.edits.push({start,end:start+previous.length,code:''});
}
const install='window.FocusSettings.installControls(n(0),n(22),n(304).default,n(304).components);';
if(!text(modules[1153]).includes(install)){
    const start=modules[1153].body.body[0].end;bundle.edits.push({start,end:start,code:install});
}
let switches=0;
for(const id of [1145,1153])walk(modules[id],node=>{
    if(node.type!=='CallExpression'||node.callee.property?.name!=='createElement')return;
    const props=node.arguments[1];
    if(!props||props.type!=='ObjectExpression')return;
    const keys=props.properties.map(p=>p.key?.name);
    if(!keys.includes('handleDiameter')||!keys.includes('checked'))return;
    const shared=new Set(['checkedIcon','uncheckedIcon','height','width','handleDiameter','onColor','offColor','activeBoxShadow']);
    const own=props.properties.filter(p=>!shared.has(p.key?.name)).map(text);
    replace(props,'Object.assign(window.FocusSettings.switchProps(),{'+own.join(',')+'})');switches++;
});
// The already migrated call sites must remain present on repeat execution.
if(switches===0&& ![1145,1153].every(id=>text(modules[id]).includes('FocusSettings.switchProps()')))throw Error('Settings switch boundary changed');
bundle.save();
console.log('Shared settings selects, language bridge and switch configuration integrated.');
