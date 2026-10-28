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
  const handle='l.default.createElement("td",{className:"focus-project-handle-cell"},l.default.createElement("button",{type:"button",className:"focus-project-handle","aria-label":this.props.reorderLabel,title:this.props.reorderLabel},l.default.createElement("span",{"aria-hidden":"true"}),l.default.createElement("span",{"aria-hidden":"true"}),l.default.createElement("span",{"aria-hidden":"true"}))),';
  const props=id===1175?',draggable:!1,onDragStart:function(event){event.preventDefault()},"data-project-id":this.props.project.id,"data-project-group":"customProjects"':',draggable:!1,tabIndex:0,onPointerDown:this.props.onPointerStart,onDragStart:function(event){event.preventDefault()},onKeyDown:this.props.onKeyDown,"data-project-id":this.props.project.id,"data-project-group":"presetProjects",title:this.props.reorderLabel';
  source=source.slice(0,from)+start+props+source.slice(to);
  if(id===1175)source=source.replace(handle,'');
  if(id===1176&&!source.includes('className:"focus-project-handle-cell"')) {
    const row='l.default.createElement("tr",null,';
    if(!source.includes(row)) throw Error('Missing row contents '+id);
    source=source.replace(row,row+handle);
  }
  b.replace(node,source);
}
b.method(1174,'render',function(){
  var self=this,actions=A,translate=window.FocusI18n.text;
  var hint=translate('拖动三条杠或使用上下方向键调整系统清单。自定义清单请在主界面排序。');
  function rows(){return self.projectRoot?Array.from(self.projectRoot.querySelectorAll('[data-project-group="presetProjects"]')):[]}
  function clearTarget(){rows().forEach(function(element){element.removeAttribute('data-drop-position')})}
  function clearDrag(){
    var drag=self.projectDrag;self.projectDrag=null;clearTarget();
    if(drag&&drag.ghost)drag.ghost.remove();
    if(drag&&drag.source.hasPointerCapture&&drag.source.hasPointerCapture(drag.pointerId))drag.source.releasePointerCapture(drag.pointerId);
    if(self.projectRoot){self.projectRoot.removeAttribute('data-drag-group');var status=self.projectRoot.querySelector('.focus-project-hint');if(status)status.textContent=hint}
    rows().forEach(function(element){element.removeAttribute('data-dragging')});
    if(self.projectDragCleanup){var cleanup=self.projectDragCleanup;self.projectDragCleanup=null;cleanup()}
  }
  function cancelDrag(event){if(!event||event.type==='blur'||event.type==='pointercancel'||event.key==='Escape')clearDrag()}
  self.clearProjectDrag=clearDrag;
  function row(project,group){return {
    reorderGroup:group,reorderLabel:translate('拖动或使用上下方向键排序'),
    onPointerStart:function(event){
      if(event.button!==0||self.reordering||event.target.closest('input,a,[role="switch"],[class*="-hide-"],[class*="-delete-"]'))return;
      event.preventDefault();clearDrag();
      var source=event.currentTarget,rect=source.getBoundingClientRect();
      (event.target.closest('.focus-project-handle')||source).focus({preventScroll:true});
      var drag={id:project.id,group:group,source:source,pointerId:event.pointerId,x:event.clientX,y:event.clientY,target:null,ghost:null};
      self.projectDrag=drag;if(source.setPointerCapture)source.setPointerCapture(event.pointerId);
      function moving(pointer){
        if(self.projectDrag!==drag)return;
        if(!drag.ghost&&Math.hypot(pointer.clientX-drag.x,pointer.clientY-drag.y)<5)return;
        pointer.preventDefault();
        if(!drag.ghost){
          drag.ghost=source.cloneNode(true);drag.ghost.removeAttribute('data-project-id');drag.ghost.removeAttribute('data-project-group');drag.ghost.classList.add('focus-project-drag-preview');drag.ghost.setAttribute('aria-hidden','true');drag.ghost.inert=true;
          Object.assign(drag.ghost.style,{width:rect.width+'px',height:rect.height+'px',left:rect.left+'px',top:rect.top+'px',font:getComputedStyle(source).font});document.body.appendChild(drag.ghost);
          source.setAttribute('data-dragging','true');self.projectRoot.setAttribute('data-drag-group',group);
        }
        drag.ghost.style.transform='translateY('+(pointer.clientY-drag.y)+'px)';
        clearTarget();drag.target=null;
        var hit=document.elementFromPoint(pointer.clientX,pointer.clientY),target=hit&&hit.closest('[data-project-group="presetProjects"]');
        if(target&&self.projectRoot.contains(target)&&target.dataset.projectId!==project.id){
          drag.target=target.dataset.projectId;var list=self.state.presetProjects,from=list.findIndex(function(item){return item.id===project.id}),to=list.findIndex(function(item){return item.id===drag.target});target.setAttribute('data-drop-position',from<to?'after':'before');
        }
      }
      function finish(pointer){
        if(self.projectDrag!==drag)return;
        var target=drag.target,active=!!drag.ghost;pointer.preventDefault();clearDrag();
        if(active&&target)move(project.id,target,group,false);
      }
      window.addEventListener('pointermove',moving,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancelDrag);window.addEventListener('keydown',cancelDrag);window.addEventListener('blur',cancelDrag);
      self.projectDragCleanup=function(){window.removeEventListener('pointermove',moving);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancelDrag);window.removeEventListener('keydown',cancelDrag);window.removeEventListener('blur',cancelDrag)};
    },
    onKeyDown:function(event){
      var handle=event.target.closest('.focus-project-handle');
      if((event.target!==event.currentTarget&&!handle)||!(event.key==='ArrowUp'||event.key==='ArrowDown'))return;
      event.preventDefault();var list=self.state[group],index=list.findIndex(function(item){return item.id===project.id}),other=list[index+(event.key==='ArrowUp'?-1:1)];
      if(other)move(project.id,other.id,group,!!handle);
    }
  }}
  function move(from,to,group,focusHandle){
    if(from===to||self.reordering)return;
    persist(function(){return window.FocusSettings.reorderProjects(v.default.shared.db,self.state.presetProjects,from,to)},from,focusHandle);
  }
  function persist(operation,from,focusHandle){
    if(self.reordering)return;
    if(self.projectAnimations)self.projectAnimations.forEach(function(animation){animation.cancel()});
    self.reordering=true;if(self.projectRoot)self.projectRoot.setAttribute('aria-busy','true');
    self.setState({projectOrderSaving:true});
    operation().then(function(items){
      if(self.projectDisposed)return;
      var changes={};items.forEach(function(item){changes[item.id]=item.order});
      var displayed=self.state.presetProjects.map(function(item){return changes[item.id]===undefined?item:Object.assign({},item,{order:changes[item.id]})}).sort(function(a,b){return a.order-b.order});
      var positions={};rows().forEach(function(element){positions[element.dataset.projectId]=element.getBoundingClientRect().top});
      self.setState({presetProjects:displayed},function(){
        var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        rows().forEach(function(element){
          var previous=positions[element.dataset.projectId],offset=previous-element.getBoundingClientRect().top;
          if(!reduced&&Number.isFinite(offset)&&offset&&element.animate){
            if(element.dataset.projectId===from)element.setAttribute('data-reorder-active','true');
            var animation=element.animate([{transform:'translateY('+offset+'px)'},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
            self.projectAnimations=self.projectAnimations||new Set();self.projectAnimations.add(animation);animation.onfinish=animation.oncancel=function(){element.removeAttribute('data-reorder-active');self.projectAnimations.delete(animation)};
          }
          if(element.dataset.projectId===from&&focusHandle)element.querySelector('.focus-project-handle').focus({preventScroll:true});
        });
      });
      var all=self.props.presetProjects.map(function(item){return changes[item.id]===undefined?item:Object.assign({},item,{order:changes[item.id]})});
      all.sort(function(a,b){return a.order-b.order});self.props.dispatch(actions.initPresetProjects(all));
    }).catch(function(error){if(!self.projectDisposed){window.FocusLocal.notice(translate('清单排序失败：')+error.message);self.initProject()}}).finally(function(){self.reordering=false;if(self.projectRoot)self.projectRoot.removeAttribute('aria-busy');if(!self.projectDisposed)self.setState({projectOrderSaving:false})});
  }
  return m.default.createElement('div',{className:g.default.root+' focus-project-management',ref:function(element){self.projectRoot=element}},
    m.default.createElement('div',{className:'focus-project-toolbar'},
      m.default.createElement('p',{className:'focus-project-hint',role:'status','aria-live':'polite'},hint),
      m.default.createElement('button',{type:'button',className:'focus-project-reset',disabled:!!self.state.projectOrderSaving,onClick:function(){clearDrag();persist(function(){return window.FocusSettings.restoreSystemProjectOrder(v.default.shared.db)},null,false)}},translate('恢复系统清单默认排序'))),
    m.default.createElement(x.default,{classNames:[g.default.content],autoDisappear:!1,isUl:!0},
      this.state.presetProjects.map(function(item,index){return m.default.createElement(_.default,Object.assign({project:item,key:item.id,highlight:index%2==1,changeHiddenState:self.switchPresetProjectHiddenState,isDarkMode:self.props.isDarkMode},row(item,'presetProjects')))}),
      this.state.customProjects.map(function(item,index){return m.default.createElement(y.default,{project:item,key:item.id,highlight:index%2==1,delete:self.showDeleteDialog,changeHiddenState:self.switchProjectHiddenState})})),this.getConfirmDialog());
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
