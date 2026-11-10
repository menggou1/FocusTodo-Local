import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { ApplicationServices } from '../app/contracts';
import type { Entity } from '../services/core.mjs';
import { workspaceText } from '../shared/workspace';
import { WorkspaceProvider, useWorkspace } from './workspace/Context';
import { Sidebar, type SidebarView } from './workspace/Sidebar';
import { TaskDetails } from './workspace/TaskDetails';
import { ProjectIcon } from './workspace/ProjectIcon';
import { LegacyIcon } from './workspace/LegacyIcon';
import { TaskName } from './workspace/TaskName';
import { TaskDeleteDialog } from './workspace/TaskDeleteDialog';
import { TaskContextMenu } from './workspace/TaskContextMenu';
import { taskGroups } from './workspace/TaskGroups';
import { Timer } from './workspace/Timer';
import { Calendar } from './workspace/Calendar';
import { History, Reports } from './workspace/Reports';
import { Forest } from './workspace/Forest';
import { Settings } from './workspace/Settings';
import { Updates } from './workspace/Updates';
import { PageOverlay } from './workspace/Dialog';
import { LegacyScrollbars } from './workspace/LegacyScrollbars';
import { dateInput, expected, number, ordered, projectName } from './workspace/model';
import '../styles/app.css';

type View = SidebarView;
export function App({ services }: { services: ApplicationServices }) {
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  const text = workspaceText(services.language.locale);
  useEffect(() => {
    document.documentElement.lang = services.language.locale;
    document.title = 'FocusTodo';
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
  const [deletingTask,setDeletingTask]=useState<Entity|null>(null);
  const [timerOpen,setTimerOpen]=useState(false),[forestReward,setForestReward]=useState(0);
  const [overlay,setOverlay]=useState<'settings'|'reports'|'forest'|null>(null),[settingsTab,setSettingsTab]=useState('pomodoro');
  useEffect(()=>{let live=true;const update=()=>services.forest.rewards().then(items=>{if(live)setForestReward(items.reduce((sum,item)=>sum+item.powerValue,0))}).catch(report);void update();const timer=setInterval(update,30000);return()=>{live=false;clearInterval(timer)}},[services,snapshot,report,overlay]);
  const [quickEstimate,setQuickEstimate]=useState(0),[quickProjectId,setQuickProjectId]=useState(''),[profileMenu,setProfileMenu]=useState(false);
  const [view, setView] = useState<View>({ kind: 'project', id: 'id-deadline-today' });
  const [query, setQuery] = useState(''), [name, setName] = useState(''), [selected, select] = useState('');
  const [showCompleted, setShowCompleted] = useState(preferences.showFinishedTasksInToday);
  const [taskMenu, setTaskMenu] = useState<{ task: Entity; x: number; y: number } | null>(null);
  const taskMenuReturn = useRef<HTMLElement | null>(null);
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
  const title = project ? projectName(project, text) : view.kind === 'search' ? services.language.legacyText('tsk_search_result') : text[view.kind];
  const active = view.kind === 'search' ? ordered(services.business.search(query)) : project?.type === 3000 ? ordered(snapshot.tasks.filter(row => row.state === 0 && !row.isFinished && String(row.tags).split(',').includes(project.id))) : project && isTasks
    ? ordered(services.business.tasksInView({ id: completedView ? '' : project.id, type: completedView ? 7000 : number(project.type) }, !!completedView)) : [];
  const completedTasks = project?.type === 3000 ? ordered(snapshot.tasks.filter(row => row.state === 0 && row.isFinished && String(row.tags).split(',').includes(project.id))) : project && !completedView && isTasks ? ordered(services.business.tasksInView({ id: project.id, type: number(project.type) }, true)) : [];
  const finished = showCompleted ? completedTasks : [];
  const completedCount = completedView || view.kind === 'search' ? active.filter(row => row.isFinished).length : completedTasks.length;
  const actualPomodoros=(task:Entity)=>snapshot.records.filter(row=>row.state!==-1&&row.taskId===task.id).reduce((sum,row)=>sum+Math.min(number(row.interval)/(number(row.pomodoroInterval)||preferences.workInterval),1),0);
  const remaining=(task:Entity)=>Math.max(0,number(task.estimatePomoNum)-actualPomodoros(task))*(number(task.pomodoroInterval)||preferences.workInterval);
  const navTasks=(row:Entity):readonly Entity[]=>row.type===3000?snapshot.tasks.filter(task=>task.state===0&&!task.isFinished&&String(task.tags||'').split(',').includes(row.id)):row.type===2000?snapshot.tasks.filter(task=>task.state===0&&!task.isFinished&&projects.some(child=>child.id===task.projectId&&child.parentId===row.id)):services.business.tasksInView({id:row.id,type:number(row.type)});
  const sidebarSummary=(row:Entity)=>{const tasks=navTasks(row);return {count:tasks.length,minutes:Math.round(tasks.reduce((total,task)=>total+remaining(task),0)/60)}};
  const canDropTask=(row:Entity)=>{const source=taskDrag.current?.row;return !!source&&!source.isFinished&&[1000,7005,3000,4000,4001,4003,5001,5002,5003].includes(number(row.type))};
  function dropTask(row:Entity){const source=taskDrag.current?.row;cancelDrag();if(!source||source.isFinished)return;const type=number(row.type),date=new Date(),changes:Record<string,unknown>={};if([1000,7005].includes(type))changes.projectId=row.id;else if(type===3000)changes.tags=[...new Set([...String(source.tags||'').split(',').filter(Boolean),row.id])].join(',');else if([4000,4001,4003].includes(type)){if(type===4001)date.setDate(date.getDate()+1);changes.deadline=type===4003?0:date.setHours(23,59,59,999)}else if([5001,5002,5003].includes(type))changes.priority=type-5000;else return;void run(()=>services.business.command({type:'updateTask',id:source.id,changes,expected:source}))}
  const estimatedSeconds = active.filter(row => !row.isFinished).reduce((total, row) => total + remaining(row), 0);
  const taskIds = new Set([...active, ...completedTasks].map(row => row.id));
  let spentSeconds = snapshot.records.filter(row => row.state !== -1 && taskIds.has(String(row.taskId))).reduce((total, row) => total + number(row.interval), 0);
  if([4000,4007].includes(number(project?.type))){const lower=new Date();lower.setHours(0,0,0,0);const upper=new Date();if(project?.type===4007){lower.setDate(lower.getDate()-(lower.getDay()+6)%7);upper.setTime(+lower);upper.setDate(upper.getDate()+7)}spentSeconds=services.business.report(+lower,+upper).time}else if([4001,4002,4003,4004,4006].includes(number(project?.type)))spentSeconds=0;
  const quickProject=projects.find(row=>row.id===quickProjectId)||([1000,7005].includes(number(project?.type))?project:fallback);
  const customOrder = project?.orderingRule === 3 && !completedView;
  function navigate(next: View, focus = true) { if(next.kind==='settings'||next.kind==='reports'||next.kind==='forest'){setSettingsTab('pomodoro');setOverlay(next.kind);return} setOverlay(null);if(next.kind==='timer'){timerReturn.current={view,selected};setTimerOpen(true);return} setTimerOpen(false);focusHeading.current = focus; setView(next);setQuickProjectId(''); select(''); setMobileNav(false); }
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
  function closeTaskMenu() {
    setTaskMenu(null);
    const target = taskMenuReturn.current;
    taskMenuReturn.current = null;
    requestAnimationFrame(() => { if (target?.isConnected) target.focus(); });
  }
  function openTaskMenu(task: Entity, event: ReactMouseEvent<HTMLLIElement>) {
    if (task.isFinished || (event.target as Element).closest('.domain-inline-subtasks')) return;
    event.preventDefault(); event.stopPropagation();
    const row = event.currentTarget;
    const name = row.querySelector<HTMLElement>('.workspace-task-name');
    const active = document.activeElement;
    taskMenuReturn.current = active instanceof HTMLElement && row.contains(active) && active !== document.body ? active : name;
    setTaskMenu({ task, x: event.clientX, y: event.clientY });
  }
  function openTaskMenuFromKeyboard(task: Entity, event: ReactKeyboardEvent<HTMLLIElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    const target = event.target as Element, name = target.closest<HTMLElement>('.workspace-task-name');
    if (!name) return;
    event.preventDefault(); event.stopPropagation();
    const rect = name.getBoundingClientRect();
    taskMenuReturn.current = name;
    setTaskMenu({ task, x: rect.left + 8, y: rect.bottom + 4 });
  }
  const taskRow = (task: Entity, rows: Entity[]) => <li key={task.id} className="workspace-task" data-testid="task-row" data-task-id={task.id} data-priority={number(task.priority)} data-selected={selected === task.id || undefined} data-dragging={dragId === task.id || undefined}
    onContextMenu={event => openTaskMenu(task, event)}
    onKeyDown={event => openTaskMenuFromKeyboard(task, event)}
    onClick={event => {
      // Legacy TaskItem selected from the row itself and stopped propagation
      // so the workspace did not handle the same click again. Complete/start
      // stopped propagation before the row; name/tags/date/pomodoros bubbled
      // to the row. New independent controls keep their own action and must
      // not select as a side effect.
      const target = event.target as Element;
      if (target.closest('.workspace-task-name')) {
        // TaskName owns the select call; keep the click inside the row once.
        event.stopPropagation();
        return;
      }
      if (target.closest('.domain-inline-subtasks, input, button, a, select, textarea, label')) return;
      event.stopPropagation();
      select(task.id);
    }}
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
    {!task.isFinished && <button type="button" className="workspace-task-start" aria-label={text.focusTask + ': ' + task.name} disabled={busy || blocked} onClick={async () => { if (await run(() => services.startForTask(task.id))) navigate({ kind: 'timer' }); }}><LegacyIcon name="task-start"/></button>}
    <div className="legacy-task-name-pomodoros"><div className="legacy-task-name-line"><TaskName task={task} select={()=>select(task.id)}/><span className="legacy-task-tags">{projects.filter(tag=>tag.type===3000&&String(task.tags||'').split(',').includes(tag.id)).map(tag=><button key={tag.id} type="button" style={{color:'#'+String(tag.color||'fd5553').replace('#','')}} onClick={()=>select(task.id)}>#{tag.name}</button>)}</span></div>{(number(task.estimatePomoNum)>0||actualPomodoros(task)>0)&&<div className="workspace-task-pomos">{number(task.estimatePomoNum)<=5&&actualPomodoros(task)<=number(task.estimatePomoNum)?Array.from({length:Math.max(number(task.estimatePomoNum),Math.ceil(actualPomodoros(task)))},(_,i)=><LegacyIcon key={i} name={i<actualPomodoros(task)?'task-pomo-actual':'task-pomo-estimate'}/>):<><LegacyIcon name="task-pomo-actual"/><span>{Number(actualPomodoros(task).toFixed(1))}</span>{number(task.estimatePomoNum)>0&&<><i>/</i><LegacyIcon name="task-pomo-estimate"/><small>{number(task.estimatePomoNum)}</small></>}</>}</div>}</div>
    {!!task.remark&&<LegacyIcon name="task-remark"/>}
    {number(task.deadline)>0&&<span className="workspace-task-date">{dateInput(task.deadline)===dateInput(new Date().setHours(23,59,59,999))?text.today:dateInput(task.deadline)}</span>}
    {!!task.hasSubtask&&<button aria-label={task.isExpanded?text.collapse:text.expand} aria-expanded={!!task.isExpanded} disabled={busy||blocked} onClick={()=>{void run(()=>services.business.command({type:'updateTask',id:task.id,changes:{isExpanded:!task.isExpanded},expected:{isExpanded:task.isExpanded}}))}}>▾</button>}
    {!!task.hasSubtask&&!!task.isExpanded&&<ul className="domain-inline-subtasks">{ordered(snapshot.subtasks.filter(child=>child.taskId===task.id&&child.state===0)).map(child=><li key={child.id}><input type="checkbox" checked={!!child.isFinished} aria-label={text.toggleSubtask+': '+child.name} disabled={busy||blocked} onChange={()=>{void run(()=>services.business.command({type:'toggleSubtask',id:child.id,expected:child}))}}/><button onClick={()=>select(task.id)}>{child.name}</button>{!child.isFinished&&<button aria-label={text.focusSubtask+': '+child.name} disabled={busy||blocked} onClick={()=>{void startTask(task.id,child.id)}}>▷</button>}</li>)}</ul>}
  </li>;
  return <div className="workspace-shell" data-testid="app-shell">
    <LegacyScrollbars />
    <a className="prototype-skip" href="#workspace-content">{text.skip}</a>
    <header className="workspace-header">
      <button className="workspace-mobile-toggle" aria-label={text.navigation} aria-expanded={mobileNav} onClick={() => setMobileNav(value => !value)}>☰</button>
      <div className="workspace-profile-container"><button className="workspace-profile" aria-label={services.language.locale.startsWith('zh')?'本地资料':'Local profile'} aria-expanded={profileMenu} onClick={()=>setProfileMenu(!profileMenu)}>{services.settings.profile().avatar?<img className="workspace-avatar" src={services.settings.profile().avatar} alt=""/>:<LegacyIcon className="workspace-avatar" name="header-portrait"/>}<span>{services.settings.profile().name}</span><LegacyIcon className="workspace-profile-arrow" name="user-dropdown"/></button>{profileMenu&&<><button className="workspace-menu-dismiss" aria-label={text.close} onClick={()=>setProfileMenu(false)}/><div className="workspace-profile-menu" role="menu">{(['account','pomodoro'] as const).map((tab)=><button key={tab} role="menuitem" onClick={()=>{setProfileMenu(false);setSettingsTab(tab);setOverlay('settings')}}>{tab==='account'?(services.language.locale.startsWith('zh')?'账号':'Account'):text.settings}</button>)}</div></>}</div>
      <nav aria-label={text.navigation}>{(['forest','reports'] as const).map(item=><button key={item} title={text[item]} aria-label={text[item]} data-view={item} aria-current={overlay===item?'page':undefined} onClick={()=>navigate({kind:item})}><LegacyIcon name={item==='forest'?'header-forest':'header-report'}/>{item==='forest'&&forestReward>0&&<small className="legacy-forest-header-count">{forestReward}</small>}</button>)}<Updates openTask={openTask}/><button title={text.settings} aria-label={text.settings} data-view="settings" aria-current={overlay==='settings'?'page':undefined} onClick={()=>navigate({kind:'settings'})}><LegacyIcon name="header-setting"/></button></nav>
    </header>
    <div className={'workspace-layout' + (selectedTask && isTasks ? ' has-details' : '')}>
      <Sidebar projects={projects} view={view} navigate={navigate} query={query} setQuery={setQuery} summary={sidebarSummary}
        width={resizeWidth ?? preferences.projectRegionWidth} mobileNav={mobileNav} canDropTask={canDropTask} dropTask={dropTask} />
      <div className="workspace-resize" role="separator" aria-label={text.sidebarWidth} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={380} aria-valuenow={resizeWidth ?? preferences.projectRegionWidth} tabIndex={0}
        onPointerDown={event => { if (busy || blocked) return; resizeStart.current = { x: event.clientX, width: preferences.projectRegionWidth }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (resizeStart.current) setResizeWidth(Math.min(380, Math.max(180, resizeStart.current.width + event.clientX - resizeStart.current.x))); }}
        onPointerUp={event => { if (!resizeStart.current) return; const value = Math.min(380, Math.max(180, resizeStart.current.width + event.clientX - resizeStart.current.x)); resizeStart.current = null; setResizeWidth(null); void run(() => services.settings.set('projectRegionWidth', value)); }}
        onPointerCancel={() => { resizeStart.current = null; setResizeWidth(null); }}
        onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); void run(() => services.settings.set('projectRegionWidth', preferences.projectRegionWidth + (event.key === 'ArrowLeft' ? -10 : 10))); } }} />
      <main id="workspace-content" className={'workspace-content'+(project?.type===7001?' calendar-content':'')} tabIndex={-1}>
        <div className="workspace-view-heading"><h1 ref={heading} tabIndex={-1}>{title}</h1>{project && !completedView && <label className="workspace-sort"><span className="workspace-sr">{text.sort}</span><select aria-label={text.sort} value={number(project.orderingRule)} disabled={busy || blocked} onChange={event => { void run(() => services.business.command({ type: 'updateProject', id: project.id, changes: { orderingRule: Number(event.target.value) }, expected: expected(project, ['orderingRule']) })); }}>
          {[text.project, text.deadline, text.priority, text.manual].map((name, index) => <option value={index} key={index}>{name}</option>)}</select></label>}</div>
        {isTasks ? <>
          <div className="workspace-summary"><div><div className="workspace-summary-value"><strong>{Math.round(estimatedSeconds / 60)}</strong><small>{text.minutes}</small></div><span>{text.estimatedTime}</span></div><div><div className="workspace-summary-value"><strong>{active.filter(row => !row.isFinished).length}</strong></div><span>{services.language.locale.startsWith('zh')?'待完成任务':'Tasks to be Completed'}</span></div><div><div className="workspace-summary-value"><strong>{Math.round(spentSeconds / 60)}</strong><small>{text.minutes}</small></div><span>{text.elapsedTime}</span></div><div><div className="workspace-summary-value"><strong data-testid="completed-total">{completedCount}</strong></div><span>{services.language.locale.startsWith('zh')?'已完成任务':'Completed Tasks'}</span></div></div>
          {!completedView && view.kind !== 'search' && <form className="workspace-add-task" onSubmit={async event => {
            event.preventDefault();
            const now = new Date(), type = number(project?.type);
            let deadline = preferences.defaultDeadline;
            if (type === 4000 || type === 4001) { if (type === 4001) now.setDate(now.getDate() + 1); deadline = now.setHours(23, 59, 59, 999); }
            if (type === 4003) deadline = 0;
            const peers = snapshot.tasks.filter(row => row.state === 0 && !row.isFinished);
            const order = preferences.newTaskOnTop ? Math.min(0, ...peers.map(row => number(row.order))) - 10000 : Math.max(0, ...peers.map(row => number(row.order))) + 10000;
            if (await run(() => services.business.command({ type: 'addTask', values: { name: name.trim(), projectId: quickProject?.id||fallback?.id||'',
              deadline, order, estimatePomoNum:quickEstimate, tags: type === 3000 ? project?.id : '', priority: [5001, 5002, 5003].includes(type) ? type - 5000 : 0 } }))) setName('');
          }}><span className="workspace-plus" aria-hidden="true">＋</span><input aria-label={text.addTask} placeholder={services.language.locale.startsWith('zh')?'在"'+(quickProject?projectName(quickProject,text):text.tasks)+'"中添加一个任务，按「回车」键保存':'Add a task to "'+(quickProject?projectName(quickProject,text):text.tasks)+'", press「Enter」to save'} value={name} maxLength={1000} required disabled={busy || blocked} onChange={event => setName(event.target.value)} /><div className="workspace-quick-pomos" aria-label={text.estimate+' shortcuts'}>{Array.from({length:5},(_,i)=><button type="button" key={i} aria-label={text.estimate+': '+(i+1)} aria-pressed={quickEstimate>=i+1} onClick={()=>setQuickEstimate(quickEstimate===i+1?0:i+1)}><LegacyIcon name="detail-pomo-blank"/></button>)}<span>›</span></div><details className="workspace-quick-project-picker"><summary className="workspace-quick-project" aria-label={text.project+'…'}><ProjectIcon type={number(quickProject?.type)||7005} color={String(quickProject?.color||'')}/></summary><div className="legacy-detail-popover legacy-project-options">{projects.filter(row=>[1000,7005].includes(number(row.type))&&row.state===0).map(row=><button key={row.id} type="button" role="option" aria-selected={quickProject?.id===row.id} onClick={event=>{setQuickProjectId(row.id);const pop=event.currentTarget.closest('details');if(pop)pop.open=false}}><ProjectIcon type={number(row.type)} color={String(row.color||'')}/><span>{projectName(row,text)}</span>{quickProject?.id===row.id&&<i>✓</i>}</button>)}</div></details></form>}
          {!completedView&&taskGroups(active, project, projects, text).map(group => <section key={group.id} className="workspace-task-group">{group.title && group.rows.length>0 && <h2>{group.title}<span>  •  {Math.round(group.rows.reduce((n,t)=>n+remaining(t),0)/60)}{services.language.locale.startsWith('zh')?'分钟':'m'}</span></h2>}<ul className="workspace-tasks" aria-label={group.title || title}>{group.rows.map(task => taskRow(task, group.rows))}</ul></section>)}
          {project && !completedView && <><button className="workspace-completed-toggle" onClick={() => setShowCompleted(value => !value)}>{showCompleted ? text.hideCompleted : text.showCompleted}</button>
            <ul className="workspace-tasks" aria-label={text.completed}>{finished.map(task => taskRow(task, finished))}</ul></>}
          {completedView&&<History openTask={openTask}/>}
        </> : view.kind === 'settings' ? <Settings/> : view.kind==='reports'?<Reports openTask={openTask}/>:view.kind==='forest'?<Forest/>:project?.type===7001?<Calendar startTask={(id,child)=>{void startTask(id,child)}} openTask={openTask}/>:null}
        <Timer expanded={timerOpen} openExpanded={() => navigate({ kind: 'timer' })} closeExpanded={()=>{setTimerOpen(false);focusHeading.current=true;setView({...timerReturn.current.view});select(timerReturn.current.selected)}} />
      </main>
      {selectedTask && isTasks && <TaskDetails key={selectedTask.id} task={selectedTask} projects={projects} subtasks={snapshot.subtasks} close={() => select('')} onStart={() => navigate({ kind: 'timer' })} />}
    </div>
    {taskMenu && <TaskContextMenu remove={setDeletingTask} key={taskMenu.task.id} task={taskMenu.task} x={taskMenu.x} y={taskMenu.y} close={closeTaskMenu} />}
  {deletingTask&&<TaskDeleteDialog task={deletingTask} close={()=>{setDeletingTask(null)}}/>}
  {overlay&&<PageOverlay title={overlay==='forest'?(services.language.locale.startsWith('zh')?'专注森林':'Focus forest'):text[overlay]} full={overlay==='reports'} close={()=>setOverlay(null)}>{overlay==='settings'?<Settings initialTab={settingsTab}/>:overlay==='reports'?<Reports openTask={openTask}/>:<Forest/>}</PageOverlay>}
  </div>;
}
