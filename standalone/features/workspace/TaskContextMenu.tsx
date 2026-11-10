import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent as ReactChangeEvent, type KeyboardEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { LegacyIcon } from './LegacyIcon';
import { number,ordered,projectName,dateInput,timestamp } from './model';
import { deadlineChanges } from '../../domain/task-edits.mjs';
import { DatePicker } from './Pickers';
import { ProjectIcon } from './ProjectIcon';
import { MenuSubmenu } from './MenuSubmenu';

const options = [
  { value: 0, icon: 'task_priority_none' },
  { value: 1, icon: 'task_priority_low' },
  { value: 2, icon: 'task_priority_middle' },
  { value: 3, icon: 'task_priority_high' },
] as const;

function endOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value.getTime();
}

function quickDeadline(kind: 'today' | 'tomorrow' | 'nextWeek' | 'someday') {
  if (kind === 'someday') return 0;
  const date = new Date();
  if (kind === 'tomorrow') date.setDate(date.getDate() + 1);
  if (kind === 'nextWeek') date.setDate(date.getDate() + 7);
  return endOfLocalDay(date);
}

export function TaskContextMenu({ task, x, y, close, remove }: { task: Entity; x: number; y: number; close(): void; remove(task:Entity):void }) {
  const { services, text, queue } = useWorkspace();
  const menu = useRef<HTMLDivElement>(null), buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const estimateInput = useRef<HTMLInputElement>(null), widthNode = useRef<HTMLSpanElement>(null);
  const initialEstimate = number(task.estimatePomoNum);
  const [estimate, setEstimate] = useState(initialEstimate), [inputWidth, setInputWidth] = useState(9);
  const estimateRef = useRef(initialEstimate), savedEstimate = useRef(initialEstimate);
  const [position, setPosition] = useState({ left: x, top: y, originX: 'left', originY: 'top' });
  const [ready, setReady] = useState(false), [open, setOpen] = useState(false), [closing, setClosing] = useState(false);
  const closingRef = useRef(false), closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submenu,setSubmenu]=useState<{id:'date'|'projects'|'tags';anchor:HTMLElement}|null>(null);
  const [tagDraft,setTagDraft]=useState(()=>String(task.tags||'').split(',').filter(Boolean));
  const tagRef=useRef(tagDraft),tagChanged=useRef(false);
  const projects=ordered(services.business.getSnapshot().projects.filter(row=>row.state===0));
  const destinations=projects.filter(row=>[1000,7005].includes(number(row.type))&&row.id!==task.projectId),tags=projects.filter(row=>row.type===3000);
  const labels = [text.normal, text.low, text.medium, text.high];
  const deadlineItems = [
    { kind: 'today' as const, label: services.language.legacyText('tsk_deadline_today') },
    { kind: 'tomorrow' as const, label: services.language.legacyText('tsk_deadline_tomorrow') },
    { kind: 'nextWeek' as const, label: services.language.text('下周到期') },
    { kind: 'someday' as const, label: services.language.legacyText('prj_someday') },
  ];

  useLayoutEffect(() => {
    const element = menu.current!;
    const width = element.offsetWidth, height = element.offsetHeight;
    let left = x, top = y, originX = 'left', originY = 'top';
    if (left + width > innerWidth - 4) { left -= width; originX = 'right'; }
    if (top + height > innerHeight - 4) {
      if (top - height < 4) { top -= height / 2; originY = ''; } else { top -= height; originY = 'bottom'; }
    }
    left = Math.max(4, Math.min(left, innerWidth - width - 4));
    top = Math.max(4, Math.min(top, innerHeight - height - 4));
    setPosition({ left, top, originX, originY });
    setReady(true);
    const frame = requestAnimationFrame(() => {
      setOpen(true);
      const index = options.findIndex(option => option.value === number(task.priority));
      buttons.current[Math.max(0, index)]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [x, y, task.priority]);

  useLayoutEffect(() => {
    const width = widthNode.current?.getBoundingClientRect().width || 0;
    setInputWidth(Math.max(9, Math.ceil(width)));
  }, [estimate]);

  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      requestClose();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, []);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function updateTaskWith(build: (current: Entity) => Record<string, unknown>) {
    return queue(async () => {
      const current = services.business.getSnapshot().tasks.find(row => row.id === task.id);
      if (!current) throw new Error('Task no longer available');
      const changes = build(current);
      if (!Object.keys(changes).length) return;
      await services.business.command({ type: 'updateTask', id: task.id, changes, expected: current });
    });
  }

  function updateTask(changes: Record<string, unknown>) {
    return updateTaskWith(() => changes);
  }

  function commitEstimate() {
    if (estimateRef.current === savedEstimate.current) return;
    const estimatePomoNum = estimateRef.current;
    savedEstimate.current = estimatePomoNum;
    void updateTask({ estimatePomoNum }).then(success=>{if(!success&&savedEstimate.current===estimatePomoNum)savedEstimate.current=initialEstimate});
  }

  function changeEstimate(value: number) {
    const next = Math.max(0, Math.min(1000, Math.trunc(value)));
    estimateRef.current = next;
    setEstimate(next);
  }

  function handleEstimateWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const step = Math.max(-5, Math.min(5, Math.ceil(event.deltaY / 5)));
    if (step) changeEstimate(estimateRef.current - step);
  }

  function handleEstimateInput(event: ReactChangeEvent<HTMLInputElement>) {
    const parsed = Number.parseInt(event.target.value, 10);
    changeEstimate(Number.isNaN(parsed) ? 0 : parsed);
  }

  function handleEstimateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault(); event.stopPropagation();
    commitEstimate();
    requestClose();
  }

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    commitEstimate();
    commitTags();
    setOpen(false); setClosing(true);
    // Legacy ContextMenu unmounts 120ms after hiding even though its exit
    // stylesheet declares 250ms. Keep the actual 1.9.3 visible exit timing.
    closeTimer.current = setTimeout(close, 120);
  }

  function choose(priority: number) {
    const estimateChanged = estimateRef.current !== savedEstimate.current;
    const priorityChanged = priority !== number(task.priority);
    if (estimateChanged) savedEstimate.current = estimateRef.current;
    requestClose();
    if (!estimateChanged && !priorityChanged) return;
    const changes: Record<string, unknown> = {};
    if (estimateChanged) changes.estimatePomoNum = estimateRef.current;
    if (priorityChanged) changes.priority = priority;
    updateTask(changes);
  }

  function chooseDeadline(deadline: number) {
    const estimateChanged = estimateRef.current !== savedEstimate.current;
    if (estimateChanged) savedEstimate.current = estimateRef.current;
    requestClose();
    void updateTaskWith(current => {
      const changes: Record<string, unknown> = {};
      if (estimateChanged) changes.estimatePomoNum = estimateRef.current;
      Object.assign(changes,deadlineChanges(current,deadline));
      return changes;
    });
  }

  function commitTags(){if(!tagChanged.current)return;tagChanged.current=false;const value=tagRef.current.join(',');void updateTask({tags:value});}
  function parent(id:'date'|'projects'|'tags',label:string,disabled=false){return <div className="legacy-context-parent" onMouseEnter={event=>{if(!disabled)setSubmenu({id,anchor:event.currentTarget})}} onMouseLeave={()=>{if(id==='tags'&&tagChanged.current){commitTags();requestClose()}setSubmenu(null)}}><button type="button" role="menuitem" aria-haspopup="true" aria-expanded={submenu?.id===id} disabled={disabled} onClick={event=>setSubmenu({id,anchor:event.currentTarget.parentElement!})} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();setSubmenu({id,anchor:event.currentTarget.parentElement!})}}}>{label}<i/></button>{submenu?.id===id&&<MenuSubmenu anchor={submenu.anchor}>{id==='date'?<DatePicker value={dateInput(task.deadline)} shortcutHidden actionsHidden cancel={()=>setSubmenu(null)} confirm={value=>chooseDeadline(timestamp(value,true))}/>:id==='projects'?<div className="legacy-menu-projects">{destinations.map(row=><button key={row.id} type="button" role="menuitem" onClick={()=>{requestClose();void updateTask({projectId:row.id})}}><ProjectIcon type={number(row.type)} color={String(row.color||'')}/><span>{projectName(row,text)}</span></button>)}</div>:<div className="legacy-menu-tags">{tags.map(tag=><label key={tag.id}><ProjectIcon type={3000} color={String(tag.color||'')}/><span>{tag.name}</span><input type="checkbox" aria-label={String(tag.name)} checked={tagDraft.includes(tag.id)} onChange={event=>{const next=event.target.checked?[...tagRef.current,tag.id]:tagRef.current.filter(id=>id!==tag.id);tagRef.current=next;tagChanged.current=true;setTagDraft(next)}}/></label>)}</div>}</MenuSubmenu>}</div>}
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    // The estimate input keeps native number editing, including arrow keys.
    if ((event.target as HTMLElement).closest('input')) return;
    const focusable = Array.from(menu.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)') || []);
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key === 'Tab' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const previous = event.key === 'Tab' ? event.shiftKey : ['ArrowLeft', 'ArrowUp'].includes(event.key);
      focusable[(index + (previous ? -1 : 1) + focusable.length) % focusable.length]?.focus();
      return;
    }
    if (!['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    focusable[event.key === 'Home' ? 0 : focusable.length - 1]?.focus();
  }

  return createPortal(<div data-app-interaction-root className="legacy-context-layer" onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <div className="legacy-context-mask" onClick={requestClose} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); requestClose(); }} />
    <div ref={menu} role="menu" aria-label={services.language.locale.startsWith('zh') ? '任务操作' : 'Task actions'} className={'legacy-context-menu' + (ready ? ' ready' : '') + (open ? ' is-open' : '') + (closing ? ' is-closing' : '')}
      style={{ left: position.left, top: position.top, transformOrigin: position.originX + ' ' + position.originY }} onKeyDown={navigate}>
      {!task.isFinished&&<><div className="legacy-context-group">
        <div className="legacy-estimate-menu" onMouseEnter={() => estimateInput.current?.focus()}
          onMouseLeave={() => { commitEstimate(); if (document.activeElement === estimateInput.current) estimateInput.current?.blur(); }}>
          <div className="legacy-estimate-title">{text.estimate}</div>
          <div className="legacy-pomodoro-selection" onWheel={handleEstimateWheel}>
            <button type="button" className="legacy-pomodoro-minus" aria-label={text.estimate + ' −'} onMouseDown={event => event.preventDefault()} onClick={() => changeEstimate(estimateRef.current - 1)} />
            <div className="legacy-pomodoro-value">
              <span className="legacy-pomodoro-icon" aria-hidden="true" />
              <input ref={estimateInput} className="legacy-pomodoro-input" type="number" min={0} max={1000} step={1} value={estimate}
                aria-label={text.estimate} style={{ width: inputWidth + 'px' }} onChange={handleEstimateInput} onKeyDown={handleEstimateKeyDown} />
            </div>
            <button type="button" className="legacy-pomodoro-plus" aria-label={text.estimate + ' +'} onMouseDown={event => event.preventDefault()} onClick={() => changeEstimate(estimateRef.current + 1)} />
          </div>
          <span ref={widthNode} className="legacy-pomodoro-width" aria-hidden="true">{estimate}</span>
        </div>
      </div>
      <div className="legacy-context-group">
        <div className="legacy-deadline-menu" role="group" aria-label={text.deadline}>
          {deadlineItems.slice(0,3).map(item => <button key={item.kind} type="button" role="menuitem" onMouseEnter={()=>setSubmenu(null)} onClick={() => chooseDeadline(quickDeadline(item.kind))}>{item.label}</button>)}
          {parent('date',services.language.legacyText('tsk_deadline_custom'))}
          <button type="button" role="menuitem" onMouseEnter={()=>setSubmenu(null)} onClick={()=>chooseDeadline(0)}>{deadlineItems[3].label}</button>
        </div>
      </div>
      <div className="legacy-context-group">
        <div className="legacy-priority-menu">
          <div className="legacy-priority-title">{text.priority}</div>
          <div className="legacy-priority-options">
            {options.map((option, index) => <button key={option.value} ref={element => { buttons.current[index] = element; }} type="button" role="menuitemradio"
              aria-checked={number(task.priority) === option.value} aria-label={labels[index]} onClick={() => choose(option.value)}>
              <LegacyIcon name={option.icon} />
            </button>)}
          </div>
        </div>
      </div>
      <div className="legacy-context-group">{parent('projects',services.language.legacyText('tsk_move_prj'),!destinations.length)}</div>
      <div className="legacy-context-group">{parent('tags',services.language.legacyText('tag'),!tags.length)}</div></>}
      <div className="legacy-context-group legacy-menu-actions">{!!task.isFinished&&<button type="button" role="menuitem" onClick={()=>{requestClose();void queue(async()=>{const current=services.business.getSnapshot().tasks.find(row=>row.id===task.id);if(current)await services.business.command({type:'uncompleteTask',id:current.id,expected:current})})}}>{services.language.legacyText('tsk_uncomplete')}</button>}<button type="button" role="menuitem" onClick={()=>{requestClose();remove(task)}}>{services.language.legacyText('tsk_del')}</button></div>
    </div>
  </div>, document.body);
}

