/* One short movie per runtime, plus two controlled full-frame states per side.
 * Movies are never used to measure FPS. No screenshots in performance runs.
 */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,fs,path}=require('./ui-restore-helpers.cjs');
const {fixture,expand,selectors,out}=require('./timer-rail-cards.cjs');
const {execFileSync}=require('node:child_process');
async function pointClick(page,selector){const r=await page.locator(selector).boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2)}
(async()=>{
 const clip=await paired({locale:'en',reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'video-temp'),size:{width:1280,height:900}}}),videos=clip.handles.map(h=>h.page.video());
 try{await fixture(clip);for(const key of ['old','new'])await expand(clip[key],key==='old');
 // Run both pages' gestures together so the two recordings end together.
 for(const key of ['old','new'])await pointClick(clip[key],selectors[key].toggle);await clip.old.waitForTimeout(250);
 for(const key of ['old','new'])await pointClick(clip[key],selectors[key].toggle);await clip.old.waitForTimeout(300);
 for(const key of ['old','new'])await pointClick(clip[key],selectors[key].back);await clip.old.waitForTimeout(450);
 }finally{for(const h of clip.handles)await h.context.close();for(let i=0;i<2;i++){const raw=await videos[i].path(),target=path.join(out,(i?'new':'old')+'-motion.webm');const ffmpeg=path.join(process.env.LOCALAPPDATA,'ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-sseof','-3','-i',raw,'-an','-c:v','libvpx','-b:v','700k','-y',target],{stdio:'pipe'});fs.unlinkSync(raw)}await clip.close()}
 const pair=await paired({locale:'en',reducedMotion:'no-preference'}),frames=[];
 try{await fixture(pair,0);for(const key of ['old','new']){const p=pair[key],s=selectors[key];await expand(p,key==='old');await p.screenshot({path:path.join(out,key+'-cards.png')});await p.clock.install({time:new Date('2026-11-08T12:00:00+08:00')});await p.clock.pauseAt(new Date('2026-11-08T12:00:01+08:00'));
 await pointClick(p,s.toggle);await p.locator(key==='old'?'.WidgetView-root-28i7L:not(.WidgetView-expanded-nHYoP)':'.legacy-timer-widget-rail[data-expanded=false]').waitFor({state:'attached'});
 await p.evaluate(()=>{document.body.offsetWidth;for(const a of document.getAnimations()){a.pause();a.currentTime=75}});
 frames.push({key,phase:'rail',time:75,geometry:await p.locator(s.rail).evaluate(e=>e.getBoundingClientRect().toJSON())});await p.screenshot({path:path.join(out,key+'-rail-75ms.png'),animations:'allow'});
 await p.evaluate(()=>{for(const a of document.getAnimations())a.finish()});await p.clock.runFor(200);
 await pointClick(p,s.back);await p.locator(s.floating).waitFor({state:'attached'});await p.evaluate(()=>{document.body.offsetWidth;for(const a of document.getAnimations()){a.pause();a.currentTime=125}});
 frames.push({key,phase:'return',time:125,geometry:await p.locator(s.floating).evaluate(e=>e.getBoundingClientRect().toJSON())});await p.screenshot({path:path.join(out,key+'-return-125ms.png'),animations:'allow'});
 await p.evaluate(()=>{for(const a of document.getAnimations())a.finish()});await p.clock.runFor(300);
 }}finally{await pair.close();fs.writeFileSync(path.join(out,'keyframes.json'),JSON.stringify(frames,null,2))}
 console.log('Saved two 3-second actual-motion clips and four full-frame controlled keyframes');
})().catch(e=>{console.error(e);process.exitCode=1});
