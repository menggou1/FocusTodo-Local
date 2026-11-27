import { formatDateTime, formatTaskDate } from '../../domain/display.mjs';
import { RecordTaskPicker } from './RecordTaskPicker';
import { PickerField } from './PickerField';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { Dialog } from './Dialog';
import { localInput } from './Dates';
import { number, projectName, string } from './model';
import { LegacyIcon } from './LegacyIcon';
import { PomodoroPicker, DatePicker } from './Pickers';
import { ProjectIcon } from './ProjectIcon';

export type RecordAnchor={x:number;y:number;width:number;height:number};
type RecordFields = { selected?: string; child?: string; begin?: number; minutes?: number };
type RecordKind = 'schedule' | 'record';
type RecordEditorProps = {
 kind: RecordKind; row?: Entity; start?: number; taskId?: string; interval?: number;
 quick?: boolean; anchored?: boolean; previewChange?(name: string, seconds: number): void; close(): void;
} & ({inspector: true; removeRow(row: Entity, kind: RecordKind): Promise<void>} | {inspector?: false; removeRow?: never});

export function RecordEditor({kind,row,start=Date.now(),taskId='',interval,quick=false,anchored=false,previewChange,inspector=false,close,removeRow}:RecordEditorProps){
 const{services,text,run,queue,busy,blocked}=useWorkspace(),zh=services.language.locale.startsWith('zh'),t=(a:string,b:string)=>zh?a:b;
 const data=useSyncExternalStore(services.business.subscribe,services.business.getSnapshot),prefs=services.settings.getSnapshot(),isQuick=kind==='schedule'&&!row&&(!taskId||quick),sidebar=!!row&&inspector;
 // A local input value can refer to two instants on the autumn clock change.
 const [begin, setBegin] = useState(() => row ? number(row.endDate) - number(row.interval) * 1000
   : kind === 'record' ? start - (interval || prefs.workInterval) * 1000 : start);
 const[base,setBase]=useState(row),baseRef=useRef(row),[selected,setSelected]=useState(string(row?.taskId)||taskId),[child,setChild]=useState(string(row?.subtaskId)),[minutes,setMinutes]=useState((row?number(row.interval):interval||prefs.workInterval)/60),[pomo,setPomo]=useState(row?number(row.pomodoroInterval||row.interval)/60:prefs.workInterval/60),[name,setName]=useState(''),[count,setCount]=useState(0),[project,setProject]=useState('id-task-tasks'),[validation,setValidation]=useState(''),[pending,setPending]=useState(0);
 const form=useRef<HTMLFormElement>(null),closeRef=useRef(close),leaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);closeRef.current=close;
 const[leaving,setLeaving]=useState(false);
 function requestClose(){if(sidebar||isQuick||matchMedia('(prefers-reduced-motion: reduce)').matches){closeRef.current();return}if(leaveTimer.current)return;setLeaving(true);leaveTimer.current=setTimeout(()=>{leaveTimer.current=null;closeRef.current()},250)}
 useEffect(()=>()=>{if(leaveTimer.current)clearTimeout(leaveTimer.current)},[]);
 // The local 1.9.x quick creator cancels on its transparent outside layer;
 // the original manual-record overlay intentionally keeps outside clicks inert.
 useEffect(()=>{if(!isQuick)return;const dismiss=(event:PointerEvent)=>{const dialog=form.current?.closest('dialog');if(!dialog||busy||event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)requestClose()};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss)},[isQuick,busy]);
 const closeFields=()=>form.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(node=>node.open=false);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&sidebar&&!document.querySelector('dialog[open],.workspace-picker-surface')){e.preventDefault();requestClose()}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[sidebar]);
 useEffect(()=>{if(isQuick)previewChange?.(name.trim(),minutes*60)},[name,minutes,isQuick]);
 // Legacy drag selection already has a painted preview when its creator opens;
 // a double-click opens the centered creator. Keep those two observed placements.
 useEffect(()=>{if(!isQuick||!anchored)return;const frame=requestAnimationFrame(()=>{const dialog=form.current?.closest('dialog'),preview=document.querySelector('.legacy-calendar-selection');if(!dialog||!preview)return;const r=preview.getBoundingClientRect(),bounds=dialog.getBoundingClientRect(),below=r.bottom+12,top=below+bounds.height<=innerHeight-12?below:r.top-bounds.height-12;Object.assign(dialog.style,{position:'fixed',margin:'0',left:Math.max(12,Math.min(innerWidth-bounds.width-12,r.left+r.width/2-bounds.width/2))+'px',top:Math.max(12,Math.min(innerHeight-bounds.height-12,top))+'px'})});return()=>cancelAnimationFrame(frame)},[isQuick,anchored]);
 const task=data.tasks.find(task=>task.id===selected),selectedName=child?data.subtasks.find(item=>item.id===child)?.name||task?.name:task?.name;
 const beginInput = Number.isFinite(begin) ? localInput(begin) : '';
 const startLabel = beginInput ? formatDateTime(begin, services.language.locale) : text.none;
 const changes = (values: RecordFields = {}) => ({
   taskId: values.selected ?? selected,
   subtaskId: values.child ?? child,
   endDate: (values.begin ?? begin) + (values.minutes ?? minutes) * 60000,
   interval: (values.minutes ?? minutes) * 60,
   ...(kind === 'record' ? { pomodoroInterval: pomo * 60 } : { isAllDay: !!baseRef.current?.isAllDay }),
 });
 async function persist(values:RecordFields){if(!sidebar)return;setPending(value=>value+1);const valuesToSave=changes(values);const success=await queue(async()=>{const current=baseRef.current!;const result=kind==='schedule'?await services.calendar.put({...current,...valuesToSave},current):await services.business.command({type:'updateRecord',id:current.id,changes:valuesToSave,expected:current});baseRef.current=result as Entity;setBase(result as Entity)});setPending(value=>value-1);setValidation(success?text.saved:text.failed)}
 function changeStart(value: string) {
   const time = new Date(value).getTime();
   setBegin(time);
   if (Number.isFinite(time)) void persist({ begin: time });
 }
 function remove() {
   if (baseRef.current && removeRow) void removeRow(baseRef.current, kind);
 }
 const taskField=<PickerField className="legacy-record-field"><summary><LegacyIcon name="pomo-task"/><span>{services.language.legacyText('pomo_task_title')}</span><span className="legacy-record-value">{selectedName||text.none}</span>{selected&&<button type="button" className="legacy-record-unlink" aria-label={t('移除任务关联','Remove task association')} onClick={e=>{e.preventDefault();setSelected('');setChild('');void persist({selected:'',child:''})}}>×</button>}</summary><div className="legacy-detail-popover legacy-record-task-picker"><RecordTaskPicker projects={data.projects} tasks={data.tasks} selected={selected} choose={id=>{setSelected(id);setChild('');void persist({selected:id,child:''});closeFields()}}/></div></PickerField>;
 const startField=<PickerField className="legacy-record-field"><summary><LegacyIcon name="pomo-starttime"/><span>{services.language.legacyText('pomo_start_time')}</span><span className="legacy-record-value">{startLabel}</span></summary><div className="legacy-detail-popover legacy-date-popover"><DatePicker reminder allowPast recordTime value={beginInput} cancel={closeFields} confirm={value=>{if(!value)return;if(value!==beginInput.slice(0,16))changeStart(value);closeFields()}}/></div></PickerField>;
 const durationField=<PickerField className="legacy-record-field" ><summary><LegacyIcon name="detail-pomodoro"/><span>{kind==='schedule'?t('日程时长','Schedule Duration'):services.language.legacyText('pomo_len')}</span><span className="legacy-record-value"><span className="legacy-record-duration-text">{services.language.legacyText('cmm_local_minute',Math.round(minutes))}</span></span></summary><div className="legacy-detail-popover legacy-record-duration-popover"><div className="legacy-record-duration-picker" ref={node=>{if(node)node.scrollTop=Math.max(0,Math.min(475,Math.round(minutes)-3)*34)}} role="listbox" aria-label={t('调整时长','Adjust duration')}>{Array.from({length:480},(_,i)=>i+1).map(value=><button type="button" role="option" aria-selected={value===minutes} key={value} onClick={()=>{setMinutes(value);void persist({minutes:value});closeFields()}}><span>{services.language.legacyText('pomo_min',value)}</span>{value===minutes&&<i className="legacy-option-check"/>}</button>)}</div></div></PickerField>;

 const hiddenFields=<div className="workspace-sr"><label>{t('开始时间','Start time')}<input type="datetime-local" tabIndex={-1} step="0.001" required value={beginInput} onChange={e=>changeStart(e.target.value)}/></label><label>{t('时长（分钟）','Duration (minutes)')}<input type="number" min={1/60} max={480} step="any" required value={minutes} onChange={e=>{setMinutes(e.target.valueAsNumber);void persist({minutes:e.target.valueAsNumber})}}/></label><label>{text.interval}<input type="number" min={1} max={480} step="any" value={pomo} onChange={e=>setPomo(e.target.valueAsNumber)}/></label></div>;
 const content=<form noValidate={isQuick} ref={form} data-pending={pending} onSubmit={async e=>{e.preventDefault();setValidation('');if(isQuick&&!name.trim()){setValidation(services.language.text('请输入任务名称'));form.current?.querySelector<HTMLInputElement>('.legacy-record-name input')?.focus();return}if(!Number.isFinite(begin)||!Number.isFinite(minutes)||minutes<=0){setValidation(text.validation);return}if(sidebar){await persist({});return}const success=await run(async()=>{if(isQuick)await services.calendar.createTask({name:name.trim(),count,interval:minutes*60,startTime:begin,projectId:project,shortBreak:prefs.shortBreakInterval,addToTop:prefs.newTaskOnTop});else if(base)await services.business.command({type:kind==='schedule'?'updateSchedule':'updateRecord',id:base.id,changes:changes(),expected:base});else await services.business.command({type:kind==='schedule'?'addSchedule':'addRecord',values:changes()})});if(success)requestClose()}}>
 {isQuick?<><label className="legacy-record-name"><span className="workspace-sr">{text.name}</span><input autoFocus aria-label={text.name} placeholder={services.language.text('添加任务...')} required aria-invalid={!!validation||undefined} aria-describedby="calendar-name-error" maxLength={1000} value={name} onChange={e=>{setName(e.target.value);if(e.target.value.trim())setValidation('')}}/></label><PickerField className="legacy-record-field legacy-record-pomodoro"><summary><LegacyIcon name="detail-pomodoro"/><span>{t('番茄','Pomodoro')}</span><span className="legacy-detail-pomo-value"><span><LegacyIcon name="task-pomo-actual"/>0 / <LegacyIcon name="task-pomo-estimate"/>{count}</span><small><LegacyIcon name="task-pomo-estimate"/> = {minutes}{text.minutes}</small></span></summary><div className="legacy-detail-popover legacy-pomodoro-popover"><PomodoroPicker estimate={count} interval={minutes} cancel={closeFields} confirm={(n,value)=>{setCount(n);setMinutes(value);closeFields()}}/></div></PickerField><PickerField className="legacy-record-field"><summary><LegacyIcon name="detail-project"/><span>{text.project}</span><span className="legacy-record-value">{data.projects.find(item=>item.id===project)?projectName(data.projects.find(item=>item.id===project)!,text):text.tasks}</span></summary><div className="legacy-detail-popover legacy-project-options">{data.projects.filter(item=>item.state!==-1&&[1000,7005].includes(number(item.type))).map(item=><button type="button" role="option" aria-selected={item.id===project} key={item.id} onClick={()=>{setProject(item.id);closeFields()}}><ProjectIcon type={number(item.type)} color={String(item.color||'')}/><span>{projectName(item,text)}</span>{item.id===project&&<i className="legacy-option-check"/>}</button>)}</div></PickerField></>:<>{taskField}{startField}{durationField}</>}
 {hiddenFields}{validation&&<p id="calendar-name-error" className={validation===text.saved?'workspace-sr':'danger'} role="status">{validation}</p>}{!sidebar&&<footer><button type="button" onClick={requestClose} disabled={busy}>{text.cancel}</button><button type="submit" className="primary" disabled={busy||blocked}>{isQuick?text.confirm:services.language.legacyText('cmm_ok')}</button></footer>}
 </form>;
 if(sidebar)return <aside className="legacy-record-inspector" aria-label={t('日程详情','Schedule details')} data-record-id={base?.id}><div className="legacy-record-inspector-content">{content}<footer className="legacy-detail-bottom"><button type="button" aria-label={text.close} onClick={requestClose}><LegacyIcon name="detail-close"/></button><span>{t('创建于','Created ')}{formatTaskDate(number(base?.creationDate)||Date.now(),services.language.locale)}</span><button type="button" aria-label={text.remove} disabled={busy||blocked||pending>0} onClick={event=>{event.currentTarget.focus();void remove()}}><LegacyIcon name="detail-delete"/></button></footer></div></aside>;
 return <Dialog motion={leaving?'legacy-window-exit':'legacy-window-enter'} title={isQuick?services.language.text('添加任务'):base?t('编辑番茄记录','Edit Pomodoro Record'):services.language.legacyText('pomo_new')} className={isQuick?'legacy-record-quick':'legacy-record-modal'+(leaving?' is-leaving':'')} close={requestClose}>{content}</Dialog>;
}
