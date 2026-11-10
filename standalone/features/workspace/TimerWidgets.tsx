import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useWorkspace } from './Context';
import { number, ordered } from './model';
import type { Entity } from '../../services/core.mjs';
const images=import.meta.glob<string>('../../../public/img/{task*,folder-expanded-indicator,widget_empty}.png',{eager:true,query:'?url',import:'default'});
const image=(name:string)=>images['../../../public/img/'+name+'.png'];

/** Module 1052 uses jQuery's swing tween: 1500ms red, 1500ms pale. */
function RunningPomodoro() {
 const group=useRef<SVGGElement>(null);
 useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const start=performance.now();let frame:number;const tick=(now:number)=>{const phase=(now-start)%3000,reverse=phase>=1500,t=(phase%1500)/1500,ease=.5-Math.cos(t*Math.PI)/2,from=reverse?[253,85,83]:[255,204,203],to=reverse?[255,204,203]:[253,85,83];group.current?.setAttribute('fill','rgb('+from.map((v,i)=>Math.floor(v+(to[i]-v)*ease)).join(',')+')');frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[]);
 return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><g ref={group} transform="translate(0.915109,0.099819)" fill="#FFCCCB"><rect transform="translate(8.624379,3.486779) rotate(40) translate(-8.624379,-3.486779)" x="8.19580735" y="2.59535068" width="1" height="1.78285714" rx=".372670807"/><ellipse cx="5.13239397" cy="6.96857561" rx="4.71428571" ry="4.5"/><rect x="3.22213309" y=".418003627" width="3.42857143" height="1" rx=".5"/><rect x="4.51883371" y=".895228795" width="1" height="2.38857143" rx=".5"/><path d="M5.22992522,4.28962471 L5.43544254,6.69838201 C5.45739404,6.95566374 5.26662121,7.18202699 5.00933948,7.2039785 C4.99612059,7.20510635 4.98285969,7.20567104 4.96959277,7.20567104 C4.71948628,7.20567104 4.51673491,7.00291967 4.51673491,6.75281318 C4.51673491,6.73516748 4.51776627,6.71753687 4.51982369,6.70001152 L4.80359109,4.2828566 C4.81738991,4.16531706 4.92386068,4.0812186 5.04140021,4.09501742 C5.14248303,4.10688427 5.22127295,4.18821615 5.22992522,4.28962471 Z" fill="#FFF"/></g></svg>;
}

export function TimerTaskPomodoros({task,subtask,state}:{task:Entity;subtask?:Entity;state:string}) {
 const {services}=useWorkspace(),records=services.business.getSnapshot().records.filter(r=>r.state!==-1&&(subtask?r.subtaskId===subtask.id:r.taskId===task.id)),values=records.map(r=>Math.min(number(r.interval)/Math.max(1,number(r.pomodoroInterval)),1)),estimate=subtask?0:number(task.estimatePomoNum),limit=['work','pause'].includes(state)?4:5;
 if(estimate===0&&values.length<=limit||estimate<=5&&values.length<=Math.min(estimate,limit)){
  if(!estimate&&!values.length&&limit===5)return null;
  let remaining=Math.max(estimate-values.length,0);if(limit===4){if(state==='work'){values.push(-1);remaining=Math.max(remaining-1,0)}else if(!remaining)remaining=1;}
  while(remaining-->0)values.push(0);
  return <small className="timer-selected-pomos">{values.map((v,i)=>v===-1?<RunningPomodoro key={i}/>:<img key={i} draggable={false} src={image(v===0?'task-pomo-estimate':'task-pomo-actual'+(Math.floor(v*4)+1===5?'':(Math.floor(v*4)+1)*20))} alt=""/>)}</small>;
 }
 return <small className="timer-selected-pomos">{state==='work'?<RunningPomodoro/>:<img src={image('task-pomo-actual')} alt=""/>}{Number(values.reduce((a,b)=>a+b,0).toFixed(1))}{estimate>0&&<> / <img src={image('task-pomo-estimate')} alt=""/>{estimate}</>}</small>;
}

function TaskRow({row,parent}:{row:Entity;parent?:Entity}) {
 const {services,text,run,busy,blocked}=useWorkspace(),[finishing,setFinishing]=useState(false),[visual,setVisual]=useState<boolean|null>(null),timer=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>()=>timer.current.forEach(clearTimeout),[]);
 const finished=visual??!!row.isFinished,session=services.timer.getSnapshot(),running=session?.state==='work'&&(parent?session.subtaskId===row.id:session.taskId===row.id);
 const records=services.business.getSnapshot().records.filter(r=>r.state!==-1&&(parent?r.subtaskId===row.id:r.taskId===row.id)),values=records.map(r=>Math.min(number(r.interval)/Math.max(1,number(r.pomodoroInterval)),1)),estimate=parent?0:number(row.estimatePomoNum);
 const many=!(estimate===0&&values.length<=5||estimate<=5&&values.length<=estimate),icons=values.map(v=>v===0?'task-pomo-estimate':'task-pomo-actual'+(Math.floor(v*4)+1===5?'':(Math.floor(v*4)+1)*20));
 while(!many&&icons.length<estimate)icons.push('task-pomo-estimate');
 const complete=()=>{if(finishing||busy||blocked)return;setFinishing(true);const repeat=!parent&&number(row.rCycle)>0&&!finished;timer.current.push(setTimeout(()=>setVisual(!finished),repeat?250:0));timer.current.push(setTimeout(async()=>{await run(()=>services.business.command(parent?{type:'toggleSubtask',id:row.id,expected:row}:{type:row.isFinished?'uncompleteTask':'completeTask',id:row.id,expected:row}));setVisual(null);setFinishing(false)},repeat?500:250));};
 const priority=['no','low','medium','high'][number(row.priority)||0],completion=finished?'task_done_no_priority':`task_${number(row.rCycle)>0?'repeat_':''}${priority}_priority`;
 const children=parent?[]:ordered(services.business.getSnapshot().subtasks.filter(r=>r.taskId===row.id&&r.state===0));
 return <><li className={'timer-widget-task'+(parent?' is-subtask':'')} data-task-id={row.id} data-finished={finished}>
 {parent&&<span className="timer-widget-subline"/>}<button className="timer-widget-complete" aria-label={text.complete+': '+row.name} disabled={finishing||busy||blocked} onClick={complete} style={{backgroundImage:`url("${image(completion)}")`,transform:finishing&&number(row.rCycle)>0?'rotate(360deg)':undefined}}/>
 <button className="timer-widget-play" aria-label={text.focusTask+': '+row.name} disabled={finished||busy||blocked} onClick={()=>{void run(()=>services.startForTask(parent?.id||row.id,parent?row.id:undefined))}} style={{backgroundImage:`url("${image(finished?'task-start-disabled':running?'task-pomo-running':'task-start')}")`}}/>
 <div className="timer-widget-task-name"><span>{row.name}</span>{(estimate>0||values.length>0)&&<div className="timer-widget-pomos">{many?<><img src={image('task-pomo-actual')} alt=""/>{Number(values.reduce((a,b)=>a+b,0).toFixed(1))}{estimate>0&&<> / <img src={image('task-pomo-estimate')} alt=""/>{estimate}</>}</>:icons.map((icon,i)=><img key={i} src={image(icon)} alt=""/>)}</div>}</div>
 {!!children.length&&<button className="timer-widget-subtasks" aria-label={row.isExpanded?text.collapse:text.expand} aria-expanded={!!row.isExpanded} onClick={()=>{void run(()=>services.business.command({type:'updateTask',id:row.id,changes:{isExpanded:!row.isExpanded},expected:{isExpanded:row.isExpanded}}))}}/>}
 </li>{!!row.isExpanded&&children.map(child=><TaskRow key={child.id} row={child} parent={row}/>)}</>;
}

function History({now}:{now:number}) {
 const {services,text}=useWorkspace(),business=services.business.getSnapshot(),canvas=useRef<HTMLCanvasElement>(null),summary=useRef<HTMLCanvasElement>(null),scroll=useRef<HTMLDivElement>(null);
 const day=new Date(now);day.setHours(0,0,0,0);const lower=+day,upper=new Date(day).setDate(day.getDate()+1);
 const records=business.records.filter(r=>r.state!==-1&&number(r.endDate)>lower&&number(r.endDate)<=Math.min(upper,now)),contentX=useMemo(()=>{const ctx=document.createElement('canvas').getContext('2d')!;ctx.font="12px Helvetica,Tahoma,Arial,'Microsoft YaHei','微软雅黑',SimSun,Heiti,'黑体',sans-serif,STXihei,'华文细黑'";return Math.ceil(ctx.measureText('00:00').width)+4},[]);
 const color=(r:Entity)=>'#'+(business.projects.find(p=>p.id===business.tasks.find(t=>t.id===r.taskId)?.projectId)?.color||'AEBDC3');
 useLayoutEffect(()=>{
  for(const [el,height]of [[canvas.current,2900],[summary.current,8]] as const){if(!el)continue;el.width=290*devicePixelRatio;el.height=height*devicePixelRatio;const ctx=el.getContext('2d')!;ctx.scale(devicePixelRatio,devicePixelRatio);if(height===8){for(const r of records){ctx.fillStyle=color(r);ctx.fillRect(Math.max(0,(number(r.endDate)-number(r.interval)*1000-lower)/86400000)*290,0,number(r.interval)/86400*290,8)}continue;}
   ctx.font="12px Helvetica,Tahoma,Arial,'Microsoft YaHei','微软雅黑',SimSun,Heiti,'黑体',sans-serif,STXihei,'华文细黑'";const x=Math.ceil(ctx.measureText('00:00').width)+4;ctx.lineWidth=.5;const desc=services.settings.getSnapshot().isDarkMode?'#8f8f91':'#aeaeae';ctx.strokeStyle=desc+'4D';ctx.beginPath();for(let h=0;h<=24;h++){ctx.moveTo(x+16,h*120+10);ctx.lineTo(290,h*120+10)}ctx.stroke();ctx.textAlign='right';ctx.fillStyle=desc;ctx.textBaseline='middle';for(let h=0;h<=24;h++)ctx.fillText(String(h).padStart(2,'0')+':00',x-4,h*120+10);
   const y=120*(now-lower)/3600000+10;ctx.strokeStyle='#ff3333';ctx.beginPath();ctx.moveTo(x+16,y);ctx.lineTo(290,y);ctx.stroke();ctx.fillStyle='#ff3333';ctx.beginPath();ctx.arc(x+16,y,3,0,2*Math.PI);ctx.fill();el.dataset.nowY=String(y);
  }
 },[business,now,lower,services]);
 useEffect(()=>{const id=requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=120*Math.max(Math.ceil((now-lower)/3600000)-4,0)});return()=>cancelAnimationFrame(id)},[lower]);
 return <section data-widget-type={2} className="legacy-timer-history"><h3>{services.language.legacyText('tmr_today_detail').replaceAll("''","'")}</h3><div className="legacy-timer-history-summary"><canvas ref={summary}/></div><div ref={scroll} className="legacy-timer-history-hours" data-timer-scroll data-timer-scrollbar="hidden"><div className="timer-history-canvas-content"><canvas ref={canvas}/>{records.map(r=>{const start=Math.max(lower,number(r.endDate)-number(r.interval)*1000),seconds=(number(r.endDate)-start)/1000,task=business.tasks.find(t=>t.id===r.taskId),name=seconds>=480?(business.subtasks.find(t=>t.id===r.subtaskId)?.name||task?.name||text.noTask):'';return <div key={r.id} className="timer-history-record" style={{left:contentX+16,top:(start-lower)/30000+10,height:seconds/30,background:color(r)}}><span>{name}</span>{seconds>=480&&<span>{Math.floor(seconds/3600)>0&&services.language.legacyText('cmm_local_hour',Math.floor(seconds/3600))}{Math.floor(seconds/60)%60>0&&services.language.legacyText('cmm_local_minute',Math.floor(seconds/60)%60)}</span>}</div>})}</div></div></section>;
}

export function TimerWidgetCards() {
 const {services}=useWorkspace(),business=useSyncExternalStore(services.business.subscribe,services.business.getSnapshot),preferences=useSyncExternalStore(services.settings.subscribe,services.settings.getSnapshot),[now,setNow]=useState(Date.now());
 useEffect(()=>{const tick=()=>setNow(Date.now()),id=setInterval(tick,60000);window.addEventListener('focus',tick);return()=>{clearInterval(id);window.removeEventListener('focus',tick)}},[]);
 const day=new Date(now);day.setHours(0,0,0,0);const tomorrow=new Date(day);tomorrow.setDate(day.getDate()+1);
 const total=Math.round(services.business.report(+day,+tomorrow).time/60),hours=Math.floor(total/60),minutes=total%60;
 const project=business.projects.find(p=>p.type===4000),unfinished=[...services.business.tasksInView({id:'id-deadline-today',type:4000})];
 unfinished.sort((a,b)=>number(project?.orderingRule)===2?number(b.priority)-number(a.priority)||number(a.order)-number(b.order):number(project?.orderingRule)===0?number(a.order)-number(b.order):(number(b.deadline)-number(a.deadline)||number(a.order)-number(b.order)));
 const finished=business.tasks.filter(t=>t.state===0&&t.isFinished&&number(t.finishedDate)>=+day&&number(t.finishedDate)<+tomorrow).sort((a,b)=>number(a.finishedDate)-number(b.finishedDate)),tasks=[...unfinished,...finished];
 const cards:Record<number,React.ReactNode>={0:<section key={0} data-widget-type={0}><h3>{services.language.legacyText('rpt_time_today')}</h3><p>{hours>0&&<><strong>{hours}</strong><small>{services.language.legacyText('cmm_local_hour','')}</small></>}{(minutes>0||hours===0)&&<><strong>{minutes}</strong><small>{services.language.legacyText('cmm_local_minute','')}</small></>}</p></section>,1:<section key={1} data-widget-type={1} className="legacy-timer-today"><h3>{services.language.legacyText('prj_today')}</h3>{tasks.length?<div className="timer-widget-task-scroll" data-timer-scroll><ul>{tasks.map(row=><TaskRow row={row} key={row.id}/>)}</ul></div>:<div className="legacy-timer-widget-empty"><img draggable={false} src={image('widget_empty')} alt=""/><p>{services.language.legacyText('pomo_no_task')}</p></div>}</section>,2:<History key={2} now={now}/>};
 return <>{preferences.visibleWidgets.map(type=>cards[type])}</>;
}
