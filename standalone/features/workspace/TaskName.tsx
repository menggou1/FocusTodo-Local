import { useEffect, useRef } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';

/** The legacy task name is directly editable; focus owns the draft revision. */
export function TaskName({task,select}:{task:Entity;select():void}){
 const {services,queue,blocked}=useWorkspace();
 const ref=useRef<HTMLDivElement>(null),editing=useRef(false),base=useRef(String(task.name)),retained=useRef(false);
 useEffect(()=>{if(!editing.current&&!retained.current&&ref.current)ref.current.textContent=String(task.name)},[task.name]);
 return <div ref={ref} className="workspace-task-name" role="button" tabIndex={0} aria-label={String(task.name)} contentEditable={blocked?false:'plaintext-only'} suppressContentEditableWarning data-finished={!!task.isFinished}
 onFocus={()=>{editing.current=true;base.current=String(task.name)}} onClick={select}
 onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){event.preventDefault();event.currentTarget.textContent=String(task.name);retained.current=false;event.currentTarget.blur()}}}
 onBlur={async event=>{editing.current=false;const name=event.currentTarget.textContent?.trim()||'';if(name===base.current)return;if(!name){event.currentTarget.textContent=String(task.name);return}const success=await queue(()=>services.business.command({type:'updateTask',id:task.id,changes:{name},expected:{name:base.current}}));retained.current=!success;}}/>
}
