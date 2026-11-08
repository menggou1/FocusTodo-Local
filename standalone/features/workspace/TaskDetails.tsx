import { useState } from 'react';
import type { Entity, CompatibleRecord } from '../../services/core.mjs';
import { Dialog } from './Dialog';
import { useWorkspace } from './Context';
import { ProjectEditor } from './Projects';
import { dateInput, number, ordered, projectName, string, timestamp } from './model';

export function TaskDetails({ task, projects, subtasks, close, onStart }: { task: Entity; projects: readonly Entity[]; subtasks: readonly Entity[]; close(): void; onStart(): void }) {
  const { services, text, run, busy, blocked } = useWorkspace();
  // Keep the opened revision until explicitly reopened; remote refreshes must not erase a draft.
  const [base] = useState(task);
  const [draft, setDraft] = useState(() => ({ name: string(task.name), remark: string(task.remark), projectId: string(task.projectId),
    deadline: dateInput(task.deadline), reminder: dateInput(task.reminderDate, true), priority: number(task.priority),
    estimatePomoNum: number(task.estimatePomoNum), interval: number(task.pomodoroInterval) / 60,
    rCycle: number(task.rCycle) || 1, rUnit: number(task.rCycle) ? string(task.rUnit) : '', rValue: string(task.rValue), tags: string(task.tags) }));
  const [savedBase, setSavedBase] = useState(base);
  const [savedDraft, setSavedDraft] = useState(draft);
  const [subtaskName, setSubtaskName] = useState(''), [deleting, setDeleting] = useState(false), [preserve, setPreserve] = useState(true);
  const [editing, setEditing] = useState<Entity | null>(null), [editName, setEditName] = useState(''), [validation, setValidation] = useState('');
  const [createTag, setCreateTag] = useState(false);
  const drag = useState(() => ({ current: null as Entity | null }))[0];
  const set = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => { setValidation(''); setDraft(previous => ({ ...previous, [key]: value })); };
  const children = ordered(subtasks.filter(row => row.taskId === task.id && row.state === 0));
  const save = async () => {
    if (draft.rUnit && !draft.deadline) { setValidation(text.repeatNeedsDate); return; }
    const days = draft.rValue.split(',').map(value => Number(value.trim()));
    if (draft.rUnit === 'weeks' && (!draft.rValue.trim() || !days.every(day => Number.isInteger(day) && day >= 0 && day <= 6))) { setValidation(text.invalidWeekdays); return; }
    const deadline = timestamp(draft.deadline, true);
    const values: CompatibleRecord = { name: draft.name.trim(), remark: draft.remark, projectId: draft.projectId, deadline,
      reminderDate: timestamp(draft.reminder), priority: draft.priority, estimatePomoNum: draft.estimatePomoNum, pomodoroInterval: draft.interval * 60, tags: draft.tags,
      rCycle: draft.rUnit ? draft.rCycle : 0, rUnit: draft.rUnit,
      rValue: draft.rUnit === 'weeks' ? [...new Set(days)].sort((a, b) => a - b).join(',') : '',
      rFirstDeadline: draft.rUnit ? (deadline === savedBase.deadline && savedBase.rFirstDeadline ? savedBase.rFirstDeadline : deadline) : 0 };
    const changes: CompatibleRecord = {};
    const fields = { name: 'name', remark: 'remark', projectId: 'projectId', deadline: 'deadline', reminder: 'reminderDate', priority: 'priority', estimatePomoNum: 'estimatePomoNum', interval: 'pomodoroInterval', tags: 'tags' } as const;
    for (const [field, target] of Object.entries(fields)) {
      const key = field as keyof typeof fields;
      if (draft[key] !== savedDraft[key]) changes[target] = values[target];
    }
    if (['rCycle', 'rUnit', 'rValue', 'deadline'].some(field => draft[field as keyof typeof draft] !== savedDraft[field as keyof typeof draft])) {
      for (const field of ['rCycle', 'rUnit', 'rValue', 'rFirstDeadline']) changes[field] = values[field];
    }
    let committed: CompatibleRecord | undefined;
    if (await run(async () => { committed = await services.business.command({ type: 'updateTask', id: task.id, changes,
      expected: savedBase }) as CompatibleRecord; })) {
      setSavedBase(committed as Entity); setSavedDraft(draft); setValidation(text.saved);
    }
  };
  return <aside className="workspace-details" aria-label={text.details}>
    <header><h2>{text.details}</h2><button type="button" aria-label={text.close} onClick={close}>×</button></header>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || blocked || task.state !== 0}>
        <label>{text.name}<input required maxLength={1000} value={draft.name} onChange={event => set('name', event.target.value)} /></label>
        <label>{text.estimate}<input type="number" required min={0} max={9999} step={1} value={draft.estimatePomoNum} onChange={event => set('estimatePomoNum', event.target.valueAsNumber)} /></label>
        <label>{text.interval}<input type="number" required min={1} max={480} step="any" value={draft.interval} onChange={event => set('interval', event.target.valueAsNumber)} /></label>
        <label>{text.deadline}<input type="date" value={draft.deadline} onChange={event => set('deadline', event.target.value)} /></label>
        <label>{text.project}<select aria-label={text.project} value={draft.projectId} onChange={event => set('projectId', event.target.value)}><option value="">{text.none}</option>
          {projects.filter(row => [1000, 7005].includes(number(row.type)) && row.state === 0).map(row => <option key={row.id} value={row.id}>{projectName(row, text)}</option>)}</select></label>
        <label>{text.priority}<select aria-label={text.priority} value={draft.priority} onChange={event => set('priority', Number(event.target.value))}>
          {[text.normal, text.low, text.medium, text.high].map((label, index) => <option key={index} value={index}>{label}</option>)}</select></label>
        <fieldset className="workspace-tags"><legend>{text.tags}</legend>{projects.filter(row => row.type === 3000 && row.state === 0).map(row => <label className="workspace-check" key={row.id}>
          <input type="checkbox" checked={draft.tags.split(',').includes(row.id)} onChange={event => { const tags = draft.tags.split(',').filter(Boolean).filter(id => id !== row.id); if (event.target.checked) tags.push(row.id); set('tags', tags.join(',')); }} />{row.name}</label>)}
          <button type="button" onClick={event => { event.currentTarget.focus(); setCreateTag(true); }}>{text.createTag}</button></fieldset>
        <label>{text.reminder}<input type="datetime-local" value={draft.reminder} onChange={event => set('reminder', event.target.value)} /></label>
        <label>{text.repeat}<select aria-label={text.repeat} value={draft.rUnit} onChange={event => set('rUnit', event.target.value)}><option value="">{text.none}</option>
          {(['days', 'weeks', 'months', 'years'] as const).map(unit => <option key={unit} value={unit}>{text[unit]}</option>)}</select></label>
        {draft.rUnit && <label>{text.cycle}<input type="number" required min={1} max={10000} step={1} value={draft.rCycle} onChange={event => set('rCycle', event.target.valueAsNumber)} /></label>}
        {draft.rUnit === 'weeks' && <label>{text.weekdays}<input value={draft.rValue} onChange={event => set('rValue', event.target.value)} /></label>}
        <label className="workspace-note">{text.remark}<textarea aria-label={text.remark} rows={3} value={draft.remark} onChange={event => set('remark', event.target.value)} /></label>
        <button className="primary" disabled={!draft.name.trim()}>{text.save}</button>
      </fieldset>
      {validation && <p role="status">{validation}</p>}
    </form>
    <section aria-label={text.subtasks}><h3>{text.subtasks}</h3>
      {children.map((row, index) => <div className="workspace-subtask" key={row.id} onDragOver={event => { if (drag.current) event.preventDefault(); }} onDrop={event => {
        event.preventDefault(); const from = drag.current; drag.current = null; if (!from || from.id === row.id) return;
        const peers = children.filter(child => child.id !== from.id), slot = peers.findIndex(child => child.id === row.id) + (children.findIndex(child => child.id === from.id) < index ? 1 : 0);
        const before = peers[slot - 1], after = peers[slot], order = before && after ? (number(before.order) + number(after.order)) / 2 : before ? number(before.order) + 10000 : number(after?.order) - 10000;
        void run(() => services.business.command({ type: 'updateSubtask', id: from.id, changes: { order }, expected: from }));
      }}>
        <button type="button" className="workspace-handle" aria-label={text.reorder + ': ' + row.name} draggable={!busy && !blocked} disabled={blocked} onDragStart={event => { drag.current = row; event.dataTransfer.setData('text/plain', row.id); }} onDragEnd={() => { drag.current = null; }}
          onKeyDown={event => {
            if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const direction = event.key === 'ArrowUp' ? -1 : 1, target = children[index + direction]; if (!target) return;
            const adjacent = children[index + direction * 2], order = adjacent ? (number(target.order) + number(adjacent.order)) / 2 : number(target.order) + direction * 10000;
            void run(() => services.business.command({ type: 'updateSubtask', id: row.id, changes: { order }, expected: row }));
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
