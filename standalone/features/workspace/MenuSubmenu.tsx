import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
/** The original submenu opens against the parent row, flipping at the viewport edge. */
export function MenuSubmenu({anchor,children}:{anchor:HTMLElement;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),[position,setPosition]=useState({left:0,top:0,origin:'left top'}),[open,setOpen]=useState(false);
 useLayoutEffect(()=>{const row=anchor.getBoundingClientRect(),box=ref.current!,width=box.offsetWidth,height=box.offsetHeight;const left=row.right+width>innerWidth?Math.max(4,row.left-width):row.right,top=Math.max(4,Math.min(row.top,innerHeight-height-4));setPosition({left,top,origin:(left<row.left?'right':'left')+' '+(top<row.top?'bottom':'top')});const frame=requestAnimationFrame(()=>setOpen(true));return()=>cancelAnimationFrame(frame)},[anchor]);
 return createPortal(<div ref={ref} className={'legacy-context-submenu'+(open?' is-open':'')} style={{left:position.left,top:position.top,transformOrigin:position.origin}}>{children}</div>,document.body);
}
