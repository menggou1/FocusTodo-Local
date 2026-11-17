import { formatDateTime } from '../../domain/display.mjs';
import { PickerField } from './PickerField';
import { useEffect, useRef, useState } from 'react';
import type { Entity, CompatibleRecord } from '../../services/core.mjs';
import { ConfirmDialog } from './ConfirmDialog';
import { TaskDeleteDialog } from './TaskDeleteDialog';
import { useWorkspace } from './Context';
import { ProjectEditor } from './Projects';
import { LegacyIcon } from './LegacyIcon';
import { RecordEditor } from './RecordEditor';
import { PomodoroPicker, DatePicker, RepeatPicker, TagsPicker } from './Pickers';
import { ProjectIcon } from './ProjectIcon';
import { deadlineChanges } from '../../domain/task-edits.mjs';
import { dateInput, number, ordered, projectName, string, timestamp } from './model';
import repeatNoPriority from '../../../public/img/task_repeat_no_priority.png';
import repeatLow from '../../../public/img/task_repeat_low_priority.png';
import repeatMedium from '../../../public/img/task_repeat_medium_priority.png';
import repeatHigh from '../../../public/img/task_repeat_high_priority.png';
import taskNo from '../../../public/img/task_no_priority.png';
import taskDone from '../../../public/img/task_done_no_priority.png';
import { formatTaskDate } from './TaskGroups';
import { SubtaskName } from './SubtaskName';

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
  const [selectedSubtask,selectSubtask]=useState('');
  const [editing, setEditing] = useState<Entity | null>(null), [validation, setValidation] = useState('');
  const [createTag, setCreateTag] = useState(false);
  const [createRecord,setCreateRecord]=useState(false),[pickerVersion,setPickerVersion]=useState(0);
  const drag = useState(() => ({ current: null as Entity | null }))[0];
  const chinese=services.language.locale.startsWith('zh');
  const repeatIcon=[repeatNoPriority,repeatLow,repeatMedium,repeatHigh][number(task.priority)]||repeatNoPriority;
  const reminderValue=(value:string)=>value?formatDateTime(+new Date(value),services.language.locale):text.none;
  useEffect(()=>{const reset=(event:Event)=>{const element=event.target as HTMLDetailsElement;if(element.open&&element.closest('.workspace-details'))setPickerVersion(value=>value+1)};document.addEventListener('toggle',reset,true);return()=>document.removeEventListener('toggle',reset,true)},[]);
  const closeFields=()=>{document.querySelectorAll<HTMLDetailsElement>('.workspace-details details[open]').forEach(element=>element.open=false)};
  const dueLabel=!draft.deadline?text.someday:formatTaskDate(new Date(draft.deadline.length===10?draft.deadline+'T12:00':draft.deadline).getTime(),services.language.locale);
  const set = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => { setValidation(''); draftRef.current={...draftRef.current,[key]:value};setDraft(draftRef.current); };
  useEffect(()=>{const remote={name:string(task.name),remark:string(task.remark),projectId:string(task.projectId),deadline:dateInput(task.deadline),reminder:dateInput(task.reminderDate,true),priority:number(task.priority),estimatePomoNum:number(task.estimatePomoNum),interval:number(task.pomodoroInterval)/60,rCycle:number(task.rCycle)||1,rUnit:number(task.rCycle)?string(task.rUnit):'',rValue:string(task.rValue),tags:string(task.tags)};const current=draftRef.current,saved=savedDraftRef.current,next={...current},nextSaved={...saved};const preserve:Record<string,unknown>={};const fields:Record<string,string>={interval:'pomodoroInterval',reminder:'reminderDate'};for(const key of Object.keys(remote) as (keyof typeof remote)[]){if(current[key]===saved[key]){Object.assign(next,{[key]:remote[key]});Object.assign(nextSaved,{[key]:remote[key]})}else preserve[fields[key]||key]=savedBaseRef.current[fields[key]||key]}savedBaseRef.current={...task,...preserve};draftRef.current=next;savedDraftRef.current=nextSaved;setDraft(next)},[task]);
  const children = ordered(subtasks.filter(row => row.taskId === task.id && row.state === 0));
  const note=useRef<HTMLTextAreaElement>(null);
  const resizeNote=()=>{const el=note.current;if(!el)return;el.style.height='auto';el.style.height=Math.max(165,el.scrollHeight)+'px'};
  useEffect(()=>{resizeNote()},[draft.remark]);
  useEffect(()=>{const el=note.current;if(!el)return;const forward=(event:WheelEvent)=>{if(el.scrollHeight>el.clientHeight+1)return;const scroller=el.closest('.workspace-details-info') as HTMLElement|null;if(!scroller)return;event.preventDefault();scroller.scrollTop+=event.deltaY};el.addEventListener('wheel',forward,{passive:false});return()=>el.removeEventListener('wheel',forward)},[]);
  const save = async (only?:string) => {
    const entered={...draftRef.current};
    const recurrence=['rCycle','rUnit','rValue'];
    if((!only||recurrence.includes(only))&&entered.rUnit&&!entered.deadline){setValidation(text.repeatNeedsDate);return}
    const days=entered.rValue.split(',').map(value=>Number(value.trim()));
    if((!only||recurrence.includes(only))&&entered.rUnit==='weeks'&&(!entered.rValue.trim()||!days.every(day=>Number.isInteger(day)&&day>=1&&day<=7))){setValidation(text.invalidWeekdays);return}
    const fields={name:'name',remark:'remark',projectId:'projectId',deadline:'deadline',reminder:'reminderDate',priority:'priority',estimatePomoNum:'estimatePomoNum',interval:'pomodoroInterval',tags:'tags'} as const;
    const keys=(only?[only]:Object.keys(entered)) as (keyof typeof entered)[];
    if(!keys.some(key=>entered[key]!==savedDraftRef.current[key]))return;
    setPending(n=>n+1);
    const success=await queue(async()=>{
      const savedBase=savedBaseRef.current,deadline=timestamp(entered.deadline,true),changes:CompatibleRecord={};
      const values:CompatibleRecord={...entered,name:entered.name.trim(),deadline,reminderDate:timestamp(entered.reminder),pomodoroInterval:entered.interval*60};
      for(const key of keys){const target=fields[key as keyof typeof fields];if(target&&entered[key]!==savedDraftRef.current[key])changes[target]=values[target]}
      if((!only||only==='deadline')&&entered.deadline!==savedDraftRef.current.deadline)Object.assign(changes,deadlineChanges(savedBase,deadline));
      if((!only||recurrence.includes(only))&&recurrence.some(key=>entered[key as keyof typeof entered]!==savedDraftRef.current[key as keyof typeof entered]))Object.assign(changes,{...(entered.deadline!==savedDraftRef.current.deadline?{deadline}:{}),rCycle:entered.rUnit?entered.rCycle:0,rUnit:entered.rUnit,rValue:entered.rUnit==='weeks'?[...new Set(days)].sort((a,b)=>a-b).join(','):'',rFirstDeadline:entered.rUnit?(deadline===savedBase.deadline&&savedBase.rFirstDeadline?savedBase.rFirstDeadline:deadline):0});
      if(!Object.keys(changes).length)return;
      savedBaseRef.current=await services.business.command({type:'updateTask',id:task.id,changes,expected:savedBase}) as Entity;
      if('rCycle' in changes&&changes.rCycle===0){draftRef.current={...draftRef.current,rCycle:1,rUnit:'',rValue:''};savedDraftRef.current={...savedDraftRef.current,rCycle:1,rUnit:'',rValue:''};setDraft(draftRef.current)}
      for(const key of keys)(savedDraftRef.current as Record<string,unknown>)[key]=entered[key];
      if(!only||recurrence.includes(only))for(const key of recurrence)(savedDraftRef.current as Record<string,unknown>)[key]=entered[key as keyof typeof entered];
    });setPending(n=>n-1);setSaveFailed(!success);setValidation(success?text.saved:text.failed);
  };
  const nextRepeatLabel=()=>{if(!draft.rUnit)return null;const base=number(task.deadline)||number(task.rFirstDeadline)||Date.now();const date=new Date(base);const cycle=Math.max(1,Math.round(number(draft.rCycle)||1));
    if(draft.rUnit==='days')date.setDate(date.getDate()+cycle);
    else if(draft.rUnit==='weeks'){const w=date.getDay()||7;const days=draft.rValue.split(',').filter(Boolean).map(Number).filter(d=>d>=1&&d<=7).sort((a,b)=>a-b);if(!days.length)return null;let best=null;for(const d of days){const offset=((d-w)+7)%7||7;if(!best||offset<best.offset)best={offset,d}}date.setDate(date.getDate()+(best?.offset||7)+(cycle-1)*7)}
    else if(draft.rUnit==='months')date.setMonth(date.getMonth()+cycle);
    else date.setFullYear(date.getFullYear()+cycle);
    const zh=chinese,now=new Date(),start=new Date(now);start.setHours(0,0,0,0);const tomorrow=new Date(start);tomorrow.setDate(tomorrow.getDate()+1);const d0=new Date(date);d0.setHours(0,0,0,0);
    if(d0.getTime()===start.getTime())return zh?'今天':'Today';if(d0.getTime()===tomorrow.getTime())return zh?'明天':'Tomorrow';
    const weekdays=zh?['日','一','二','三','四','五','六']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];const label=formatTaskDate(+date,services.language.locale);return zh?`${label} 周${weekdays[date.getDay()]}`:`${weekdays[date.getDay()]}, ${label}`};
  const repeatLabel=(unit:string,cycle:number,value:string)=>{if(!unit)return text.none;const zh=chinese;const labels=zh?['一','二','三','四','五','六','日']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    if(unit==='days')return cycle===1?(zh?'每天':'Every day'):`${zh?'每':'Every '}${cycle}${zh?'天':' days'}`;
    if(unit==='weeks'){const days=value.split(',').filter(Boolean).map(Number).sort((a,b)=>a-b);return `${zh?'每周':'Every week'}${days.length?` ${days.map(d=>labels[(d+6)%7]).join(zh?'、':', ')}`:''}`}
    if(unit==='months')return cycle===1?(zh?'每月':'Every month'):`${zh?'每':'Every '}${cycle}${zh?'个月':' months'}`;
    return cycle===1?(zh?'每年':'Every year'):`${zh?'每':'Every '}${cycle}${zh?'年':' years'}`};
  return <aside className="workspace-details" aria-label={text.details} data-pending={pending}>
    <div className="workspace-details-content"><div className="workspace-details-info">
    <form onSubmit={event=>{event.preventDefault();void save()}} onBlur={event=>{const target=event.target as unknown as HTMLInputElement;const key=target.dataset.field;if(key&&target.checkValidity())void save(key)}} onChange={event=>{const target=event.target as unknown as HTMLInputElement;if(target.dataset.field&&(target.tagName==='SELECT'||target.type==='checkbox'))void save(target.dataset.field)}}>
      <fieldset disabled={blocked || task.state !== 0}>
        <div className="legacy-detail-title"><input className="legacy-complete" style={{backgroundImage:`url(${number(task.rCycle)>0?repeatIcon:task.isFinished?taskDone:taskNo})`}} type="checkbox" aria-label={(task.isFinished?text.undo:text.complete)+': '+task.name} checked={!!task.isFinished} onChange={()=>{void run(async()=>{const saved=await services.business.command({type:task.isFinished?'uncompleteTask':'completeTask',id:task.id,expected:task});if(saved&&!task.isFinished)close()})}}/><button type="button" className="legacy-detail-start" aria-label={text.focusTask+': '+task.name} onClick={async()=>{if(await run(()=>services.startForTask(task.id)))onStart()}}><LegacyIcon name="task-start"/></button><input aria-label={text.name} data-field="name" required maxLength={1000} value={draft.name} onChange={event=>set('name',event.target.value)}/><PickerField className="legacy-priority-picker"><summary aria-label={text.priority+'…'}><LegacyIcon name={['task_priority_none','task_priority_low','task_priority_middle','task_priority_high'][draft.priority]}/></summary><div className="legacy-detail-popover legacy-detail-priority-options" role="menu">{['tsk_priority_none','tsk_priority_low','tsk_priority_middle','tsk_priority_high'].map((label,index)=><button type="button" key={index} role="menuitemradio" aria-checked={draft.priority===index} onClick={()=>{set('priority',index);void save('priority');closeFields()}}><LegacyIcon name={['task_priority_none','task_priority_low','task_priority_middle','task_priority_high'][index]}/><span>{services.language.legacyText(label)}</span>{draft.priority===index&&<i className="legacy-option-check"/>}</button>)}</div></PickerField></div>
        <div className="legacy-detail-tag-row">{draft.tags.split(',').filter(Boolean).map(id=>projects.find(row=>row.id===id&&row.state===0&&row.type===3000)).filter((row):row is Entity=>!!row).map(tag=>{const color=/^[a-f\d]{6}$/i.test(String(tag.color))?'#'+tag.color:'#aeaeae';return <span className="legacy-detail-tag" key={tag.id} style={{backgroundColor:color+'3d'}}><span style={{color}}>{tag.name}</span><button type="button" aria-label={text.remove+': '+tag.name} style={{backgroundColor:color}} onClick={()=>{set('tags',draftRef.current.tags.split(',').filter(id=>id!==tag.id).join(','));void save('tags')}}/></span>})}<PickerField className="legacy-detail-tags"><summary><span className="legacy-tag-add-content"><LegacyIcon name="tag-add"/><span>{text.tags}</span></span></summary><div className="legacy-detail-popover legacy-tags-popover"><TagsPicker key={pickerVersion} tags={projects.filter(row=>row.type===3000&&row.state===0)} value={draft.tags} cancel={closeFields} create={()=>{closeFields();setCreateTag(true)}} confirm={value=>{set('tags',value);void save('tags');closeFields()}}/></div></PickerField></div>
        <PickerField className="legacy-detail-field legacy-detail-pomodoro"><summary><LegacyIcon name="detail-pomodoro"/><span>{chinese?'番茄':'Pomodoro'}</span><span className="legacy-detail-pomo-value"><span><LegacyIcon name="task-pomo-actual"/><b className="legacy-pomo-actual">{number(task.actualPomoNum)}</b><i className="legacy-pomo-separator">/</i><LegacyIcon name="task-pomo-estimate"/><b className="legacy-pomo-estimated">{draft.estimatePomoNum}</b></span><small><LegacyIcon name="task-pomo-estimate"/> = {draft.interval}{text.minutes}</small></span></summary><div className="legacy-detail-popover legacy-pomodoro-popover"><PomodoroPicker key={pickerVersion} estimate={draft.estimatePomoNum} interval={draft.interval} cancel={closeFields} confirm={(estimate,interval)=>{set('estimatePomoNum',estimate);set('interval',interval);void save();closeFields()}}/></div></PickerField>
        <PickerField className="legacy-detail-field"><summary><LegacyIcon name="detail-deadline"/><span>{text.deadline}</span><span className="legacy-detail-value">{dueLabel}</span></summary><div className="legacy-detail-popover legacy-date-popover"><DatePicker key={pickerVersion} value={draft.deadline} cancel={closeFields} confirm={value=>{set('deadline',value);void save('deadline');closeFields()}}/></div></PickerField>
        <PickerField className="legacy-detail-field"><summary><LegacyIcon name="detail-project"/><span>{text.project}</span><span className="legacy-detail-value">{projects.find(row=>row.id===draft.projectId)?projectName(projects.find(row=>row.id===draft.projectId)!,text):text.none}</span></summary><div className="legacy-detail-popover legacy-project-options">{projects.filter(row=>[1000,7005].includes(number(row.type))&&row.state!==-1).map(row=><button type="button" role="option" aria-selected={draft.projectId===row.id} key={row.id} onClick={()=>{set('projectId',row.id);void save('projectId');closeFields()}}><ProjectIcon type={number(row.type)} color={String(row.color||'')}/><span>{projectName(row,text)}</span>{draft.projectId===row.id&&<i className="legacy-option-check"/>}</button>)}</div></PickerField>
        <PickerField className="legacy-detail-field"><summary><LegacyIcon name="detail-reminder"/><span>{text.reminder}</span><span className="legacy-detail-value" data-empty={!draft.reminder||undefined} data-overdue={draft.reminder&&new Date(draft.reminder)<new Date()?true:undefined}>{reminderValue(draft.reminder)}</span></summary><div className="legacy-detail-popover legacy-date-popover"><DatePicker key={pickerVersion} reminder value={draft.reminder} cancel={closeFields} confirm={value=>{set('reminder',value);void save('reminder');closeFields()}}/></div></PickerField>
        <PickerField className="legacy-detail-field"><summary><LegacyIcon name="detail-repetition"/><span>{text.repeat}</span><span className="legacy-detail-value legacy-repeat-value" data-empty={!draft.rUnit||undefined}><span>{repeatLabel(draft.rUnit,draft.rCycle,draft.rValue)}</span>{nextRepeatLabel()&&<small className="legacy-repeat-next">{chinese?'下个任务: ':'Next: '}{nextRepeatLabel()}</small>}</span></summary><div className="legacy-detail-popover legacy-repeat-popover"><RepeatPicker key={pickerVersion} unit={draft.rUnit} cycle={draft.rCycle} value={draft.rValue} confirm={(unit,cycle,value)=>{set('rUnit',unit);set('rCycle',cycle);set('rValue',value);void save();closeFields()}}/></div></PickerField>
        {saveFailed&&<button className="primary" disabled={!draft.name.trim()||pending>0}>{text.save}</button>}
      </fieldset>
      {validation && <p className={saveFailed?'danger':'workspace-sr'} role="status">{validation}</p>}
    </form>
    <section className="legacy-detail-subtasks" aria-label={text.subtasks}>
      <div className="legacy-subtask-separator"/>
      {children.map((row, index) => <div className="workspace-subtask" key={row.id} data-selected={selectedSubtask===row.id||undefined} onClick={event=>{if(!(event.target as Element).closest('button,input'))selectSubtask(row.id)}} onFocus={event=>{if((event.target as Element).closest('.legacy-subtask-name'))selectSubtask(row.id)}} draggable={!busy&&!blocked} onDragStart={event=>{drag.current=row;event.dataTransfer.setData('text/plain',row.id)}} onDragEnd={()=>{drag.current=null}} onDragOver={event => { if (drag.current) event.preventDefault(); }} onDrop={event => {
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
        <button type="button" className="legacy-subtask-start" aria-label={text.focusSubtask + ': ' + row.name} disabled={busy || blocked || !!row.isFinished || !!task.isFinished} onClick={async () => { if (await run(() => services.startForTask(task.id, row.id))) onStart(); }}><LegacyIcon name={row.isFinished||task.isFinished?'task-start-disabled':'task-start'}/></button>
        <SubtaskName subtask={row} selected={selectedSubtask===row.id}/>
        <button type="button" className="legacy-subtask-delete" aria-label={text.deleteSubtask + ': ' + row.name} disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setEditing(row);setDeleting(true); }}><LegacyIcon name="detail-subtask-delete"/></button>
      </div>)}
      <form onSubmit={async event => { event.preventDefault(); if (await run(() => services.business.batch([{ type: 'addSubtask', values: { name: subtaskName.trim(), taskId: task.id,
        order: Math.max(0, ...children.map(row => number(row.order))) + 10000 } },{type:'updateTask',id:task.id,changes:{hasSubtask:true},expected:{hasSubtask:task.hasSubtask}}]))) setSubtaskName(''); }}>
        <LegacyIcon name="detail-subtask-add"/><label className="workspace-sr" htmlFor="new-subtask">{text.addSubtask}</label><input id="new-subtask" name="new-subtask" autoComplete="off" spellCheck={false} tabIndex={-10} placeholder={text.addSubtask+'...'} value={subtaskName} maxLength={1000} required disabled={busy || blocked} onChange={event => setSubtaskName(event.target.value)} />
      </form>
      <div className="legacy-subtask-separator bottom"/>
    </section>
    <textarea ref={note} className="legacy-detail-note" aria-label={text.remark} placeholder={chinese?'添加备注...':'Add note...'} value={draft.remark} onChange={event=>{set('remark',event.target.value);resizeNote()}} onFocus={()=>resizeNote()} onBlur={()=>{void save('remark')}}/>
    </div>
    <footer className="legacy-detail-bottom"><button type="button" aria-label={text.close} onClick={close}><LegacyIcon name="detail-close"/></button><span>{chinese?'创建于':'Created '}{formatTaskDate(number(task.creationDate||task.createDate||task.createdDate),services.language.locale)}</span><button type="button" aria-label={chinese?'手动补记':'Add focus record'} onClick={()=>{setCreateRecord(true)}}><LegacyIcon name="add-pomodoro"/></button><button type="button" aria-label={text.remove} disabled={busy||blocked} onClick={event=>{event.currentTarget.focus();setEditing(null);setDeleting(true)}}><LegacyIcon name="detail-delete"/></button></footer>
    </div>
    {deleting&&!editing&&<TaskDeleteDialog task={task} close={()=>setDeleting(false)} afterDelete={close} preserveHistory={preserve} extra={<label className="legacy-confirm-option"><input type="checkbox" checked={preserve} disabled={busy||blocked} onChange={event=>setPreserve(event.target.checked)}/>{text.preserveHistory}</label>}/>}
    {deleting&&editing&&<ConfirmDialog canClose={!busy} title={services.language.legacyText('tsk_del_title',String(editing.name))} message={services.language.legacyText('sbt_del_msg')} close={()=>{setDeleting(false);setEditing(null)}}>{dismiss=><>
      <button disabled={busy} onClick={dismiss}>{text.cancel}</button><button className="primary" disabled={busy||blocked} onClick={async()=>{
        const command={type:'removeSubtask' as const,id:editing.id,expected:editing};
        if(await run(()=>children.length===1?services.business.batch([command,{type:'updateTask',id:task.id,changes:{hasSubtask:false,isExpanded:false},expected:{hasSubtask:task.hasSubtask}}]):services.business.command(command)))dismiss();
      }}>{services.language.legacyText('cmm_ok')}</button>
    </>}</ConfirmDialog>}
    {createTag && <ProjectEditor type={3000} projects={projects} close={() => setCreateTag(false)} />}
    {createRecord&&<RecordEditor kind="record" taskId={task.id} close={()=>setCreateRecord(false)}/>}
  </aside>;
}
