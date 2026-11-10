import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import redPointer from '../../../public/img/timer-indicator-red.png?url';
import bluePointer from '../../../public/img/timer-indicator-blue.png?url';

/** 1.9.3 module 1116: stepped gradient arc and independent indicator. */
export function TimerProgress({elapsed,interval,mode,state,rest,readElapsed}:{elapsed:number;interval:number;mode:string;state:string;rest:boolean;readElapsed():number}) {
 const read=useRef(readElapsed);read.current=readElapsed;
 const [live,setLive]=useState(elapsed);
 useEffect(()=>{setLive(read.current());if(!['work','rest'].includes(state))return;const id=setInterval(()=>setLive(read.current()),Math.min(1000,Math.max(interval/6,40)));return()=>clearInterval(id)},[interval,state]);
 const value=['work','rest'].includes(state)?live:elapsed;
 const canvas=useRef<HTMLCanvasElement>(null),ratio=value/Math.max(interval,1),countup=mode==='countup'&&!rest;
 const rotation=countup?360*Math.max(ratio-.3,0)%360:0,angle=360*Math.min(ratio,countup?.3:1);
 useLayoutEffect(()=>{
  const el=canvas.current!,ctx=el.getContext('2d')!,dpr=devicePixelRatio;
  el.width=440*dpr;el.height=440*dpr;ctx.scale(dpr,dpr);ctx.lineJoin='round';ctx.lineWidth=32;
  const unit=.005,steps=Math.ceil((countup?.6:2)*Math.PI/unit),positions=countup?[0,.33,.67,1]:[0,.35,.87,1];
  const colors=rest?['#2bcbde05','#3bb1e180','#5687e7b3','#5f79eae6']:countup?['#fb447305','#fc505c66','#fe5e42b3','#ff6437d9']:['#fb447305','#fc505c80','#fe5e42b3','#ff6437e6'];
  const gradient:string[]=[];
  for(let part=0;part<3;part++){const from=colors[part].slice(1).match(/../g)!.map(v=>parseInt(v,16)),to=colors[part+1].slice(1).match(/../g)!.map(v=>parseInt(v,16)),n=Math.ceil(steps*positions[part+1])-Math.ceil(steps*positions[part]);for(let i=0;i<n;i++)gradient.push('#'+from.map((v,k)=>Math.floor(v+(to[k]-v)*i/n).toString(16).padStart(2,'0')).join(''));}
  const end=Math.min(steps,countup?Math.floor(ratio/.3*steps):Math.round(ratio*steps));
  for(let i=0;i<end;i++){ctx.beginPath();ctx.strokeStyle=gradient[i];ctx.arc(220,220,210,-Math.PI/2+unit*i,-Math.PI/2+unit*(i+2));ctx.stroke();}
 },[value,interval,countup,rest]);
 return <div className="legacy-timer-progress" aria-hidden="true" style={{transform:`rotateZ(${rotation}deg)`}}><canvas ref={canvas}/><div className="legacy-timer-pointer" data-angle={angle+rotation} style={{display:['initial','waitingForRest'].includes(state)?'none':undefined,transform:`rotateZ(${angle}deg) translateY(-184px)`,backgroundImage:`url("${rest?bluePointer:redPointer}")`}}/></div>;
}
