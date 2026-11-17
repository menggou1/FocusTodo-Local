import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useWorkspace} from './Context';

export function ProfileMenu({close,account}:{close():void;account():void}) {
 const {services}=useWorkspace(),[open,setOpen]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),surface=useRef<HTMLDivElement>(null);
 function dismiss(after=close){if(timer.current)return;setOpen(false);timer.current=setTimeout(after,120)}
 useLayoutEffect(()=>{setOpen(true);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();dismiss()}};document.addEventListener('keydown',escape);return()=>{if(timer.current)clearTimeout(timer.current);document.removeEventListener('keydown',escape)}},[]);
 return createPortal(<div data-app-interaction-root className="legacy-profile-layer"><div className="legacy-profile-mask" onClick={()=>dismiss()} onContextMenu={e=>{e.preventDefault();dismiss()}}/><div ref={surface} className={'workspace-profile-menu'+(open?' is-open':'')} role="menu"><button type="button" role="menuitem" onClick={()=>dismiss(account)}>{services.language.legacyText('usr_set')}</button></div></div>,document.body);
}
