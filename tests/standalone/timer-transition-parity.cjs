process.env.FOCUS_RESTORE_SHARED='1';
const {paired,assert,fs,path}=require('./ui-restore-helpers.cjs');
const out=path.resolve('dist/acceptance/d-v-timer'),results=[];
async function sample(page,old,phase){return page.evaluate(async({old,phase})=>{
 const targetSel=old?'.Timer-root-1NNf3':phase==='open'?'.domain-full-timer':'.workspace-floating-timer';
 document.querySelector(old?(phase==='open'?'.FloatTimer-zoomup-3tTgo':'.FullscreenTimer-zoomdown-10U6T'):(phase==='open'?'.legacy-timer-float-expand':'.legacy-timer-close')).click();
 for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);
 const target=document.querySelector(targetSel),surface=document.querySelector(old?(phase==='open'?'.FullscreenTimer-root-1wlsO':'.FloatTimer-root-3_uz_'):phase==='open'?'.workspace-timer-expanded':'.workspace-floating-timer>.workspace-clock');
 const animations=[...new Set([...target.getAnimations(),...surface.getAnimations()])];window.__dvAnimations=animations;
 for(const a of animations)a.pause();
 return [0,125,250].map(time=>{for(const a of animations)a.currentTime=time;const r=target.getBoundingClientRect();return{time,rect:[r.x,r.y,r.width,r.height],surfaceOpacity:Number(getComputedStyle(surface).opacity),backgroundOpacity:Number(getComputedStyle(target).opacity)}});
 },{old,phase})}
(async()=>{
const pair=await paired({locale:'en',reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:900}}});
const videos=pair.handles.map(h=>h.page.video());
try{
 for(let round=0;round<3;round++)for(const phase of ['open','close']){
 const before=await sample(pair.old,true,phase),after=await sample(pair.new,false,phase);
 for(let i=0;i<3;i++){for(let k=0;k<4;k++)assert(Math.abs(before[i].rect[k]-after[i].rect[k])<=1,`${phase} frame ${i} rect ${k}: ${before[i].rect} / ${after[i].rect}`);assert(Math.abs(before[i].surfaceOpacity-after[i].surfaceOpacity)<.01);assert.equal(after[i].backgroundOpacity,1,'Background must stay opaque during geometry transitions');}
 for(const [label,page]of[['old',pair.old],['new',pair.new]])for(const time of [0,125,250]){await page.evaluate(time=>{for(const a of window.__dvAnimations)a.currentTime=time},time);await page.screenshot({path:path.join(out,`transition-${round}-${phase}-${time}-${label}.png`),fullPage:true});}
 results.push({round,phase,before,after});
 }
 // Right rail and central margin share the original 150ms linear clock.
 for(const [page,old]of[[pair.old,true],[pair.new,false]]){await page.locator(old?'.FloatTimer-root-3_uz_':'.workspace-floating-timer').hover();await page.locator(old?'.FloatTimer-zoomup-3tTgo':'.legacy-timer-float-expand').click();await page.waitForTimeout(400);}
 const railSample=async(page,old)=>page.evaluate(async old=>{document.querySelector(old?'.WidgetView-indicator-1bJ-c':'.legacy-timer-widget-toggle').click();const rail=document.querySelector(old?'.WidgetView-root-28i7L':'.legacy-timer-widget-rail'),main=document.querySelector(old?'.FullscreenTimer-content-25rDU':'.legacy-timer-main');for(let i=0;i<30;i++){if(old?!rail.classList.contains('WidgetView-expanded-nHYoP'):rail.dataset.expanded==='false')break;await new Promise(requestAnimationFrame)}const animations=[...rail.getAnimations(),...main.getAnimations()];for(const a of animations)a.pause();return[0,75,150].map(time=>{for(const a of animations)a.currentTime=time;return{time,width:rail.getBoundingClientRect().width,margin:parseFloat(getComputedStyle(main).marginRight)}})},old);
 const railBefore=await railSample(pair.old,true),railAfter=await railSample(pair.new,false);for(let i=0;i<3;i++){assert(Math.abs(railBefore[i].width-railAfter[i].width)<1);assert(Math.abs(railBefore[i].margin-railAfter[i].margin)<1)}results.push({railBefore,railAfter});
 for(const [page,old]of[[pair.old,true],[pair.new,false]]){await page.waitForTimeout(180);await page.locator(old?'.FullscreenTimer-zoomdown-10U6T':'.legacy-timer-close').click();await page.waitForTimeout(400);}
 // Replay unpaused motion for human review as well as the sampled clock above.
 for(const [page,old]of[[pair.old,true],[pair.new,false]]){await page.locator(old?'.FloatTimer-root-3_uz_':'.workspace-floating-timer').hover();await page.locator(old?'.FloatTimer-zoomup-3tTgo':'.legacy-timer-float-expand').click();await page.waitForTimeout(500);await page.locator(old?'.WidgetView-indicator-1bJ-c':'.legacy-timer-widget-toggle').click();await page.waitForTimeout(400);await page.locator(old?'.WidgetView-indicator-1bJ-c':'.legacy-timer-widget-toggle').click();await page.waitForTimeout(400);await page.locator(old?'.FullscreenTimer-zoomdown-10U6T':'.legacy-timer-close').click();await page.waitForTimeout(500);}
 console.log('PASS 3 repeat open/close cycles: geometry, opacity and opaque background; natural motion recorded');
}finally{for(const h of pair.handles)await h.context.close();fs.writeFileSync(path.join(out,'transition-results.json'),JSON.stringify(results,null,2));for(let i=0;i<2;i++)await videos[i].saveAs(path.join(out,(i?'new':'old')+'-timer-motion.webm'));await pair.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
