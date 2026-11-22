import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './Dialog';
import { useWorkspace } from './Context';
import { usePreferenceChanges } from './usePreferenceChanges';


/** Rebuilt React settings Select: old geometry, filtering, keyboard choice and blur dismissal. */
export function SettingsSelect({children,value,onChange,disabled,searchable=true,selectedMark=true,optionAction,...props}:SelectHTMLAttributes<HTMLSelectElement>&{searchable?:boolean;selectedMark?:boolean;optionAction?:(value:string,label:string)=>ReactNode}) {
  const select=useRef<HTMLSelectElement>(null),search=useRef<HTMLInputElement>(null),menu=useRef<HTMLDivElement>(null),scrollActive=useRef(false),id=useId();
  const options=useMemo(()=>Children.toArray(children).filter(isValidElement).map(child=>{const option=child.props as {value?:string|number;children?:string|number;disabled?:boolean;'data-search-value'?:number};return {value:String(option.value??option.children??''),label:String(option.children??''),searchValue:String(option['data-search-value']??option.value??''),disabled:!!option.disabled}}),[children]);
  const selected=options.findIndex(option=>option.value===String(value)),[open,setOpen]=useState(false),[active,setActive]=useState(selected),[query,setQuery]=useState(''),[position,setPosition]=useState({left:0,top:0,width:200});
  const visible=useMemo(()=>open?options.map((option,index)=>({...option,index})).filter(option=>(option.label+' '+option.searchValue).toLocaleLowerCase().includes(query.toLocaleLowerCase())):[],[open,options,query]);
  // Native options stay available to accessibility and native change events.
  // Populate their DOM together, without mounting 1,500 React option fibers
  // every time the settings window opens.
  const optionKey=JSON.stringify(options);
  useLayoutEffect(()=>{
    const node=select.current!,fragment=document.createDocumentFragment();
    for(const item of options){const option=new Option(item.label,item.value);option.disabled=item.disabled;fragment.append(option)}
    node.replaceChildren(fragment);node.value=String(value);
  },[optionKey]);
  useLayoutEffect(()=>{if(select.current)select.current.value=String(value)},[value]);
  const reveal=()=>{if(disabled)return;const rect=select.current!.getBoundingClientRect();setPosition({left:rect.left,top:rect.bottom+8,width:rect.width});scrollActive.current=true;setActive(selected);setQuery('');setOpen(previous=>!previous)};
  const choose=(index:number)=>{const option=options[index];if(!option||option.disabled)return;select.current!.value=option.value;select.current!.dispatchEvent(new Event('change',{bubbles:true}));setOpen(false);setQuery('');select.current!.focus()};
  const keys=(event:KeyboardEvent)=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);select.current?.focus()}else if(event.key==='Enter'||event.key===' '&&event.target===select.current||event.key==='F4'){event.preventDefault();if(open)choose(active);else reveal()}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(!open)reveal();else{const current=visible.findIndex(option=>option.index===active),index=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,current+(event.key==='ArrowDown'?1:-1)));scrollActive.current=true;setActive(visible[index]?.index??-1)}}else if(event.key==='Tab')setOpen(false);else if(!open&&searchable&&event.key.length===1){event.preventDefault();reveal();setQuery(event.key);setActive(options.findIndex(option=>(option.label+' '+option.searchValue).toLocaleLowerCase().includes(event.key.toLocaleLowerCase())))}};
  useEffect(()=>{if(!open)return;if(searchable)search.current?.focus();const outside=(event:PointerEvent)=>{if(!select.current?.parentElement?.contains(event.target as Node)&&!menu.current?.parentElement?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true)},[open,searchable]);
  useEffect(()=>{if(open&&scrollActive.current&&menu.current){const option=menu.current.querySelector<HTMLElement>('[data-active=true]');if(option){const top=option.offsetTop,bottom=top+option.offsetHeight,list=menu.current;if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=bottom-list.clientHeight+option.offsetHeight/3;else if(top<list.scrollTop)list.scrollTop=Math.max(0,top-option.offsetHeight/3)}scrollActive.current=false}},[open,active]);
  return <span className="legacy-settings-select" data-query={!!query||undefined}><select {...props} ref={select} value={value} disabled={disabled} aria-expanded={open} aria-controls={open?id:undefined} onChange={event=>{onChange?.(event);setOpen(false)}} onPointerDown={event=>{if(event.button===0)event.preventDefault()}} onClick={event=>{event.preventDefault();select.current?.focus();reveal()}} onKeyDown={keys}/>{open&&searchable&&<input ref={search} className="legacy-settings-search" aria-label={document.documentElement.lang.startsWith('zh')?'筛选选项':'Filter options'} value={query} onMouseDown={event=>{event.preventDefault();setOpen(false);select.current?.focus()}} onChange={event=>{scrollActive.current=false;setQuery(event.target.value);setActive(options.findIndex(option=>(option.label+' '+option.searchValue).toLocaleLowerCase().includes(event.target.value.toLocaleLowerCase())))}} onKeyDown={keys} style={{opacity:query?1:0}}/>}{open&&createPortal(<div className="legacy-settings-menu-surface" data-app-interaction-root style={position}><div className="legacy-settings-menu" data-selected-mark={selectedMark||undefined} ref={menu} id={id} role="listbox">{!visible.length&&<div className="legacy-settings-no-options">No options</div>}{visible.map(option=>{const action=optionAction?.(option.value,option.label),attributes={role:'option','aria-selected':String(value)===option.value,'data-active':option.index===active||undefined,onMouseMove:()=>setActive(option.index),onMouseDown:(event:React.MouseEvent)=>event.preventDefault(),onClick:()=>choose(option.index)};return action?<div {...attributes} className="legacy-settings-option" key={option.value}><span>{option.label}</span>{action}</div>:<button {...attributes} type="button" disabled={option.disabled} key={option.value}>{option.label}</button>})}</div></div>,select.current?.closest('dialog')||document.body)}</span>;
}

const assets=import.meta.glob<string>('../../../public/img/{wn-*,setting-play}.*',{query:'?url',import:'default',eager:true});
export const noiseOptions=[['Mute','mute'],['Ticking','tic-tac'],['FastTicking','countdown'],['WindWithCrickets','wind-with-crickets'],['Classroom','class-room'],['Wilderness','wilderness'],['Stream','stream'],['OceanShore','oceam-shore'],['Rain','rain'],['CofficeShop','cofe'],['FireBurning','bonfire'],['Library','library'],['WindThroughTrees','wind'],['Frogs','frogs-at-night'],['BrownNoise','brown-noise'],['Metronome','metronome']];
export const soundImage=(name:string)=>assets['../../../public/img/'+name+'.png'];
const alarms=['None','Timer','AlarmBeep','Beeps','Bell1','Bell2','BicycleBell','Birdcall','CarHorn','ClownHorn','CockCrow','Cuckoo','DrumCymbalCrash','Fanfare','Music1','Music2','Music3','PartyHorn','Percussion','PianoMusic','RingTone','Satellite','SchoolBell','ToyNoisemakerHonk','Victory','Whistle','WindChimes','WindUp'];
export function SoundSettings({ close=()=>{},inline=false }: {close?(): void;inline?:boolean}) {
  const { services, text, report, busy, blocked } = useWorkspace(),legacy=services.language.legacyText;
  const {prefs:preferences,change} = usePreferenceChanges();
  useEffect(() => () => services.audio?.stopAudition(), [services]);
  const audition=(field:'workAlarm'|'breakAlarm'|'bgMusic',value=preferences[field])=>{try{services.audio?.audition(value+(field==='bgMusic'?'.m4a':'.mp3'),(field==='bgMusic'?preferences.whiteNoiseVolume:preferences.ringtoneVolume)/100)}catch(error){report(error)}};
  const volume=(field:'ringtoneVolume'|'whiteNoiseVolume')=><VolumeControl field={field} value={preferences[field]} save={value=>change(field,value)} disabled={busy||blocked}/>;
  return <Dialog title={text.audio} close={close} inline={inline} className="legacy-sound-settings">
    {!navigator.locks&&<p>{services.language.text('当前浏览器不支持多标签页背景音协调，已暂停自动背景音。计时、完成铃声和手动试听仍可使用。') as string}</p>}
    <h3 className="legacy-settings-category">{services.language.text('提示音')}</h3>{volume('ringtoneVolume')}
    <label className="domain-setting legacy-sound-completion"><span>{services.language.text('任务完成提示音')}</span><input className="legacy-switch" type="checkbox" checked={preferences.completeSoundEnabled} disabled={busy||blocked} onChange={event=>change('completeSoundEnabled',event.target.checked)}/></label>
    {(['workAlarm','breakAlarm']as const).map(field=><div className="legacy-sound-alarm" key={field}><div className="legacy-sound-row"><span>{legacy(field==='workAlarm'?'alm_work':'alm_break')}</span><SettingsSelect aria-label={legacy(field==='workAlarm'?'alm_work':'alm_break')} disabled={busy||blocked} value={preferences[field]} onChange={e=>{change(field,e.target.value)}} optionAction={(value,label)=>value==='alm_None'?null:<button type="button" className="legacy-alarm-option-preview" title={text.previewSound} aria-label={text.previewSound+': '+label} disabled={!services.audio} onClick={event=>{event.stopPropagation();audition(field,value)}}><img src={assets['../../../public/img/setting-play.png']} alt=""/></button>}>{alarms.map(name=><option key={name} value={'alm_'+name}>{legacy('alm_'+name)}</option>)}</SettingsSelect></div></div>)}
    <hr/><h3 className="legacy-settings-category">{legacy('bgm')}</h3>{volume('whiteNoiseVolume')}
    <div className="legacy-noise-grid" role="radiogroup" aria-label={legacy('bgm')}>{noiseOptions.map(([name,image])=>{const value='bgm_'+name;return <div className="legacy-noise-option" key={name}><button className="legacy-noise-choice" type="button" role="radio" aria-checked={preferences.bgMusic===value} disabled={busy||blocked} onClick={()=>{change('bgMusic',value)}}><img src={assets['../../../public/img/wn-'+image+'.png']} alt=""/><span>{legacy(value)}</span><i aria-hidden="true"/></button>{name!=='Mute'&&<button type="button" className="legacy-noise-preview" aria-label={text.previewSound+': '+legacy(value)} disabled={!services.audio||busy} onClick={()=>audition('bgMusic',value)}><img src={assets['../../../public/img/setting-play.png']} alt=""/></button>}</div>})}</div>
    {!inline&&<footer><button onClick={()=>services.audio?.stopAudition()}>{text.stopSound}</button><button onClick={close}>{text.close}</button></footer>}
  </Dialog>;
}

const volumeKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown']);

function VolumeControl({field,value,save,disabled}:{field:'ringtoneVolume'|'whiteNoiseVolume';value:number;save(value:number):void;disabled:boolean}) {
  const {services}=useWorkspace(),legacy=services.language.legacyText,audio=services.audio;
  const [draft,setDraft]=useState(value);
  const input=useRef<HTMLInputElement>(null),latest=useRef(value),pointer=useRef<number|null>(null),keys=useRef(new Set<string>());
  const whiteNoise=field==='whiteNoiseVolume';
  const active=()=>pointer.current!==null||keys.current.size>0;
  useEffect(()=>{
    if(active())return;
    latest.current=value;
    setDraft(value);
    if(whiteNoise&&services.settings.getSnapshot().whiteNoiseVolume===value)audio?.previewWhiteNoiseVolume(null);
  },[value,whiteNoise,services,audio]);
  useEffect(()=>()=>{if(whiteNoise)audio?.previewWhiteNoiseVolume(null)},[whiteNoise,audio]);

  const update=(position:number)=>{
    latest.current=position;
    setDraft(position);
    audio?.auditionVolume(position/100);
    if(whiteNoise)audio?.previewWhiteNoiseVolume(position/100);
  };
  const finish=(commit:boolean)=>{
    const pointerId=pointer.current;
    pointer.current=null;
    if(!commit&&pointerId!==null&&input.current?.hasPointerCapture(pointerId))input.current.releasePointerCapture(pointerId);
    keys.current.clear();
    if(commit&&latest.current!==value){
      save(latest.current);
      audio?.volumeTip(latest.current/100);
    }else{
      audio?.auditionVolume(value/100);
      if(whiteNoise)audio?.previewWhiteNoiseVolume(null);
      latest.current=value;
      setDraft(value);
    }
  };
  useEffect(()=>{
    const cancel=()=>{if(active())finish(false)};
    const cancelPointer=(event:PointerEvent)=>{if(pointer.current===event.pointerId)cancel()};
    // A release may target another element after capture has been lost. Some
    // engines deliver the loss notification only after that release.
    const release=(event:PointerEvent)=>{
      if(pointer.current===event.pointerId)finish(input.current?.hasPointerCapture(event.pointerId)===true);
    };
    window.addEventListener('blur',cancel);
    window.addEventListener('pointerup',release,true);
    window.addEventListener('pointercancel',cancelPointer,true);
    window.addEventListener('lostpointercapture',cancelPointer,true);
    if(disabled)cancel();
    return()=>{
      window.removeEventListener('blur',cancel);
      window.removeEventListener('pointerup',release,true);
      window.removeEventListener('pointercancel',cancelPointer,true);
      window.removeEventListener('lostpointercapture',cancelPointer,true);
    };
  },[disabled,value,audio]);
  const move=(event:ReactPointerEvent<HTMLInputElement>)=>{
    // The native thumb is 10px wide. Its center travels inside the track ends.
    const {left,width}=event.currentTarget.getBoundingClientRect();
    const percent=Math.min(100,Math.max(0,(event.clientX-left-5)/Math.max(1,width-10)*100));
    update(Number(percent.toFixed(6)));
  };
  return <label className="legacy-sound-row"><span>{legacy('alm_volume')}</span><input
    aria-label={(whiteNoise?legacy('bgm'):services.language.text('提示音'))+' '+legacy('alm_volume')}
    ref={input} type="range" min={0} max={100} step="any" style={{'--volume':draft+'%'} as CSSProperties} value={draft} disabled={disabled}
    onPointerDown={event=>{
      if(disabled||!event.isPrimary||event.button!==0||pointer.current!==null)return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current=event.pointerId;
      keys.current.clear();
      const {left,width}=event.currentTarget.getBoundingClientRect();
      if(Math.abs(event.clientX-(left+5+(width-10)*latest.current/100))>5)move(event);
    }}
    onPointerMove={event=>{if(pointer.current===event.pointerId){if(event.buttons===0)finish(false);else move(event)}}}
    onKeyDown={event=>{
      if(event.key==='Escape'&&active()){event.preventDefault();event.stopPropagation();finish(false);return}
      if(pointer.current!==null){if(volumeKeys.has(event.key))event.preventDefault();return}
      if(volumeKeys.has(event.key))keys.current.add(event.key);
    }}
    onChange={event=>{update(event.target.valueAsNumber);if(!active())finish(true)}}
    onKeyUp={event=>{if(keys.current.delete(event.key)&&!keys.current.size)finish(true)}}
    onBlur={()=>{if(keys.current.size)finish(true)}}
  /></label>;
}
