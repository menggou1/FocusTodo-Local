const {paired,fixture,open,sel,out}=require('./forest-parity.cjs');
const {assert,fs,path}=require('./ui-restore-helpers.cjs');
const results=[];
const near=(a,b,label,tolerance=.08)=>assert(Math.abs(a-b)<=tolerance,`${label}: ${a} / ${b}`);
const props=['backgroundColor','color','opacity','transform','boxShadow','outlineColor','outlineWidth','outlineStyle','outlineOffset','borderTopColor','borderTopWidth','borderRadius','transitionDuration','transitionTimingFunction'];
async function style(locator,pseudo){return locator.evaluate((e,{props,pseudo})=>{const s=getComputedStyle(e,pseudo);return Object.fromEntries(props.map(k=>[k,s[k]]))},{props,pseudo})}
async function noAddedFeedback(page,target,label){
 const read=()=>target.evaluate(e=>{const s=getComputedStyle(e);return Object.fromEntries(['backgroundColor','opacity','transform','boxShadow','outlineWidth','outlineStyle'].map(k=>[k,k==='outlineWidth'&&s.outlineStyle==='none'?'0px':s[k]]))});
 await page.mouse.move(0,0);const idle=await read();const point=await target.evaluate(e=>{const r=e.getBoundingClientRect();for(let y=2;y<r.height;y+=4)for(let x=2;x<r.width;x+=4)if(e.contains(document.elementFromPoint(r.x+x,r.y+y)))return{x,y};return null});assert(point,label+' has a visible pointer target');await target.hover({position:point});const hover=await read();await page.mouse.down();const active=await read();await page.mouse.move(0,0);await page.mouse.up();await page.keyboard.press('Tab');await target.focus();const focus=await read();await target.evaluate(e=>e.blur());
 for(const [name,s]of Object.entries({hover,active,focus}))assert.deepEqual(s,idle,label+' '+name+' has no invented feedback');return{idle,hover,active,focus};
}
async function buttons(pair,prefix){
 const states={};
 for(const key of ['old','new']){
  const page=pair[key],items=page.locator(sel[key].actions);states[key]=[];
  for(let i=0;i<3;i++){
   const item=items.nth(i);await page.mouse.move(0,0);await page.waitForTimeout(230);const idle=await style(item);
   await item.hover();await page.waitForTimeout(230);const hover=await style(item);await page.mouse.down();const active=await style(item);await page.mouse.move(0,0);await page.mouse.up();await page.waitForTimeout(230);
   // Establish keyboard modality, then focus the actual control.
   await page.keyboard.press('Tab');await item.focus();const focus=await style(item);await item.evaluate(e=>e.blur());
   states[key].push({idle,hover,active,focus,rect:await item.boundingBox()});
  }
 }
 for(let i=0;i<3;i++)for(const state of ['idle','hover','active','focus'])assert.deepEqual(states.new[i][state],states.old[i][state],`${prefix} action ${i} ${state}`);
 return states;
}
async function scroll(page,key,kind,prefix){
 const view=page.locator(sel[key][kind]),custom=kind!=='achievements'||key==='new',track=view.locator('..').locator(key==='old'?'[class*=ScrollView-customTrack]':'.legacy-scroll-track');
 async function read(){return view.evaluate((e,{key,custom})=>{
  const track=e.parentElement.querySelector(key==='old'?'[class*=ScrollView-customTrack]':'.legacy-scroll-track'),thumb=track?.firstElementChild,s=getComputedStyle(e),r=e.getBoundingClientRect();
  const paint=(node,pseudo)=>{const t=getComputedStyle(node,pseudo);return Object.fromEntries(['width','height','opacity','backgroundColor','borderRadius','boxShadow'].map(p=>[p,t[p]]))};
  return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},clientWidth:e.clientWidth,height:e.clientHeight,total:e.scrollHeight,top:e.scrollTop,scrollbarWidth:s.scrollbarWidth,scrollbarColor:s.scrollbarColor,track:custom?paint(track):paint(e,'::-webkit-scrollbar'),thumb:custom?paint(thumb):paint(e,'::-webkit-scrollbar-thumb'),trackRight:custom?r.right-track.getBoundingClientRect().right:null,thumbHeight:custom?thumb.getBoundingClientRect().height:null};
 },{key,custom})}
 await view.waitFor();await page.mouse.move(0,0);await page.waitForTimeout(1250);const idle=await read();assert(idle.total>idle.height,`${kind} generated data must overflow`);
 const r=await view.boundingBox();await page.mouse.move(r.x+r.width-4,r.y+30);await page.waitForTimeout(230);const hover=await read();
 await page.mouse.move(r.x+80,r.y+70);await page.mouse.wheel(0,100);await page.waitForTimeout(230);const wheel=await read();assert(wheel.top>0,kind+' wheel');
 await page.screenshot({path:path.join(out,`${prefix}-${kind}-wheel-${key}.png`)});
 let dragged;
 if(custom){assert.equal(idle.track.opacity,'0');assert.equal(hover.track.opacity,'1');assert.equal(wheel.track.opacity,'1');
  await view.evaluate(e=>e.scrollTop=0);await page.mouse.move(r.x+r.width-4,r.y+30);await page.waitForTimeout(230);const thumb=await track.locator('>div').boundingBox();await page.mouse.move(thumb.x+3,thumb.y+10);await page.mouse.down();await page.mouse.move(thumb.x+3,thumb.y+55,{steps:10});await page.mouse.up();await page.waitForTimeout(40);dragged=await read();assert(dragged.top>0,kind+' thumb drag');
 }else{
  // Native scrollbar is styled by the same WebKit pseudo-elements. Exercise
  // its actual thumb rather than replacing it with a custom component.
  await view.evaluate(e=>e.scrollTop=0);const thumbHeight=r.height*r.height/idle.total;await page.mouse.move(r.x+r.width-3,r.y+Math.min(thumbHeight/2,50));await page.mouse.down();await page.mouse.move(r.x+r.width-3,r.y+Math.min(thumbHeight/2,50)+35,{steps:10});await page.mouse.up();await page.waitForTimeout(60);dragged=await read();/* Native old achievement list is intentionally replaced by ScrollView. */
 }
 await page.mouse.move(0,0);await page.waitForTimeout(1300);const hidden=await read();if(custom)assert.equal(hidden.track.opacity,'0');await view.evaluate(e=>e.scrollTop=0);return {idle,hover,wheel,dragged,hidden};
}
function compareScroll(a,b,kind){for(const state of ['idle','hover','wheel']){
 const x=a[state],y=b[state];for(const p of ['x','y','width','height'])near(x.rect[p],y.rect[p],kind+' '+state+' '+p);
 assert.equal(y.clientWidth,x.clientWidth,kind+' content width');near(x.total,y.total,kind+' content height',1);
 if(kind!=='achievements')for(const part of ['track','thumb'])for(const prop of ['width','opacity','backgroundColor','borderRadius','boxShadow'])assert.equal(y[part][prop],x[part][prop],`${kind} ${state} ${part}.${prop}`);
 if(kind!=='achievements'){near(x.trackRight,y.trackRight,kind+' track inset');if(state!=='idle')near(x.thumbHeight,y.thumbHeight,kind+' visible thumb height',.1)}
}}
async function panel(page,key,kind,prefix){
 const title=kind==='achievements'?(prefix.startsWith('en')?'Achievements':'成就'):(prefix.startsWith('en')?'Forest guide':'专注森林攻略');
 const trigger=page.getByRole('button',{name:title,exact:true});
 const frames=await page.evaluate(async({button,drawer})=>{window.__drawerLifecycle=[];const started=performance.now();const mo=new MutationObserver(()=>{const e=document.querySelector(drawer);if(e)window.__drawerLifecycle.push({time:performance.now()-started,class:e.className,visible:e.dataset.visible,transform:getComputedStyle(e).transform})});mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-visible']});window.__drawerObserver=mo;document.querySelectorAll(button)[0].click();let animation;for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);animation=document.querySelector(drawer)?.getAnimations().find(a=>a.transitionProperty==='transform');if(animation)break}if(!animation)throw Error('Missing enter transition');const e=document.querySelector(drawer);animation.pause();const timing=animation.effect.getComputedTiming(),keyframes=animation.effect.getKeyframes(),samples=[];for(const time of [0,60,150,240,299]){animation.currentTime=time;const r=e.getBoundingClientRect(),s=getComputedStyle(e);samples.push({time,x:r.x,y:r.y,width:r.width,height:r.height,opacity:s.opacity,transform:s.transform})}return{duration:timing.duration,easing:keyframes[0].easing,keyframes,samples};},{button:sel[key].actions+(kind==='achievements'?':first-child':':nth-child(2)'),drawer:sel[key].drawer});
 for(const time of [0,150,299]){await page.locator(sel[key].drawer).evaluate((e,time)=>e.getAnimations().forEach(a=>a.currentTime=time),time);await page.screenshot({path:path.join(out,`${prefix}-${kind}-enter-${time}-${key}.png`)})}
 await page.locator(sel[key].drawer).evaluate(e=>e.getAnimations().forEach(a=>a.finish()));await page.waitForTimeout(80);
 const activityExists=await page.locator(sel[key].activity).count();assert.equal(activityExists,1,'activity persists below drawer');
 await page.screenshot({path:path.join(out,`${prefix}-${kind}-full-${key}.png`)});
 const scrolled=await scroll(page,key,kind,prefix);
 const closeFeedback=await noAddedFeedback(page,page.locator(sel[key].close),key+' '+kind+' close');
 // Real exit recording and rAF geometry establish the 300ms lifecycle too.
 const exit=await page.evaluate(async({close,drawer})=>{window.__exitFrames=[];const start=performance.now();function sample(){const e=document.querySelector(drawer),r=e?.getBoundingClientRect();window.__exitFrames.push({time:performance.now()-start,present:!!e,x:r?.x,opacity:e?getComputedStyle(e).opacity:null});if(performance.now()-start<360)requestAnimationFrame(sample)}document.querySelector(close).click();requestAnimationFrame(sample);let a;for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);a=document.querySelector(drawer)?.getAnimations().find(a=>a.transitionProperty==='transform');if(a)break}if(!a)throw Error('Missing exit transition');const e=document.querySelector(drawer),time=a.currentTime;a.pause();const samples=[0,60,150,240,299].map(t=>{a.currentTime=t;const r=e.getBoundingClientRect();return{time:t,x:r.x,y:r.y,width:r.width,height:r.height,opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform}});a.currentTime=time;a.play();return{duration:a.effect.getTiming().duration,easing:a.effect.getKeyframes()[0].easing,samples}},{close:sel[key].close,drawer:sel[key].drawer});
 await page.waitForTimeout(400);await page.locator(sel[key].drawer).waitFor({state:'detached'});const lifecycle=await page.evaluate(()=>{window.__drawerObserver.disconnect();return{enter:window.__drawerLifecycle,exit:window.__exitFrames}});
 return{frames,exit,lifecycle,scrolled,closeFeedback};
}
async function run(){
 for(const locale of (process.env.FOCUS_VISUAL_LOCALES?.split(',')||['zh-CN','en']))for(const dark of (process.env.FOCUS_VISUAL_THEMES?.split(',').map(s=>s==='dark')||[false,true])){
  const prefix=locale+'-'+(dark?'dark':'light'),pair=await paired({locale,dark,reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'videos'),size:{width:1280,height:900}}}),result={prefix};
  try{
   await fixture(pair);for(const key of ['old','new'])await open(pair[key],key);
   result.buttons=await buttons(pair,prefix);result.otherButtons={};for(const key of ['old','new']){const p=pair[key];result.otherButtons[key]={close:await noAddedFeedback(p,p.locator(key==='old'?'[class*=Forest-closeBtn]':'[data-testid=close-page]'),key+' forest close'),mature:await noAddedFeedback(p,p.locator(sel[key].sun).filter({hasText:'60g'}),key+' mature sun'),immature:await noAddedFeedback(p,p.locator(sel[key].sun).filter({hasText:'24g'}),key+' immature sun')}}result.activity={};for(const key of ['old','new'])result.activity[key]=await scroll(pair[key],key,'activity',prefix);compareScroll(result.activity.old,result.activity.new,'activity');
   for(const kind of ['achievements','help']){result[kind]={};for(const key of ['old','new'])result[kind][key]=await panel(pair[key],key,kind,prefix);const a=result[kind].old,b=result[kind].new;assert.deepEqual(b.frames.samples,a.frames.samples,prefix+' '+kind+' entry frames');assert.equal(b.frames.duration,a.frames.duration);assert.equal(b.frames.easing,a.frames.easing);assert.deepEqual(b.exit.samples,a.exit.samples,prefix+' '+kind+' exit frames');assert.equal(b.exit.duration,a.exit.duration);assert.equal(b.exit.easing,a.exit.easing);compareScroll(a.scrolled,b.scrolled,kind);if(kind==='achievements')for(const state of ['idle','hover','wheel'])for(const part of ['track','thumb'])for(const prop of ['width','opacity','backgroundColor','borderRadius','boxShadow'])assert.equal(b.scrolled[state][part][prop],result.activity.old[state][part][prop],'achievement uses old ScrollView '+state+' '+part+'.'+prop)}
   for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}result.passed=true;console.log('PASS '+prefix+' forest button states, scroll/drag/autohide and enter/exit keyframes');
  }catch(e){result.passed=false;result.error=e.stack;console.error(e);for(const key of ['old','new'])await pair[key].screenshot({path:path.join(out,`${prefix}-failure-${key}.png`)}).catch(()=>{});throw e}
  finally{results.push(result);fs.writeFileSync(path.join(out,'ui-results.json'),JSON.stringify(results,null,2));const videos=pair.handles.map(h=>h.page.video());for(const h of pair.handles)await h.context.close();for(let i=0;i<videos.length;i++)await videos[i].saveAs(path.join(out,`${prefix}-${i?'new':'old'}.webm`));await pair.close()}
 }
}
run().catch(e=>{console.error(e);process.exitCode=1});
