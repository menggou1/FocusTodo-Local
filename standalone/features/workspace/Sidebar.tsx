import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { ProjectIcon } from './ProjectIcon';
import { LegacyIcon } from './LegacyIcon';
import { ProjectEditor } from './Projects';
import { ConfirmDialog } from './ConfirmDialog';
import { useRowDrag } from './useRowDrag';
import { useRowMotion } from './useRowMotion';
import { sidebarTaskDropKind } from '../../domain/task-edits.mjs';
import { sidebarItems, sidebarMinutes, sidebarMove } from './SidebarModel.mjs';
import { expected, number, projectName } from './model';

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
  searchInput(value: string, immediate: boolean): void;
  searchReset: { value: string };
  cancelPendingSearch(): void;
  summary(row: Entity): Summary;
  width: number;
  mobileNav: boolean;
  taskDragActive: boolean;
  taskDropTarget: string;
}

const customTypes = [1000, 2000, 3000];
const isCustom = (row: Entity) => customTypes.includes(number(row.type));
const menuLabel = (services: ReturnType<typeof useWorkspace>['services']) => services.language.locale.startsWith('zh') ? '清单菜单' : 'List menu';

export function Sidebar({ projects, view, navigate, searchInput, searchReset, cancelPendingSearch, summary, width, mobileNav, taskDragActive, taskDropTarget }: Props) {
  const { services, text, run, queue, busy, blocked } = useWorkspace();
  const scroll = useRef<HTMLDivElement>(null);
  const projection = useRef<DropPreview | null>(null);
  const dragContext = useRef<Entity[]>([]);
  const captureMotion = useRowMotion(scroll, '.sidebar-custom,.sidebar-empty-folder', 'data-motion-id');
  const [menu, setMenu] = useState<MenuState | null>(null), [editor, setEditor] = useState<EditorState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [dragging, setDragging] = useState(''), [overId, setOverId] = useState('');
  const [preview, setPreview] = useState<DropPreview | null>(null);
  const [committingMoves, setCommittingMoves] = useState<DropPreview[]>([]);
  const folderExpand = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const presets = projects.filter(row => row.state === 0 && number(row.type) >= 4000 && number(row.type) !== 7002);
  const pendingProjects = committingMoves.reduce<readonly Entity[]>((rows, move) =>
    rows.map(row => row.id === move.id ? { ...row, order: move.order, parentId: move.parentId } : row), projects);
  const projectedItems = (move: DropPreview | null) => sidebarItems(move
    ? pendingProjects.map(row => row.id === move.id ? { ...row, order: move.order, parentId: move.parentId } : row)
    : pendingProjects);
  const items = projectedItems(preview);
  const today = presets.find(row => number(row.type) === 4000) || projects.find(row => row.id === 'id-deadline-today');

  function clearFolderExpand() { if (folderExpand.current) { clearTimeout(folderExpand.current.timer); folderExpand.current = null; } }
  useEffect(() => clearFolderExpand, []);

  function fallbackView(): SidebarView {
    return today ? { kind: 'project', id: today.id } : { kind: 'project', id: 'id-deadline-today' };
  }
  function chooseRow(row: Entity) {
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
  async function removeProject(row: Entity, dismiss=()=>setConfirm(null)) {
    if (await run(() => services.business.command({ type: 'removeProject', id: row.id, expected: row }))) {
      dismiss();
      if (view.kind === 'project' && view.id === row.id) navigate(fallbackView(), false);
    }
  }
  async function hideProject(row: Entity, dismiss=()=>setConfirm(null)) {
    if (await run(() => services.business.command({ type: 'setProjectHidden', id: row.id, hidden: true, expected: expected(row, ['state']) }))) {
      dismiss();
      if (view.kind === 'project' && view.id === row.id) navigate(fallbackView(), false);
    }
  }
  function summaryFor(row: Entity) { return summary(row); }
  function rowMenuLabel() { return menuLabel(services); }


  function clearDrag() {
    projection.current = null;
    clearFolderExpand();
    setDragging('');
    setOverId('');
    setPreview(null);
  }

  const pointerDrag = useRowDrag<Entity>({
    start(row) {
      dragContext.current = pendingProjects.filter(item => item.state === 0 && isCustom(item));
      setDragging(row.id);
    },
    move(row, x, y) {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('.sidebar-custom,.sidebar-empty-folder');
      if (!hit || !scroll.current?.contains(hit)) { clearFolderExpand(); return; }
      const target = hit.dataset.motionId;
      if (!target || target === row.id) return;
      const projected = projectedItems(projection.current);
      const current = projected.some(item => item.id === row.id) ? projected : projectedItems(null);
      const from = current.findIndex(item => item.id === row.id), to = current.findIndex(item => item.id === target);
      const rect = hit.getBoundingClientRect();
      if (from < to && y < rect.top + rect.height / 2 || from > to && y > rect.top + rect.height / 2) return;
      const next = sidebarMove(current, row.id, target);
      if (next && (next.order !== projection.current?.order || next.parentId !== projection.current?.parentId)) {
        captureMotion(row.id);
        projection.current = next;
        setPreview(next);
        setOverId(target);
      }
      const folder = projects.find(item => item.id === target);
      if (folder?.type !== 2000 || folder.expanded !== false) { clearFolderExpand(); return; }
      if (folderExpand.current?.id === folder.id) return;
      clearFolderExpand();
      folderExpand.current = { id: folder.id, timer: setTimeout(() => {
        clearFolderExpand();
        captureMotion(row.id);
        void run(() => services.business.command({ type: 'updateProject', id: folder.id, changes: { expanded: true }, expected: expected(folder, ['expanded', 'state']) }));
      }, 1000) };
    },
    end(row, x, y, handoff) {
      const next = projection.current;
      const hit = document.elementFromPoint(x, y);
      const commit = !!(next && hit && scroll.current?.contains(hit) && !hit.closest('.sidebar-presets,.workspace-search'));
      const remainsVisible = !commit || projectedItems(next).some(item => item.id === row.id);
      if (remainsVisible) captureMotion(row.id, handoff);
      clearDrag();
      if (!next || !commit) return;
      setCommittingMoves(current => [...current, next]);
      const orderContext = dragContext.current;
      void queue(() => services.business.command({
        type: 'updateProject', id: row.id, changes: { order: next.order, parentId: next.parentId },
        expected: expected(row, ['order', 'parentId']), orderContext,
      })).then(saved => {
        if (!saved) captureMotion(row.id, remainsVisible ? undefined : handoff);
        else if (!remainsVisible) handoff.remove();
        setCommittingMoves(current => current.filter(item => item !== next));
      });
    },
    cancel(row, handoff) { captureMotion(row.id, handoff); clearDrag(); },
  });

  function row(item: { id: string; project: Entity | null; parent: Entity | null }) {
    if (!item.project) {
      return <div className="sidebar-empty-folder" key={item.id} data-empty-id={item.id} data-motion-id={item.id} style={{ '--sidebar-parent': '#' + String(item.parent?.color || 'aeaeae').replace('#', '') } as CSSProperties}>
        <span className="sidebar-child-line" />
        <button type="button" onClick={() => setEditor({ row: item.parent || undefined, type: 2000 })}>{services.language.legacyText('fld_click_add')}</button>
      </div>;
    }
    const project = item.project, custom = isCustom(project), folder = number(project.type) === 2000;
    const selected = view.kind === 'project' && view.id === project.id;
    const counts = summaryFor(project), hideStats = [7001, 7003].includes(number(project.type));
    return <div key={item.id} className={'sidebar-item' + (custom ? ' sidebar-custom' : '') + (item.parent ? ' sidebar-child' : '') + (menu?.row.id === project.id ? ' sidebar-menu-open' : '')}
      onPointerDown={custom&&(!busy||committingMoves.length>0)&&!blocked?event=>pointerDrag(event,project,'project'):undefined}
      data-project-id={project.id} data-motion-id={item.id} data-dragging={dragging === project.id || undefined} data-over={overId === project.id || undefined}
      data-task-drop={taskDragActive && sidebarTaskDropKind(project) ? (taskDropTarget === project.id ? 'over' : 'available') : undefined}
      onContextMenu={event => openMenu(event, project)}>
      {item.parent && <span className="sidebar-child-line" style={{ '--sidebar-parent': '#' + String(item.parent.color || 'aeaeae').replace('#', '') } as CSSProperties} />}
      <button type="button" className="workspace-nav sidebar-nav-main" aria-label={projectName(project, text)} data-project-id={project.id}
        data-view={number(project.type) === 7005 ? 'tasks' : undefined} aria-current={selected ? 'page' : undefined}
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
    <div className="workspace-projects" ref={scroll}>
      <SearchBox active={view.kind === 'search'} searchInput={searchInput} searchReset={searchReset} cancelPendingSearch={cancelPendingSearch} />
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
    {confirm && <ConfirmDialog canClose={!busy} title={confirm.kind === 'hide' ? services.language.legacyText('prj_hide') : services.language.legacyText('prj_del_title', confirm.row.name)} message={confirm.kind === 'hide' ? services.language.legacyText('prj_hide_prompt') : services.language.legacyText('prj_del_prompt')} close={() => setConfirm(null)}>{dismiss=><>
      <button type="button" onClick={dismiss}>{services.language.legacyText('cmm_cancel')}</button><button type="button" className="primary" disabled={busy || blocked} onClick={() => { if (confirm.kind === 'hide') void hideProject(confirm.row,dismiss); else void removeProject(confirm.row,dismiss); }}>{services.language.legacyText('cmm_ok')}</button>
    </>}</ConfirmDialog>}
  </nav>;
}

function SearchBox({ active, searchInput, searchReset, cancelPendingSearch }: Pick<Props, 'searchInput' | 'searchReset' | 'cancelPendingSearch'> & { active: boolean }) {
  const { services, text } = useWorkspace();
  const input = useRef<HTMLInputElement>(null), composing = useRef(false);
  const [query, setQuery] = useState('');
  useLayoutEffect(() => {
    composing.current = false;
    setQuery(searchReset.value);
  }, [searchReset]);

  function clearSearch() {
    composing.current = false;
    setQuery('');
    searchInput('', true);
    input.current?.focus();
  }
  function changeSearch(value: string) {
    setQuery(value);
    if (!composing.current) searchInput(value, false);
  }
  function searchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      searchInput(event.currentTarget.value, true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (active || query) clearSearch();
      else {
        cancelPendingSearch();
        input.current?.blur();
      }
    }
  }
  function projectSearchLabel() { return services.language.locale.startsWith('zh') ? '清除搜索' : 'Clear search'; }

  return <div className="workspace-search">
    <div className="workspace-search-box">
      <LegacyIcon name="search-icon" />
      <span className="workspace-sr">{text.search}</span>
      <input ref={input} type="search" placeholder={text.search} title={text.searchHelp} value={query}
        onChange={event => changeSearch(event.target.value)} onKeyDown={searchKey}
        onCompositionStart={() => { composing.current = true; cancelPendingSearch(); }}
        onCompositionEnd={event => {
          if (!composing.current) return;
          composing.current = false;
          changeSearch(event.currentTarget.value);
        }} />
      {!!query && <button type="button" className="workspace-search-clear" aria-label={projectSearchLabel()} title={projectSearchLabel()} onClick={clearSearch}><span /></button>}
    </div>
  </div>;
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
