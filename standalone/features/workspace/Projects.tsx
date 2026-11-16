import { useRef, useState } from 'react';
import type { Entity } from '../../services/core.mjs';
import { Dialog, useWindowClose } from './Dialog';
import { useWorkspace } from './Context';
import { ProjectIcon } from './ProjectIcon';
import { expected, number, ordered, projectName, string } from './model';

const projectColors=['AEBDC3','768BFD','67C3E8','F4B357','C540B5','F4658C','F7D550','A0CE62','FF7F55','A66FF0','1EACDC','84E2AE','8D4CE3','4670F6','E95ED3','EC6B66','A4A4A5','B69A8F','62E0C5','4E4E4E'];
export function ProjectEditor({row,type,projects,close:onClose}:{row?:Entity;type:number;projects:readonly Entity[];close():void}){
 const {close,motion}=useWindowClose(onClose);
 const{services,text,run,busy,blocked}=useWorkspace(),zh=services.language.locale.startsWith('zh');
 const[name,setName]=useState(string(row?.name)),[parentId]=useState(string(row?.parentId)),[color,setColor]=useState('#'+(/^[a-f\d]{6}$/i.test(string(row?.color))?string(row?.color):type===2000?'4670F6':type===3000?'F4658C':'67C3E8')),[contained,setContained]=useState<string[]>(projects.filter(item=>item.parentId===row?.id&&item.type===1000).map(item=>item.id)),[newList,setNewList]=useState(false);
 const created=useRef<Entity|null>(null);
 return <><Dialog motion={motion} className="legacy-project-editor" title={row?(type===2000?(zh?'编辑清单夹':'Edit folder'):type===3000?text.edit:(zh?'编辑清单':'Edit Project')):type===2000?(zh?'创建清单夹':'Create folder'):type===3000?text.createTag:text.createList} close={close}>
 <form onSubmit={async event=>{event.preventDefault();if(await run(async()=>{const changes={name:name.trim(),parentId,color:color.slice(1).toUpperCase()};let saved=row;if(row)saved=await services.business.command({type:'updateProject',id:row.id,changes,expected:expected(row,['name','parentId','state','color'])}) as Entity;else{saved=created.current||await services.business.command({type:'addProject',values:{...changes,type,orderingRule:type===1000?3:0,order:Math.max(0,...projects.map(row=>number(row.order)))+10000}}) as Entity;created.current=saved}if(type===2000&&saved){const changes=projects.filter(item=>item.type===1000&&item.state!==-1&&(contained.includes(item.id)||item.parentId===saved!.id)).map(item=>({type:'updateProject' as const,id:item.id,changes:{parentId:contained.includes(item.id)?saved!.id:''},expected:item}));if(changes.length)await services.business.batch(changes)}}))close()}}>
 <input className="legacy-project-name" aria-label={text.name} autoFocus required maxLength={1000} placeholder={type===2000?(zh?'清单夹名称':'Folder name'):type===3000?(zh?'标签名称':'Tag name'):(zh?'清单名称':'List name')} value={name} onChange={event=>setName(event.target.value)}/><div className="legacy-project-palette" role="group" aria-label={text.color+' palette'}>{projectColors.map(value=><button type="button" key={value} style={{background:'#'+value}} aria-label={'#'+value} aria-pressed={color.slice(1).toUpperCase()===value} onClick={()=>setColor('#'+value)}>{color.slice(1).toUpperCase()===value&&<img draggable={false} src="./img/project-color-checked.png" alt=""/>}</button>)}<input className="workspace-sr" aria-label={text.color} type="color" value={color} onChange={event=>setColor(event.target.value)}/></div>
 {type===2000&&<div className="legacy-folder-lists">{projects.filter(item=>item.type===1000&&item.state===0&&(!item.parentId||item.parentId===row?.id)).map(item=><label key={item.id}><ProjectIcon type={1000} color={String(item.color||'AEBDC3')}/><span>{item.name}</span><input type="checkbox" checked={contained.includes(item.id)} onChange={event=>setContained(previous=>event.target.checked?[...previous,item.id]:previous.filter(id=>id!==item.id))}/></label>)}<button type="button" onClick={()=>setNewList(true)}><i/> {text.createList}</button></div>}
 <footer><button type="button" onClick={close} disabled={busy}>{text.cancel}</button><button className="primary" aria-label={text.save} disabled={busy||blocked||!name.trim()}>{text.confirm}</button></footer></form>
 </Dialog>{newList&&<ProjectEditor type={1000} projects={projects} close={()=>setNewList(false)}/>}</>;
}

export function ProjectManager({ projects, close,inline=false }: { projects: readonly Entity[]; close(): void;inline?:boolean }) {
  const { services, text, run, busy, blocked } = useWorkspace();
  const [editor, setEditor] = useState<Entity | null>(null);
  const [selected,setSelected]=useState<string[]>([]),[parent,setParent]=useState('');
  const t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const drag = useRef<{ from: string; snapshot: { id: string; order: number }[] } | null>(null);
  const [active, setActive] = useState('');
  const presetRows = ordered(projects.filter(row => row.state !== -1 && number(row.type) >= 4000 && ![4000, 7002, 7005].includes(number(row.type))));
  const customRows = ordered(projects.filter(row => row.state !== -1 && number(row.type) === 1000));
  const rows = [...presetRows, ...customRows];
  const group = (row: Entity) => number(row.type) >= 4000 ? 'preset' : row.type === 3000 ? 'tags' : string(row.parentId) || 'root';
  const reorder = (from: string, to: string, snapshot: { id: string; order: number }[]) => run(() => services.business.command({ type: 'reorderProjects', from, to, snapshot }));
  function cancelDrag() { drag.current = null; setActive(''); }
  return <>
    <Dialog title={text.manageLists} close={close} inline={inline}>
      <div className={inline?'legacy-manager-bulk domain-toolbar':'domain-toolbar'}><select aria-label={text.folder} value={parent} onChange={e=>setParent(e.target.value)}><option value="">{text.none}</option>{projects.filter(p=>p.type===2000&&p.state===0).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!projects.some(p=>selected.includes(p.id)&&p.type===1000)||busy||blocked} onClick={()=>{void run(()=>services.business.batch(projects.filter(p=>selected.includes(p.id)&&p.type===1000).map(p=>({type:'updateProject',id:p.id,changes:{parentId:parent},expected:p}))))}}>{t('移动所选清单','Move selected lists')}</button><button className="danger" disabled={!selected.length||busy||blocked} onClick={()=>{if(window.confirm(text.deleteListHelp))void run(async()=>{await services.business.batch(projects.filter(p=>selected.includes(p.id)).map(p=>({type:'removeProject',id:p.id,expected:p})));setSelected([])})}}>{t('删除所选','Delete selected')}</button></div>
      {inline&&<header className="legacy-manager-heading"><p>{t('拖动三条杠或使用上下方向键调整系统清单。自定义清单请在主界面排序。','Drag the handles or use arrow keys to reorder system lists. Reorder custom lists in the workspace.')}</p><button type="button" disabled={busy||blocked} onClick={()=>{void run(()=>services.business.command({type:'restoreProjectOrder'}))}}>{text.restoreOrder}</button></header>}
      <div className="workspace-project-manager" onKeyDown={event => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); cancelDrag(); } }}>
        {rows.map(row => {
          const peers = rows.filter(other => group(other) === group(row));
          const snapshot = () => peers.map(row => ({ id: row.id, order: number(row.order) }));
          return <div key={row.id} data-project-id={row.id} data-hidden={row.state!==0||undefined} data-dragging={active === row.id || undefined}
            onDragOver={event => { if (drag.current?.snapshot.some(other => other.id === row.id)) event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); const input = drag.current; cancelDrag(); if (input?.snapshot.some(other => other.id === row.id)) void reorder(input.from, row.id, input.snapshot); }}>
            <button type="button" className="workspace-handle" aria-label={text.reorder + ': ' + projectName(row, text)} draggable={!busy && !blocked} aria-disabled={busy || blocked} disabled={blocked}
              onDragStart={event => { drag.current = { from: row.id, snapshot: snapshot() }; event.dataTransfer.setData('text/plain', row.id); setActive(row.id); }} onDragEnd={cancelDrag}
              onKeyDown={event => {
                if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault();
                const target = peers[peers.findIndex(other => other.id === row.id) + (event.key === 'ArrowUp' ? -1 : 1)];
                if (target) void reorder(row.id, target.id, snapshot());
              }}>☰</button>
            {Number(row.type)<4000&&<input type="checkbox" aria-label={t('选择','Select')+': '+row.name} checked={selected.includes(row.id)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/>}
            <ProjectIcon type={number(row.type)} color={String(row.color||'')}/><span className="workspace-project-title">{projectName(row, text)}</span>
            <label className="workspace-check"><input className="legacy-switch" type="checkbox" aria-label={text.visible + ': ' + projectName(row, text)} checked={row.state === 0} disabled={busy || blocked}
              onChange={event => { void run(() => services.business.command({ type: 'setProjectHidden', id: row.id, hidden: !event.target.checked, expected: expected(row, ['state']) })); }} /><span className="workspace-sr">{text.visible}</span></label>
            {number(row.type) < 4000 && <button type="button" disabled={busy} aria-label={text.edit + ': ' + row.name} onClick={event => { event.currentTarget.focus(); setEditor(row); }}>{text.edit}</button>}
          </div>;
        })}
      </div>
      <footer><button type="button" disabled={busy || blocked} onClick={() => { void run(() => services.business.command({ type: 'restoreProjectOrder' })); }}>{text.restoreOrder}</button><button onClick={close} disabled={busy}>{text.close}</button></footer>
    </Dialog>
    {editor && <ProjectEditor row={editor} type={number(editor.type)} projects={projects} close={() => setEditor(null)} />}
  </>;
}
