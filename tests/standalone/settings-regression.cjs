const {createStandaloneServer}=require('../../scripts/standalone-server.cjs');
const {assert,fs,path,root,evidence,launch,contextFor}=require('./helpers.cjs');
const version=require('../../release.json').localVersion;
const prefix='FocusTodoStandalone.data.';
const image=fs.readFileSync(path.join(root,'public/img/header-portrait.png'));
const volumeTip=fs.readFileSync(path.join(root,'public/audio/VolumeTip.wav')).toString('base64');
const engines=(process.env.FOCUS_STANDALONE_ENGINES||'chromium').split(',');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});const server=createStandaloneServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const engine of engines){const browser=await launch(engine);try{
  const {page:p,context,errors,requests}=await contextFor(browser,origin,{reducedMotion:'no-preference'});
  await context.addInitScript(prefix=>{
   localStorage.setItem(prefix+'FocusTodo.language','zh-CN');localStorage.setItem(prefix+'DarkMode','false');
   window.settingsProbe={writes:[],plays:[],tipElements:[],themeMutations:0,opens:0};
   const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.settingsProbe.writes.push([k,String(v)]);return write.call(this,k,v)};
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){
    if(this.loop)window.settingsProbe.background=this;
    const tip=this.src.startsWith('data:audio/')||/\/VolumeTip-[^/]+\.wav$/.test(this.src);
    const overlap=tip?window.settingsProbe.tipElements.filter(a=>!a.paused&&!a.ended).length:0;
    const sample={src:tip?'VolumeTip.wav':this.src,volume:this.volume,time:performance.now(),overlap,decoded:false};
    window.settingsProbe.plays.push(sample);
    if(tip){window.settingsProbe.tipSource=this.src;window.settingsProbe.tipElements.push(this)}
    return play.call(this).then(()=>{sample.decoded=this.readyState>=2},error=>{sample.error=error.name;throw error});
   };
   const show=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(){window.settingsProbe.opens++;return show.call(this)};
   document.addEventListener('DOMContentLoaded',()=>new MutationObserver(rs=>window.settingsProbe.themeMutations+=rs.length).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']}),{once:true});
  },prefix);
  await p.goto(origin,{waitUntil:'domcontentloaded'});await p.getByTestId('app-shell').waitFor();await p.evaluate(()=>document.fonts.ready);
  async function open(tab){if(!await p.getByTestId('settings-page').isVisible())await p.locator('[data-view=settings]').click();await p.locator('[data-settings-tab='+tab+']').click()}
  async function close(){await p.getByTestId('close-page').click();await p.getByTestId('settings-page').waitFor({state:'hidden'})}
  async function avatar(selector){await p.waitForFunction(s=>{const e=document.querySelector(s);return e?.complete&&e.naturalWidth>0},selector);assert.match(await p.locator(selector).getAttribute('src'),/header-portrait/)}
  await avatar('.workspace-avatar');
  for(const value of ['', 'not-an-image','data:image/png;base64,AAAA']){
   await p.evaluate(({prefix,value})=>localStorage.setItem(prefix+'Portrait',value),{prefix,value});await p.reload({waitUntil:'domcontentloaded'});await p.getByTestId('app-shell').waitFor();await avatar('.workspace-avatar');await open('account');await avatar('.domain-avatar');await close();await p.locator('[data-view=forest]').click();await avatar('.legacy-forest-user>img');await p.getByTestId('close-page').click();await p.getByTestId('forest-page').waitFor({state:'hidden'});
  }
  await open('account');const profileInput=p.locator('input[type=file][accept="image/png,image/jpeg,image/gif"]'),importInput=p.locator('input[type=file][accept^=".json"]');
  const name=p.getByTestId('settings-page').locator('input[required]');await name.fill('保留取消后的资料');
  for(const input of [profileInput,importInput]){await input.evaluate(e=>e.dispatchEvent(new Event('cancel',{bubbles:true})));assert.equal(await p.getByTestId('settings-page').isVisible(),true);assert.equal(await name.inputValue(),'保留取消后的资料')}
  await profileInput.setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await p.locator('.legacy-settings-notice').waitFor();assert.equal(await p.getByTestId('settings-page').isVisible(),true);
  await profileInput.setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:image});await p.locator('.legacy-account-row button.primary').click();await p.waitForFunction(prefix=>localStorage.getItem(prefix+'Portrait')?.startsWith('data:image/png;base64,'),prefix);assert.equal(await p.getByTestId('settings-page').isVisible(),true);
  await importInput.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});const restore=p.locator('.legacy-backup-restore');await restore.locator('.legacy-backup-error').filter({hasText:/./}).waitFor();assert.equal(await p.getByTestId('settings-page').isVisible(),true);await restore.locator('footer button').first().click();await restore.waitFor({state:'hidden'});
  // Import a real export with an alternate avatar while keeping the same preference snapshot.
  await p.getByRole('button',{name:'导出数据',exact:true}).click();
  const exporter=p.locator('.legacy-backup-export');
  await exporter.locator('input[value=json]').check();
  const [backupDownload]=await Promise.all([p.waitForEvent('download'),exporter.locator('footer button.primary').click()]);
  const backup=JSON.parse(fs.readFileSync(await backupDownload.path(),'utf8'));
  assert.match(backup.localStorage.Portrait,/^data:image\/png;base64,/);
  const restoredAvatar=await p.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
   const context=canvas.getContext('2d');
   context.fillStyle='#3575cd';context.fillRect(0,0,64,64);
   context.fillStyle='#ffffff';context.fillRect(16,16,32,32);
   return canvas.toDataURL();
  });
  assert.notEqual(backup.localStorage.Portrait,restoredAvatar);
  backup.localStorage.Portrait=restoredAvatar;
  backup.localStorage.AvatarImportSentinel='preserved';
  await exporter.locator('footer button').first().click();await exporter.waitFor({state:'hidden'});
  await p.setViewportSize({width:1280,height:550});
  await importInput.setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  const importTrack=restore.locator(':scope>.legacy-scroll-track');
  await importTrack.waitFor();
  const importBody=restore.locator('form');
  await importBody.hover();
  await p.mouse.wheel(0,450);
  await p.waitForFunction(()=>document.querySelector('.legacy-backup-restore>form').scrollTop>0);
  await p.screenshot({path:path.join(evidence,'restore-'+engine+'.png')});
  await Promise.all([p.waitForEvent('download'),restore.locator('footer button.primary').click()]);
  const safety=p.locator('.legacy-task-delete');
  await safety.locator('button.primary').click();
  await restore.waitFor({state:'hidden'});
  assert.equal(await p.locator('.domain-avatar').getAttribute('src'),restoredAvatar);
  assert.equal(await p.locator('.workspace-avatar').getAttribute('src'),restoredAvatar);
  assert.equal(await p.evaluate(prefix=>localStorage.getItem(prefix+'AvatarImportSentinel'),prefix),'preserved');
  await p.setViewportSize({width:1280,height:900});
  await open('projects');await p.waitForTimeout(300);
  await p.evaluate(()=>{window.settingsDialog=document.querySelector('.domain-overlay');window.settingsOpens=window.settingsProbe.opens;window.settingsAnimations=[];window.settingsDialog.addEventListener('animationstart',e=>window.settingsAnimations.push(e.animationName))});
  const reset=p.locator('.legacy-settings-project-toolbar button');await reset.click();const toggle=p.locator('.legacy-settings-project-toggle input').first();const before=await toggle.isChecked();await toggle.click();await p.waitForFunction(before=>document.querySelector('.legacy-settings-project-toggle input').checked!==before,before);await reset.click();
  assert.equal(await p.evaluate(()=>window.settingsDialog===document.querySelector('.domain-overlay')&&window.settingsOpens===window.settingsProbe.opens&&window.settingsAnimations.length===0),true,'settings keep the same dialog and do not replay entrance');
  await open('appearance');const select=p.getByTestId('prototype-theme');await select.click();assert.deepEqual(await p.locator('.legacy-settings-menu [role=option]').allTextContents(),['浅色','深色','跟随系统']);await select.locator('..').click({position:{x:60,y:15}});assert.equal(await p.locator('.legacy-settings-menu').count(),0,'whole trigger closes an open searchable menu');
  await select.click();await p.locator('.legacy-settings-menu [role=option]').filter({hasText:'深色'}).click();await p.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  for(const tab of ['appearance','pomodoro','general']){
   await open(tab);const selects=p.locator('.legacy-settings-content select');for(let i=0;i<await selects.count();i++){
    const trigger=selects.nth(i);await trigger.scrollIntoViewIfNeeded();await trigger.click();const menu=p.locator('.legacy-settings-menu');await menu.waitFor();assert.equal(await menu.locator('[aria-selected=true]').count(),1);assert.equal(await menu.locator('[aria-selected=true]').evaluate(e=>getComputedStyle(e).backgroundImage.includes('new-task-project-selected')),true);await trigger.click({position:{x:190,y:15}});await menu.waitFor({state:'hidden'});await trigger.click();await p.locator('.domain-overlay>header h1').click();await menu.waitFor({state:'hidden'});
   }
  }
  await open('appearance');await p.getByRole('button',{name:'Ocean',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[aria-label=Ocean]').getAttribute('aria-pressed')==='true');
  await p.evaluate(()=>{window.settingsProbe.writes=[];window.settingsProbe.themeMutations=0;window.settingsOpens=window.settingsProbe.opens});await p.getByRole('button',{name:'Ocean',exact:true}).click();await p.waitForTimeout(150);assert.deepEqual(await p.evaluate(()=>window.settingsProbe.writes),[],'current theme produces no writes');assert.equal(await p.evaluate(()=>window.settingsProbe.themeMutations),0);
  for(const theme of ['Leaf','Ocean','Trees','Ocean']){await p.getByRole('button',{name:theme,exact:true}).click();await p.waitForFunction(theme=>document.querySelector('[aria-label='+theme+']').getAttribute('aria-pressed')==='true',theme);const bg=await p.getByTestId('timer-floating').evaluate(e=>e.style.backgroundImage);assert(bg.toLowerCase().includes(theme.toLowerCase()));}
  await open('pomodoro');const alarms=p.locator('.legacy-sound-alarm select');
  for(const alarm of await alarms.all()){
   assert.equal(await alarm.locator('option').first().getAttribute('value'),'alm_None');
   assert.equal(await alarm.inputValue(),'alm_Timer');
  }
  const taskSound=p.getByText('任务完成提示音',{exact:true}).locator('..').locator('input');
  assert(await taskSound.isChecked());
  await taskSound.uncheck();
  await p.waitForFunction(prefix=>localStorage.getItem(prefix+'TskCmpSnd')==='false',prefix);
  assert.equal(await p.locator('.legacy-alarm-preview').count(),0);
  await alarms.first().click();const menu=p.locator('.legacy-settings-menu');const preview=menu.locator('.legacy-alarm-option-preview').first();await preview.click();assert.equal(await menu.isVisible(),true);await p.screenshot({path:path.join(evidence,'settings-'+engine+'-alarm-dark.png')});const previewRect=await preview.boundingBox(),check=await menu.locator('[aria-selected=true]').boundingBox();assert(previewRect.x+previewRect.width<=check.x+check.width-24);
  const track=p.locator('.legacy-settings-menu-surface>.legacy-scroll-track');assert.equal(await track.count(),1);await menu.hover();const scrollBefore=await menu.evaluate(e=>e.scrollTop);await p.mouse.wheel(0,300);await p.waitForFunction(before=>document.querySelector('.legacy-settings-menu').scrollTop>before,scrollBefore);await track.dispatchEvent('mouseenter');const thumb=track.locator('.legacy-scroll-thumb'),thumbRect=await thumb.boundingBox();await p.mouse.move(thumbRect.x+3,thumbRect.y+5);await p.mouse.down();await p.mouse.move(thumbRect.x+3,thumbRect.y+40,{steps:8});await p.mouse.up();assert(await menu.evaluate(e=>e.scrollTop)>scrollBefore);await menu.locator('[role=option]').last().click();await menu.waitFor({state:'hidden'});
  await p.locator('.legacy-noise-choice:has(img[src*=wn-rain])').click();await p.waitForFunction(prefix=>localStorage.getItem(prefix+'BgMusic')==='bgm_Rain',prefix);await close();await p.getByTestId('timer-floating').locator('button.primary').click();await p.waitForFunction(()=>window.settingsProbe.background&&!window.settingsProbe.background.paused);await open('pomodoro');
  for(let i=0;i<2;i++){
   const range=p.locator('.legacy-sound-row input[type=range]').nth(i);await range.scrollIntoViewIfNeeded();assert.equal(await range.evaluate(e=>getComputedStyle(e).borderWidth),'0px');assert.equal(await range.getAttribute('step'),'any');
   await p.evaluate(()=>{window.settingsProbe.writes=[];window.settingsProbe.plays=[]});const rect=await range.boundingBox();await p.mouse.move(rect.x+rect.width-5,rect.y+rect.height/2);await p.mouse.down();for(let x=rect.width-8;x>65;x-=1.3)await p.mouse.move(rect.x+x,rect.y+rect.height/2);if(i===1){const live=Number(await range.inputValue());await p.waitForFunction(value=>Math.abs(window.settingsProbe.background.volume-value/100)<.000001,live);assert.equal(await p.evaluate(()=>window.settingsProbe.writes.filter(([key])=>key.endsWith('WNVol')).length),0,'drag preview has no persistence writes');await p.waitForTimeout(1100);assert(Math.abs(await p.evaluate(()=>window.settingsProbe.background.volume)-live/100)<.000001,'timer publication preserves the live preview')}await p.waitForTimeout(200);
   assert.equal(await p.evaluate(()=>window.settingsProbe.plays.filter(a=>a.src.includes('VolumeTip')).length),0,'Holding a paused drag never plays feedback');
   await p.mouse.up();
   const value=Number(await range.inputValue());assert(!Number.isInteger(value),'fractional volume follows actual pointer pixels');const key=i?'WNVol':'RtnVol';await p.waitForFunction(({key,value,prefix})=>Number(localStorage.getItem(prefix+key))===value,{key,value,prefix});const writes=await p.evaluate(({key,prefix})=>window.settingsProbe.writes.filter(([k])=>k===prefix+key),{key,prefix});assert.equal(writes.length,1,'one final pointer transaction');await p.waitForFunction(value=>window.settingsProbe.plays.some(a=>a.src.includes('VolumeTip')&&Math.abs(a.volume-value/100)<.000001&&a.decoded),value).catch(async error=>{console.error(await p.evaluate(()=>window.settingsProbe.plays));throw error});const tip=await p.evaluate(()=>window.settingsProbe.plays.filter(a=>a.src.includes('VolumeTip')));assert.equal(tip.length,1);assert(tip.every(a=>a.overlap===0),'feedback samples never play over an earlier sample');assert(Math.abs(tip.at(-1).volume-value/100)<.000001);
  }
  const slider=p.locator('.legacy-sound-row input[type=range]').first();
  await slider.scrollIntoViewIfNeeded();
  let bounds=await slider.boundingBox();
  const stored=await slider.inputValue();
  await p.evaluate(()=>{window.settingsProbe.plays=[];window.settingsProbe.writes=[]});
  await slider.evaluate(el=>el.addEventListener('pointerdown',event=>{el.dataset.testPointerId=event.pointerId},{once:true}));
  await p.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height/2);
  await p.mouse.down();
  await slider.evaluate(el=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:Number(el.dataset.testPointerId)})));
  await p.mouse.up();
  assert.equal(await slider.inputValue(),stored,'A cancelled drag restores the saved value');
  assert.equal(await p.evaluate(()=>window.settingsProbe.plays.length),0);
  await slider.evaluate(el=>el.addEventListener('pointerdown',event=>{el.dataset.testPointerId=event.pointerId},{once:true}));
  await p.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height/2);
  await p.mouse.down();
  await p.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height/2);
  await slider.evaluate(el=>el.releasePointerCapture(Number(el.dataset.testPointerId)));
  await p.mouse.move(bounds.x+bounds.width*.7,bounds.y-30);
  await p.mouse.up();
  assert.equal(await slider.inputValue(),stored,'Unexpected loss of capture cancels the gesture');
  assert.equal(await p.evaluate(()=>window.settingsProbe.plays.length),0);
  await slider.focus();
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(120);
  assert.equal(await p.evaluate(()=>window.settingsProbe.plays.length),0);
  await p.keyboard.up('ArrowLeft');
  await p.waitForFunction(()=>window.settingsProbe.plays.some(a=>a.src.includes('VolumeTip')&&a.decoded));
  assert(Number(await slider.inputValue())<Number(stored));
  if(engine==='chromium'){
   const cdp=await context.newCDPSession(p);
   bounds=await slider.boundingBox();
   await p.evaluate(()=>window.settingsProbe.plays=[]);
   const point={x:bounds.x+bounds.width*.7,y:bounds.y+bounds.height/2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+18}]});
   await p.waitForTimeout(120);
   assert.equal(await p.evaluate(()=>window.settingsProbe.plays.length),0);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await p.waitForFunction(()=>window.settingsProbe.plays.some(a=>a.src.includes('VolumeTip')&&a.decoded));
   await cdp.detach();
  }
  await p.screenshot({path:path.join(evidence,'settings-'+engine+'-dark.png')});await close();
  assert.equal(await p.title(),'专注清单'+version);
  await p.getByRole('button',{name:'日程',exact:true}).click();
  await p.locator('[data-view=notifications]').click();
  const popover=p.locator('.legacy-notification-popover');
  await popover.locator('.legacy-scroll-track').waitFor();
  assert.equal(await popover.locator('header').evaluate(e=>getComputedStyle(e).color),'rgb(232, 232, 235)','The notification heading uses legible dark-mode text');
  const firstUpdate=p.locator('[data-version]').first();
  assert(await firstUpdate.evaluate(el=>{
   const r=el.getBoundingClientRect();
   return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+8));
  }),'Calendar controls cannot cover the notification list');
  await p.screenshot({path:path.join(evidence,'calendar-notifications-'+engine+'.png')});
  await firstUpdate.click();const release=p.locator('.legacy-release-dialog');await release.waitFor();assert.equal(await release.locator('header button').count(),0);assert.equal(await release.locator('footer button').count(),1);assert.equal(await release.locator('footer button').textContent(),'确定');
  assert(await release.locator('footer button').evaluate(e=>{
   const text=document.createRange();text.selectNodeContents(e);
   const r=text.getBoundingClientRect(),b=e.getBoundingClientRect();
   return Math.abs(r.x+r.width/2-b.x-b.width/2)<1&&Math.abs(r.y+r.height/2-b.y-b.height/2)<2;
  }),'Update confirmation label is centered on both axes');assert.equal(await release.locator('footer button').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 81, 85)');assert(await release.locator('li').count()>0);await release.evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished)));assert.equal(await release.evaluate(e=>getComputedStyle(e).opacity),'1');await p.screenshot({path:path.join(evidence,'release-'+engine+'.png')});await release.locator('footer button').click();await release.waitFor({state:'hidden'});
  const tipSource=await p.evaluate(()=>window.settingsProbe.tipSource);
  if(await p.evaluate(()=>typeof OfflineAudioContext==='function')){
   assert(tipSource.split(',')[1]===volumeTip,'Embedded playback uses the original WAV bytes');
   assert(!requests.some(url=>url.includes('VolumeTip')||url.endsWith('.wav')),'Volume feedback must not request a standalone WAV on a full engine');
  }else{
   assert.match(tipSource,/\/VolumeTip-[^/]+\.wav$/);
   const response=await p.request.get(tipSource);
   assert.equal(response.status(),200);
   assert((await response.body()).toString('base64')===volumeTip,'The media-only fallback uses the original WAV bytes');
  }
  await p.reload({waitUntil:'domcontentloaded'});await p.getByTestId('app-shell').waitFor();
  assert.equal(await p.locator('.workspace-avatar').getAttribute('src'),restoredAvatar);
  await open('pomodoro');
  assert.equal(await taskSound.isChecked(),false);
  assert.equal(await alarms.first().inputValue(),'alm_WindUp');
  assert.deepEqual(errors,[]);console.log('PASS '+engine+' settings regressions: avatar fallbacks, dialog, stable settings/theme, dropdowns/checks/preview/scroll, continuous volume + feedback, title, file cancel/failure/success');await context.close();
  // A cold, held full-size image must retain the painted theme. A newer
  // choice also cancels that pending selection, without a stale later switch.
  const cold=await contextFor(browser,origin);let releaseImage;const held=new Promise(r=>releaseImage=r);let requested=false;
  await cold.context.addInitScript(prefix=>{localStorage.setItem(prefix+'FocusTodo.language','zh-CN');localStorage.setItem(prefix+'DarkMode','false')},prefix);
  await cold.context.route(/timer-bg-desert-(?!shortcut).*\.jpg/,async route=>{requested=true;await held;await route.continue()});
  try{await cold.page.goto(origin,{waitUntil:'domcontentloaded'});await cold.page.getByTestId('app-shell').waitFor();await cold.page.locator('[data-view=settings]').click();await cold.page.locator('[data-settings-tab=appearance]').click();
   await cold.page.getByRole('button',{name:'Desert',exact:true}).click();assert(requested);assert.equal(await cold.page.getByRole('button',{name:'Leaf',exact:true}).getAttribute('aria-pressed'),'true');assert.match(await cold.page.getByTestId('timer-floating').getAttribute('style'),/timer-bg-leaf/);
   await cold.page.getByRole('button',{name:'Ocean',exact:true}).click();await cold.page.waitForFunction(()=>document.querySelector('[aria-label=Ocean]').getAttribute('aria-pressed')==='true');releaseImage();await cold.page.waitForResponse(/timer-bg-desert-(?!shortcut).*\.jpg/);assert.equal(await cold.page.getByRole('button',{name:'Ocean',exact:true}).getAttribute('aria-pressed'),'true');
   await cold.page.getByRole('button',{name:'Desert',exact:true}).click();await cold.page.waitForFunction(()=>document.querySelector('[aria-label=Desert]').getAttribute('aria-pressed')==='true');assert.match(await cold.page.getByTestId('timer-floating').getAttribute('style'),/timer-bg-desert/);assert.deepEqual(cold.errors,[]);console.log('PASS '+engine+' cold image decoding and stale theme cancellation');
  }finally{releaseImage();await cold.context.close()}
 }finally{await browser.close()}}}finally{await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
