import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { ApplicationServices } from '../app/contracts';
import type { Entity } from '../services/core.mjs';
import { workspaceText } from '../shared/workspace';
import { WorkspaceProvider, useWorkspace } from './workspace/Context';
import { ProjectEditor, ProjectManager } from './workspace/Projects';
import { TaskDetails } from './workspace/TaskDetails';
import { ProjectIcon } from './workspace/ProjectIcon';
import { taskGroups } from './workspace/TaskGroups';
import { Timer } from './workspace/Timer';
import { Calendar } from './workspace/Calendar';
import { History, Reports } from './workspace/Reports';
import { Forest } from './workspace/Forest';
import { Settings } from './workspace/Settings';
import { Updates } from './workspace/Updates';
import { PageOverlay } from './workspace/Dialog';
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
  const { services, text, run, report, busy, blocked } = useWorkspace();
  const snapshot = useSyncExternalStore(services.business.subscribe, services.business.getSnapshot);
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  const [timerOpen,setTimerOpen]=useState(false);
  const [overlay,setOverlay]=useState<'settings'|'reports'|'forest'|null>(null),[settingsTab,setSettingsTab]=useState('general');
  const [view, setView] = useState<View>({ kind: 'project', id: 'id-deadline-today' });
  const [query, setQuery] = useState(''), [name, setName] = useState(''), [selected, select] = useState('');
  const [showCompleted, setShowCompleted] = useState(preferences.showFinishedTasksInToday);
  const [projectEditor, setProjectEditor] = useState<1000 | 2000 | 3000 | null>(null), [manager, setManager] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  const resizeStart = useRef<{x: number; width: number} | null>(null);
  const [mobileNav, setMobileNav] = useState(false), [dragId, setDragId] = useState('');
  const taskDrag = useRef<{ row: Entity; rows: Entity[] } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const timerReturn=useRef<{view:View;selected:string}>({view:{kind:'project',id:'id-deadline-today'},selected:''});
  useEffect(()=>{void services.forest.dailyLaunch().catch(report)},[services]);
  const achievementKey=snapshot.tasks.filter(row=>row.state!==-1&&row.isFinished).length+'|'+snapshot.records.map(row=>[row.id,row.state,row.endDate,row.interval].join(':')).join(',');
  useEffect(()=>{const timer=setTimeout(()=>{void services.forest.syncAchievements().catch(report)},100);return()=>clearTimeout(timer)},[services,achievementKey]);
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
  const active = view.kind === 'search' ? ordered(services.business.search(query)) : project?.type === 3000 ? ordered(snapshot.tasks.filter(row => row.state === 0 && !row.isFinished && String(row.tags).split(',').includes(project.id))) : project && isTasks
    ? ordered(services.business.tasksInView({ id: completedView ? '' : project.id, type: completedView ? 7000 : number(project.type) }, !!completedView)) : [];
  const completedTasks = project?.type === 3000 ? ordered(snapshot.tasks.filter(row => row.state === 0 && row.isFinished && String(row.tags).split(',').includes(project.id))) : project && !completedView && isTasks ? ordered(services.business.tasksInView({ id: project.id, type: number(project.type) }, true)) : [];
  const finished = showCompleted ? completedTasks : [];
  const completedCount = completedView || view.kind === 'search' ? active.filter(row => row.isFinished).length : completedTasks.length;
  const estimatedSeconds = active.filter(row => !row.isFinished).reduce((total, row) => total + number(row.estimatePomoNum) * number(row.pomodoroInterval), 0);
  const taskIds = new Set([...active, ...completedTasks].map(row => row.id));
  const spentSeconds = snapshot.records.filter(row => row.state !== -1 && taskIds.has(String(row.taskId))).reduce((total, row) => total + number(row.interval), 0);
  const customOrder = project?.orderingRule === 3 && !completedView;
  function navigate(next: View) { if(next.kind==='settings'||next.kind==='reports'||next.kind==='forest'){setSettingsTab('general');setOverlay(next.kind);return} setOverlay(null);if(next.kind==='timer'){timerReturn.current={view,selected};setTimerOpen(true);return} setTimerOpen(false);focusHeading.current = true; setView(next); select(''); setMobileNav(false); }
  function openTask(id:string) { navigate({kind:'project',id:'id-task-tasks'});select(id); }
  async function startTask(id:string,child?:string) { if(await run(()=>id?services.startForTask(id,child):services.timer.command({type:'switchTask',taskId:'',subtaskId:'',mode:preferences.isCountdown?'countdown':'countup',config:services.settings.timerConfig(),expectedSession:services.timer.getSnapshot()?.sessionId})))navigate({kind:'timer'}); }
  function cancelDrag() { taskDrag.current = null; setDragId(''); }
  async function reorder(to: Entity, source = taskDrag.current) {
    cancelDrag(); if (!source || source.row.id === to.id) return;
    const rows = source.rows.filter(row => row.id !== source.row.id), index = rows.findIndex(row => row.id === to.id);
    if (index < 0) return;
    const from = source.rows.findIndex(row => row.id === source.row.id), originalTo = source.rows.findIndex(row => row.id === to.id);
    const insert = index + (from < originalTo ? 1 : 0);
    rows.splice(insert,0,source.row);
    await run(()=>services.business.batch(rows.map((row,index)=>({type:'updateTask',id:row.id,changes:{order:(index+1)*10000},expected:row}))));
  }
  const taskRow = (task: Entity, rows: Entity[]) => <li key={task.id} className="workspace-task" data-testid="task-row" data-task-id={task.id} data-selected={selected === task.id || undefined} data-dragging={dragId === task.id || undefined}
    onDragOver={event => { if (customOrder && taskDrag.current?.rows.some(row => row.id === task.id)) event.preventDefault(); }}
    onDrop={event => { event.preventDefault(); if (customOrder) void reorder(task); }}>
    <button type="button" className="workspace-handle" aria-label={text.reorder + ': ' + task.name} draggable={!busy && !blocked && !task.isFinished} aria-disabled={busy || blocked} disabled={blocked || !!task.isFinished}
      onDragStart={event => { taskDrag.current = { row: task, rows }; setDragId(task.id); event.dataTransfer.setData('text/plain', task.id); }} onDragEnd={cancelDrag}
      onKeyDown={event => {
        if (event.key === 'Escape') { cancelDrag(); return; }
        if (!customOrder || !['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault();
        const target = rows[rows.findIndex(row => row.id === task.id) + (event.key === 'ArrowUp' ? -1 : 1)];
        if (target) void reorder(target, { row: task, rows });
      }}>⠿</button>
    <input type="checkbox" aria-label={(task.isFinished ? text.undo : text.complete) + ': ' + task.name} checked={!!task.isFinished} disabled={busy || blocked}
      onChange={() => { void run(async () => {
        await services.business.command({ type: task.isFinished ? 'uncompleteTask' : 'completeTask', id: task.id, expected: task });
        if (!task.isFinished && preferences.completeSoundEnabled) { try { services.audio?.effect('Complete.m4a', preferences.ringtoneVolume / 100); } catch { /* Media failure cannot undo a committed task. */ } }
      }); }} />
    <button type="button" className="workspace-task-name" onClick={() => select(task.id)} data-finished={!!task.isFinished}>{task.name}</button>
    {!task.isFinished && <button type="button" aria-label={text.focusTask + ': ' + task.name} disabled={busy || blocked} onClick={async () => { if (await run(() => services.startForTask(task.id))) navigate({ kind: 'timer' }); }}>▷</button>}
    {number(task.priority) > 0 && <span className="workspace-priority" aria-label={text.priority + ': ' + task.priority}>⚑</span>}
    <span className="workspace-task-date">{dateInput(task.deadline)}</span>
    {snapshot.subtasks.some(child=>child.taskId===task.id&&child.state===0)&&<button aria-label={task.isExpanded?text.collapse:text.expand} aria-expanded={!!task.isExpanded} disabled={busy||blocked} onClick={()=>{void run(()=>services.business.command({type:'updateTask',id:task.id,changes:{isExpanded:!task.isExpanded},expected:{isExpanded:task.isExpanded}}))}}>▾</button>}
    {!!task.isExpanded&&<ul className="domain-inline-subtasks">{ordered(snapshot.subtasks.filter(child=>child.taskId===task.id&&child.state===0)).map(child=><li key={child.id}><input type="checkbox" checked={!!child.isFinished} aria-label={text.toggleSubtask+': '+child.name} disabled={busy||blocked} onChange={()=>{void run(()=>services.business.command({type:'toggleSubtask',id:child.id,expected:child}))}}/><button onClick={()=>select(task.id)}>{child.name}</button>{!child.isFinished&&<button aria-label={text.focusSubtask+': '+child.name} disabled={busy||blocked} onClick={()=>{void startTask(task.id,child.id)}}>▷</button>}</li>)}</ul>}
  </li>;
  const navigationRow = (row: Entity, nested = false) => {
    const folder = row.type === 2000;
    return <div key={row.id} className={nested ? 'workspace-nested' : undefined}>
      <button className="workspace-nav" aria-label={projectName(row, text)} data-project-id={row.id} data-view={row.type === 7005 ? 'tasks' : undefined}
        onDragOver={event => { if (taskDrag.current && [1000, 7005, 3000, 4000, 4001, 4003, 5001, 5002, 5003].includes(number(row.type))) event.preventDefault(); }}
        onDrop={event => {
          event.preventDefault(); const source = taskDrag.current?.row; cancelDrag(); if (!source || source.isFinished) return;
          const type = number(row.type), date = new Date(), changes: Record<string, unknown> = {};
          if ([1000, 7005].includes(type)) changes.projectId = row.id;
          else if (type === 3000) changes.tags = [...new Set([...String(source.tags || '').split(',').filter(Boolean), row.id])].join(',');
          else if ([4000, 4001, 4003].includes(type)) { if (type === 4001) date.setDate(date.getDate() + 1); changes.deadline = type === 4003 ? 0 : date.setHours(23, 59, 59, 999); }
          else if ([5001, 5002, 5003].includes(type)) changes.priority = type - 5000; else return;
          void run(() => services.business.command({ type: 'updateTask', id: source.id, changes, expected: source }));
        }}
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
      <button className="workspace-profile" aria-label={services.language.locale.startsWith('zh')?'本地资料':'Local profile'} onClick={()=>{setSettingsTab('account');setOverlay('settings')}}>{services.settings.profile().avatar?<img className="workspace-avatar" src={services.settings.profile().avatar} alt=""/>:<span className="workspace-avatar" aria-hidden="true">♙</span>}<span>{services.settings.profile().name}</span></button><span className="workspace-preview" title={text.previewHelp}>{text.preview}</span>
      <nav aria-label={text.navigation}>{(['timer', 'forest', 'reports', 'settings'] as const).map(item => <button key={item} data-view={item} aria-current={(item==='timer'?timerOpen:overlay===item)?'page':undefined} onClick={() => navigate({ kind: item })}>{text[item]}</button>)}<Updates openTask={openTask}/></nav>
    </header>
    <div className={'workspace-layout' + (selectedTask && isTasks ? ' has-details' : '')}>
      <nav className="workspace-sidebar" data-open={mobileNav} aria-label={text.lists} style={{ '--sidebar-width': (resizeWidth ?? preferences.projectRegionWidth) + 'px' } as CSSProperties}>
        <label className="workspace-search"><span className="workspace-sr">{text.search}</span><input type="search" placeholder={text.search} title={text.searchHelp} value={query}
          onFocus={() => { setView({ kind: 'search' }); select(''); }} onChange={event => { setQuery(event.target.value); setView({ kind: 'search' }); }}
          onKeyDown={event => { if (event.key === 'Enter') { setMobileNav(false); heading.current?.focus(); } }} /></label>
        <div className="workspace-projects">{projects.filter(row => row.state === 0 && row.type !== 7002 && (!row.parentId || !projects.some(parent => parent.id === row.parentId && parent.state === 0))).map(row => navigationRow(row))}</div>
        <footer><button disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setProjectEditor(1000); }}>＋ {text.createList}</button>
          <button disabled={busy || blocked} aria-label={text.createFolder} title={text.createFolder} onClick={event => { event.currentTarget.focus(); setProjectEditor(2000); }}>▱＋</button>
          <button disabled={busy || blocked} aria-label={text.createTag} title={text.createTag} onClick={event => { event.currentTarget.focus(); setProjectEditor(3000); }}>#＋</button>
          <button aria-label={text.manageLists} title={text.manageLists} onClick={event => { event.currentTarget.focus(); setManager(true); }}>☷</button></footer>
      </nav>
      <div className="workspace-resize" role="separator" aria-label={text.sidebarWidth} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={380} aria-valuenow={resizeWidth ?? preferences.projectRegionWidth} tabIndex={0}
        onPointerDown={event => { if (busy || blocked) return; resizeStart.current = { x: event.clientX, width: preferences.projectRegionWidth }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (resizeStart.current) setResizeWidth(Math.min(380, Math.max(180, resizeStart.current.width + event.clientX - resizeStart.current.x))); }}
        onPointerUp={event => { if (!resizeStart.current) return; const value = Math.min(380, Math.max(180, resizeStart.current.width + event.clientX - resizeStart.current.x)); resizeStart.current = null; setResizeWidth(null); void run(() => services.settings.set('projectRegionWidth', value)); }}
        onPointerCancel={() => { resizeStart.current = null; setResizeWidth(null); }}
        onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); void run(() => services.settings.set('projectRegionWidth', preferences.projectRegionWidth + (event.key === 'ArrowLeft' ? -10 : 10))); } }} />
      <main id="workspace-content" className="workspace-content" tabIndex={-1}>
        <div className="workspace-view-heading"><h1 ref={heading} tabIndex={-1}>{title}</h1>{project && !completedView && <label className="workspace-sort"><span className="workspace-sr">{text.sort}</span><select aria-label={text.sort} value={number(project.orderingRule)} disabled={busy || blocked} onChange={event => { void run(() => services.business.command({ type: 'updateProject', id: project.id, changes: { orderingRule: Number(event.target.value) }, expected: expected(project, ['orderingRule']) })); }}>
          {[text.project, text.deadline, text.priority, text.manual].map((name, index) => <option value={index} key={index}>{name}</option>)}</select></label>}</div>
        {isTasks ? <>
          <div className="workspace-summary"><span><strong>{Math.round(estimatedSeconds / 60)}</strong>{text.estimatedTime} ({text.minutes})</span><span><strong>{active.filter(row => !row.isFinished).length}</strong>{text.activeCount}</span><span><strong>{Math.round(spentSeconds / 60)}</strong>{text.elapsedTime} ({text.minutes})</span><span><strong data-testid="completed-total">{completedCount}</strong>{text.completedCount}</span></div>
          {!completedView && view.kind !== 'search' && <form className="workspace-add-task" onSubmit={async event => {
            event.preventDefault();
            const now = new Date(), type = number(project?.type);
            let deadline = preferences.defaultDeadline;
            if (type === 4000 || type === 4001) { if (type === 4001) now.setDate(now.getDate() + 1); deadline = now.setHours(23, 59, 59, 999); }
            if (type === 4003) deadline = 0;
            const peers = snapshot.tasks.filter(row => row.state === 0 && !row.isFinished);
            const order = preferences.newTaskOnTop ? Math.min(0, ...peers.map(row => number(row.order))) - 10000 : Math.max(0, ...peers.map(row => number(row.order))) + 10000;
            if (await run(() => services.business.command({ type: 'addTask', values: { name: name.trim(), projectId: [1000, 7005].includes(type) ? project?.id : fallback?.id || '',
              deadline, order, tags: type === 3000 ? project?.id : '', priority: [5001, 5002, 5003].includes(type) ? type - 5000 : 0 } }))) setName('');
          }}><span aria-hidden="true">＋</span><input aria-label={text.addTask} placeholder={text.addTask} value={name} maxLength={1000} required disabled={busy || blocked} onChange={event => setName(event.target.value)} /></form>}
          {taskGroups(active, project, projects, text).map(group => <section key={group.id} className="workspace-task-group">{group.title && <h2>{group.title}</h2>}<ul className="workspace-tasks" aria-label={group.title || title}>{group.rows.map(task => taskRow(task, group.rows))}</ul></section>)}
          {!active.length && <p className="workspace-empty">{text.empty}</p>}
          {project && !completedView && <><button className="workspace-completed-toggle" onClick={() => setShowCompleted(value => !value)}>{showCompleted ? text.hideCompleted : text.showCompleted}</button>
            <ul className="workspace-tasks" aria-label={text.completed}>{finished.map(task => taskRow(task, finished))}</ul></>}
          {completedView&&<History openTask={openTask}/>}
        </> : view.kind === 'settings' ? <Settings/> : view.kind==='reports'?<Reports openTask={openTask}/>:view.kind==='forest'?<Forest/>:project?.type===7001?<Calendar startTask={(id,child)=>{void startTask(id,child)}} openTask={openTask}/>:null}
        <Timer expanded={timerOpen} openExpanded={() => navigate({ kind: 'timer' })} closeExpanded={()=>{setTimerOpen(false);focusHeading.current=true;setView({...timerReturn.current.view});select(timerReturn.current.selected)}} />
      </main>
      {selectedTask && isTasks && <TaskDetails key={selectedTask.id} task={selectedTask} projects={projects} subtasks={snapshot.subtasks} close={() => select('')} onStart={() => navigate({ kind: 'timer' })} />}
    </div>
    {projectEditor && <ProjectEditor type={projectEditor} projects={projects} close={() => setProjectEditor(null)} />}
    {manager && <ProjectManager projects={projects} close={() => setManager(false)} />}
  {overlay&&<PageOverlay title={text[overlay]} full={overlay!=='settings'} close={()=>setOverlay(null)}>{overlay==='settings'?<Settings initialTab={settingsTab}/>:overlay==='reports'?<Reports openTask={openTask}/>:<Forest/>}</PageOverlay>}
  </div>;
}
