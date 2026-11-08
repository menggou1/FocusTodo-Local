import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { ApplicationServices, LanguagePreference } from '../app/contracts';
import type { Entity } from '../services/core.mjs';
import { workspaceText } from '../shared/workspace';
import { WorkspaceProvider, useWorkspace } from './workspace/Context';
import { ProjectEditor, ProjectManager } from './workspace/Projects';
import { TaskDetails } from './workspace/TaskDetails';
import { ProjectIcon } from './workspace/ProjectIcon';
import { dateInput, expected, number, ordered, projectName } from './workspace/model';
import '../styles/app.css';

type View = { kind: 'project'; id: string } | { kind: 'search' | 'timer' | 'reports' | 'forest' | 'settings' };
export function App({ services }: { services: ApplicationServices }) {
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  const text = workspaceText(services.language.locale);
  useEffect(() => {
    document.documentElement.lang = services.language.locale;
    document.title = 'FocusTodo · ' + text.preview;
  }, [services, preferences.language, text.preview]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = (preferences.isDarkMode ?? media.matches) ? 'dark' : 'light'; };
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [preferences.isDarkMode]);
  return <WorkspaceProvider services={services} text={text}><Workspace /></WorkspaceProvider>;
}

function Workspace() {
  const { services, text, run, busy, blocked } = useWorkspace();
  const snapshot = useSyncExternalStore(services.business.subscribe, services.business.getSnapshot);
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  const [view, setView] = useState<View>({ kind: 'project', id: 'id-deadline-today' });
  const [query, setQuery] = useState(''), [name, setName] = useState(''), [selected, select] = useState('');
  const [showCompleted, setShowCompleted] = useState(preferences.showFinishedTasksInToday);
  const [projectEditor, setProjectEditor] = useState<1000 | 2000 | null>(null), [manager, setManager] = useState(false);
  const [mobileNav, setMobileNav] = useState(false), [dragId, setDragId] = useState('');
  const taskDrag = useRef<{ row: Entity; rows: Entity[] } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  useEffect(() => {
    if (focusHeading.current && !mobileNav) { focusHeading.current = false; heading.current?.focus(); }
  }, [view, mobileNav]);
  const projects = ordered(snapshot.projects.filter(row => row.state !== -1));
  const fallback = projects.find(row => row.type === 7005);
  const project = view.kind === 'project' ? projects.find(row => row.id === view.id && row.state === 0) || fallback : undefined;
  const selectedTask = snapshot.tasks.find(row => row.id === selected && row.state === 0);
  const isTasks = view.kind === 'search' || view.kind === 'project' && ![7001].includes(number(project?.type));
  const completedView = project?.type === 7003;
  const title = project ? projectName(project, text) : text[view.kind === 'project' ? 'tasks' : view.kind];
  const active = view.kind === 'search' ? ordered(services.business.search(query)) : project && isTasks
    ? ordered(services.business.tasksInView({ id: completedView ? '' : project.id, type: completedView ? 7000 : number(project.type) }, !!completedView)) : [];
  const completedTasks = project && !completedView && isTasks ? ordered(services.business.tasksInView({ id: project.id, type: number(project.type) }, true)) : [];
  const finished = showCompleted ? completedTasks : [];
  const completedCount = completedView || view.kind === 'search' ? active.filter(row => row.isFinished).length : completedTasks.length;
  function navigate(next: View) { focusHeading.current = true; setView(next); select(''); setMobileNav(false); }
  function cancelDrag() { taskDrag.current = null; setDragId(''); }
  async function reorder(to: Entity, source = taskDrag.current) {
    cancelDrag(); if (!source || source.row.id === to.id) return;
    const rows = source.rows.filter(row => row.id !== source.row.id), index = rows.findIndex(row => row.id === to.id);
    if (index < 0) return;
    const from = source.rows.findIndex(row => row.id === source.row.id), originalTo = source.rows.findIndex(row => row.id === to.id);
    const insert = index + (from < originalTo ? 1 : 0);
    const before = rows[insert - 1], after = rows[insert];
    const order = before && after ? (number(before.order) + number(after.order)) / 2 : before ? number(before.order) + 10000 : number(after?.order) - 10000;
    if (before && order <= number(before.order) || after && order >= number(after.order)) {
      await run(async () => { throw Object.assign(new Error('Order slots overlap'), { code: 'conflict' }); }); return;
    }
    await run(() => services.business.command({ type: 'updateTask', id: source.row.id, changes: { order }, expected: source.row }));
  }
  const taskRow = (task: Entity, rows: Entity[]) => <li key={task.id} className="workspace-task" data-testid="task-row" data-task-id={task.id} data-selected={selected === task.id || undefined} data-dragging={dragId === task.id || undefined}
    onDragOver={event => { if (taskDrag.current?.rows.some(row => row.id === task.id)) event.preventDefault(); }}
    onDrop={event => { event.preventDefault(); void reorder(task); }}>
    <button type="button" className="workspace-handle" aria-label={text.reorder + ': ' + task.name} draggable={!busy && !blocked} aria-disabled={busy || blocked} disabled={blocked}
      onDragStart={event => { taskDrag.current = { row: task, rows }; setDragId(task.id); event.dataTransfer.setData('text/plain', task.id); }} onDragEnd={cancelDrag}
      onKeyDown={event => {
        if (event.key === 'Escape') { cancelDrag(); return; }
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault();
        const target = rows[rows.findIndex(row => row.id === task.id) + (event.key === 'ArrowUp' ? -1 : 1)];
        if (target) void reorder(target, { row: task, rows });
      }}>⠿</button>
    <input type="checkbox" aria-label={(task.isFinished ? text.undo : text.complete) + ': ' + task.name} checked={!!task.isFinished} disabled={busy || blocked}
      onChange={() => { void run(() => services.business.command({ type: task.isFinished ? 'uncompleteTask' : 'completeTask', id: task.id, expected: task })); }} />
    <button type="button" className="workspace-task-name" onClick={() => select(task.id)} data-finished={!!task.isFinished}>{task.name}</button>
    {number(task.priority) > 0 && <span className="workspace-priority" aria-label={text.priority + ': ' + task.priority}>⚑</span>}
    <span className="workspace-task-date">{dateInput(task.deadline)}</span>
  </li>;
  const navigationRow = (row: Entity, nested = false) => {
    const folder = row.type === 2000;
    return <div key={row.id} className={nested ? 'workspace-nested' : undefined}>
      <button className="workspace-nav" aria-label={projectName(row, text)} data-project-id={row.id} data-view={row.type === 7005 ? 'tasks' : undefined}
        aria-current={view.kind === 'project' && project?.id === row.id ? 'page' : undefined}
        aria-expanded={folder ? row.expanded !== false : undefined} disabled={folder && (busy || blocked)}
        onClick={() => folder ? void run(() => services.business.command({ type: 'updateProject', id: row.id, changes: { expanded: row.expanded === false }, expected: expected(row, ['expanded', 'state']) })) : navigate({ kind: 'project', id: row.id })}>
        <ProjectIcon type={number(row.type)} />{folder && <span aria-hidden="true">{row.expanded === false ? '▸' : '▾'}</span>}
        <span className="workspace-nav-name">{projectName(row, text)}</span>
        {!folder && ![7001, 7003].includes(number(row.type)) && <span className="workspace-nav-count">{services.business.tasksInView({ id: row.id, type: number(row.type) }).length || ''}</span>}
      </button>
      {folder && row.expanded !== false && projects.filter(child => child.type === 1000 && child.parentId === row.id && child.state === 0).map(child => navigationRow(child, true))}
    </div>;
  };
  return <div className="workspace-shell" data-testid="app-shell">
    <a className="prototype-skip" href="#workspace-content">{text.skip}</a>
    <header className="workspace-header">
      <button className="workspace-mobile-toggle" aria-label={text.navigation} aria-expanded={mobileNav} onClick={() => setMobileNav(value => !value)}>☰</button>
      <span className="workspace-avatar" aria-hidden="true">♙</span><span>FocusTodo</span><span className="workspace-preview" title={text.previewHelp}>{text.preview}</span>
      <nav aria-label={text.navigation}>{(['timer', 'forest', 'reports', 'settings'] as const).map(item => <button key={item} data-view={item} aria-current={view.kind === item ? 'page' : undefined} onClick={() => navigate({ kind: item })}>{text[item]}</button>)}</nav>
    </header>
    <div className={'workspace-layout' + (selectedTask && isTasks ? ' has-details' : '')}>
      <nav className="workspace-sidebar" data-open={mobileNav} aria-label={text.lists} style={{ '--sidebar-width': preferences.projectRegionWidth + 'px' } as CSSProperties}>
        <label className="workspace-search"><span className="workspace-sr">{text.search}</span><input type="search" placeholder={text.search} title={text.searchHelp} value={query}
          onFocus={() => { setView({ kind: 'search' }); select(''); }} onChange={event => { setQuery(event.target.value); setView({ kind: 'search' }); }}
          onKeyDown={event => { if (event.key === 'Enter') { setMobileNav(false); heading.current?.focus(); } }} /></label>
        <div className="workspace-projects">{projects.filter(row => row.state === 0 && row.type !== 7002 && row.type !== 3000 && (!row.parentId || !projects.some(parent => parent.id === row.parentId && parent.state === 0))).map(row => navigationRow(row))}</div>
        <footer><button disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setProjectEditor(1000); }}>＋ {text.createList}</button>
          <button disabled={busy || blocked} aria-label={text.createFolder} title={text.createFolder} onClick={event => { event.currentTarget.focus(); setProjectEditor(2000); }}>▱＋</button>
          <button aria-label={text.manageLists} title={text.manageLists} onClick={event => { event.currentTarget.focus(); setManager(true); }}>☷</button></footer>
      </nav>
      <main id="workspace-content" className="workspace-content" tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        {isTasks ? <>
          <div className="workspace-summary"><span><strong>{active.filter(row => !row.isFinished).length}</strong>{text.activeCount}</span><span><strong data-testid="completed-total">{completedCount}</strong>{text.completedCount}</span></div>
          {!completedView && view.kind !== 'search' && <form className="workspace-add-task" onSubmit={async event => {
            event.preventDefault();
            const now = new Date(), type = number(project?.type);
            let deadline = preferences.defaultDeadline;
            if (type === 4000 || type === 4001) { if (type === 4001) now.setDate(now.getDate() + 1); deadline = now.setHours(23, 59, 59, 999); }
            if (type === 4003) deadline = 0;
            const peers = snapshot.tasks.filter(row => row.state === 0 && !row.isFinished);
            const order = preferences.newTaskOnTop ? Math.min(0, ...peers.map(row => number(row.order))) - 10000 : Math.max(0, ...peers.map(row => number(row.order))) + 10000;
            if (await run(() => services.business.command({ type: 'addTask', values: { name: name.trim(), projectId: [1000, 7005].includes(type) ? project?.id : fallback?.id || '',
              deadline, order, priority: [5001, 5002, 5003].includes(type) ? type - 5000 : 0 } }))) setName('');
          }}><span aria-hidden="true">＋</span><input aria-label={text.addTask} placeholder={text.addTask} value={name} maxLength={1000} required disabled={busy || blocked} onChange={event => setName(event.target.value)} /></form>}
          <ul className="workspace-tasks" aria-label={title}>{active.map(task => taskRow(task, active))}</ul>
          {!active.length && <p className="workspace-empty">{text.empty}</p>}
          {project && !completedView && <><button className="workspace-completed-toggle" onClick={() => setShowCompleted(value => !value)}>{showCompleted ? text.hideCompleted : text.showCompleted}</button>
            <ul className="workspace-tasks" aria-label={text.completed}>{finished.map(task => taskRow(task, finished))}</ul></>}
        </> : view.kind === 'settings' ? <section className="workspace-settings">
          <label>{text.language}<select data-testid="prototype-language" value={preferences.language} disabled={busy || blocked} onChange={event => { void run(() => services.language.setPreference(event.target.value as LanguagePreference)); }}>
            <option value="auto">{text.auto}</option><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
          <label>{text.theme}<select data-testid="prototype-theme" value={preferences.isDarkMode === null ? 'auto' : preferences.isDarkMode ? 'dark' : 'light'} disabled={busy || blocked}
            onChange={event => { void run(() => services.settings.set('isDarkMode', event.target.value === 'auto' ? null : event.target.value === 'dark')); }}>
            <option value="auto">{text.auto}</option><option value="light">{text.light}</option><option value="dark">{text.dark}</option></select></label>
        </section> : <p className="workspace-empty">{text.pending}</p>}
      </main>
      {selectedTask && isTasks && <TaskDetails key={selectedTask.id} task={selectedTask} projects={projects} subtasks={snapshot.subtasks} close={() => select('')} />}
    </div>
    {projectEditor && <ProjectEditor type={projectEditor} projects={projects} close={() => setProjectEditor(null)} />}
    {manager && <ProjectManager projects={projects} close={() => setManager(false)} />}
  </div>;
}
