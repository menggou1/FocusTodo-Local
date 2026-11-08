import { useRef, useState } from 'react';
import type { Entity } from '../../services/core.mjs';
import { Dialog } from './Dialog';
import { useWorkspace } from './Context';
import { expected, number, ordered, projectName, string } from './model';

export function ProjectEditor({ row, type, projects, close }: { row?: Entity; type: number; projects: readonly Entity[]; close(): void }) {
  const { services, text, run, busy, blocked } = useWorkspace();
  const [name, setName] = useState(string(row?.name)), [parentId, setParent] = useState(string(row?.parentId));
  const [deleting, setDeleting] = useState(false);
  return <Dialog title={row ? text.edit : type === 2000 ? text.createFolder : text.createList} close={close}>
    {deleting ? <form onSubmit={async event => { event.preventDefault(); if (row && await run(() => services.business.command({ type: 'removeProject', id: row.id, expected: row }))) close(); }}>
      <p>{text.deleteListHelp}</p><p>{name}</p><footer><button type="button" onClick={() => setDeleting(false)}>{text.cancel}</button><button disabled={busy || blocked} className="danger">{text.remove}</button></footer>
    </form> : <form onSubmit={async event => {
      event.preventDefault();
      const changes = { name: name.trim(), parentId };
      if (await run(() => services.business.command(row ? { type: 'updateProject', id: row.id, changes, expected: expected(row, ['name', 'parentId', 'state']) }
        : { type: 'addProject', values: { ...changes, type, order: Math.max(0, ...projects.map(row => number(row.order))) + 10000 } }))) close();
    }}>
      <label>{text.name}<input autoFocus required maxLength={1000} value={name} onChange={event => setName(event.target.value)} /></label>
      {type === 1000 && <label>{text.folder}<select aria-label={text.folder} value={parentId} onChange={event => setParent(event.target.value)}><option value="">{text.none}</option>
        {projects.filter(row => row.type === 2000 && row.state === 0).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      <footer>{row && <button type="button" className="danger" disabled={busy || blocked} onClick={() => setDeleting(true)}>{text.remove}</button>}
        <button type="button" disabled={busy} onClick={close}>{text.cancel}</button><button className="primary" disabled={busy || blocked || !name.trim()}>{text.save}</button></footer>
    </form>}
  </Dialog>;
}

export function ProjectManager({ projects, close }: { projects: readonly Entity[]; close(): void }) {
  const { services, text, run, busy, blocked } = useWorkspace();
  const [editor, setEditor] = useState<Entity | null>(null);
  const drag = useRef<{ from: string; snapshot: { id: string; order: number }[] } | null>(null);
  const [active, setActive] = useState('');
  const rows = ordered(projects.filter(row => row.state !== -1 && row.type !== 3000 && row.type !== 7002));
  const group = (row: Entity) => number(row.type) >= 4000 ? 'preset' : string(row.parentId) || 'root';
  const reorder = (from: string, to: string, snapshot: { id: string; order: number }[]) => run(() => services.business.command({ type: 'reorderProjects', from, to, snapshot }));
  function cancelDrag() { drag.current = null; setActive(''); }
  return <>
    <Dialog title={text.manageLists} close={close}>
      <div className="workspace-project-manager" onKeyDown={event => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); cancelDrag(); } }}>
        {rows.map(row => {
          const peers = rows.filter(other => group(other) === group(row));
          const snapshot = () => peers.map(row => ({ id: row.id, order: number(row.order) }));
          return <div key={row.id} data-project-id={row.id} data-dragging={active === row.id || undefined}
            onDragOver={event => { if (drag.current?.snapshot.some(other => other.id === row.id)) event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); const input = drag.current; cancelDrag(); if (input?.snapshot.some(other => other.id === row.id)) void reorder(input.from, row.id, input.snapshot); }}>
            <button type="button" className="workspace-handle" aria-label={text.reorder + ': ' + projectName(row, text)} draggable={!busy && !blocked} aria-disabled={busy || blocked} disabled={blocked}
              onDragStart={event => { drag.current = { from: row.id, snapshot: snapshot() }; event.dataTransfer.setData('text/plain', row.id); setActive(row.id); }} onDragEnd={cancelDrag}
              onKeyDown={event => {
                if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault();
                const target = peers[peers.findIndex(other => other.id === row.id) + (event.key === 'ArrowUp' ? -1 : 1)];
                if (target) void reorder(row.id, target.id, snapshot());
              }}>☰</button>
            <span className="workspace-project-title">{projectName(row, text)}</span>
            <label className="workspace-check"><input type="checkbox" aria-label={text.visible + ': ' + projectName(row, text)} checked={row.state === 0} disabled={busy || blocked}
              onChange={event => { void run(() => services.business.command({ type: 'setProjectHidden', id: row.id, hidden: !event.target.checked, expected: expected(row, ['state']) })); }} />{text.visible}</label>
            {number(row.type) < 4000 && <button type="button" disabled={busy} aria-label={text.edit + ': ' + row.name} onClick={event => { event.currentTarget.focus(); setEditor(row); }}>{text.edit}</button>}
          </div>;
        })}
      </div>
      <footer><button type="button" disabled={busy || blocked} onClick={() => { void run(() => services.business.command({ type: 'restoreProjectOrder' })); }}>{text.restoreOrder}</button><button onClick={close} disabled={busy}>{text.close}</button></footer>
    </Dialog>
    {editor && <ProjectEditor row={editor} type={number(editor.type)} projects={projects} close={() => setEditor(null)} />}
  </>;
}
