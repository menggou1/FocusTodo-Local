import { useState, useSyncExternalStore } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { Dialog } from './Dialog';
import { localInput } from './Dates';
import { number, string } from './model';

export function RecordEditor({ kind, row, start = Date.now(), taskId = '', close }: {kind:'schedule'|'record';row?:Entity; start?:number;taskId?:string;close():void}) {
  const { services, text, run, busy, blocked } = useWorkspace(), t = (zh:string,en:string) => services.language.locale.startsWith('zh') ? zh : en;
  const data = useSyncExternalStore(services.business.subscribe, services.business.getSnapshot), prefs = services.settings.getSnapshot();
  const [base] = useState(row), [selected, setSelected] = useState(string(row?.taskId) || taskId), [child, setChild] = useState(string(row?.subtaskId));
  const [begin, setBegin] = useState(localInput(row ? number(row.endDate)-number(row.interval)*1000 : start));
  const [minutes, setMinutes] = useState(row ? number(row.interval)/60 : prefs.workInterval/60), [pomo, setPomo] = useState(row ? number(row.pomodoroInterval || row.interval)/60 : prefs.workInterval/60);
  const [newTask, setNewTask] = useState(kind==='schedule' && !row && !taskId), [name, setName] = useState(''), [count,setCount] = useState(1), [project,setProject] = useState('id-task-tasks');
  const [deleting,setDeleting] = useState(false), [copy,setCopy] = useState(false), [allDay,setAllDay] = useState(!!row?.isAllDay);
  return <Dialog title={deleting ? text.confirmDelete : kind==='schedule' ? t('安排专注','Schedule focus') : t('专注记录','Focus record')} close={close}>
    <form onSubmit={async event=>{
      event.preventDefault();
      const at = begin === localInput(base ? number(base.endDate)-number(base.interval)*1000 : start) && base ? number(base.endDate)-number(base.interval)*1000 : +new Date(begin);
      const changes={taskId:selected,subtaskId:child,endDate:at+minutes*60000,interval:minutes*60,...(kind==='record'?{pomodoroInterval:pomo*60}:{isAllDay:allDay})};
      const success=await run(async()=>{
        if(deleting && base) await services.business.command({type:kind==='schedule'?'removeSchedule':'removeRecord',id:base.id,expected:base});
        else if(newTask && kind==='schedule' && !base) await services.calendar.createTask({name:name.trim(),count,interval:minutes*60,startTime:at,projectId:project,shortBreak:prefs.shortBreakInterval,addToTop:prefs.newTaskOnTop});
        else if(base && !copy) {
          if(kind==='schedule') await services.calendar.put({...base,...changes},base);
          else await services.business.command({type:'updateRecord',id:base.id,changes,expected:base});
        } else await services.business.command({type:kind==='schedule'?'addSchedule':'addRecord',values:copy&&base?{...Object.fromEntries(Object.entries(base).filter(([key])=>key!=='id')),...changes}:changes});
      });if(success)close();
    }}>
      {deleting ? <p>{text.confirmDelete} — {data.tasks.find(task=>task.id===base?.taskId)?.name || text.noTask}</p> : <>
        {kind==='schedule'&&!base&&<label className="workspace-check"><input type="checkbox" checked={newTask} onChange={e=>setNewTask(e.target.checked)}/>{t('同时创建任务','Create a task')}</label>}
        {newTask ? <><label>{text.name}<input required maxLength={1000} value={name} onChange={e=>setName(e.target.value)}/></label><label>{text.project}<select aria-label={text.project} value={project} onChange={e=>setProject(e.target.value)}>{data.projects.filter(p=>p.state===0&&[1000,7005].includes(number(p.type))).map(p=><option key={p.id} value={p.id}>{p.type===7005?text.tasks:p.name}</option>)}</select></label><label>{text.estimate}<input type="number" min={1} max={100} required value={count} onChange={e=>setCount(e.target.valueAsNumber)}/></label></>
          : <><label>{text.tasks}<select aria-label={text.tasks} value={selected} onChange={e=>{setSelected(e.target.value);setChild('')}}><option value="">{text.noTask}</option>{data.tasks.filter(task=>task.state===0).map(task=><option key={task.id} value={task.id}>{task.name}</option>)}</select></label><label>{text.subtasks}<select aria-label={text.subtasks} value={child} onChange={e=>setChild(e.target.value)}><option value="">{text.none}</option>{data.subtasks.filter(s=>s.taskId===selected&&s.state===0).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></>}
        <label>{t('开始时间','Start time')}<input type="datetime-local" step="0.001" required value={begin} onChange={e=>setBegin(e.target.value)}/></label>
        <label>{t('时长（分钟）','Duration (minutes)')}<input type="number" required min={1/60} max={480} step="any" value={minutes} onChange={e=>setMinutes(e.target.valueAsNumber)}/></label>
        {kind==='record'?<label>{text.interval}<input type="number" required min={1} max={480} step="any" value={pomo} onChange={e=>setPomo(e.target.valueAsNumber)}/></label>:<label className="workspace-check"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/>{t('全天','All day')}</label>}
      </>}
      <footer>{base&&!deleting&&<><button type="button" className="danger" onClick={()=>setDeleting(true)}>{text.remove}</button>{kind==='schedule'&&<button type="button" aria-pressed={copy} onClick={()=>setCopy(!copy)}>{t('复制','Duplicate')}</button>}</>}<button type="button" onClick={close} disabled={busy}>{text.cancel}</button><button className={deleting?'danger':'primary'} disabled={busy||blocked}>{deleting?text.remove:text.save}</button></footer>
    </form>
  </Dialog>;
}
