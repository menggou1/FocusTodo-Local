import { formatCompactDuration as durationLabel, formatClock } from '../../domain/display.mjs';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { Entity } from '../../services/core.mjs';
import { confirmInApp } from '../../services/confirmation';
import { useWorkspace } from './Context';
import { range, shift, stamp } from './Dates';
import { RecordEditor } from './RecordEditor';
import { dateInput, number, projectName } from './model';
import { PickerField } from './PickerField';
import { DatePicker } from './Pickers';
import { ProjectIcon } from './ProjectIcon';
import { TimerTaskPomodoros } from './TimerWidgets';
import { useWindowClose } from './Dialog';
import { SettingsSelect } from './SoundSettings';

// Time slots keep their own click and gesture behavior. Workspace controls and
// portaled surfaces handle their own clicks, including their scrollbars.
const calendarInteraction = [
  '.legacy-record-inspector', '.legacy-calendar-pane', '.legacy-calendar-menu-layer',
  '.legacy-scroll-track', '[data-app-interaction-root]', 'dialog',
  'button', 'a[href]', 'input', 'select', 'textarea', 'label', 'details',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])',
].join(',');

type CalendarEvent={id:string;type:string;start:number;end:number;record:Entity};
type TimeRange={start:number;end:number};
type Preview=TimeRange & {title?:string;task?:Entity};
type EventEdit=TimeRange & {event:CalendarEvent;pointer?:{x:number;y:number}};
type Editor={row?:Entity;start?:number;interval?:number;quick?:boolean;anchored?:boolean;kind:'schedule'|'record'};


/** Pointer previews remain local; services receive only the final committed gesture. */
export function Calendar({startTask}:{startTask(id:string,child?:string):void;openTask(id:string):void}) {
  const {services,text,run,busy,blocked}=useWorkspace(),t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const snapshot=useSyncExternalStore(services.business.subscribe,services.business.getSnapshot);
  const [mode,setMode]=useState<'day'|'week'|'month'>('day'),[date,setDate]=useState(Date.now()),[now,setNow]=useState(Date.now());
  const [pane,setPane]=useState(false),[paneProject,setPaneProject]=useState('id-deadline-today'),[editor,setEditor]=useState<Editor|null>(null);
  const [paneMounted,setPaneMounted]=useState(false);
  const [taskGhost,setTaskGhost]=useState<{row:Entity;x:number;y:number;seconds:number;start?:number;invalid:boolean}|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null),[menu,setMenu]=useState<{event:CalendarEvent;x:number;y:number}|null>(null);
  const [edit,setEdit]=useState<EventEdit|null>(null);
  const [added,setAdded]=useState<CalendarEvent|null>(null);
  const root=useRef<HTMLElement>(null),scroll=useRef<HTMLDivElement>(null),gesture=useRef<(()=>void)|null>(null),suppressClick=useRef(0),pendingMonthEvent=useRef<CalendarEvent|null>(null);
  const period=range(date,mode),first=mode==='month'?range(period.start,'week').start:period.start;
  const dayCount=mode==='month'?Math.ceil(Math.round((shift(period.start,1,'month')-first)/86400000)/7)*7:mode==='week'?7:1;
  const days=Array.from({length:dayCount},(_,i)=>shift(first,i,'day')),last=shift(days.at(-1)!,1,'day');
  const events=useMemo(()=>services.calendar.events(first,last) as CalendarEvent[],[services,snapshot,first,last]);
  const hourHeight=mode==='day'?124:64,today=range(now).start,dual=mode==='day'&&range(date).start<=today;
  const tasksById=useMemo(()=>new Map(snapshot.tasks.map(row=>[row.id,row])),[snapshot.tasks]);
  const projectsById=useMemo(()=>new Map(snapshot.projects.map(row=>[row.id,row])),[snapshot.projects]);
  const subtasksById=useMemo(()=>new Map(snapshot.subtasks.map(row=>[row.id,row])),[snapshot.subtasks]);
  const paneView=snapshot.projects.find(project=>project.id===paneProject);
  const paneProjects=useMemo(()=>snapshot.projects.filter(project=>project.state===0&&![7001,7003,7002].includes(number(project.type))),[snapshot.projects]);
  const paneOptions=useMemo(()=>paneProjects.filter(row=>!row.parentId||!paneProjects.some(parent=>parent.id===row.parentId&&parent.type===2000))
    .flatMap(row=>row.type===2000?[row,...paneProjects.filter(child=>child.parentId===row.id)]:[row]),[paneProjects]);
  const paneTasks=useMemo(()=>{
    if(!paneMounted||!paneView)return [];
    const descendants=new Set<string>();
    function collect(id:string){
      if(descendants.has(id))return;
      descendants.add(id);
      paneProjects.filter(row=>row.parentId===id).forEach(row=>collect(row.id));
    }
    if(paneView.type===2000)collect(paneView.id);
    const tasks=paneView.type===2000?snapshot.tasks.filter(row=>row.state===0&&descendants.has(String(row.projectId)))
      :paneView.type===3000?snapshot.tasks.filter(row=>row.state===0&&String(row.tags||'').split(',').includes(paneView.id))
      :services.business.tasksInView({id:paneView.id,type:number(paneView.type)});
    return tasks.filter(row=>!row.isFinished).sort((a,b)=>a.order!==undefined&&b.order!==undefined&&a.order!==b.order?number(a.order)-number(b.order):number(a.creationDate)-number(b.creationDate));
  },[paneMounted,paneView,paneProjects,snapshot,services,today]);
  useEffect(()=>{if(!paneOptions.some(row=>row.id===paneProject))setPaneProject(paneOptions[0]?.id||'')},[snapshot.projects,paneProject]);
  const eventTitle=(row:Entity)=>String(subtasksById.get(String(row.subtaskId))?.name||tasksById.get(String(row.taskId))?.name||services.language.text('未指定任务'));
  const time=(at:number)=>formatClock(at);
  const timeRange=({start,end}:TimeRange)=>time(start)+'–'+(range(start).start===range(end).start?'':dateInput(end).slice(5)+' ')+time(end);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000),refresh=()=>setNow(Date.now());window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);gesture.current?.()}},[]);
  useEffect(()=>{const el=scroll.current;if(el)el.scrollTop=Number(sessionStorage.getItem('FocusTodo.calendarScroll'))||0},[mode]);
  useEffect(()=>{if(!pane)root.current?.querySelectorAll<HTMLDetailsElement>('.legacy-calendar-list-picker').forEach(field=>field.open=false)},[pane]);
  const previousPeriod=useRef({date,mode});
  useEffect(()=>{if(previousPeriod.current.date===date&&previousPeriod.current.mode===mode)return;previousPeriod.current={date,mode};setEditor(pendingMonthEvent.current?{kind:pendingMonthEvent.current.type==='schedule'?'schedule':'record',row:pendingMonthEvent.current.record}:null);pendingMonthEvent.current=null;setPreview(null);setMenu(null);gesture.current?.()},[date,mode]);
  const closeEditor=useCallback(()=>{setEditor(null);setPreview(null)},[]);
  const inspecting=!!editor?.row;
  useEffect(()=>{
    if(!inspecting&&!pane)return;
    function dismissOnBlank(event:MouseEvent){
      const target=event.target;
      if(!(target instanceof Element)||event.defaultPrevented||suppressClick.current>performance.now())return;
      if(target.closest(calendarInteraction))return;
      if(inspecting)closeEditor();
      if(pane)setPane(false);
    }
    document.addEventListener('click',dismissOnBlank);
    return()=>document.removeEventListener('click',dismissOnBlank);
  },[inspecting,pane,closeEditor]);
  function blank(){if(suppressClick.current>performance.now()){suppressClick.current=0;return}closeEditor();setPane(false);setMenu(null)}
  function quick(start:number,end:number,anchored=false){setPane(false);setMenu(null);setPreview({start,end});setEditor({kind:'schedule',start,interval:(end-start)/1000,quick:true,anchored})}
  function inspect(event:CalendarEvent){if(suppressClick.current>performance.now()){suppressClick.current=0;return}setPane(false);setPreview(null);setMenu(null);setEditor({kind:event.type==='schedule'?'schedule':'record',row:event.record})}
  function point(x:number,y:number,planned=true,inside=false){
    const viewport=scroll.current?.getBoundingClientRect();
    if(!viewport)return null;
    if(inside&&(x<viewport.left||x>=viewport.right||y<viewport.top||y>=viewport.bottom||
      document.elementFromPoint(x,y)?.closest('.legacy-calendar-pane')))return null;
    for(const column of root.current?.querySelectorAll<HTMLElement>('.domain-calendar-grid:not(.month)>.domain-calendar-day')||[]){
      const rect=column.getBoundingClientRect();
      if(x<rect.left||x>=rect.right)continue;
      if(planned&&dual&&x>rect.left+rect.width/2)return null;
      const minutes=Math.max(0,Math.min(1439,Math.round((y-rect.top)/rect.height*1440)));
      const at=new Date(column.dataset.date+'T00:00');at.setMinutes(minutes);return +at;
    }
    return null;
  }
  function track(event:ReactPointerEvent,move:(e:PointerEvent)=>void,up:()=>void){
    gesture.current?.();const id=event.pointerId;
    let lastPointer:PointerEvent|null=null,frame=0;
    const update=()=>{frame=0;if(lastPointer)move(lastPointer)};
    const onScroll=()=>{if(lastPointer&&!frame)frame=requestAnimationFrame(update)};
    const cleanup=()=>{
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onPointerCancel);document.removeEventListener('keydown',onKey);
      document.removeEventListener('scroll',onScroll,true);window.removeEventListener('blur',onCancel);gesture.current=null;
    };
    const onMove=(e:PointerEvent)=>{if(e.pointerId===id){lastPointer=e;onScroll()}};
    const onUp=(e:PointerEvent)=>{if(e.pointerId===id){cleanup();move(e);up()}};
    const onCancel=()=>{cleanup();setPreview(null);setTaskGhost(null);setEdit(value=>value?.pointer?null:value)};
    const onPointerCancel=(e:PointerEvent)=>{if(e.pointerId===id)onCancel()};
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onCancel()}};
    document.addEventListener('pointermove',onMove);document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onPointerCancel);document.addEventListener('keydown',onKey);
    document.addEventListener('scroll',onScroll,true);window.addEventListener('blur',onCancel);gesture.current=onCancel;
  }
  function suppressGestureClick(){suppressClick.current=performance.now()+250;setTimeout(()=>{suppressClick.current=0},0)}
  function selectRange(e:ReactPointerEvent){if(e.button!==0||busy||blocked)return;const start=point(e.clientX,e.clientY);if(start===null)return;let selection:TimeRange|null=null;
    track(e,event=>{if(Math.abs(event.clientY-e.clientY)<4&&!selection)return;const end=point(event.clientX,event.clientY);if(end===null)return;const begin=Math.min(start,end);selection={start:begin,end:Math.min(begin+28800000,Math.max(begin+60000,start,end))};setPreview(selection)},()=>{if(!selection)return;suppressGestureClick();quick(selection.start,selection.end,true)});
  }
  function dragEvent(e:ReactPointerEvent,event:CalendarEvent,day:number,resize=false){
    if(e.button!==0||event.type!=='schedule'||busy||blocked||edit)return;
    const origin=point(e.clientX,e.clientY,false);if(origin===null)return;
    const card=e.currentTarget.closest<HTMLElement>('.domain-time-event')!;
    e.preventDefault();e.stopPropagation();
    let latest:EventEdit|null=null,paintedDelta:number|null=null,moved=false;
    track(e,p=>{
      if(!moved&&Math.abs(p.clientY-e.clientY)<4&&Math.abs(p.clientX-e.clientX)<4)return;
      moved=true;
      const position=point(p.clientX,p.clientY,true,true);
      if(position===null){
        if(latest){latest=null;setEdit(null)}
        return;
      }
      if(paintedDelta===null){
        // A new gesture can catch a card partway through its CSS rollback.
        const bounds=card.getBoundingClientRect(),axis=card.parentElement!.getBoundingClientRect();
        const pixelsPerMinute=axis.height/1440;
        const painted=resize?bounds.height:bounds.top-axis.top;
        const target=parseFloat(resize?card.style.height:card.style.top)*pixelsPerMinute/(hourHeight/60);
        paintedDelta=Math.round((painted-target)/pixelsPerMinute)*60000+(resize?0:range(origin).start-day);
      }
      const delta=position-origin+paintedDelta,start=resize?event.start:event.start+delta;
      const end=resize?Math.max(start+60000,Math.min(start+28800000,event.end+delta)):start+event.end-event.start;
      latest={event,start,end,pointer:{x:p.clientX,y:p.clientY}};setEdit(latest);
    },async()=>{
      if(!moved)return;
      suppressGestureClick();
      if(!latest)return;
      closeEditor();setMenu(null);
      const {start,end}=latest,pending={event,start,end};
      setEdit(pending);
      const saved=await run(()=>services.calendar.put({...event.record,endDate:end,interval:(end-start)/1000},event.record));
      // Resolve a rollback against saved data, even if the conflicting tab's broadcast has not arrived.
      if(!saved)await services.business.refresh().catch(()=>{});
      setEdit(current=>current===pending?null:current);
    });
  }
  function dragTask(e:ReactPointerEvent,row:Entity){
    if(e.button!==0||busy||blocked||edit&&!edit.pointer)return;
    const seconds=number(row.pomodoroInterval)||services.settings.getSnapshot().workInterval;
    let moved=false,latest:Preview|null=null;
    track(e,p=>{
      if(!moved&&Math.abs(p.clientY-e.clientY)<4&&Math.abs(p.clientX-e.clientX)<4)return;
      moved=true;
      const start=point(p.clientX,p.clientY,true,true);
      latest=start===null?null:{start,end:start+seconds*1000,title:String(row.name),task:row};
      const target=document.elementFromPoint(p.clientX,p.clientY);
      setTaskGhost({row,x:p.clientX,y:p.clientY,seconds,start:latest?.start,invalid:!latest&&!target?.closest('.legacy-calendar-pane')});
      setPreview(latest);
    },async()=>{
      if(!moved)return;
      suppressGestureClick();setTaskGhost(null);
      const placement=latest;if(!placement)return;
      let committed:CalendarEvent|null=null;
      await run(()=>services.business.command({type:'addSchedule',values:{taskId:row.id,subtaskId:'',projectId:row.projectId,interval:seconds,endDate:placement.end,isAllDay:false}},result=>{
        if(Array.isArray(result)||typeof result.id!=='string')return;
        // The command exposes the new id after commit, before publishing the snapshot.
        committed={id:result.id,type:'schedule',record:{...result,id:result.id},start:placement.start,end:placement.end};
        setAdded(committed);setPreview(current=>current===placement?null:current);
      }));
      setPreview(current=>current===placement?null:current);
      setAdded(current=>current===committed?null:current);
    });
  }
  async function removeCalendarRow(row: Entity, kind: Editor['kind']) {
    const scheduled = kind === 'schedule';
    const title = scheduled ? '删除此日程？' : '删除此专注记录？';
    const message = scheduled ? '此操作会移除该日程安排，相关任务和专注记录会保留。' : '此操作会移除此专注记录，关联任务会保留。';
    if (!await confirmInApp(services.language.text(title), services.language.text(message), text.remove)) return;
    const type = scheduled ? 'removeSchedule' : 'removeRecord';
    if (await run(() => services.business.command({type, id: row.id, expected: row}))) closeEditor();
  }
  function action(remove:boolean){
    const event=menu?.event;
    if(!event)return;
    if(remove){void removeCalendarRow(event.record, 'schedule');return}
    const {id,...values}=event.record;void id;
    void run(()=>services.business.command({type:'addSchedule',values:{...values,endDate:event.end+(number(event.record.interval)+services.settings.getSnapshot().shortBreakInterval)*1000}}));
  }
  function context(e:React.MouseEvent,event:CalendarEvent){e.preventDefault();e.stopPropagation();if(event.type==='schedule')setMenu({event,x:e.clientX,y:e.clientY})}
  const cardAccent=(task?:Entity)=>'#'+String(projectsById.get(String(task?.projectId))?.color||'4670F6').replace('#','');
  const editedId=edit?.event.id;
  const visibleEvents=edit?[...events.filter(event=>event.id!==editedId||event.type!=='schedule'),{...edit.event,start:edit.start,end:edit.end}]
    :added&&!events.some(event=>event.id===added.id)?[...events,added]:events;
  const eventNode=(event:CalendarEvent,day:number,dayIndex:number,column:number,columns:number,side?:'schedule'|'focus',draft=false)=>{
    const clippedStart=Math.max(day,event.start),start=new Date(clippedStart),wall=start.getHours()*60+start.getMinutes();
    const height=Math.max(18,(Math.min(shift(day,1,'day'),event.end)-clippedStart)/60000*hourHeight/60);
    const task=draft?preview?.task:tasksById.get(String(event.record.taskId)),color=cardAccent(task);
    const title=draft?preview?.title||services.language.text('未指定任务'):eventTitle(event.record);
    const lane=side?50:100,part=lane/columns,gutter=(12+(columns-1)*4)/columns;
    const offset=(side==='focus'?50:0)+column*part,border=dayIndex===dayCount-1?0:1;
    const changing=event.type==='schedule'&&event.id===editedId;
    const segment=day===Math.max(first,range(event.start).start)?'start':day;
    return <div key={mode+':'+first+':'+event.type+':'+event.id+':'+segment} role={draft?undefined:'button'} tabIndex={draft?undefined:0}
      aria-label={draft?undefined:title} className={'domain-time-event '+event.type+(draft?' legacy-calendar-selection':'')}
      data-event-id={event.id} data-calendar-quick-draft={draft&&editor?.quick||undefined} data-calendar-edit={changing?(edit?.pointer?'dragging':'saving'):undefined}
      style={{top:wall*hourHeight/60,height,left:'calc('+((dayIndex+offset/100)/dayCount*100)+'% + '+(6+column*(4-gutter)-offset*border/100)+'px)',
        width:'calc('+(part/dayCount)+'% - '+(gutter+part*border/100)+'px)','--calendar-card-accent':color,
        background:event.type==='focus'?(mode==='day'?color:color+'8c'):undefined,borderColor:event.type==='focus'?color:undefined} as CSSProperties}
      onPointerDown={e=>{if(!draft&&!(e.target as Element).closest('button'))dragEvent(e,event,day)}}
      onClick={e=>{e.stopPropagation();if(!draft)inspect(event)}}
      onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();inspect(event)}}}
      onContextMenu={e=>context(e,event)} title={title+'\n'+stamp(event.start,services.language.locale)+' – '+stamp(event.end,services.language.locale)}>
      <div className="legacy-event-title"><span>{title}</span><small>{event.type==='focus'&&mode==='day'?durationLabel((event.end-event.start)/1000):timeRange(event)}</small></div>
      {event.type==='schedule'&&!draft&&mode==='day'&&<>
        <button className="legacy-event-start" aria-label={text.start+': '+title} disabled={busy||blocked||changing||!!task?.isFinished||!!subtasksById.get(String(event.record.subtaskId))?.isFinished} onClick={e=>{e.stopPropagation();startTask(String(event.record.taskId),String(event.record.subtaskId||''))}}>▶</button>
        <button className="domain-event-resize" aria-label={t('调整安排时长','Resize schedule')} disabled={busy||blocked||changing&&!edit?.pointer} onPointerDown={e=>dragEvent(e,event,day,true)} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const seconds=Math.max(60,Math.min(28800,number(event.record.interval)+(e.key==='ArrowUp'?-300:300)));void run(()=>services.calendar.put({...event.record,interval:seconds,endDate:event.start+seconds*1000},event.record))}}}>─</button>
      </>}
    </div>;
  };
  function timedEvents(day:number,dayIndex:number){
    const end=shift(day,1,'day'),rows=visibleEvents.filter(row=>row.start<end&&row.end>day&&!row.record.isAllDay);
    const layout=(type?:'schedule'|'focus')=>services.calendar.layoutEvents(type?rows.filter(row=>row.type===type):rows,day,end,hourHeight/60)
      .map(({event,column,columns})=>eventNode(event as CalendarEvent,day,dayIndex,number(column),number(columns),type));
    const draft=preview&&preview.start<end&&preview.end>day?{id:'calendar-preview',type:'schedule',start:preview.start,end:preview.end,record:{id:'calendar-preview'}}:null;
    return [...(dual?[...layout('schedule'),...layout('focus')]:layout()),
      draft&&eventNode(draft,day,dayIndex,0,1,dual?'schedule':undefined,true)];
  }
  const dateLabel=mode==='day'?dateInput(date):dateInput(date).slice(0,7);
  return <section ref={root} className={'domain-calendar legacy-calendar '+mode+(!dual&&mode==='day'?' single':'')+(editor?.row?' has-inspector':'')} data-testid="calendar-page" data-pane-open={pane} style={{'--legacy-hour-height':hourHeight+'px'} as CSSProperties}>
    <div className="legacy-calendar-main"><div className="legacy-calendar-toolbar"><div className="legacy-calendar-navigation"><button onClick={()=>setDate(Date.now())}>{services.language.text('回到今天')}</button><button aria-label={t('上一期','Previous period')} onClick={()=>setDate(shift(date,-1,mode))}>‹</button><button aria-label={t('下一期','Next period')} onClick={()=>setDate(shift(date,1,mode))}>›</button><PickerField className="legacy-calendar-date"><summary><span>{dateLabel}</span><span className="legacy-date-caret"/></summary><div className="legacy-detail-popover legacy-calendar-date-popover"><DatePicker value={dateInput(date)} allowPast shortcutHidden actionsHidden calendar cancel={()=>{}} confirm={value=>{if(value)setDate(+new Date(value+'T12:00'));root.current?.querySelectorAll<HTMLDetailsElement>('.legacy-calendar-date').forEach(el=>el.open=false)}}/></div></PickerField></div><div className="legacy-calendar-actions"><SettingsSelect searchable={false} aria-label={t('日程视图','Schedule view')} value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>{(['day','week','month'] as const).map((p,i)=><option key={p} value={p}>{[t('日','Day'),t('周','Week'),t('月','Month')][i]}</option>)}</SettingsSelect></div></div>
    <div className="legacy-calendar-body">
      {mode==='day'&&<h2 className="legacy-calendar-day-title"><span>{range(date).start===today?text.today:new Date(date).toLocaleDateString(services.language.locale,{month:'short',day:'numeric'})} {new Date(date).toLocaleDateString(services.language.locale,{weekday:'long'})}</span></h2>}
      {mode==='month'?<><div className="legacy-calendar-weekdays">{Array.from({length:7},(_,i)=><span key={i}>{new Date(shift(range(date,'week').start,i,'day')).toLocaleDateString(services.language.locale,{weekday:'short'})}</span>)}</div><div className="legacy-month-scroll"><div className="domain-calendar-grid month">{days.map(day=>{const rows=events.filter(row=>row.start<shift(day,1,'day')&&row.end>day);return <section key={day} className="domain-calendar-day" data-date={dateInput(day)} data-other-month={new Date(day).getMonth()!==new Date(date).getMonth()||undefined} onClick={()=>{setDate(day);setMode('day')}}><button className="legacy-month-day-number" data-today={day===today||undefined}>{new Date(day).getDate()}</button><div className="legacy-month-events">{rows.slice(0,3).map(event=><button key={event.id} className={'domain-month-event '+event.type} onClick={e=>{e.stopPropagation();pendingMonthEvent.current=event;setDate(day);setMode('day')}} style={(()=>{const task=snapshot.tasks.find(row=>row.id===event.record.taskId),project=snapshot.projects.find(row=>row.id===task?.projectId),color='#'+String(project?.color||'4670F6').replace('#','');return{background:color+(event.type==='focus'?'8c':'2e'),borderColor:color,color:event.type==='focus'?'#fff':undefined}})()}>{!event.record.isAllDay&&<small>{time(event.start)}</small>}<span>{eventTitle(event.record)}</span></button>)}{rows.length>3&&<span className="legacy-month-more">+{rows.length-3}</span>}</div></section>})}</div></div></>:
      <>{events.some(event=>event.record.isAllDay)&&<div className="legacy-calendar-all-day"><span>{t('全天','All day')}</span><div style={{gridTemplateColumns:`repeat(${dayCount},minmax(0,1fr))`}}>{days.map(day=><div key={day}>{events.filter(event=>event.record.isAllDay&&event.start<shift(day,1,'day')&&event.end>day).map(event=><button key={event.id} onClick={()=>inspect(event)}>{eventTitle(event.record)}</button>)}</div>)}</div></div>}{(mode==='week'||dual)&&<div className={'legacy-calendar-columns '+mode}>{mode==='day'?<><span>{t('已安排','Scheduled')}</span><span>{t('已完成','Completed')}</span></>:days.map(day=><button key={day} onClick={()=>{setDate(day);setMode('day')}}><strong>{String(new Date(day).getDate()).padStart(2,'0')}</strong><small>{new Date(day).toLocaleDateString(services.language.locale,{weekday:'short'})}</small></button>)}</div>}<div ref={scroll} className="legacy-calendar-scroll" onScroll={e=>sessionStorage.setItem('FocusTodo.calendarScroll',String(e.currentTarget.scrollTop))}><div className="legacy-calendar-time-ruler">{Array.from({length:23},(_,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}:00</span></div>)}</div><div className={'domain-calendar-grid '+mode} style={{gridTemplateColumns:`repeat(${dayCount},minmax(0,1fr))`}}>{days.map(day=><section key={day} className="domain-calendar-day" data-date={dateInput(day)}><div className="domain-hours" onPointerDown={e=>{if((e.target as Element).closest('.domain-time-slot'))selectRange(e)}} onClick={e=>{if((e.target as Element).closest('.domain-time-slot'))blank()}} onDoubleClick={e=>{if(!(e.target as Element).closest('.domain-time-slot'))return;const pos=point(e.clientX,e.clientY);if(pos!==null)quick(pos,pos+services.settings.getSnapshot().workInterval*1000)}}>
        {Array.from({length:48},(_,slot)=><button key={slot} className="domain-time-slot" aria-label={t('新建安排','New schedule')+' '+dateInput(day)+' '+String(Math.floor(slot/2)).padStart(2,'0')+':'+(slot%2?'30':'00')}/>)}
        {day===today&&<div className="legacy-calendar-now" style={{top:(new Date(now).getHours()*60+new Date(now).getMinutes()+new Date(now).getSeconds()/60)*hourHeight/60}}/>}
      </div></section>)}{days.flatMap(timedEvents)}</div></div></>}
    </div></div>
    <div className="legacy-calendar-pane" id="calendar-task-panel" inert={!pane}>{paneMounted&&<aside className="domain-calendar-tasks"><header><PickerField className="legacy-calendar-list-picker" align="start" fitViewport restoreFocusOnEscape><summary><span>{paneView?projectName(paneView,text):text.today}</span><i className="legacy-date-caret"/></summary><div className="legacy-detail-popover legacy-calendar-project-menu" role="listbox" aria-label={text.project}>{paneOptions.map(project=><button type="button" key={project.id} style={{paddingLeft:project.parentId?32:16}} role="option" aria-selected={project.id===paneProject} onClick={()=>{setPaneProject(project.id);root.current?.querySelectorAll<HTMLDetailsElement>('.legacy-calendar-list-picker').forEach(el=>el.open=false)}}><>{project.parentId&&<i className="legacy-calendar-folder-indicator" style={{backgroundColor:'#'+String(paneProjects.find(row=>row.id===project.parentId)?.color||'aeaeae')}}/>}<ProjectIcon type={number(project.type)} color={String(project.color||'')}/></><span>{projectName(project,text)}</span>{project.id===paneProject&&<i className="legacy-option-check"/>}</button>)}</div></PickerField></header><div className="legacy-calendar-task-viewport"><div className="legacy-calendar-task-list" data-local-scroll tabIndex={0} role="region" aria-label={t('可安排的任务','Tasks to schedule')}>{paneTasks.map(row=><div className="legacy-calendar-task" key={row.id} onPointerDown={e=>dragTask(e,row)} draggable={false}><span className="legacy-calendar-task-name">{String(row.name)}</span><TimerTaskPomodoros task={row} state="idle"/></div>)}</div></div></aside>}</div>
    <button type="button" className="legacy-calendar-pane-toggle" aria-label={pane?t('收起任务面板','Hide task panel'):t('显示任务面板','Show task panel')}
      aria-expanded={pane} aria-controls="calendar-task-panel" onClick={()=>{closeEditor();setPaneMounted(true);setPane(value=>!value)}}>
      <span className="legacy-calendar-pane-glyph" aria-hidden="true"/>
    </button>
    {edit?.pointer&&createPortal(<span className="legacy-calendar-drag-time" style={{
      left:Math.max(90,Math.min(innerWidth-90,edit.pointer.x)),top:edit.pointer.y<48?edit.pointer.y+34:edit.pointer.y-12
    }}>{timeRange(edit)}</span>,document.body)}
    {taskGhost&&createPortal(<div data-app-interaction-root className="legacy-calendar-task-drag"
      data-placement={taskGhost.start!==undefined?'allowed':taskGhost.invalid?'invalid':'unplaced'}
      style={{left:Math.max(8,Math.min(innerWidth-288,taskGhost.x+14)),top:Math.max(8,Math.min(innerHeight-96,taskGhost.y+12)),
        '--calendar-card-accent':cardAccent(taskGhost.row)} as CSSProperties}>
      <strong>{String(taskGhost.row.name)}</strong>
      <div><span>{t('时长','Duration')} {durationLabel(taskGhost.seconds)}</span>
        <span>{taskGhost.start!==undefined?t('开始','Starts')+' '+time(taskGhost.start):taskGhost.invalid?t('无法放置','Cannot place here'):t('未安排','Unplaced')}</span></div>
      {number(taskGhost.row.estimatePomoNum)>1&&<small>{number(taskGhost.row.estimatePomoNum)} × {durationLabel(taskGhost.seconds)} ≈ {durationLabel(number(taskGhost.row.estimatePomoNum)*taskGhost.seconds)}</small>}
    </div>,document.body)}
    {editor&&<RecordEditor key={editor.row?.id||String(editor.start)} {...editor} inspector close={closeEditor} removeRow={removeCalendarRow} previewChange={(title,seconds)=>setPreview(value=>value?{...value,title,end:value.start+seconds*1000}:value)}/>}
    {menu&&<CalendarContextMenu key={menu.event.id+':'+menu.x+':'+menu.y} x={menu.x} y={menu.y} close={()=>setMenu(null)} choose={action}/>}

  </section>;
}


function CalendarContextMenu({x,y,close,choose}:{x:number;y:number;close():void;choose(remove:boolean):void}){
 const {services,text,busy,blocked}=useWorkspace(),{close:dismiss,motion}=useWindowClose(close),leaving=motion==='legacy-window-exit';
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();dismiss()}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[dismiss]);
 const flipX=x+190>innerWidth-4,flipY=y+64>innerHeight-4;
 return <div className="legacy-calendar-menu-layer" onPointerDown={dismiss} onContextMenu={e=>{e.preventDefault();dismiss()}}><div data-app-interaction-root className={'legacy-calendar-context '+motion} role="menu" style={{left:Math.max(4,flipX?x-190:x),top:Math.max(4,flipY?y-64:y),transformOrigin:(flipX?'right':'left')+' '+(flipY?'bottom':'top')}} onPointerDown={e=>e.stopPropagation()}><button role="menuitem" disabled={busy||blocked||leaving} onClick={()=>{dismiss();choose(false)}}>{services.language.locale.startsWith('zh')?'复制':'Duplicate'}</button><button role="menuitem" disabled={busy||blocked||leaving} onClick={()=>{dismiss();choose(true)}}>{text.remove}</button></div></div>;
}
