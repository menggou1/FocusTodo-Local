import {useLayoutEffect,useRef,useState} from 'react';

/** 1.9.x InputUL: native scrolling, 30px rows, two blank rows at either end,
 * drag-to-scroll, click-to-select, opacity falloff, and a 500ms snap delay. */
export function ScrollWheel({value,min,max,label,change}:{value:number;min:number;max:number;label:string;change(value:number):void}) {
 const list=useRef<HTMLUListElement>(null),drag=useRef<{y:number;top:number;moved:boolean}|null>(null),snap=useRef<ReturnType<typeof setTimeout>|null>(null),hide=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [offset,setOffset]=useState((value-min)*30),[bar,setBar]=useState(false),[highlight,setHighlight]=useState(false);
 const latest=useRef(change);latest.current=change;
 const paint=(top:number)=>{setOffset(top);latest.current(Math.max(min,Math.min(max,Math.round(top/30)+min)))};
 function settle(){if(snap.current)clearTimeout(snap.current);const el=list.current!;el.scrollTo({top:Math.round(el.scrollTop/30)*30,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
 function show(){setBar(true);if(hide.current)clearTimeout(hide.current);hide.current=setTimeout(()=>setBar(false),1000)}
 useLayoutEffect(()=>{list.current!.scrollTop=(value-min)*30;return()=>{if(snap.current)clearTimeout(snap.current);if(hide.current)clearTimeout(hide.current)}},[]);
 return <div className="legacy-scroll-wheel" onMouseDown={e=>{if(e.button!==0)return;e.preventDefault();if(snap.current)clearTimeout(snap.current);drag.current={y:e.clientY,top:list.current!.scrollTop,moved:false}}} onMouseMove={e=>{if(!drag.current)return;const d=drag.current;if(Math.abs(e.clientY-d.y)>1)d.moved=true;if(d.moved)list.current!.scrollTop=d.top-(e.clientY-d.y)}} onMouseUp={()=>{if(drag.current){settle();requestAnimationFrame(()=>{drag.current=null})}}} onMouseLeave={()=>{drag.current=null;settle();setBar(false)}}>
 <ul ref={list} tabIndex={0} role="listbox" aria-label={label} aria-activedescendant={label+'-'+value} data-scrollbar={bar||undefined} data-highlight={highlight||undefined} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();setHighlight(r.right-e.clientX<10);if(r.right-e.clientX<10)show()}} onScroll={e=>paint(e.currentTarget.scrollTop)} onWheel={e=>{e.stopPropagation();show();if(snap.current)clearTimeout(snap.current);snap.current=setTimeout(settle,500)}} onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?min:e.key==='End'?max:Math.max(min,Math.min(max,value+(e.key==='ArrowDown'?1:-1)));list.current!.scrollTop=(next-min)*30}}>
 {[0,1].map(i=><li key={'before'+i} aria-hidden="true"/>)}
 {Array.from({length:max-min+1},(_,i)=>{const n=i+min,opacity=Math.max(0,1-Math.abs(offset/30-i)/3);return <li key={n} id={label+'-'+n} role="option" aria-selected={n===value} style={{opacity:Math.round(offset/30)===i?1:opacity}} onClick={()=>{if(drag.current?.moved)return;list.current!.scrollTo({top:i*30,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}}>{n}</li>})}
 {[0,1].map(i=><li key={'after'+i} aria-hidden="true"/>)}
 </ul><i className="legacy-wheel-top"/><i className="legacy-wheel-bottom"/>
 </div>;
}
