import {useRef,useState,useEffect} from 'react';
import type {Entity} from '../../services/core.mjs';
import {useWorkspace} from './Context';
const warning=new URL('../../../public/img/WarningTip.png',import.meta.url).href;
export function TaskDeleteDialog({task,close}:{task:Entity;close():void}){
 const {services,text,queue,busy,blocked}=useWorkspace(),ref=useRef<HTMLDialogElement>(null),[pending,setPending]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),repeat=!!task.rCycle&&!task.isFinished;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{if(timer.current)clearTimeout(timer.current);ref.current?.close();if(previous?.isConnected)previous.focus()}},[]);
 const remove=(current=false)=>{if(pending)return;setPending(true);timer.current=setTimeout(()=>{void queue(async()=>{await services.business.command({type:'removeTask',id:task.id,...(current?{repeat:'current' as const}:{}),expected:task})}).then(success=>{if(success)close();else setPending(false)})},matchMedia('(prefers-reduced-motion: reduce)').matches?0:400)};
 const title=services.language.legacyText('tsk_del_title',String(task.name));
 return <dialog ref={ref} className={'legacy-task-delete'+(repeat?' repeat':'')} aria-label={title} onCancel={event=>{event.preventDefault();if(!pending&&!busy)close()}}><div className="legacy-delete-content"><img src={warning} alt=""/><div><strong>{title}</strong><p>{services.language.legacyText(repeat?'tsk_del_repeat_prompt':'tsk_del_prompt')}</p></div></div><footer>{repeat?<><button disabled={busy||blocked||pending} onClick={()=>remove(true)}>{services.language.legacyText('tsk_del_current')}</button><button disabled={busy||blocked||pending} onClick={()=>remove()}>{services.language.legacyText('tsk_del_repeat')}</button><button className="primary" disabled={busy||pending} onClick={close}>{text.cancel}</button></>:<><button disabled={busy||pending} onClick={close}>{text.cancel}</button><button className="primary" disabled={busy||blocked||pending} onClick={()=>remove()}>{services.language.legacyText('cmm_ok')}</button></>}</footer></dialog>;
}
