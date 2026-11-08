import { useRef, useState } from 'react';
import type { Entity, CompatibleRecord } from '../../services/core.mjs';
import { Dialog } from './Dialog';
import { useWorkspace } from './Context';
import { ProjectEditor } from './Projects';
import { dateInput, number, ordered, projectName, string, timestamp } from './model';

export function TaskDetails({ task, projects, subtasks, close, onStart }: { task: Entity; projects: readonly Entity[]; subtasks: readonly Entity[]; close(): void; onStart(): void }) {
  const { services, text, run, queue, busy, blocked } = useWorkspace();
  // Keep the opened revision until explicitly reopened; remote refreshes must not erase a draft.
  const [base] = useState(task);
  const [draft, setDraft] = useState(() => ({ name: string(task.name), remark: string(task.remark), projectId: string(task.projectId),
    deadline: dateInput(task.deadline), reminder: dateInput(task.reminderDate, true), priority: number(task.priority),
    estimatePomoNum: number(task.estimatePomoNum), interval: number(task.pomodoroInterval) / 60,
    rCycle: number(task.rCycle) || 1, rUnit: number(task.rCycle) ? string(task.rUnit) : '', rValue: string(task.rValue), tags: string(task.tags) }));
  const savedBaseRef = useRef(base);
  const savedDraftRef = useRef(draft), draftRef = useRef(draft);
  const [pending,setPending]=useState(0),[saveFailed,setSaveFailed]=useState(false);
  const [subtaskName, setSubtaskName] = useState(''), [deleting, setDeleting] = useState(false), [preserve, setPreserve] = useState(true);
  const [editing, setEditing] = useState<Entity | null>(null), [editName, setEditName] = useState(''), [validation, setValidation] = useState('');
  const [createTag, setCreateTag] = useState(false);
  const drag = useState(() => ({ current: null as Entity | null }))[0];
  const set = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => { setValidation(''); draftRef.current={...draftRef.current,[key]:value};setDraft(draftRef.current); };
  const children = ordered(subtasks.filter(row => row.taskId === task.id && row.state === 0));
  const save = async (only?:string) => {
    const entered={...draftRef.current};
    const recurrence=['rCycle','rUnit','rValue','deadline'];
    if(entered.rUnit&&!entered.deadline){setValidation(text.repeatNeedsDate);return}
    const days=entered.rValue.split(',').map(value=>Number(value.trim()));
    if(entered.rUnit==='weeks'&&(!entered.rValue.trim()||!days.every(day=>Number.isInteger(day)&&day>=0&&day<=6))){setValidation(text.invalidWeekdays);return}
    const fields={name:'name',remark:'remark',projectId:'projectId',deadline:'deadline',reminder:'reminderDate',priority:'priority',estimatePomoNum:'estimatePomoNum',interval:'pomodoroInterval',tags:'tags'} as const;
    const keys=(only?[only]:Object.keys(entered)) as (keyof typeof entered)[];
    if(!keys.some(key=>entered[key]!==savedDraftRef.current[key]))return;
    setPending(n=>n+1);
    const success=await queue(async()=>{
      const savedBase=savedBaseRef.current,deadline=timestamp(entered.deadline,true),changes:CompatibleRecord={};
      const values:CompatibleRecord={...entered,name:entered.name.trim(),deadline,reminderDate:timestamp(entered.reminder),pomodoroInterval:entered.interval*60};
      for(const key of keys){const target=fields[key as keyof typeof fields];if(target&&entered[key]!==savedDraftRef.current[key])changes[target]=values[target]}
      if((!only||recurrence.includes(only))&&recurrence.some(key=>entered[key as keyof typeof entered]!==savedDraftRef.current[key as keyof typeof entered]))Object.assign(changes,{...(entered.deadline!==savedDraftRef.current.deadline?{deadline}:{}),rCycle:entered.rUnit?entered.rCycle:0,rUnit:entered.rUnit,rValue:entered.rUnit==='weeks'?[...new Set(days)].sort((a,b)=>a-b).join(','):'',rFirstDeadline:entered.rUnit?(deadline===savedBase.deadline&&savedBase.rFirstDeadline?savedBase.rFirstDeadline:deadline):0});
      if(!Object.keys(changes).length)return;
      savedBaseRef.current=await services.business.command({type:'updateTask',id:task.id,changes,expected:savedBase}) as Entity;
      for(const key of keys)(savedDraftRef.current as Record<string,unknown>)[key]=entered[key];
      if(!only||recurrence.includes(only))for(const key of recurrence)(savedDraftRef.current as Record<string,unknown>)[key]=entered[key as keyof typeof entered];
    });setPending(n=>n-1);setSaveFailed(!success);setValidation(success?text.saved:text.failed);
  };
  return <aside className="workspace-details" aria-label={text.details} data-pending={pending}>
    <header><h2>{text.details}</h2><button type="button" aria-label={text.close} onClick={close}>×</button></header>
    <form onSubmit={event=>{event.preventDefault();void save()}} onBlur={event=>{const target=event.target as unknown as HTMLInputElement;const key=target.dataset.field;if(key&&target.checkValidity())void save(key)}} onChange={event=>{const target=event.target as unknown as HTMLInputElement;if(target.dataset.field&&(target.tagName==='SELECT'||target.type==='checkbox'))void save(target.dataset.field)}}>
      <fieldset disabled={blocked || task.state !== 0}>
        <label>{text.name}<input data-field="name" required maxLength={1000} value={draft.name} onChange={event => set('name', event.target.value)} /></label>
        <label>{text.estimate}<input data-field="estimatePomoNum" type="number" required min={0} max={9999} step={1} value={draft.estimatePomoNum} onChange={event => set('estimatePomoNum', event.target.valueAsNumber)} /></label>
        <label>{text.interval}<input data-field="interval" type="number" required min={1} max={480} step="any" value={draft.interval} onChange={event => set('interval', event.target.valueAsNumber)} /></label>
        <label>{text.deadline}<input data-field="deadline" type="date" value={draft.deadline} onChange={event => set('deadline', event.target.value)} /></label>
        <label>{text.project}<select data-field="projectId" aria-label={text.project} value={draft.projectId} onChange={event => set('projectId', event.target.value)}><option value="">{text.none}</option>
          {projects.filter(row => [1000, 7005].includes(number(row.type)) && row.state === 0).map(row => <option key={row.id} value={row.id}>{projectName(row, text)}</option>)}</select></label>
        <label>{text.priority}<select data-field="priority" aria-label={text.priority} value={draft.priority} onChange={event => set('priority', Number(event.target.value))}>
          {[text.normal, text.low, text.medium, text.high].map((label, index) => <option key={index} value={index}>{label}</option>)}</select></label>
        <fieldset className="workspace-tags"><legend>{text.tags}</legend>{projects.filter(row => row.type === 3000 && row.state === 0).map(row => <label className="workspace-check" key={row.id}>
          <input data-field="tags" type="checkbox" checked={draft.tags.split(',').includes(row.id)} onChange={event => { const tags = draft.tags.split(',').filter(Boolean).filter(id => id !== row.id); if (event.target.checked) tags.push(row.id); set('tags', tags.join(',')); }} />{row.name}</label>)}
          <button type="button" onClick={event => { event.currentTarget.focus(); setCreateTag(true); }}>{text.createTag}</button></fieldset>
        <label>{text.reminder}<input data-field="reminder" type="datetime-local" value={draft.reminder} onChange={event => set('reminder', event.target.value)} /></label>
        <label>{text.repeat}<select data-field="rUnit" aria-label={text.repeat} value={draft.rUnit} onChange={event => {set('rUnit',event.target.value);if(event.target.value==='weeks'&&!draftRef.current.rValue)set('rValue',String(new Date().getDay()))}}><option value="">{text.none}</option>
          {(['days', 'weeks', 'months', 'years'] as const).map(unit => <option key={unit} value={unit}>{text[unit]}</option>)}</select></label>
        {draft.rUnit && <label>{text.cycle}<input data-field="rCycle" type="number" required min={1} max={10000} step={1} value={draft.rCycle} onChange={event => set('rCycle', event.target.valueAsNumber)} /></label>}
        {draft.rUnit==='weeks'&&<fieldset className="workspace-tags"><legend>{text.weekdays}</legend>{Array.from({length:7},(_,i)=><label key={i} className="workspace-check"><input data-field="rValue" type="checkbox" checked={draft.rValue.split(',').includes(String(i))} onChange={e=>{const days=draftRef.current.rValue.split(',').filter(Boolean).filter(day=>day!==String(i));if(e.target.checked)days.push(String(i));set('rValue',days.sort().join(','))}}/>{new Intl.DateTimeFormat(services.language.locale,{weekday:'short'}).format(new Date(2026,10,8+i))}</label>)}</fieldset>}
        <label className="workspace-note">{text.remark}<textarea data-field="remark" aria-label={text.remark} rows={3} value={draft.remark} onChange={event => set('remark', event.target.value)} /></label>
        {saveFailed&&<button className="primary" disabled={!draft.name.trim()||pending>0}>{text.save}</button>}
      </fieldset>
      {validation && <p role="status">{validation}</p>}
    </form>
    <section aria-label={text.subtasks}><h3>{text.subtasks}</h3>
      {children.map((row, index) => <div className="workspace-subtask" key={row.id} onDragOver={event => { if (drag.current) event.preventDefault(); }} onDrop={event => {
        event.preventDefault(); const from = drag.current; drag.current = null; if (!from || from.id === row.id) return;
        const peers = children.filter(child => child.id !== from.id), slot = peers.findIndex(child => child.id === row.id) + (children.findIndex(child => child.id === from.id) < index ? 1 : 0);
        peers.splice(slot,0,from);void run(()=>services.business.batch(peers.map((child,index)=>({type:'updateSubtask',id:child.id,changes:{order:(index+1)*10000},expected:child}))));
      }}>
        <button type="button" className="workspace-handle" aria-label={text.reorder + ': ' + row.name} draggable={!busy && !blocked} disabled={blocked} onDragStart={event => { drag.current = row; event.dataTransfer.setData('text/plain', row.id); }} onDragEnd={() => { drag.current = null; }}
          onKeyDown={event => {
            if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const direction = event.key === 'ArrowUp' ? -1 : 1, target = children[index + direction]; if (!target) return;
            const peers=children.filter(child=>child.id!==row.id);peers.splice(index+direction,0,row);void run(()=>services.business.batch(peers.map((child,index)=>({type:'updateSubtask',id:child.id,changes:{order:(index+1)*10000},expected:child}))));
          }}>⠿</button>
        <input type="checkbox" aria-label={text.toggleSubtask + ': ' + row.name} checked={!!row.isFinished} disabled={busy || blocked}
          onChange={() => { void run(() => services.business.command({ type: 'toggleSubtask', id: row.id, expected: row })); }} />
        <button type="button" className="workspace-task-name" aria-label={text.editSubtask + ': ' + row.name} onClick={event => { event.currentTarget.focus(); setEditing(row); setEditName(string(row.name)); }}>{row.name}</button>
        {!row.isFinished && !task.isFinished && <button type="button" aria-label={text.focusSubtask + ': ' + row.name} disabled={busy || blocked} onClick={async () => { if (await run(() => services.startForTask(task.id, row.id))) onStart(); }}>▷</button>}
        <button type="button" aria-label={text.deleteSubtask + ': ' + row.name} disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setEditing(row); setEditName(string(row.name)); setDeleting(true); }}>×</button>
      </div>)}
      <form onSubmit={async event => { event.preventDefault(); if (await run(() => services.business.command({ type: 'addSubtask', values: { name: subtaskName.trim(), taskId: task.id,
        order: Math.max(0, ...children.map(row => number(row.order))) + 10000 } }))) setSubtaskName(''); }}>
        <label className="workspace-sr" htmlFor="new-subtask">{text.addSubtask}</label><input id="new-subtask" placeholder={text.addSubtask} value={subtaskName} maxLength={1000} required disabled={busy || blocked} onChange={event => setSubtaskName(event.target.value)} />
      </form>
    </section>
    <footer><button type="button" className="danger" disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setEditing(null); setDeleting(true); }}>{text.remove}</button></footer>
    {(deleting || editing) && <Dialog title={deleting ? text.confirmDelete : text.editSubtask} close={() => { setDeleting(false); setEditing(null); }}>
      <form onSubmit={async event => {
        event.preventDefault();
        const command = editing ? deleting ? { type: 'removeSubtask' as const, id: editing.id, expected: editing }
          : { type: 'updateSubtask' as const, id: editing.id, changes: { name: editName.trim() }, expected: editing }
          : { type: 'removeTask' as const, id: task.id, preserveHistory: preserve, expected: task };
        if (await run(() => services.business.command(command))) { setDeleting(false); setEditing(null); if (!editing) close(); }
      }}>
        {deleting ? <><p>{editing ? text.deleteSubtask : text.deleteTaskHelp}</p><p>{editing?.name || task.name}</p>
          {!editing && <label className="workspace-check"><input type="checkbox" checked={preserve} onChange={event => setPreserve(event.target.checked)} />{text.preserveHistory}</label>}</>
          : <label>{text.name}<input autoFocus required maxLength={1000} value={editName} onChange={event => setEditName(event.target.value)} /></label>}
        <footer><button type="button" disabled={busy} onClick={() => { setDeleting(false); setEditing(null); }}>{text.cancel}</button><button disabled={busy || blocked} className={deleting ? 'danger' : 'primary'}>{deleting ? text.remove : text.save}</button></footer>
      </form>
    </Dialog>}
    {createTag && <ProjectEditor type={3000} projects={projects} close={() => setCreateTag(false)} />}
  </aside>;
}
