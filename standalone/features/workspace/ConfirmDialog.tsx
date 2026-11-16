import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useWindowClose} from './Dialog';
const warning=new URL('../../../public/img/WarningTip.png',import.meta.url).href;

/** Shared 1.9.x ConfirmDialog shell, isolated from navigation/inspector CSS. */
export function ConfirmDialog({title,message,close,children,className='',canClose=true,motion:controlledMotion,extra}:{title:string;message:string;close():void;children:ReactNode|((dismiss:()=>void)=>ReactNode);className?:string;canClose?:boolean;motion?:string;extra?:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 const {close:dismiss,motion}=useWindowClose(close);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();if(previous?.isConnected)previous.focus()}},[]);
 return createPortal(<dialog data-app-interaction-root ref={ref} className={'legacy-task-delete '+className+' '+(controlledMotion||motion)} aria-label={title} onCancel={event=>{event.preventDefault();if(canClose)dismiss()}}><div className="legacy-delete-content"><img src={warning} alt=""/><div><strong>{title}</strong><p>{message}</p>{extra}</div></div><footer>{typeof children==='function'?children(dismiss):children}</footer></dialog>,document.body);
}
