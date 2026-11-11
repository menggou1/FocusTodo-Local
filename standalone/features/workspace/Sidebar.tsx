import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { ProjectIcon } from './ProjectIcon';
import { LegacyIcon } from './LegacyIcon';
import { ProjectEditor } from './Projects';
import { Dialog } from './Dialog';
import { sidebarItems, sidebarMinutes, sidebarMove } from './SidebarModel.mjs';
import { expected, number, ordered, projectName } from './model';

export type SidebarView = { kind: 'project'; id: string } | { kind: 'search' | 'timer' | 'reports' | 'forest' | 'settings' };
type Summary = { count: number; minutes: number };
type MenuState = { row: Entity; x: number; y: number; trigger: HTMLElement };
type EditorState = { row?: Entity; type: number };
type ConfirmState = { row: Entity; kind: 'hide' | 'delete' };
type DropPreview = { id: string; order: number; parentId: string };

interface Props {
  projects: readonly Entity[];
  view: SidebarView;
  navigate(next: SidebarView, focus?: boolean): void;
  query: string;
  setQuery(value: string): void;
  summary(row: Entity): Summary;
  width: number;
  mobileNav: boolean;
  canDropTask(row: Entity): boolean;
  dropTask(row: Entity): void;
}

const customTypes = [1000, 2000, 3000];
const isCustom = (row: Entity) => customTypes.includes(number(row.type));
const menuLabel = (services: ReturnType<typeof useWorkspace>['services']) => services.language.locale.startsWith('zh') ? '清单菜单' : 'List menu';

export function Sidebar({ projects, view, navigate, query, setQuery, summary, width, mobileNav, canDropTask, dropTask }: Props) {
  const { services, text, run, busy, blocked } = useWorkspace();
  const input = useRef<HTMLInputElement>(null), searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousView = useRef<SidebarView | null>(null), lastViewKind = useRef(view.kind);
  const [menu, setMenu] = useState<MenuState | null>(null), [editor, setEditor] = useState<EditorState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [dragging, setDragging] = useState(''), [overId, setOverId] = useState('');
  const [preview, setPreview] = useState<DropPreview | null>(null);
  const folderExpand = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const presets = ordered(projects.filter(row => row.state === 0 && number(row.type) >= 4000 && number(row.type) !== 7002));
  const baseItems = sidebarItems(projects);
  const displayProjects = preview ? projects.map(row => row.id === preview.id ? { ...row, order: preview.order, parentId: preview.parentId } : row) : projects;
  const items = preview ? sidebarItems(displayProjects) : baseItems;
  const today = presets.find(row => number(row.type) === 4000) || projects.find(row => row.id === 'id-deadline-today');

  const clearSearchTimer = () => { if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; } };
  function clearFolderExpand() { if (folderExpand.current) { clearTimeout(folderExpand.current.timer); folderExpand.current = null; } }
  useEffect(() => () => { clearSearchTimer(); clearFolderExpand(); }, []);
  useEffect(() => {
    if (lastViewKind.current === 'search' && view.kind !== 'search') { clearSearchTimer(); setQuery(''); previousView.current = null; }
    lastViewKind.current = view.kind;
  }, [view.kind, setQuery]);

  function fallbackView(): SidebarView {
    return today ? { kind: 'project', id: today.id } : { kind: 'project', id: 'id-deadline-today' };
  }
  function restoreSearch(focus = true) {
    clearSearchTimer();
    const shouldNavigate = view.kind === 'search' || previousView.current !== null;
    const target = previousView.current || fallbackView();
    previousView.current = null;
    setQuery('');
    if (shouldNavigate) navigate(target, false);
    if (focus) requestAnimationFrame(() => input.current?.focus());
  }
  function commitSearch(value: string) {
    clearSearchTimer();
    const keyword = value.trim();
    if (!keyword) { if (view.kind === 'search') restoreSearch(); return; }
    if (view.kind !== 'search') previousView.current = view;
    navigate({ kind: 'search' }, false);
  }
  function scheduleSearch(value: string) {
    clearSearchTimer();
    searchTimer.current = setTimeout(() => {
      if (value.trim()) commitSearch(value);
      else if (view.kind === 'search') restoreSearch();
    }, 300);
  }
  function changeSearch(value: string) {
    setQuery(value);
    if (value.trim()) scheduleSearch(value);
    else {
      clearSearchTimer();
      if (view.kind === 'search') searchTimer.current = setTimeout(() => restoreSearch(), 300);
    }
  }
  function searchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (query.trim()) commitSearch(query);
      else if (view.kind === 'search') restoreSearch();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      clearSearchTimer();
      if (query.trim()) restoreSearch();
      else input.current?.blur();
    }
  }
  function chooseRow(row: Entity) {
    clearSearchTimer(); previousView.current = null; setQuery('');
    navigate({ kind: 'project', id: row.id });
  }
  function toggleFolder(event: ReactMouseEvent, row: Entity) {
    event.preventDefault(); event.stopPropagation();
    void run(() => services.business.command({ type: 'updateProject', id: row.id, changes: { expanded: row.expanded === false }, expected: expected(row, ['expanded', 'state']) }));
  }
  function openMenu(event: ReactMouseEvent<HTMLElement>, row: Entity) {
    if (!isCustom(row)) return;
    event.preventDefault(); event.stopPropagation();
    const trigger = event.currentTarget as HTMLElement;
    setMenu({ row, x: event.clientX, y: event.clientY, trigger });
  }
  function closeMenu(focus = true) {
    const trigger = menu?.trigger;
    setMenu(null);
    if (focus && trigger?.isConnected) requestAnimationFrame(() => trigger.focus());
  }
  function edit(row: Entity) { setMenu(null); setEditor({ row, type: number(row.type) }); }
  function requestHide(row: Entity) { setMenu(null); setConfirm({ row, kind: 'hide' }); }
  function requestDelete(row: Entity) {
    setMenu(null);
    if (number(row.type) === 1000) setConfirm({ row, kind: 'delete' });
    else void removeProject(row);
  }
  async function removeProject(row: Entity) {
    if (await run(() => services.business.command({ type: 'removeProject', id: row.id, expected: row }))) {
      setConfirm(null);
      if (view.kind === 'project' && view.id === row.id) navigate(fallbackView(), false);
    }
  }
  async function hideProject(row: Entity) {
    if (await run(() => services.business.command({ type: 'setProjectHidden', id: row.id, hidden: true, expected: expected(row, ['state']) }))) {
      setConfirm(null);
      if (view.kind === 'project' && view.id === row.id) navigate(fallbackView(), false);
    }
  }
  function summaryFor(row: Entity) { return summary(row); }
  function rowMenuLabel() { return menuLabel(services); }
  function projectSearchLabel() { return services.language.locale.startsWith('zh') ? '清除搜索' : 'Clear search'; }

  function beginProjectDrag(event: ReactDragEvent<HTMLElement>, row: Entity) {
    if (busy || blocked || !isCustom(row)) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id);
    setDragging(row.id); setOverId(''); setPreview(null);
  }
  function projectDragOver(event: ReactDragEvent<HTMLElement>, item: { project: Entity | null }) {
    if (!dragging || !item.project || item.project.id === dragging) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOverId(item.project.id);
    const target = item.project;
    if (target.type === 2000 && target.expanded === false) {
      if (folderExpand.current?.id !== target.id) {
        clearFolderExpand();
        const id = target.id;
        folderExpand.current = { id, timer: setTimeout(() => {
          folderExpand.current = null;
          const current = projects.find(row => row.id === id);
          if (current?.type === 2000 && current.expanded === false) void run(() => services.business.command({ type: 'updateProject', id, changes: { expanded: true }, expected: expected(current, ['expanded', 'state']) }));
        }, 1000) };
      }
    } else clearFolderExpand();
    const move = sidebarMove(baseItems, dragging, target.id);
    setPreview(move);
  }
  function finishProjectDrag() { clearFolderExpand(); setDragging(''); setOverId(''); setPreview(null); }
  function dropProject(event: ReactDragEvent<HTMLElement>) {
    if (!dragging || !preview) return;
    event.preventDefault();
    const row = projects.find(item => item.id === dragging);
    finishProjectDrag();
    if (!row) return;
    void run(() => services.business.command({ type: 'updateProject', id: row.id, changes: { order: preview.order, parentId: preview.parentId }, expected: expected(row, ['order', 'parentId']) }));
  }
  function taskDrop(event: ReactDragEvent<HTMLElement>, row: Entity) {
    if (!canDropTask(row)) return;
    event.preventDefault(); dropTask(row);
  }

  function row(item: { id: string; project: Entity | null; parent: Entity | null }) {
    if (!item.project) {
      return <div className="sidebar-empty-folder" key={item.id} style={{ '--sidebar-parent': '#' + String(item.parent?.color || 'aeaeae').replace('#', '') } as CSSProperties}>
        <span className="sidebar-child-line" />
        <button type="button" onClick={() => setEditor({ row: item.parent || undefined, type: 2000 })}>{services.language.legacyText('fld_click_add')}</button>
      </div>;
    }
    const project = item.project, custom = isCustom(project), folder = number(project.type) === 2000;
    const selected = view.kind === 'project' && view.id === project.id;
    const counts = summaryFor(project), hideStats = [7001, 7003].includes(number(project.type));
    return <div key={item.id} className={'sidebar-item' + (custom ? ' sidebar-custom' : '') + (item.parent ? ' sidebar-child' : '') + (menu?.row.id === project.id ? ' sidebar-menu-open' : '')}
      data-project-id={project.id} data-dragging={dragging === project.id || undefined} data-over={overId === project.id || undefined}
      onDragOver={event => projectDragOver(event, item)} onDrop={dropProject} onDragEnd={finishProjectDrag}
      onContextMenu={event => openMenu(event, project)}>
      {item.parent && <span className="sidebar-child-line" style={{ '--sidebar-parent': '#' + String(item.parent.color || 'aeaeae').replace('#', '') } as CSSProperties} />}
      <button type="button" className="workspace-nav sidebar-nav-main" aria-label={projectName(project, text)} data-project-id={project.id}
        data-view={number(project.type) === 7005 ? 'tasks' : undefined} aria-current={selected ? 'page' : undefined}
        draggable={custom && !busy && !blocked} onDragStart={event => beginProjectDrag(event, project)} onDragEnd={finishProjectDrag}
        onDragOver={event => { if (canDropTask(project)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={event => taskDrop(event, project)}
        onClick={() => chooseRow(project)}>
        <span className="sidebar-nav-icon-slot"><ProjectIcon type={number(project.type)} color={String(project.color || '')} /></span>
        <span className="workspace-nav-name">{projectName(project, text)}</span>
        {!hideStats && <><span className="workspace-nav-estimate">{sidebarMinutes(counts.minutes)}</span><span className="workspace-nav-count">{counts.count}</span></>}
      </button>
      {custom && <button type="button" className="sidebar-menu-button" aria-label={rowMenuLabel()} title={rowMenuLabel()}
        onClick={event => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setMenu({ row: project, x: rect.left, y: rect.bottom, trigger: event.currentTarget }); }}>
        <span className="sidebar-menu-icon" />
      </button>}
      {folder && <button type="button" className="sidebar-folder-toggle" aria-label={project.expanded === false ? text.expand : text.collapse} aria-expanded={project.expanded !== false}
        data-expanded={project.expanded !== false || undefined} onClick={event => toggleFolder(event, project)}><span /></button>}
    </div>;
  }

  const menuRow = menu?.row;
  return <nav className="workspace-sidebar" data-open={mobileNav} aria-label={text.lists} style={{ '--sidebar-width': width + 'px' } as CSSProperties}>
    <div className="workspace-projects">
      <div className="workspace-search">
        <div className="workspace-search-box">
          <LegacyIcon name="search-icon" />
          <span className="workspace-sr">{text.search}</span>
          <input ref={input} type="search" placeholder={text.search} title={text.searchHelp} value={query} onChange={event => changeSearch(event.target.value)} onKeyDown={searchKey} />
          {!!query && <button type="button" className="workspace-search-clear" aria-label={projectSearchLabel()} title={projectSearchLabel()} onClick={() => restoreSearch()}><span /></button>}
        </div>
      </div>
      <div className="sidebar-presets">{presets.map(project => row({ id: project.id, project, parent: null }))}</div>
      {items.length > 0 && <div className="sidebar-custom-separator" />}
      <div className="sidebar-customs">{items.map(item => row(item))}</div>
    </div>
    <footer><button aria-label={text.createList} disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setEditor({ type: 1000 }); }}><span className="sidebar-new-list-icon" />{services.language.locale.startsWith('zh') ? '创建清单' : 'Add Project'}</button>
      <button disabled={busy || blocked} aria-label={text.createTag} title={text.createTag} onClick={event => { event.currentTarget.focus(); setEditor({ type: 3000 }); }}><LegacyIcon name="tag-new" /></button>
      <button disabled={busy || blocked} aria-label={text.createFolder} title={text.createFolder} onClick={event => { event.currentTarget.focus(); setEditor({ type: 2000 }); }}><LegacyIcon name="folder-new" /></button>
    </footer>
    {menuRow && <SidebarMenu row={menuRow} x={menu!.x} y={menu!.y} close={() => closeMenu()} edit={() => edit(menuRow)} hide={() => requestHide(menuRow)} remove={() => requestDelete(menuRow)} />}
    {editor && <ProjectEditor row={editor.row} type={editor.type} projects={projects} close={() => setEditor(null)} />}
    {confirm && <Dialog title={confirm.kind === 'hide' ? services.language.legacyText('prj_hide') : services.language.legacyText('prj_del_title', confirm.row.name)} close={() => setConfirm(null)}>
      <p>{confirm.kind === 'hide' ? services.language.legacyText('prj_hide_prompt') : services.language.legacyText('prj_del_prompt')}</p>
      <footer><button type="button" onClick={() => setConfirm(null)}>{services.language.legacyText('cmm_cancel')}</button><button type="button" className={confirm.kind === 'delete' ? 'danger' : 'primary'} disabled={busy || blocked} onClick={() => { if (confirm.kind === 'hide') void hideProject(confirm.row); else void removeProject(confirm.row); }}>{services.language.legacyText('cmm_ok')}</button></footer>
    </Dialog>}
  </nav>;
}

function SidebarMenu({ row, x, y, close, edit, hide, remove }: { row: Entity; x: number; y: number; close(): void; edit(): void; hide(): void; remove(): void }) {
  const { services, text } = useWorkspace();
  const ref = useRef<HTMLDivElement>(null), [ready, setReady] = useState(false);
  const [closing, setClosing] = useState(false), closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  function requestClose(after: () => void = close) {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => after(), 120);
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useLayoutEffect(() => {
    const element = ref.current!;
    let left = x, top = y;
    if (left + element.offsetWidth > innerWidth - 4) left -= element.offsetWidth;
    if (top + element.offsetHeight > innerHeight - 4) top -= element.offsetHeight;
    setPosition({ left: Math.max(4, left), top: Math.max(4, top) });
    requestAnimationFrame(() => setReady(true));
  }, [x, y]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); requestClose(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [close, closing]);
  const legacy = (key: string) => services.language.legacyText(key);
  const type = number(row.type);
  return createPortal(<><button data-app-interaction-root type="button" className="sidebar-menu-mask" aria-label={text.close} tabIndex={-1} onClick={() => requestClose()} />
    <div data-app-interaction-root ref={ref} className={'legacy-context-menu sidebar-context-menu' + (ready ? ' ready is-open' : '') + (closing ? ' is-closing' : '')} role="menu" style={{ left: position.left, top: position.top }}>
      <div className="legacy-context-group">
        <button type="button" role="menuitem" onClick={() => requestClose(edit)}>{type === 2000 ? legacy('fld_edit') : type === 3000 ? legacy('tag_edit') : legacy('prj_edit')}</button>
        {type === 1000 && <button type="button" role="menuitem" onClick={() => requestClose(hide)}>{legacy('prj_hide')}</button>}
      </div>
      <div className="legacy-context-group"><button type="button" role="menuitem" onClick={() => requestClose(remove)}>{type === 2000 ? legacy('fld_del') : type === 3000 ? legacy('tag_del') : legacy('prj_del')}</button></div>
    </div></> , document.body);
}
