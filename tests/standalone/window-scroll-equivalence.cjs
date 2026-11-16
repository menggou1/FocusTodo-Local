/* Fixed isolated origins only. Never connects to a user's browser profile. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,assert,fs,path}=require('./ui-restore-helpers.cjs');
const out=path.resolve('dist/acceptance/d-v-window-scroll');fs.mkdirSync(out,{recursive:true});
const results=[];
async function frames(page,selector){
 return page.locator(selector).evaluate(e=>{
  const animation=e.getAnimations()[0];if(!animation)throw Error('Missing window animation: '+e.className);
  animation.pause();
  const timing=animation.effect.getTiming();
  const frames=[0,125,250].map(time=>{animation.currentTime=time;const s=getComputedStyle(e);return {time,opacity:Number(s.opacity),transform:s.transform}});
  return {duration:timing.duration,easing:timing.easing==='linear'?animation.effect.getKeyframes()[0].easing:timing.easing,frames};
 });
}
async function scrollState(page,old){
 return page.locator(old?'[class*=PomodoroSettings-content]':'.legacy-settings').evaluate((container,old)=>{
  const view=container.querySelector(old?'[class*=ScrollView-root]':'.legacy-settings-content');
  const track=container.querySelector(old?'[class*=ScrollView-customTrack]':'.legacy-scroll-track');
  const thumb=track.firstElementChild,s=getComputedStyle(track),t=getComputedStyle(thumb);
  return {width:s.width,right:container.getBoundingClientRect().right-track.getBoundingClientRect().right,opacity:Number(s.opacity),track:s.backgroundColor,radius:s.borderRadius,thumb:t.backgroundColor,shadow:t.boxShadow,thumbRadius:t.borderRadius,top:view.scrollTop,height:view.clientHeight,total:view.scrollHeight,thumbHeight:thumb.getBoundingClientRect().height};
 },old);
}
(async()=>{
 for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
  const pair=await paired({locale,dark,reducedMotion:'no-preference'}),prefix=locale+'-'+(dark?'dark':'light');
  try{
   for(const kind of ['settings','forest','reports','project']){
    const oldOpen=kind==='project'?pair.old.getByText(locale==='en'?'Add Project':'创建清单',{exact:true}):kind==='settings'?pair.old.locator('img[src="img/header-setting.png"]'):pair.old.locator(`[class*=HomeHeader-${kind==='reports'?'report':'forest'}]`);
    const newOpen=kind==='project'?pair.new.locator('.workspace-sidebar footer button').first():pair.new.locator(`[data-view=${kind}]`);
    const oldRoot=kind==='reports'?'[class*=Report-animation]':'[class*=Overlay-root]';
    const newRoot=kind==='project'?'.legacy-project-editor':'.domain-overlay';
    await oldOpen.click();const before=await frames(pair.old,oldRoot);
    await newOpen.click();const after=await frames(pair.new,newRoot);
    assert.deepEqual(after,before,prefix+' '+kind+' enter');
    for(const [label,page]of[['old',pair.old],['new',pair.new]])await page.screenshot({path:path.join(out,`${prefix}-${kind}-open-${label}.png`)});
    await pair.old.waitForTimeout(300);
    if(kind==='settings'){
     const states={};
     for(const [label,page,isOld]of[['old',pair.old,true],['new',pair.new,false]]){
      const view=page.locator(isOld?'[class*=PomodoroSettings-content] > [class*=ScrollView-root]':'.legacy-settings-content');
      const track=page.locator(isOld?'[class*=PomodoroSettings-content] > [class*=ScrollView-customTrack]':'.legacy-settings .legacy-scroll-track');
      await page.mouse.move(100,100);await page.waitForTimeout(1300);const idle=await scrollState(page,isOld);assert.equal(idle.opacity,0);
      const r=await view.boundingBox();await page.mouse.move(r.x+r.width-4,r.y+30);await page.waitForTimeout(250);const hover=await scrollState(page,isOld);assert.equal(hover.opacity,1);
      await page.mouse.move(r.x+100,r.y+100);await page.mouse.wheel(0,180);await page.waitForTimeout(250);const wheel=await scrollState(page,isOld);assert(wheel.top>0);assert.equal(wheel.opacity,1);
      await page.screenshot({path:path.join(out,`${prefix}-scroll-wheel-${label}.png`)});
      await page.mouse.move(r.x+r.width-4,r.y+30);await page.waitForTimeout(220);
      const thumb=await track.locator('>div').boundingBox();await page.mouse.move(thumb.x+3,thumb.y+10);await page.mouse.down();await page.mouse.move(thumb.x+3,thumb.y+60,{steps:8});await page.mouse.up();const dragged=await scrollState(page,isOld);assert(dragged.top>wheel.top);
      await page.mouse.move(100,100);await page.waitForTimeout(1300);assert.equal((await scrollState(page,isOld)).opacity,0);
      states[label]={idle,hover,wheel,dragged};
     }
     for(const state of ['idle','hover','wheel'])for(const key of ['width','track','radius','thumb','shadow','thumbRadius','opacity'])assert.equal(states.new[state][key],states.old[state][key],prefix+' '+state+' '+key);
     results.push({prefix,scroll:states});
    }
    const oldClose=kind==='project'?pair.old.locator('[class*=ProjectEditer-cancel]'):kind==='reports'?pair.old.locator('[class*=Report-close]'):pair.old.locator('[class*=Overlay-root] img[src="img/setting-close.png"]');
    await oldClose.click();const exitBefore=kind==='reports'?null:await frames(pair.old,oldRoot);
    await (kind==='project'?pair.new.locator('.legacy-project-editor footer button').nth(0):pair.new.getByTestId('close-page')).click();
    const exitAfter=kind==='reports'?null:await frames(pair.new,newRoot);assert.deepEqual(exitAfter,exitBefore,prefix+' '+kind+' exit');
    // CSS clocks are paused; lifecycle still waits its full 250ms before unmount.
    await pair.old.waitForTimeout(300);await pair.new.locator(newRoot).waitFor({state:'detached'});
    results.push({prefix,kind,enter:after,exit:exitAfter});
   }
  }finally{await pair.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2))}
  console.log('PASS '+prefix);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
