import { useEffect, useRef } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { LegacyIcon } from './LegacyIcon';
import { number } from './model';

/** The old detail list edits a subtask in place and saves when focus leaves. */
export function SubtaskName({subtask,selected}:{subtask:Entity;selected:boolean}) {
  const {text,services,queue,blocked}=useWorkspace();
  const ref=useRef<HTMLDivElement>(null),editing=useRef(false),base=useRef(String(subtask.name)),retained=useRef(false);
  const values=services.business.getSnapshot().records.filter(row=>row.state!==-1&&row.subtaskId===subtask.id).sort((a,b)=>number(a.endDate)-number(b.endDate)).map(row=>Math.max(0,Math.min(number(row.interval)/Math.max(1,number(row.pomodoroInterval)),1)));
  useEffect(()=>{if(!editing.current&&!retained.current&&ref.current)ref.current.textContent=String(subtask.name)},[subtask.name]);
  return <div className="legacy-subtask-name-pomodoros"><div ref={ref} className="legacy-subtask-name" role="textbox" aria-label={text.editSubtask+': '+subtask.name} tabIndex={-1} spellCheck={false} contentEditable={blocked||!selected?false:'plaintext-only'} suppressContentEditableWarning data-finished={!!subtask.isFinished}
    onFocus={()=>{editing.current=true;base.current=String(subtask.name)}}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){event.preventDefault();event.currentTarget.textContent=String(subtask.name);retained.current=false;event.currentTarget.blur()}}}
    onBlur={async event=>{editing.current=false;const name=event.currentTarget.textContent?.trim()||'';if(name===base.current)return;if(!name){event.currentTarget.textContent=String(subtask.name);return}retained.current=!await queue(()=>services.business.command({type:'updateSubtask',id:subtask.id,changes:{name},expected:{name:base.current}}));}}/>
    {!!values.length&&<div className="legacy-subtask-pomos">{values.length<=5?values.map((value,index)=><LegacyIcon key={index} name={['task-pomo-actual20','task-pomo-actual40','task-pomo-actual60','task-pomo-actual80','task-pomo-actual'][Math.floor(4*value)]}/>):<><LegacyIcon name="task-pomo-actual"/><span>{Number(values.reduce((sum,value)=>sum+value,0).toFixed(1))}</span></>}</div>}
  </div>;
}
