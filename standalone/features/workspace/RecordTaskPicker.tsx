import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Entity} from '../../services/core.mjs';
import {useWorkspace} from './Context';
import {ProjectIcon} from './ProjectIcon';
import {number,projectName} from './model';

/** Manual-record ProjectInput -> TaskInput, sharing the surrounding popover's
 * root-close boundary and the modal's native top layer. */
export function RecordTaskPicker({projects,tasks,selected,choose}:{projects:readonly Entity[];tasks:readonly Entity[];selected:string;choose(id:string):void}) {
 const {services,text}=useWorkspace(),[project,setProject]=useState<{id:string;anchor:HTMLElement}|null>(null);
 const [closing,setClosing]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 function toggle(id:string,anchor:HTMLElement){if(timer.current)clearTimeout(timer.current);if(project?.id===id&&!closing){setClosing(true);timer.current=setTimeout(()=>setProject(null),120)}else{setClosing(false);setProject({id,anchor})}}
 // Legacy fetchAllTasksByProjectId traverses the IDB index in primary-key order.
 return <div className="legacy-record-project-picker"><div className="legacy-record-project-scroll">{projects.filter(row=>row.state===0&&[1000,7005].includes(number(row.type))).map(row=><button type="button" className="legacy-record-project-option" key={row.id} aria-expanded={project?.id===row.id} onClick={event=>toggle(row.id,event.currentTarget)}><span className="legacy-record-project-artwork">{row.type===7005?<ProjectIcon type={7005}/>:<i style={{backgroundColor:'#'+String(row.color||'aeaeae')}}/>}</span><span>{projectName(row,text)}</span><i className="legacy-record-project-arrow"/></button>)}</div>{project&&<RecordTaskList key={project.id} anchor={project.anchor} closing={closing} tasks={tasks.filter(row=>row.state===0&&row.projectId===project.id).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)} selected={selected} choose={choose} label={key=>services.language.legacyText(key)}/>}</div>;
}

function RecordTaskList({anchor,tasks,selected,choose,label,closing}:{anchor:HTMLElement;tasks:readonly Entity[];selected:string;choose(id:string):void;label(key:string):string;closing:boolean}) {
 const ref=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0,origin:'left center'});
 useLayoutEffect(()=>{const el=ref.current!,row=anchor.getBoundingClientRect(),left=row.right+10+el.offsetWidth>innerWidth-4?row.left-el.offsetWidth-4:row.right+10;setPosition({left,top:Math.max(4,Math.min(row.y+row.height/2-el.offsetHeight/2,innerHeight-el.offsetHeight-4)),origin:left<row.x?'right center':'left center'});const frame=requestAnimationFrame(()=>setOpen(true));return()=>cancelAnimationFrame(frame)},[anchor]);
 return <div ref={ref} className={'legacy-record-task-submenu'+(open?' is-open':'')+(closing?' is-closing':'')} style={{left:position.left,top:position.top,transformOrigin:position.origin}}><div className="legacy-record-task-scroll" role="listbox">{!tasks.length?<div className="legacy-record-no-task">{label('pomo_no_task')}</div>:[false,true].map(done=>{const rows=tasks.filter(row=>!!row.isFinished===done);return rows.length?<div key={String(done)}><h4>{label(done?'pomo_finished_task':'pomo_unfinished_task')}</h4>{rows.map(row=><button key={row.id} type="button" role="option" aria-selected={selected===row.id} onClick={()=>choose(row.id)}><span>{row.name}</span>{selected===row.id&&<i className="legacy-option-check"/>}</button>)}</div>:null})}</div></div>;
}
