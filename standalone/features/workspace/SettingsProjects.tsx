import { ConfirmDialog } from './ConfirmDialog';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { ProjectIcon } from './ProjectIcon';
import { useRowMotion } from './useRowMotion';
import { expected, number, projectName } from './model';

/** Settings only reorders system lists. Custom lists keep their workspace order. */
export function SettingsProjects({projects}:{projects:readonly Entity[]}) {
 const {services,text,run,queue,busy,blocked}=useWorkspace(),lt=(s:string)=>services.language.text(s) as string;
 const root=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null),cleanup=useRef<()=>void>(()=>{});
 const captureMotion=useRowMotion(scroll,'[data-project-group=presetProjects]','data-project-id');
 const [saving,setSaving]=useState(false),[remove,setRemove]=useState<Entity|null>(null);
 const systemLists=(rows:readonly Entity[])=>rows.filter(p=>p.state!==-1&&number(p.type)>=4000&&![4000,7002,7005].includes(number(p.type)));
 const presets=systemLists(projects);
 const custom=projects.filter(p=>p.state!==-1&&p.type===1000);
 const rows=()=>Array.from(root.current?.querySelectorAll<HTMLElement>('[data-project-group=presetProjects]')||[]);
 const legacyNames:Record<number,string>={4001:'prj_tomorrow',4002:'prj_upcoming',4003:'prj_someday',4004:'prj_next7days',4006:'prj_overdue',4007:'prj_week',5001:'tsk_priority_low',5002:'tsk_priority_middle',5003:'tsk_priority_high',7000:'prj_all',7001:'prj_calendar',7003:'prj_history'};
 const label=(row:Entity)=>legacyNames[number(row.type)]?services.language.legacyText(legacyNames[number(row.type)]):projectName(row,text);
 useEffect(()=>()=>cleanup.current(),[]);
 async function persist(from?:string,to?:string,snapshot=presets.map(p=>({id:p.id,order:number(p.order)}))){
  if(saving||busy||blocked)return;
  cleanup.current();const discard=captureMotion(from||'',undefined,true);setSaving(true);
  try{await run(()=>services.business.command(from&&to?{type:'reorderProjects',from,to,snapshot}:{type:'restoreProjectOrder'}))}
  finally{setSaving(false);requestAnimationFrame(discard)}
 }
 function moveByKey(id:string,direction:number) {
  void queue(async()=>{
   const current=systemLists(services.business.getSnapshot().projects),index=current.findIndex(row=>row.id===id);
   const target=index<0?undefined:current[index+direction];
   if(!target)return;
   const discard=captureMotion(id,undefined,true);
   try{await services.business.command({type:'reorderProjects',from:id,to:target.id,snapshot:current.map(row=>({id:row.id,order:number(row.order)}))})}
   catch(error){discard();throw error}
  });
 }
 function start(event:PointerEvent<HTMLDivElement>,project:Entity){
  if(event.button!==0||saving||busy||blocked||(event.target as Element).closest('input,label'))return;
  event.preventDefault();cleanup.current();const source=event.currentTarget,rect=source.getBoundingClientRect(),x=event.clientX,y=event.clientY,pointerId=event.pointerId;
  (source.querySelector('button')||source).focus({preventScroll:true});source.setPointerCapture(pointerId);
  const snapshot=presets.map(p=>({id:p.id,order:number(p.order)}));let ghost:HTMLElement|null=null,target='';
  const clear=()=>{ghost?.remove();delete source.dataset.dragging;delete root.current?.dataset.dragGroup;rows().forEach(e=>delete e.dataset.dropPosition);if(source.hasPointerCapture(pointerId))source.releasePointerCapture(pointerId);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',cancel);window.removeEventListener('blur',cancel);cleanup.current=()=>{}};
  const move=(e:globalThis.PointerEvent)=>{
   if(!ghost&&Math.hypot(e.clientX-x,e.clientY-y)<5)return;e.preventDefault();
   if(!ghost){ghost=source.cloneNode(true) as HTMLElement;ghost.removeAttribute('data-project-id');ghost.classList.add('legacy-project-drag-preview');ghost.setAttribute('aria-hidden','true');ghost.inert=true;Object.assign(ghost.style,{width:rect.width+'px',height:rect.height+'px',left:rect.left+'px',top:rect.top+'px',font:getComputedStyle(source).font});root.current!.append(ghost);source.dataset.dragging='true';root.current!.dataset.dragGroup='presetProjects'}
   ghost.style.transform=`translateY(${e.clientY-y}px)`;rows().forEach(e=>delete e.dataset.dropPosition);target='';
   const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-project-group=presetProjects]');
   if(hit&&root.current?.contains(hit)&&hit!==source){target=hit.dataset.projectId!;hit.dataset.dropPosition=presets.findIndex(p=>p.id===project.id)<presets.findIndex(p=>p.id===target)?'after':'before'}
  };
  const end=(e:globalThis.PointerEvent)=>{e.preventDefault();const active=!!ghost,to=target;clear();if(active&&to)void persist(project.id,to,snapshot)};
  const cancel=(e:Event)=>{if(e.type!=='keydown'||(e as KeyboardEvent).key==='Escape'){if(e.type==='keydown'){e.preventDefault();e.stopPropagation()}clear()}};
  cleanup.current=clear;window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',cancel);window.addEventListener('blur',cancel);
 }
 return <div ref={root} className="legacy-settings-projects" aria-busy={saving||undefined}>
  <header className="legacy-settings-project-toolbar"><p role="status">{lt('拖动三条杠或使用上下方向键调整系统清单。自定义清单请在主界面排序。')}</p><button disabled={saving||busy||blocked} onClick={()=>void persist()}>{lt('恢复默认排序')}</button></header>
  <div className="legacy-settings-project-scroll"><div className="legacy-settings-project-rows" ref={scroll}>
   {[...presets,...custom].map(row=>{const preset=presets.includes(row);return <div key={row.id} className="legacy-settings-project-row" data-project-id={row.id} data-project-group={preset?'presetProjects':'customProjects'} data-hidden={row.state!==0||undefined} tabIndex={preset?0:undefined} onPointerDown={preset?e=>start(e,row):undefined} onKeyDown={e=>{if(!preset||blocked||!['ArrowUp','ArrowDown'].includes(e.key)||(e.target as HTMLElement).closest('input,label'))return;e.preventDefault();moveByKey(row.id,e.key==='ArrowUp'?-1:1)}}>
    {preset&&<span className="legacy-settings-handle-cell"><button className="legacy-settings-project-handle" aria-label={lt('拖动或使用上下方向键排序')} aria-disabled={blocked||undefined}><i/><i/><i/></button></span>}
    <ProjectIcon type={number(row.type)} color={String(row.color||'')}/><span className="legacy-settings-project-name">{label(row)}</span>
    {preset?<label className="legacy-settings-project-toggle"><input className="legacy-switch" type="checkbox" aria-label={text.visible+': '+label(row)} checked={row.state===0} disabled={saving||busy||blocked} onChange={e=>void run(()=>services.business.command({type:'setProjectHidden',id:row.id,hidden:!e.target.checked,expected:expected(row,['state'])}))}/></label>:<><button className="legacy-settings-project-visibility" data-hidden={row.state!==0||undefined} aria-label={text.visible+': '+row.name} disabled={saving||busy||blocked} onClick={()=>void run(()=>services.business.command({type:'setProjectHidden',id:row.id,hidden:row.state===0,expected:expected(row,['state'])}))}/><button className="legacy-settings-project-delete" aria-label={text.remove+': '+row.name} disabled={saving||busy||blocked} onClick={()=>setRemove(row)}/></>}
   </div>})}
  </div></div>
  {remove&&<SettingsProjectDelete row={remove} close={()=>setRemove(null)}/>}
 </div>;
}

function SettingsProjectDelete({row,close}:{row:Entity;close():void}){
 const {services,text,run,busy,blocked}=useWorkspace();
 return <ConfirmDialog className="legacy-settings-project-delete-dialog" title={services.language.legacyText('prj_del_title',row.name)} message={services.language.legacyText('prj_del_prompt')} canClose={!busy} close={close}>{dismiss=><><button disabled={busy} onClick={dismiss}>{text.cancel}</button><button className="primary" disabled={busy||blocked} onClick={async()=>{if(await run(()=>services.business.command({type:'removeProject',id:row.id,expected:row})))dismiss()}}>{services.language.legacyText('cmm_ok')}</button></>}</ConfirmDialog>;
}
