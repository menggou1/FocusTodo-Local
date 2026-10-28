const {load}=require('./lib/bundle-editor.cjs');
const b=load();
// Preserve the legacy row contents/actions; regenerate only our integration props and handle.
for (const id of [1175,1176]) {
  const node=b.method(id,'render').value;
  let source=b.source.slice(node.start,node.end);
  const start='className:d.default.root+" "+(this.props.highlight?d.default.highlight:"")';
  const end='},l.default.createElement("table"';
  const from=source.indexOf(start), to=source.indexOf(end,from);
  if(from<0 || to<0) throw Error('Missing row anchor '+id);
  source=source.slice(0,from)+start+',draggable:!0,tabIndex:0,onMouseDownCapture:this.props.onPointerStart,onDragStart:this.props.onDragStart,onDragOver:this.props.onDragOver,onDragLeave:this.props.onDragLeave,onDrop:this.props.onDrop,onDragEnd:this.props.onDragEnd,onKeyDown:this.props.onKeyDown,"data-project-id":this.props.project.id,"data-project-group":this.props.reorderGroup,title:this.props.reorderLabel'+source.slice(to);
  if(!source.includes('className:"focus-project-handle-cell"')) {
    const row='l.default.createElement("tr",null,';
    if(!source.includes(row)) throw Error('Missing row contents '+id);
    source=source.replace(row,row+'l.default.createElement("td",{className:"focus-project-handle-cell"},l.default.createElement("button",{type:"button",className:"focus-project-handle","aria-label":this.props.reorderLabel,title:this.props.reorderLabel},l.default.createElement("span",{"aria-hidden":"true"}),l.default.createElement("span",{"aria-hidden":"true"}),l.default.createElement("span",{"aria-hidden":"true"}))),');
  }
  b.replace(node,source);
}
b.method(1174,'render',function(){
  var self=this,actions=A,translate=window.FocusI18n.text;
  var hint=translate('拖动三条杠排序，也可聚焦后使用上下方向键。系统清单与自定义清单分别排序。');
  function rows(){return self.projectRoot?Array.from(self.projectRoot.querySelectorAll('[data-project-id]')):[]}
  function clearTarget(){rows().forEach(function(element){element.removeAttribute('data-drop-position')})}
  function clearDrag(){
    self.projectDrag=null;self.projectPointerBlocked=false;clearTarget();
    if(self.projectRoot){self.projectRoot.removeAttribute('data-drag-group');var status=self.projectRoot.querySelector('.focus-project-hint');if(status)status.textContent=hint}
    rows().forEach(function(element){element.removeAttribute('data-dragging')});
    if(self.projectDragCleanup){var cleanup=self.projectDragCleanup;self.projectDragCleanup=null;cleanup()}
  }
  function cancelDrag(event){if(event.key==='Escape')clearDrag()}
  self.clearProjectDrag=clearDrag;
  function row(project,group){return {
    reorderGroup:group,reorderLabel:translate('拖动或使用上下方向键排序'),
    onPointerStart:function(event){self.projectPointerBlocked=!!event.target.closest('input,a,[role="switch"],[class*="-hide-"],[class*="-delete-"]')},
    onDragStart:function(event){
      if(self.reordering||self.projectPointerBlocked){event.preventDefault();return}
      clearDrag();self.projectDrag={id:project.id,group:group};
      event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',project.id);
      event.currentTarget.setAttribute('data-dragging','true');
      if(self.projectRoot){self.projectRoot.setAttribute('data-drag-group',group);self.projectRoot.querySelector('.focus-project-hint').textContent=translate('仅能在同类清单内排序，灰色区域不可放置。')}
      window.addEventListener('dragend',clearDrag);window.addEventListener('drop',clearDrag);window.addEventListener('keydown',cancelDrag);
      self.projectDragCleanup=function(){window.removeEventListener('dragend',clearDrag);window.removeEventListener('drop',clearDrag);window.removeEventListener('keydown',cancelDrag)};
    },
    onDragOver:function(event){
      var drag=self.projectDrag;clearTarget();
      if(!drag||drag.group!==group){if(event.dataTransfer)event.dataTransfer.dropEffect='none';return}
      event.preventDefault();event.dataTransfer.dropEffect='move';
      if(drag.id!==project.id){var list=self.state[group],from=list.findIndex(function(item){return item.id===drag.id}),to=list.findIndex(function(item){return item.id===project.id});event.currentTarget.setAttribute('data-drop-position',from<to?'after':'before')}
    },
    onDragLeave:function(event){if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.removeAttribute('data-drop-position')},
    onDrop:function(event){event.preventDefault();var drag=self.projectDrag;clearDrag();if(drag&&drag.group===group)move(drag.id,project.id,group,false)},
    onDragEnd:clearDrag,
    onKeyDown:function(event){
      var handle=event.target.closest('.focus-project-handle');
      if((event.target!==event.currentTarget&&!handle)||!(event.key==='ArrowUp'||event.key==='ArrowDown'))return;
      event.preventDefault();var list=self.state[group],index=list.findIndex(function(item){return item.id===project.id}),other=list[index+(event.key==='ArrowUp'?-1:1)];
      if(other)move(project.id,other.id,group,!!handle);
    }
  }}
  function move(from,to,group,focusHandle){
    if(from===to||self.reordering)return;
    self.reordering=true;if(self.projectRoot)self.projectRoot.setAttribute('aria-busy','true');
    window.FocusSettings.reorderProjects(v.default.shared.db,self.state[group],from,to).then(function(items){
      if(self.projectDisposed)return;
      var positions={};rows().forEach(function(element){positions[element.dataset.projectId]=element.getBoundingClientRect().top});
      var state={};state[group]=items;self.setState(state,function(){
        var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        rows().forEach(function(element){
          var previous=positions[element.dataset.projectId],offset=previous-element.getBoundingClientRect().top;
          if(!reduced&&Number.isFinite(offset)&&offset&&element.animate){
            var animation=element.animate([{transform:'translateY('+offset+'px)'},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
            self.projectAnimations=self.projectAnimations||new Set();self.projectAnimations.add(animation);animation.onfinish=animation.oncancel=function(){self.projectAnimations.delete(animation)};
          }
          if(element.dataset.projectId===from&&focusHandle)element.querySelector('.focus-project-handle').focus({preventScroll:true});
        });
      });
      if(group==='presetProjects'){
        var changes={};items.forEach(function(item){changes[item.id]=item.order});
        var all=self.props.presetProjects.map(function(item){return changes[item.id]===undefined?item:Object.assign({},item,{order:changes[item.id]})});
        all.sort(function(a,b){return a.order-b.order});self.props.dispatch(actions.initPresetProjects(all));
      }else self.props.dispatch(actions.updateProjects(items.map(function(item){return {id:item.id,order:item.order}})));
    }).catch(function(error){if(!self.projectDisposed){window.FocusLocal.notice(translate('清单排序失败：')+error.message);self.initProject()}}).finally(function(){self.reordering=false;if(self.projectRoot)self.projectRoot.removeAttribute('aria-busy')});
  }
  return m.default.createElement('div',{className:g.default.root+' focus-project-management',ref:function(element){self.projectRoot=element}},
    m.default.createElement('p',{className:'focus-project-hint',role:'status','aria-live':'polite'},hint),
    m.default.createElement(x.default,{classNames:[g.default.content],autoDisappear:!1,isUl:!0},
      this.state.presetProjects.map(function(item,index){return m.default.createElement(_.default,Object.assign({project:item,key:item.id,highlight:index%2==1,changeHiddenState:self.switchPresetProjectHiddenState,isDarkMode:self.props.isDarkMode},row(item,'presetProjects')))}),
      this.state.customProjects.map(function(item,index){return m.default.createElement(y.default,Object.assign({project:item,key:item.id,highlight:index%2==1,delete:self.showDeleteDialog,changeHiddenState:self.switchProjectHiddenState},row(item,'customProjects')))})),this.getConfirmDialog());
}.toString());
const mount=b.method(1174,'componentDidMount').node;
if(!b.source.slice(b.modules[1174].start,b.modules[1174].end).includes('key:"componentWillUnmount"')) {
  b.edits.push({start:mount.end,end:mount.end,code:',{key:"componentWillUnmount",value:function(){this.projectDisposed=true;if(this.clearProjectDrag)this.clearProjectDrag();if(this.projectAnimations)this.projectAnimations.forEach(function(animation){animation.cancel()})}}'});
}
let mod=b.modules[1174],s=b.source.slice(mod.start,mod.end);
const dep='x=E(n(26));function E'; if(s.includes(dep)){let pos=mod.start+s.indexOf(dep);b.edits.push({start:pos,end:pos+dep.length,code:'x=E(n(26)),A=n(102);function E'});} else if(!s.includes('A=n(102);function E')) throw Error('Missing actions dependency');
const anchor='t.default=D}).call(this,n(6))';
if(s.includes(anchor)){let pos=mod.start+s.indexOf(anchor);b.edits.push({start:pos,end:pos+anchor.length,code:'t.default=n(27).connect(function(state){return {presetProjects:state.projectInfo.presetProjects.orderedIds.map(function(id){return state.projectInfo.presetProjects.projects[id]})}})(D)}).call(this,n(6))'});} else if(!s.includes('t.default=n(27).connect(function(state)')) throw Error('Missing export anchor');
b.save();
