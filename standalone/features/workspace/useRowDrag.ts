import { useEffect, useRef, type PointerEvent } from 'react';
import type { DragHandoff } from './useRowMotion';

/** Legacy-style floating row and live hover projection, without browser text drag. */
export function useRowDrag<T>({start,move,end,cancel}:{
  start(value:T):void;
  move(value:T,x:number,y:number):void;
  end(value:T,x:number,y:number,handoff:DragHandoff):void;
  cancel(value:T,handoff:DragHandoff):void;
}) {
  const latest=useRef({start,move,end,cancel}),cleanup=useRef<()=>void>(()=>{});
  const released=useRef(new Set<HTMLElement>());
  latest.current={start,move,end,cancel};
  useEffect(()=>()=>{cleanup.current();released.current.forEach(element=>element.remove());released.current.clear()},[]);
  return (event:PointerEvent<HTMLElement>,value:T,kind:'task'|'project'|'widget')=>{
    if(event.button!==0||!event.isPrimary)return;
    const target=event.target as Element;
    if(target.closest('input,textarea,select,a,[contenteditable]:not([contenteditable="false"]),.sidebar-menu-button,.sidebar-folder-toggle,.workspace-task-start'))return;
    event.preventDefault();cleanup.current();
    const source=event.currentTarget,x=event.clientX,y=event.clientY;
    target.closest<HTMLElement>('.workspace-handle,.legacy-widget-editor li>button')?.focus({preventScroll:true});
    const pointerId=event.pointerId;
    let ghost:HTMLElement|null=null;
    const clear=()=>{
      document.documentElement.classList.remove('workspace-row-dragging');
      window.removeEventListener('pointermove',moving);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',abort);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',abort);
      cleanup.current=()=>{};
    };
    const handoff=()=>{
      const preview=ghost!;
      ghost=null;
      released.current.add(preview);
      return {rect:preview.getBoundingClientRect(),remove:()=>{preview.remove();released.current.delete(preview)}};
    };
    const moving=(e:globalThis.PointerEvent)=>{
      if(e.pointerId!==pointerId||!ghost&&Math.hypot(e.clientX-x,e.clientY-y)<5)return;
      e.preventDefault();
      if(!ghost){
        if(!source.isConnected){clear();return}
        const rect=source.getBoundingClientRect();
        window.getSelection()?.removeAllRanges();
        ghost=document.createElement(kind==='widget'?'ul':'div');ghost.className='workspace-drag-preview '+(kind==='task'?'workspace-shell':kind==='project'?'workspace-sidebar':'');ghost.dataset.appInteractionRoot='';ghost.inert=true;ghost.setAttribute('aria-hidden','true');
        const clone=source.cloneNode(true) as HTMLElement;clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.removeAttribute('id');clone.removeAttribute('data-dragging');
        Object.assign(clone.style,{width:rect.width+'px',height:rect.height+'px',margin:'0',opacity:'1'});ghost.append(clone);
        Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});(source.closest('dialog')||document.body).append(ghost);
        document.documentElement.classList.add('workspace-row-dragging');latest.current.start(value);
      }
      ghost!.style.transform=`translate(${e.clientX-x}px,${e.clientY-y}px)`;
      latest.current.move(value,e.clientX,e.clientY);
      const scroll=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('.workspace-projects,.workspace-task-scroll,.legacy-widget-editor');
      if(scroll){const r=scroll.getBoundingClientRect();if(e.clientY<r.top+30)scroll.scrollTop-=12;else if(e.clientY>r.bottom-30)scroll.scrollTop+=12}
    };
    const suppress=(e:MouseEvent)=>{e.preventDefault();e.stopPropagation()};
    const finish=(e:globalThis.PointerEvent)=>{if(e.pointerId!==pointerId)return;clear();if(!ghost)return;e.preventDefault();window.addEventListener('click',suppress,{capture:true,once:true});setTimeout(()=>window.removeEventListener('click',suppress,true),0);latest.current.end(value,e.clientX,e.clientY,handoff())};
    const abort=()=>{clear();if(ghost)latest.current.cancel(value,handoff())};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();abort()}};
    cleanup.current=()=>{clear();ghost?.remove()};window.addEventListener('pointermove',moving,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',abort);window.addEventListener('keydown',key,true);window.addEventListener('blur',abort);
  };
}
