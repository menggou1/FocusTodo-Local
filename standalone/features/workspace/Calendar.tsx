import { useRef, useState, useSyncExternalStore } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { range, shift, stamp } from './Dates';
import { RecordEditor } from './RecordEditor';
import { dateInput, number } from './model';

export function Calendar({startTask,openTask}:{startTask(id:string,child?:string):void;openTask(id:string):void}) {
  const {services,text,run,busy,blocked}=useWorkspace(),t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const snapshot=useSyncExternalStore(services.business.subscribe,services.business.getSnapshot);
  const [mode,setMode]=useState<'day'|'week'|'month'>('day'),[date,setDate]=useState(Date.now()),[pane,setPane]=useState(true),[showFocus,setShowFocus]=useState(true);
  const [editor,setEditor]=useState<{row?:Entity;start?:number;taskId?:string;kind:'schedule'|'record'}|null>(null);
  const dragged=useRef<{row:Entity;type:string}|null>(null);
  const period=range(date,mode), first=mode==='month'?range(period.start,'week').start:period.start, dayCount=mode==='month'?42:mode==='week'?7:1;
  const days=Array.from({length:dayCount},(_,i)=>shift(first,i,'day')),last=shift(days.at(-1)!,1,'day');
  const events=services.calendar.events(first,last).filter(row=>showFocus||row.type==='schedule');
  const eventTitle=(row:Entity)=>snapshot.tasks.find(task=>task.id===row.taskId)?.name||text.noTask;
  async function drop(at:number) {
    const input=dragged.current;dragged.current=null;if(!input)return;
    if(input.type==='task'){setEditor({kind:'schedule',taskId:input.row.id,start:at});return}
    if(input.type==='schedule')await run(()=>services.calendar.put({...input.row,endDate:at+number(input.row.interval)*1000},input.row));
  }
  return <section className="domain-calendar" data-testid="calendar-page">
    <div className="domain-toolbar"><button onClick={()=>setDate(Date.now())}>{text.today}</button><button aria-label={t('上一期','Previous period')} onClick={()=>setDate(shift(date,-1,mode))}>‹</button><input aria-label={t('日程日期','Schedule date')} type="date" value={dateInput(date)} onChange={e=>{const value=+new Date(e.target.value+'T12:00');if(e.target.value&&Number.isFinite(value))setDate(value)}}/><button aria-label={t('下一期','Next period')} onClick={()=>setDate(shift(date,1,mode))}>›</button>
      <select aria-label={t('日程视图','Schedule view')} value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>{(['day','week','month'] as const).map((p,i)=><option key={p} value={p}>{[t('日','Day'),t('周','Week'),t('月','Month')][i]}</option>)}</select>
      <button onClick={()=>setEditor({kind:'schedule',start:date})}>{t('新建安排','New schedule')}</button><button aria-pressed={pane} onClick={()=>setPane(!pane)}>{text.tasks}</button><label><input type="checkbox" checked={showFocus} onChange={e=>setShowFocus(e.target.checked)}/>{t('显示专注记录','Show focus records')}</label></div>
    <div className="domain-calendar-layout"><div className={'domain-calendar-grid '+mode} style={{gridTemplateColumns:`repeat(${mode==='month'?7:dayCount},minmax(0,1fr))`}}>
      {days.map(day=>{
        const end=shift(day,1,'day'),rows=events.filter(row=>row.start<end&&row.end>day);
        return <section key={day} className="domain-calendar-day" data-date={dateInput(day)}><h3><button onClick={()=>{setDate(day);setMode('day')}}>{new Date(day).toLocaleDateString(services.language.locale,{month:'short',day:'numeric',weekday:'short'})}</button></h3>
          {mode==='month'?<><button aria-label={t('在此日创建安排','Schedule this day')+' '+dateInput(day)} className="domain-day-add" onClick={()=>setEditor({kind:'schedule',start:day+9*3600000})}>＋</button>{rows.map(event=><button key={event.id} className="domain-month-event" onClick={()=>setEditor({kind:event.type==='schedule'?'schedule':'record',row:event.record as Entity})}>{new Date(event.start).toLocaleTimeString(services.language.locale,{hour:'2-digit',minute:'2-digit'})} {eventTitle(event.record as Entity)}</button>)}</>
            : <div className="domain-hours">{Array.from({length:48},(_,slot)=>{const at=new Date(day);at.setHours(Math.floor(slot/2),(slot%2)*30,0,0);return <button key={slot} className="domain-time-slot" aria-label={t('新建安排','New schedule')+' '+dateInput(day)+' '+String(Math.floor(slot/2)).padStart(2,'0')+':'+(slot%2?'30':'00')} onClick={()=>setEditor({kind:'schedule',start:+at})} onDragOver={e=>{if(dragged.current)e.preventDefault()}} onDrop={e=>{e.preventDefault();void drop(+at)}}>{slot%2===0?String(slot/2).padStart(2,'0')+':00':''}</button>})}
              {services.calendar.layoutEvents(rows,day,end,1).map((layout)=>{
                const event=layout.event as typeof rows[number],start=new Date(Math.max(day,event.start)),wall=start.getHours()*60+start.getMinutes(),endDate=new Date(Math.min(end,event.end));
                const height=Math.max(22,Math.min(1440-wall,(event.end>=end?1440:endDate.getHours()*60+endDate.getMinutes())-wall>0?(event.end>=end?1440:endDate.getHours()*60+endDate.getMinutes())-wall:(event.end-event.start)/60000));
                return <div key={event.id} className={'domain-time-event '+event.type} style={{top:wall,height,left:`calc(40px + ${(number(layout.column)/number(layout.columns))*75}%)`,width:`${75/number(layout.columns)}%`}} draggable={event.type==='schedule'&&!busy&&!blocked} onDragStart={e=>{dragged.current={row:event.record as Entity,type:event.type};e.dataTransfer.setData('text/plain',event.id)}} onDragEnd={()=>{dragged.current=null}}>
                  <button title={stamp(event.start,services.language.locale)+' – '+stamp(event.end,services.language.locale)} onClick={()=>setEditor({kind:event.type==='schedule'?'schedule':'record',row:event.record as Entity})}>{eventTitle(event.record as Entity)}<small>{stamp(event.start,services.language.locale)}</small></button>
                  {event.type==='schedule'&&<button aria-label={text.start+': '+eventTitle(event.record as Entity)} disabled={busy||blocked} onClick={()=>startTask(String(event.record.taskId),String(event.record.subtaskId||''))}>▷</button>}
                  {event.type==='schedule'&&<button className="domain-event-resize" aria-label={t('调整安排时长','Resize schedule')} disabled={busy||blocked} onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.dataset.start=String(e.clientY)}} onPointerUp={e=>{e.stopPropagation();const startY=Number(e.currentTarget.dataset.start);if(!Number.isFinite(startY))return;const minutes=Math.max(1,Math.min(480,number(event.record.interval)/60+Math.round((e.clientY-startY)/5)*5));void run(()=>services.calendar.put({...event.record,interval:minutes*60,endDate:event.start+minutes*60000},event.record))}} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const seconds=Math.max(60,Math.min(28800,number(event.record.interval)+(e.key==='ArrowUp'?-300:300)));void run(()=>services.calendar.put({...event.record,interval:seconds,endDate:event.start+seconds*1000},event.record))}}}>↕</button>}
                </div>;
              })}
            </div>}
        </section>;
      })}
    </div>{pane&&<aside className="domain-calendar-tasks"><h3>{text.tasks}</h3>{snapshot.tasks.filter(row=>row.state===0&&!row.isFinished).map(row=><div key={row.id} draggable onDragStart={e=>{dragged.current={row,type:'task'};e.dataTransfer.setData('text/plain',row.id)}} onDragEnd={()=>{dragged.current=null}}><button onClick={()=>openTask(row.id)}>{row.name}</button><button aria-label={t('安排任务','Schedule task')+': '+row.name} onClick={()=>setEditor({kind:'schedule',taskId:row.id,start:date})}>＋</button></div>)}</aside>}</div>
    {editor&&<RecordEditor {...editor} close={()=>setEditor(null)}/>}
  </section>;
}
