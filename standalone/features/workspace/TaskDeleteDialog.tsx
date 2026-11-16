import {useRef,useState,useEffect} from 'react';
import type {Entity} from '../../services/core.mjs';
import {useWorkspace} from './Context';
import { ConfirmDialog } from './ConfirmDialog';
export function TaskDeleteDialog({task,close}:{task:Entity;close():void}){
 const {services,text,queue,busy,blocked}=useWorkspace(),[pending,setPending]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),repeat=!!task.rCycle&&!task.isFinished;
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 const remove=(current=false)=>{if(pending)return;setPending(true);timer.current=setTimeout(()=>{void queue(async()=>{await services.business.command({type:'removeTask',id:task.id,...(current?{repeat:'current' as const}:{}),expected:task})}).then(success=>{if(success)close();else setPending(false)})},matchMedia('(prefers-reduced-motion: reduce)').matches?0:400)};
 const title=services.language.legacyText('tsk_del_title',String(task.name));
 return <ConfirmDialog canClose={!pending&&!busy} className={repeat?'repeat':''} title={title} message={services.language.legacyText(repeat?'tsk_del_repeat_prompt':'tsk_del_prompt')} close={()=>{if(!pending&&!busy)close()}}>{dismiss=>repeat?<><button disabled={busy||blocked||pending} onClick={()=>remove(true)}>{services.language.legacyText('tsk_del_current')}</button><button disabled={busy||blocked||pending} onClick={()=>remove()}>{services.language.legacyText('tsk_del_repeat')}</button><button className="primary" disabled={busy||pending} onClick={dismiss}>{text.cancel}</button></>:<><button disabled={busy||pending} onClick={dismiss}>{text.cancel}</button><button className="primary" disabled={busy||blocked||pending} onClick={()=>remove()}>{services.language.legacyText('cmm_ok')}</button></>}</ConfirmDialog>;
}
