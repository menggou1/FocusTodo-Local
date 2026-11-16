import { useEffect, useRef, type PointerEvent } from 'react';

/** Legacy-style floating row and live hover projection, without browser text drag. */
export function useRowDrag<T>({start,move,end,cancel}:{start(value:T):void;move(value:T,x:number,y:number):void;end(value:T,x:number,y:number):void;cancel():void}) {
  const latest=useRef({start,move,end,cancel}),cleanup=useRef<()=>void>(()=>{});
  latest.current={start,move,end,cancel};
  useEffect(()=>()=>cleanup.current(),[]);
  return (event:PointerEvent<HTMLElement>,value:T,kind:'task'|'project')=>{
    if(event.button!==0)return;
    const target=event.target as Element;
    if(target.closest('input,textarea,select,a,[contenteditable]:not([contenteditable="false"]),.sidebar-menu-button,.sidebar-folder-toggle,.workspace-task-start'))return;
    event.preventDefault();cleanup.current();
    const source=event.currentTarget,rect=source.getBoundingClientRect(),x=event.clientX,y=event.clientY;
    let ghost:HTMLElement|null=null,active=false;
    const clear=()=>{
      ghost?.remove();document.documentElement.classList.remove('workspace-row-dragging');
      window.removeEventListener('pointermove',moving);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',abort);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',abort);
      cleanup.current=()=>{};
    };
    const moving=(e:globalThis.PointerEvent)=>{
      if(!active&&Math.hypot(e.clientX-x,e.clientY-y)<5)return;
      e.preventDefault();
      if(!active){
        active=true;window.getSelection()?.removeAllRanges();
        ghost=document.createElement('div');ghost.className='workspace-drag-preview '+(kind==='task'?'workspace-shell':'workspace-sidebar');ghost.dataset.appInteractionRoot='';ghost.inert=true;
        const clone=source.cloneNode(true) as HTMLElement;clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.removeAttribute('id');clone.removeAttribute('data-dragging');
        Object.assign(clone.style,{width:rect.width+'px',height:rect.height+'px',margin:'0',opacity:'1'});ghost.append(clone);
        Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(ghost);
        document.documentElement.classList.add('workspace-row-dragging');latest.current.start(value);
      }
      ghost!.style.transform=`translate(${e.clientX-x}px,${e.clientY-y}px)`;
      latest.current.move(value,e.clientX,e.clientY);
      const scroll=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('.workspace-projects,.workspace-task-scroll');
      if(scroll){const r=scroll.getBoundingClientRect();if(e.clientY<r.top+30)scroll.scrollTop-=12;else if(e.clientY>r.bottom-30)scroll.scrollTop+=12}
    };
    const suppress=(e:MouseEvent)=>{e.preventDefault();e.stopPropagation()};
    const finish=(e:globalThis.PointerEvent)=>{clear();if(!active)return;e.preventDefault();window.addEventListener('click',suppress,{capture:true,once:true});setTimeout(()=>window.removeEventListener('click',suppress,true),0);latest.current.end(value,e.clientX,e.clientY)};
    const abort=()=>{clear();if(active)latest.current.cancel()};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();abort()}};
    cleanup.current=abort;window.addEventListener('pointermove',moving,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',abort);window.addEventListener('keydown',key,true);window.addEventListener('blur',abort);
  };
}
