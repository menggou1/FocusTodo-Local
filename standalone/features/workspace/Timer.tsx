import { useRowDrag } from './useRowDrag';
import { useRowMotion, type DragHandoff } from './useRowMotion';
import { ConfirmDialog } from './ConfirmDialog';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { observeApplicationImages } from './AppInteractions';
import type { TimerAction } from '../../services/core.mjs';
import { useWindowClose } from './Dialog';
import { TimerProgress } from './TimerProgress';
import { TimerWidgetCards, TimerTaskPomodoros } from './TimerWidgets';
import { useWorkspace } from './Context';
import { number, string } from './model';
import { noiseOptions, soundImage } from './SoundSettings';
import { themeURL } from './Settings';
import { LegacyIcon } from './LegacyIcon';
const timerArtwork=import.meta.glob<string>('../../../public/img/{timer-*,tmr_*,fullscreen-*,float-timer-*,widget_empty,widget_show,widget_hide,task-start,task_no_priority,new-task-project-selected,setting-play,folder_project_checked,folder_project_unchecked,drag_flag,add_widget}.png',{eager:true,query:'?url',import:'default'});
const timerImage=(name:string)=>timerArtwork['../../../public/img/'+name+'.png'];
const miniArtwork=import.meta.glob<string>('../../../public/img/{timer-start,timer-pause,timer-stop,timer-complete,float-timer-close,float-timer-zoomup}.png',{eager:true,query:'?inline',import:'default'});
const miniImage=(name:string)=>miniArtwork['../../../public/img/'+name+'.png'];

type MiniAPI = { requestWindow(options: {width: number; height: number; preferInitialWindowPlacement: boolean}): Promise<Window> };
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  return (parts[0] ? parts : parts.slice(1)).map(value => String(value).padStart(2, '0')).join(':');
}
function localTime(value: number) {
  const date = new Date(value), pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function FlipDigit({value,size}:{value:string;size:number}) {
  const [previous,setPrevious]=useState(value);
  useEffect(()=>{if(previous===value)return;const timer=setTimeout(()=>setPrevious(value),700);return()=>clearTimeout(timer)},[previous,value]);
  const moving=previous!==value&&!matchMedia('(prefers-reduced-motion: reduce)').matches,gap=2*Math.ceil(Math.floor(size/60)/2);
  const upper={width:size,height:size/2,fontSize:Math.round(.9*size),lineHeight:size+'px'},lower={width:size,height:size/2,fontSize:Math.round(.9*size)};
  return <div className="legacy-flip-digit" style={{width:size,height:size}}><div className={'legacy-flip-front-top'+(moving?' animating':'')} style={upper}>{moving?previous:value}</div><div className="legacy-flip-back-top" style={upper}>{value}</div><div className="legacy-flip-front-bottom" style={lower}>{moving?previous:value}</div><div className={'legacy-flip-back-bottom'+(moving?' animating':'')} style={lower}>{value}</div><i style={{top:(size-gap)/2,height:gap}}/></div>;
}

/** The timer uses the original draft/confirm selector, independently of Settings. */
function WhiteNoiseSelector({close:onClose}:{close():void}) {
 const {close,motion}=useWindowClose(onClose);
 const {services,text,run,queue,busy,blocked}=useWorkspace(),preferences=services.settings.getSnapshot(),ref=useRef<HTMLDialogElement>(null);
 const [draft,setDraft]=useState(preferences.bgMusic),[volume,setVolume]=useState(preferences.whiteNoiseVolume);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{services.audio?.stopAudition();ref.current?.close();if(previous?.isConnected)previous.focus()}},[services]);
 return <dialog ref={ref} className={"legacy-timer-noise "+motion} aria-labelledby="legacy-timer-noise-title" onCancel={event=>{event.preventDefault();if(!busy)close()}}><h2 id="legacy-timer-noise-title">{services.language.legacyText('bgm')}</h2><label className="legacy-timer-noise-volume"><span>{services.language.legacyText('alm_volume')}</span><input aria-label={services.language.legacyText('alm_volume')} type="range" min={0} max={100} value={volume} style={{'--noise-volume':volume+'%'} as React.CSSProperties} disabled={blocked} onChange={event=>{setVolume(event.target.valueAsNumber);services.audio?.auditionVolume(event.target.valueAsNumber/100);const value=event.target.valueAsNumber;void queue(()=>services.settings.set('whiteNoiseVolume',value))}}/></label><div className="legacy-timer-noise-options" data-timer-scroll role="radiogroup" aria-label={services.language.legacyText('bgm')}>{noiseOptions.map(([name,image])=>{const value='bgm_'+name;return <div className="legacy-timer-noise-option" key={name} data-selected={draft===value}><button type="button" role="radio" aria-checked={draft===value} disabled={busy||blocked} onClick={()=>setDraft(value)}><img src={soundImage('wn-'+image)} alt=""/><span>{services.language.legacyText(value)}</span>{draft===value&&<img className="legacy-timer-noise-checked" src={timerImage('new-task-project-selected')} alt=""/>}</button>{name!=='Mute'&&<button type="button" className="legacy-timer-noise-preview" aria-label={text.previewSound+': '+services.language.legacyText(value)} disabled={!services.audio||busy||blocked} onClick={()=>services.audio?.audition(value+'.m4a',volume/100)}><img src={timerImage('setting-play')} alt=""/></button>}</div>})}</div><footer><button type="button" disabled={busy} onClick={close}>{text.cancel}</button><button type="button" className="primary" disabled={busy||blocked} onClick={async()=>{if(await run(async()=>{await services.settings.set('bgMusic',draft);await services.settings.set('whiteNoiseVolume',volume)}))close()}}>{services.language.legacyText('cmm_ok')}</button></footer></dialog>;
}

function TimerModeSelector({mode,interval,confirm,close:onClose}:{mode:'countdown'|'countup';interval:number;confirm(value:'countdown'|'countup'):Promise<boolean>;close():void}) {
 const {close,motion}=useWindowClose(onClose);
 const {services,text,busy,blocked}=useWorkspace(),[draft,setDraft]=useState(mode),ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close()},[]);
 return <dialog ref={ref} className={"legacy-timer-mode-selector "+motion} aria-labelledby="legacy-timer-mode-title" onCancel={event=>{event.preventDefault();if(!busy)close()}}><h2 id="legacy-timer-mode-title">{services.language.legacyText('tmr_mode')}</h2><div role="radiogroup" aria-label={services.language.legacyText('tmr_mode')}>{(['countdown','countup']as const).map(value=><button key={value} type="button" role="radio" aria-label={text[value]} aria-checked={draft===value} disabled={busy||blocked} onClick={()=>setDraft(value)}><span><strong>{value==='countdown'?formatClock(interval)+' ➟ 00:00':'00:00 ➟  ∞'}</strong><small>{services.language.legacyText(value==='countdown'?'tmr_mode_countdown_desc':'tmr_mode_count_desc',formatClock(interval))}</small></span><i style={draft===value?{backgroundImage:`url("${timerImage('new-task-project-selected')}")`}:undefined}/></button>)}</div><footer><button disabled={busy} onClick={close}>{text.cancel}</button><button className="primary" disabled={busy||blocked} onClick={()=>{void confirm(draft).then(saved=>{if(saved)close()})}}>{services.language.legacyText('cmm_ok')}</button></footer></dialog>;
}

function TimeWheel({minutes,change,label,close}:{minutes:number;change(value:number):void;label:string;close():void}) {
 const ref=useRef<HTMLDivElement>(null),[selected,setSelected]=useState(Math.round(minutes)),closing=useRef<ReturnType<typeof setTimeout>|null>(null),latestClose=useRef(close),drag=useRef<{y:number;scroll:number}|null>(null);latestClose.current=close;
 const resetClose=()=>{if(closing.current)clearTimeout(closing.current);closing.current=setTimeout(()=>latestClose.current(),1000)};
 useEffect(()=>{if(ref.current)ref.current.scrollTop=(minutes-1)*60;resetClose();return()=>{if(closing.current)clearTimeout(closing.current)}},[]);
 const choose=(value:number)=>{const next=Math.max(1,Math.min(480,value));setSelected(next);change(next);if(ref.current)ref.current.scrollTop=(next-1)*60};
 return <div className="legacy-timer-time-picker" data-testid="timer-duration-wheel" onPointerDown={event=>{if(closing.current)clearTimeout(closing.current);if(ref.current){drag.current={y:event.clientY,scroll:ref.current.scrollTop};event.currentTarget.setPointerCapture(event.pointerId)}}} onPointerMove={event=>{if(drag.current&&ref.current)ref.current.scrollTop=drag.current.scroll-event.clientY+drag.current.y}} onPointerUp={()=>{drag.current=null;choose(selected);resetClose()}}><div ref={ref} role="spinbutton" aria-label={label} aria-valuemin={1} aria-valuemax={480} aria-valuenow={selected} tabIndex={0} onWheel={resetClose} onKeyDown={event=>{const next=event.key==='ArrowUp'?selected-1:event.key==='ArrowDown'?selected+1:event.key==='Home'?1:event.key==='End'?480:null;if(next!==null){event.preventDefault();choose(next);resetClose()}}} onScroll={event=>{const value=Math.max(1,Math.min(480,Math.round(event.currentTarget.scrollTop/60)+1));if(value!==selected){setSelected(value);change(value)}}}><div style={{height:180}}/>{Array.from({length:480},(_,index)=>{const value=index+1,delta=selected-value,opacity=delta===0?1:Math.max(0,.6-Math.abs(delta)*2/15);return <div className="legacy-timer-time-option" key={value} style={{opacity,transform:`rotateX(${delta*20}deg) translateZ(170px) translateY(${delta*60}px)`,transformOrigin:`50% ${delta*60+30}px`}} onClick={()=>{choose(value);resetClose()}}>{String(value).padStart(2,'0')}:00</div>})}<div style={{height:180}}/></div></div>;
}

function WidgetEditor({close:onClose}:{close():void}) {
 const {close,motion}=useWindowClose(onClose);
 const {services,text,run,busy,blocked}=useWorkspace(),preferences=services.settings.getSnapshot(),ref=useRef<HTMLDialogElement>(null);
 const [order,setOrder]=useState<number[]>([...preferences.widgetOrder]),[visible,setVisible]=useState<number[]>([...preferences.visibleWidgets]);
 const [dragging,setDragging]=useState<number|null>(null),[preview,setPreview]=useState<number[]|null>(null);
 const projection=useRef<number[]|null>(null);
 const captureMotion=useRowMotion(ref,'ul:not(.workspace-drag-preview)>li[data-widget-type]','data-widget-type');
 const titles=[services.language.legacyText('rpt_time_today'),services.language.legacyText('cmm_today'),services.language.legacyText('tmr_today_detail').replaceAll("''","'")];
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();if(previous?.isConnected)previous.focus()}},[]);
 function move(rows:number[],id:number,target:number) {
  const next=rows.filter(value=>value!==id);
  next.splice(Math.max(0,Math.min(next.length,target)),0,id);
  return next;
 }
 function release(id:number,handoff:DragHandoff,accept:boolean) {
  captureMotion(String(id),handoff);
  if(accept&&projection.current)setOrder(projection.current);
  projection.current=null;
  setPreview(null);setDragging(null);
 }
 const dragWidget=useRowDrag<number>({
  start(id){setDragging(id)},
  move(id,x,y){
   const row=document.elementFromPoint(x,y)?.closest<HTMLElement>('li[data-widget-type]');
   if(!row||!ref.current?.contains(row))return;
   const rows=projection.current||order,from=rows.indexOf(id),to=rows.indexOf(Number(row.dataset.widgetType)),rect=row.getBoundingClientRect();
   if(to<0||from===to||(from<to?y<rect.top+rect.height/2:y>rect.top+rect.height/2))return;
   captureMotion(String(id));
   projection.current=move(rows,id,to);setPreview(projection.current);
  },
  end(id,x,y,handoff){release(id,handoff,!!document.elementFromPoint(x,y)?.closest('.legacy-widget-editor-content>ul'))},
  cancel(id,handoff){release(id,handoff,false)},
 });
 return <dialog ref={ref} className={"legacy-widget-editor "+motion} aria-labelledby="legacy-widget-editor-title" onCancel={event=>{event.preventDefault();if(!busy)close()}}>
  <div className="legacy-widget-editor-content">
  <h2 id="legacy-widget-editor-title">{services.language.legacyText('tmr_edit_widget')}</h2>
  <ul>{(preview||order).map(type=><li key={type} data-widget-type={type} data-dragging={dragging===type||undefined}
    onPointerDown={busy||blocked?undefined:event=>dragWidget(event,type,'widget')}>
    <input type="checkbox" aria-label={titles[type]} checked={visible.includes(type)} disabled={busy||blocked} onChange={()=>setVisible(visible.includes(type)?visible.filter(value=>value!==type):[...visible,type])}/>
    <span>{titles[type]}</span>
    <button type="button" aria-label={text.reorder+': '+titles[type]} disabled={busy||blocked} onKeyDown={event=>{
     if(!['ArrowUp','ArrowDown'].includes(event.key))return;
     event.preventDefault();
     if(dragging!==null)return;
     captureMotion(String(type));const direction=event.key==='ArrowUp'?-1:1;
     setOrder(rows=>move(rows,type,rows.indexOf(type)+direction));
    }}><img src={timerImage('drag_flag')} alt=""/></button>
   </li>)}</ul>
  <footer><button type="button" disabled={busy} onClick={close}>{text.cancel}</button><button className="primary" disabled={busy||blocked} onClick={async()=>{if(await run(()=>services.settings.setWidgetLayout(order,order.filter(type=>visible.includes(type)))))close()}}>{services.language.legacyText('cmm_ok')}</button></footer>
  </div>
 </dialog>;
}

/** All timer projections and mutations use the C service. UI owns only windows/confirmation drafts. */
export function Timer({ expanded, openExpanded, closeExpanded }: { expanded: boolean; openExpanded(): void;closeExpanded():void }) {
  const { services, text, run, report, busy, blocked } = useWorkspace();
  const session = useSyncExternalStore(services.timer.subscribe, services.timer.getSnapshot);
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  useSyncExternalStore(services.wallpaper.subscribe,()=>services.wallpaper.getSnapshot().version);
  // Legacy DialView is a PureComponent: toggling widgets never rebuilds its static ticks.
  const dialScales=useMemo(()=><div className="legacy-timer-scales" aria-hidden="true">{Array.from({length:120},(_,i)=><i key={i} style={{transform:`rotate(${i*3}deg) translateY(-210px)`,opacity:.3}}/>)}</div>,[]);
  const [widgetExpanded,setWidgetExpanded]=useState(preferences.widgetExpanded),widgetTarget=useRef(widgetExpanded),widgetWrite=useRef(false),widgetToggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!widgetWrite.current){widgetTarget.current=preferences.widgetExpanded;setWidgetExpanded(preferences.widgetExpanded)}},[preferences.widgetExpanded]);
  async function toggleWidgets(){
    if(busy||blocked)return;
    const next=!widgetTarget.current;widgetTarget.current=next;if(next)setWidgetSurface(true);setWidgetExpanded(next);
    // A rapid reversal must respond while the previous preference is saving.
    // Serialize writes and commit the latest intent, rather than dropping clicks.
    if(widgetWrite.current)return;
    widgetWrite.current=true;widgetToggle.current?.setAttribute('aria-busy','true');
    try{
      do{const target=widgetTarget.current;
        try{await services.settings.set('widgetExpanded',target)}catch(error){report(error);if(widgetTarget.current===target){widgetTarget.current=services.settings.getSnapshot().widgetExpanded;if(mounted.current)setWidgetExpanded(widgetTarget.current)}}
      }while(widgetTarget.current!==services.settings.getSnapshot().widgetExpanded);
    }finally{widgetWrite.current=false;widgetToggle.current?.setAttribute('aria-busy','false')}
  }
  const [widgetSurface,setWidgetSurface]=useState(widgetExpanded);
  // Module 674 mounts content in the same frame as expansion, retaining it
  // for 150ms on collapse. Layout effect prevents a blank expansion frame.
  useLayoutEffect(()=>{if(widgetExpanded){setWidgetSurface(true);return}const timer=setTimeout(()=>setWidgetSurface(false),150);return()=>clearTimeout(timer)},[widgetExpanded]);
  const widgetCards=useMemo(()=><TimerWidgetCards/>,[]);
  const business = useSyncExternalStore(services.business.subscribe, services.business.getSnapshot);
  const [confirmation, setConfirmation] = useState(false);
  const [mini, setMini] = useState<Window | null>(null), [miniError, setMiniError] = useState('');
  const [miniBackdrop, setMiniBackdrop] = useState<{ source:string; data:string } | null>(null);
  const opening = useRef(false), mounted = useRef(true);
  const fullscreen=useRef<HTMLDialogElement>(null);
  const previousExpanded=useRef(expanded),[exitMotion,setExitMotion]=useState(false),collapsing=exitMotion||!expanded&&previousExpanded.current;
  useLayoutEffect(()=>{const leaving=previousExpanded.current&&!expanded;previousExpanded.current=expanded;setExitMotion(leaving);if(leaving){const timer=setTimeout(()=>setExitMotion(false),250);return()=>clearTimeout(timer)}},[expanded]);
  useLayoutEffect(()=>{if(expanded){fullscreen.current?.showModal();return()=>fullscreen.current?.close()}},[expanded]);
  const [themeVersion,setThemeVersion]=useState(0);void themeVersion;
  useEffect(()=>{const update=()=>setThemeVersion(v=>v+1),observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','lang']});window.addEventListener('storage',update);return()=>{observer.disconnect();window.removeEventListener('storage',update)}},[]);
  const [sound, setSound] = useState(false),[modePicker,setModePicker]=useState(false),[modePrompt,setModePrompt]=useState(false),[flip,setFlip]=useState(false),[flipControls,setFlipControls]=useState(true),[widgetEditor,setWidgetEditor]=useState(false);
  const [timePicker,setTimePicker]=useState(false),[draftMinutes,setDraftMinutes]=useState(25);
  const [viewport,setViewport]=useState({width:innerWidth,height:innerHeight}),flipHide=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{const resize=()=>setViewport({width:innerWidth,height:innerHeight});addEventListener('resize',resize);return()=>removeEventListener('resize',resize)},[]);
  useEffect(()=>()=>{if(flipHide.current)clearTimeout(flipHide.current)},[]);
  useEffect(()=>{if(!miniError)return;const timer=setTimeout(()=>setMiniError(''),5000);return()=>clearTimeout(timer)},[miniError]);
  useEffect(()=>{if(!modePrompt)return;const timer=setTimeout(()=>setModePrompt(false),3000);return()=>clearTimeout(timer)},[modePrompt]);
  const [recoveryCollapsed, setRecoveryCollapsed] = useState(false);
  const [cutoff, setCutoff] = useState(0), [keepRunning, setKeepRunning] = useState(false);
  const pending = session?.pendingRecovery;
  useEffect(() => { if (pending) { setCutoff(pending.to); setKeepRunning(false); setRecoveryCollapsed(false); } }, [pending?.from, pending?.to]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (mini && !mini.closed) mini.close(); }, [mini]);
  useEffect(() => {
    if (!mini || mini.closed) return;
    mini.document.documentElement.lang = services.language.locale;
    mini.document.documentElement.dataset.theme = document.documentElement.dataset.theme;
  }, [mini, services, preferences.language, preferences.isDarkMode, session, themeVersion]);

  const projection = services.timer.view();
  const state = session?.state || 'initial', mode = session?.mode || (preferences.isCountdown ? 'countdown' : 'countup');
  const rest = state === 'rest' || state === 'waitingForRest' || session?.pausedFrom === 'rest';
  const task = business.tasks.find(row => row.id === session?.taskId), subtask = business.subtasks.find(row => row.id === session?.subtaskId);
  const elapsed = projection?.elapse || 0, interval = state==='initial'?(number(task?.pomodoroInterval)||preferences.workInterval):(projection?.interval||preferences.workInterval);
  const time = formatClock(mode === 'countup' && !rest ? elapsed : interval - elapsed);
  const remaining=interval-elapsed,floatingMinutes=mode==='countdown'||rest?(remaining>0?Math.max(1,Math.floor(remaining/60)):0):Math.round(elapsed/60);
  const floatingClock=()=> <strong className="workspace-clock" aria-label={time}><canvas className="legacy-floating-progress" width={40} height={40} aria-hidden="true" ref={canvas=>{const context=canvas?.getContext('2d');if(!context)return;context.clearRect(0,0,40,40);context.strokeStyle=state==='rest'?'#00A8F9':'#fd5553';context.lineWidth=2;context.beginPath();context.arc(20,20,19,-Math.PI/2,-Math.PI/2+(elapsed%Math.max(1,interval))/Math.max(1,interval)*2*Math.PI);context.stroke()}}/><span>{floatingMinutes}</span></strong>;
  const label = state === 'work' ? text.working : state === 'rest' ? text.resting : state === 'pause' ? text.paused : state === 'waitingForRest' ? text.waiting : state === 'recovery' ? text.recovery : text.idle;
  const command = (action: TimerAction) => run(() => services.timer.command({ ...action, expectedSession: session?.sessionId }));
  async function commitTime(){if(!timePicker)return;setTimePicker(false);const value=draftMinutes*60;if(value===interval)return;await run(async()=>{if(task)await services.business.command({type:'updateTask',id:task.id,changes:{pomodoroInterval:value},expected:{pomodoroInterval:task.pomodoroInterval}});else await services.settings.set('workInterval',value);await services.timer.command({type:'configure',mode,expectedSession:session?.sessionId,config:{...services.settings.timerConfig(task),interval:value}})})}
  const start = async () => {await commitTime();return command({ type: state === 'pause' ? 'resume' : 'start', mode, taskId: string(task?.id), subtaskId: string(subtask?.id), config: services.settings.timerConfig(task) })};
  useEffect(()=>{if(!timePicker)return;const outside=(event:PointerEvent)=>{if(!(event.target as Element).closest('.legacy-timer-time-picker,.legacy-timer-duration-trigger,button,input'))void commitTime()};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[timePicker,draftMinutes,interval,task]);
  async function openMini() {
    if (mini && !mini.closed) { mini.focus(); return; }
    if (opening.current) return;
    const api = (window as Window & {documentPictureInPicture?: MiniAPI}).documentPictureInPicture;
    if (!api) { setMiniError(text.miniUnavailable); return; }
    opening.current = true;
    let target: Window | undefined;
    try {
      target = await api.requestWindow({ width: task || subtask ? 232 : 147, height: 58, preferInitialWindowPlacement: true });
      if (!mounted.current || target.closed) { target.close(); return; }
      const doc = target.document;
      doc.title = text.mini;
      doc.documentElement.lang = services.language.locale;
      doc.documentElement.dataset.theme = document.documentElement.dataset.theme;
      doc.documentElement.classList.add('legacy-mini-document');
      // The auxiliary document can delay separate stylesheet requests. Reuse
      // the app's loaded rules and resolve their assets from the same origin.
      for (const sheet of document.styleSheets) {
        if (!(sheet.ownerNode instanceof Element) || !sheet.ownerNode.matches('link[rel="stylesheet"], style[data-vite-dev-id]')) continue;
        const style = doc.createElement('style');
        style.textContent = Array.from(sheet.cssRules, rule => rule.cssText).join('\n')
          .replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/g,
            (_match, double, single, unquoted) => 'url("' + new URL(double ?? single ?? unquoted, sheet.href || document.baseURI).href + '")');
        doc.head.appendChild(style);
      }
      const disposeImages=observeApplicationImages(doc.body);
      target.addEventListener('pagehide', () => { disposeImages();if (mounted.current) setMini(current=>current===target?null:current); }, { once: true });
      setMini(target); setMiniError('');
    } catch { target?.close(); setMiniError(text.miniFailed); }
    finally { opening.current = false; }
  }
  const controls = (compact = false, auxiliary = false) => {
    const image = auxiliary ? miniImage : timerImage;
    return <div className="workspace-timer-controls">
    {state === 'rest' ? <button aria-label={text.finish} disabled={busy || blocked} onClick={() => { void command({ type: 'stop' }); }}>{compact?<img src={image('timer-complete')} alt=""/>:text.finish}</button>
      : state === 'waitingForRest' ? <button className="primary" aria-label={text.rest} disabled={busy || blocked} onClick={() => { void command({ type: 'rest' }); }}>{compact?<img src={image('timer-start')} alt=""/>:text.rest}</button>
      : state === 'work' ? <button aria-label={text.pause} disabled={busy || blocked} onClick={() => { void command({ type: 'pause' }); }}>{compact?<img src={image('timer-pause')} alt=""/>:text.pause}</button>
      : state === 'recovery' ? <button onClick={() => setRecoveryCollapsed(false)}>{text.recovery}</button>
      : <button className="primary" aria-label={state==='pause'?text.resume:text.start} disabled={busy || blocked} onClick={() => { void start(); }}>{compact?<img src={image('timer-start')} alt=""/>:<><img src={timerImage('timer-start-big')} alt=""/>{state==='pause'?text.resume:(services.language.locale.startsWith('zh')?'开始专注':'Start Focus')}</>}</button>}
    {state === 'pause' && <button aria-label={text.stop} disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); setConfirmation(true); }}>{compact?<img src={image('timer-stop')} alt=""/>:text.stop}</button>}
    </div>;
  };
  const theme=services.themes.read(),wallpaper=theme.active?services.wallpaper.read()[theme.active]:null;
  const t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const backdrop=string(wallpaper?.dataUrl)||themeURL(theme.theme||'Leaf');
  useEffect(()=>{
    if (!mini || backdrop.startsWith('data:')) return;
    const controller = new AbortController();
    const reader = new FileReader();
    reader.onload = () => {
      if (!controller.signal.aborted) setMiniBackdrop({ source:backdrop, data:String(reader.result) });
    };
    // Native PiP can defer its own image requests, even for same-origin URLs.
    void services.network.request(new URL(backdrop,document.baseURI).href,'blob',{signal:controller.signal}).then(file=>{
      if (!controller.signal.aborted && file instanceof Blob) reader.readAsDataURL(file);
    }).catch(()=>{}); // Leave the regular wallpaper URL as a fallback.
    return () => { controller.abort(); if (reader.readyState===FileReader.LOADING) reader.abort(); };
  },[mini, backdrop, services]);
  const showFlipControls=()=>{setFlipControls(true);if(flipHide.current)clearTimeout(flipHide.current);if(!['initial','pause','waitingForRest'].includes(state))flipHide.current=setTimeout(()=>setFlipControls(false),5000)};
  useEffect(()=>{if(flip)showFlipControls()},[flip,state]);
  const flipParts=time.split(':');if(mode==='countdown'&&interval>=3600&&flipParts.length===2)flipParts.unshift('00');
  const flipSize=2*Math.floor(Math.round(Math.min(viewport.width/(flipParts.length+1),viewport.height/2))/2);
  const surface=<section className={expanded?'workspace-timer-expanded'+(widgetExpanded?' with-widgets':''):'workspace-floating-timer'+(task?' has-task':'')+(collapsing?' is-collapsing':'')} aria-label={text.timer} data-testid={expanded?'timer-expanded':'timer-floating'} data-state={state} style={!expanded?{backgroundImage:`url("${backdrop}")`,'--float-size':task?'232px':'147px','--float-offset':task?'-108px':'-60px'} as React.CSSProperties:undefined} onDoubleClick={event=>{if((event.target as Element).closest('button,input,textarea,[contenteditable],.legacy-timer-task-selection,.legacy-timer-widget-rail,.legacy-timer-time-picker,.legacy-flip-clock'))return;if(expanded)closeExpanded();else openExpanded()}}>
    {expanded?<><button className="legacy-timer-close" aria-label={text.close} onClick={async()=>{await commitTime();closeExpanded()}}><img src={timerImage('timer-zoomdown')} alt=""/></button><div className="legacy-timer-main"><div className="legacy-timer-column"><div className="legacy-timer-center"><div className="legacy-timer-clock-group"><div className={'legacy-timer-task-selection'+(task?' has-task':'')}>{task?<><button className="legacy-timer-selected-complete" type="button" aria-label={subtask?text.toggleSubtask:text.complete} disabled={busy||blocked||state==='recovery'} onClick={()=>{void run(()=>services.business.command(subtask?{type:'toggleSubtask',id:subtask.id,expected:subtask}:{type:task.isFinished?'uncompleteTask':'completeTask',id:task.id,expected:task}))}}><LegacyIcon name={(subtask?.isFinished??task.isFinished)?'task_done_no_priority':'task_no_priority'}/></button><div className="legacy-timer-selected-name"><span>{subtask?.name||task.name}</span><TimerTaskPomodoros task={task} subtask={subtask} state={state}/></div><button className="legacy-timer-selected-detach" aria-label={text.noTask} disabled={busy||blocked||state==='recovery'} onClick={()=>{void command({type:'detach',config:services.settings.timerConfig()})}}><img src={timerImage('timer-task-delete')} alt=""/></button></>:<span>{t('请选择一个任务...','Please select a task...')}</span>}</div>
    <div className="legacy-timer-dial">{dialScales}<TimerProgress readElapsed={()=>services.timer.view()?.elapse||0} elapsed={elapsed} interval={interval} mode={mode} state={state} rest={rest}/><strong className="workspace-clock" aria-label={time} style={timePicker?{visibility:'hidden'}:undefined}>{time}</strong><button className="legacy-timer-duration-trigger" type="button" aria-label={text.interval} disabled={!['initial','waitingForRest'].includes(state)||busy||blocked} onClick={()=>{if(timePicker)void commitTime();else{setDraftMinutes(Math.round(interval/60));setTimePicker(true)}}}/>{timePicker&&<TimeWheel minutes={draftMinutes} change={setDraftMinutes} label={text.interval} close={()=>{void commitTime()}}/>}</div><div className="legacy-timer-actions">{controls(false)}</div></div></div>
    <div className="legacy-timer-menus"><button onClick={async()=>{await commitTime();setFlip(!flip)}}><img src={timerImage('tmr_flipclock')} alt=""/><span>{t('全屏','Fullscreen')}</span></button><div className="legacy-timer-mode-menu"><button aria-label={services.language.legacyText('tmr_mode')} onClick={async()=>{await commitTime();if(state==='initial'||state==='waitingForRest')setModePicker(true);else setModePrompt(true)}}><img src={timerImage(mode==='countdown'?'tmr_mode_countdown':'tmr_mode_count')} alt=""/><span>{services.language.legacyText('tmr_mode')}</span></button></div>{modePrompt&&<div className="legacy-timer-mode-prompt" role="status">{services.language.legacyText('tmr_mode_prompt')}</div>}<button aria-label={text.audio} onClick={async()=>{await commitTime();setSound(true)}}><img src={timerImage('tmr_bgm')} alt=""/><span>{t('白噪音','White noise')}</span></button></div></div></div>
    <aside className="legacy-timer-widget-rail" data-expanded={widgetExpanded}>
    {widgetSurface&&<aside className={'legacy-timer-widgets'+(!preferences.visibleWidgets.length?' is-empty':'')} data-expanded={widgetExpanded} data-timer-scroll data-timer-scrollbar="hidden" inert={!widgetExpanded}>{preferences.visibleWidgets.length?widgetCards:<div className="legacy-timer-widget-blank"><button onClick={()=>setWidgetEditor(true)}><img src={timerImage('add_widget')} alt=""/>{services.language.legacyText('tmr_add_widget')}</button></div>}{!!preferences.visibleWidgets.length&&<footer className="legacy-timer-edit-widgets"><button onClick={()=>setWidgetEditor(true)}>{services.language.legacyText('tmr_edit_widget')}</button></footer>}</aside>}
    <button ref={widgetToggle} className="legacy-timer-widget-toggle" aria-label={t('切换组件','Toggle widgets')} aria-busy={false} onClick={()=>{void toggleWidgets()}}><span style={{backgroundImage:`url("${timerImage(widgetExpanded?'widget_hide':'widget_show')}")`}}/></button></aside><p className="workspace-sr" role="status">{label}</p>
    {flip&&<div className="legacy-flip-clock" data-testid="timer-flip" onMouseMove={showFlipControls} onTouchStart={showFlipControls} onDoubleClick={event=>event.stopPropagation()}><button className="legacy-flip-close" hidden={!flipControls} aria-label={text.close} onClick={()=>setFlip(false)} style={{backgroundImage:`url("${timerImage('fullscreen-close')}")`}}/><div className="legacy-flip-content"><div className="legacy-flip-digits" aria-label={time}>{flipParts.map((part,index)=><FlipDigit key={index} value={part} size={flipSize}/>)}</div><div className={'legacy-flip-actions'+(flipControls?'':' hidden')}>
      {state==='work'?<button aria-label={text.pause} onClick={()=>{void command({type:'pause'})}} style={{backgroundImage:`url("${timerImage('fullscreen-pause')}")`}}/>:state==='rest'?<button aria-label={text.finish} onClick={()=>{void command({type:'stop'})}} style={{backgroundImage:`url("${timerImage('fullscreen-complete-break')}")`}}/>:<button aria-label={state==='pause'?text.resume:state==='waitingForRest'?text.rest:text.start} disabled={state==='recovery'||busy||blocked} onClick={()=>{if(state==='waitingForRest')void command({type:'rest'});else void start()}} style={{backgroundImage:`url("${timerImage('fullscreen-play')}")`}}/>}
      {state==='pause'&&<button aria-label={text.stop} onClick={()=>setConfirmation(true)} style={{backgroundImage:`url("${timerImage('fullscreen-stop')}")`}}/>}</div></div></div>}</>:<>{floatingClock()}{task&&<p className="legacy-floating-task">{subtask?.name||task.name}</p>}{controls(true)}<button className="legacy-timer-float-expand" aria-label={text.expandTimer} onClick={openExpanded}><img src={timerImage('timer-zoomup')} alt=""/></button><button className="legacy-timer-float-mini" aria-label={text.mini} onClick={()=>{void openMini()}}><img src={timerImage('float-timer-float')} alt=""/></button></>}
  </section>;
  return <>
    {expanded?<dialog className="domain-full-timer" ref={fullscreen} aria-label={text.timer} onCancel={e=>{e.preventDefault();closeExpanded()}} style={{backgroundImage:`url("${string(wallpaper?.dataUrl)||themeURL(theme.theme||'Leaf')}")`,'--float-size':task?'232px':'147px','--float-offset':task?'-108px':'-60px'} as React.CSSProperties}>{surface}</dialog>:surface}
    {mini && !mini.closed && createPortal(<div className="legacy-mini-frame">
      <div className="legacy-mini-wallpaper" aria-hidden="true" style={{backgroundImage:"url(\""+(miniBackdrop?.source===backdrop?miniBackdrop.data:new URL(backdrop,document.baseURI).href)+"\")"}}/>
      <section data-app-interaction-root className={'workspace-mini-native workspace-floating-timer'+(task||subtask?' has-task':'')} aria-label={text.mini} data-state={state}>
        {floatingClock()}{(task||subtask)&&<p className="legacy-floating-task">{subtask?.name||task?.name}</p>}{controls(true,true)}
      </section>
      <button className="legacy-mini-window-button" aria-label={t('返回主窗口','Return to main window')} onClick={() => mini.close()}><img src={miniImage('float-timer-zoomup')} alt=""/></button>
      <button className="legacy-mini-window-button legacy-mini-close" aria-label={text.closeMini} onClick={() => mini.close()}><img src={miniImage('float-timer-close')} alt=""/></button>
    </div>, mini.document.body)}
    {miniError&&<div className="legacy-timer-notice" role="status">{miniError}</div>}
    {confirmation && <ConfirmDialog title={services.language.legacyText('tmr_stop_title')} message={services.language.legacyText('tmr_stop_prompt')} canClose={!busy} close={() => setConfirmation(false)}>{dismiss=><><button disabled={busy} onClick={dismiss}>{text.cancel}</button><button className="primary" disabled={busy || blocked} onClick={async () => {
        if (await run(async () => {
          await services.timer.command({ type: 'stop', expectedSession: session?.sessionId });
        })) dismiss();
      }}>{services.language.legacyText('tmr_stop')}</button></>}</ConfirmDialog>}
    {modePicker&&<TimerModeSelector mode={mode} interval={interval} close={()=>setModePicker(false)} confirm={async value=>{return run(async()=>{await services.timer.command({type:'mode',mode:value,expectedSession:session?.sessionId});await services.settings.set('isCountdown',value==='countdown')})}}/>}
    {widgetEditor&&<WidgetEditor close={()=>setWidgetEditor(false)}/>}
    {sound && <WhiteNoiseSelector close={() => setSound(false)} />}
    {pending && !recoveryCollapsed && <ConfirmDialog title={text.recovery} message={text.recoveryHelp} canClose={!busy} close={() => setRecoveryCollapsed(true)} extra={<>
      <p>{new Date(pending.from).toLocaleString(services.language.locale)} — {new Date(pending.to).toLocaleString(services.language.locale)}</p>
      <form id="resolve-interrupted-time" className="workspace-recovery-form" onSubmit={async event => { event.preventDefault(); await command({ type: 'resolve', cutoff, continue: keepRunning }); }}>
        <label>{text.cutoff}<input type="datetime-local" step="0.001" required min={localTime(pending.from)} max={localTime(pending.to)} value={localTime(cutoff || pending.to)} onChange={event => setCutoff(new Date(event.target.value).getTime())} /></label>
        <label className="workspace-check"><input type="checkbox" checked={keepRunning} onChange={event => setKeepRunning(event.target.checked)} />{text.keepRunning}</label>
      </form></>}>
      <button type="button" disabled={busy || blocked} onClick={() => { void command({ type: 'resolve', cutoff: pending.from, continue: false }); }}>{text.discardGap}</button>
      <button type="submit" form="resolve-interrupted-time" className="primary" disabled={busy || blocked}>{text.confirm}</button>
    </ConfirmDialog>}
  </>;
}
