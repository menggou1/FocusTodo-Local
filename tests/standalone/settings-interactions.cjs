/* D-V settings: actual pointer input and DOM/CSS against the 1.9.3 oracle. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,copyFixture,metrics,assert,fs,path}=require('./ui-restore-helpers.cjs');
const image=fs.readFileSync(path.resolve(__dirname,'../../public/img/header-portrait.png'));
const dataURL='data:image/png;base64,'+image.toString('base64');
const tabs=[['account','账号','Account'],['general','通用','General'],['pomodoro','番茄钟','Pomodoro Timer'],['projects','清单管理','Projects'],['appearance','外观','Appearance'],['about','关于','About']];
async function tab(pair,id,locale){const row=tabs.find(t=>t[0]===id);await pair.old.locator('[class*=Settings-menuName]').filter({hasText:row[locale==='en'?2:1]}).click();await pair.new.locator('[data-settings-tab='+id+']').click()}
async function open(pair){
 const oldPause=await pair.old.addStyleTag({content:'[class*=Overlay-root]{animation-play-state:paused!important}'}),newPause=await pair.new.addStyleTag({content:'.domain-overlay,.domain-overlay::backdrop{animation-play-state:paused!important}'});
 await pair.old.locator('img[src="img/header-setting.png"]').click();
 const before=await pair.old.locator('[class*=Overlay-root]').evaluate(e=>{const a=e.getAnimations()[0];return {duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing==='linear'?a.effect.getKeyframes()[0].easing:a.effect.getTiming().easing,frames:a.effect.getKeyframes().map(f=>({opacity:f.opacity}))}});
 await pair.new.locator('[data-view=settings]').click();await pair.new.getByTestId('settings-page').waitFor();
 const after=await pair.new.locator('.domain-overlay').evaluate(e=>e.getAnimations({subtree:true}).map(a=>({pseudo:a.effect.pseudoElement,duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing==='linear'?a.effect.getKeyframes()[0].easing:a.effect.getTiming().easing,frames:a.effect.getKeyframes().map(f=>({opacity:f.opacity}))})));
 assert(after.some(a=>a.pseudo==='::backdrop'),'settings mask fades with its content');for(const a of after){const {pseudo,...motion}=a;assert.deepEqual(motion,before)}
 assert.equal(await pair.new.locator('.domain-overlay').evaluate(e=>getComputedStyle(e,'::backdrop').backgroundColor),await pair.old.locator('[class*=Overlay-mask]').evaluate(e=>getComputedStyle(e).backgroundColor));
 await oldPause.evaluate(e=>e.remove());await newPause.evaluate(e=>e.remove());await pair.old.waitForTimeout(280);
}
const rootOld='.focus-project-management',rootNew='.legacy-settings-projects';
const ids=(p,root)=>p.locator(root+' [data-project-id]').evaluateAll(es=>es.map(e=>e.dataset.projectId));
async function compare(pair,oldSelector,newSelector,properties=['x','y','width','height','color','fontSize','fontWeight']){
 const a=(await metrics(pair.old,{value:oldSelector})).value,b=(await metrics(pair.new,{value:newSelector})).value;
 assert(a&&b,oldSelector+' / '+newSelector);
 for(const key of properties)assert(typeof a[key]==='number'?Math.abs(a[key]-b[key])<1:a[key]===b[key],newSelector+' '+key+': '+a[key]+' / '+b[key]);
}
async function drag(page,root,handle,ghost){
 const a=await page.locator(root+' '+handle).nth(0).boundingBox(),b=await page.locator(root+' '+handle).nth(2).boundingBox();
 await page.mouse.move(a.x+10,a.y+10);await page.mouse.down();await page.mouse.move(a.x+12,a.y+11);assert.equal(await page.locator(ghost).count(),0,'5px activation threshold');
 await page.mouse.move(b.x+10,b.y+10,{steps:12});assert.equal(await page.locator(ghost).count(),1);
 await page.waitForTimeout(160);
 assert.equal(await page.locator(root+' [data-drop-position=after]').count(),1);
 assert.equal(await page.locator(root+' [data-dragging=true]').evaluate(e=>getComputedStyle(e).opacity),'0.5');
 assert.equal(await page.locator(ghost).evaluate(e=>getComputedStyle(e).opacity),'0.95');
 await page.mouse.up();
 await page.waitForFunction(root=>[...document.querySelectorAll(root+' [data-project-id]')].some(e=>e.getAnimations().some(a=>a.effect.getTiming().duration===180)),root,{polling:10});
 const timing=await page.locator(root+' [data-project-id]').evaluateAll(es=>es.flatMap(e=>e.getAnimations().map(a=>({duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing}))));
 assert(timing.some(t=>t.duration===180&&t.easing==='ease-out'),'180ms FLIP');await page.waitForTimeout(220);assert.equal(await page.locator(ghost).count(),0);
}
(async()=>{
 for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
  const pair=await paired({locale,dark,reducedMotion:'no-preference'});
  try{
   await pair.old.evaluate(async dataURL=>{
    const s=await FocusLocalData.snapshot(),base=s.indexedDB.Project.find(p=>p.type===7005);
    await new Promise((resolve,reject)=>{const q=indexedDB.open('PomodoroDB6',3);q.onsuccess=()=>{const db=q.result,tx=db.transaction('Project','readwrite');for(let i=0;i<4;i++)tx.objectStore('Project').put({...base,id:'settings-custom-'+i,name:'Custom '+i,type:1000,state:0,parentId:'',order:10000+i*10000});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}});
    localStorage.setItem('FocusTodo.externalNetwork','true');
    localStorage.setItem('lexible-custom-themes',JSON.stringify({custom_later:{dataUrl:dataURL,thumbnail:dataURL,type:'custom',createdAt:2,name:'Later image'},__bing_daily__:{dataUrl:dataURL,thumbnail:dataURL,type:'bing',updatedAt:Date.now(),name:'Bing'},custom_first:{dataUrl:dataURL,thumbnail:dataURL,type:'custom',createdAt:1,name:'First image'}}));
   },dataURL);
   await pair.old.reload();await pair.old.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await pair.old.evaluate(()=>FocusLocalReady);await copyFixture(pair);await open(pair);
   for(const[id]of tabs){await tab(pair,id,locale);await compare(pair,'[class^=Settings-root]','.domain-overlay',['x','y','width','height']);await compare(pair,'[class*=Settings-navigation]','.legacy-settings>nav',['x','y','width','height']);}
   await tab(pair,'projects',locale);
   assert.deepEqual(await ids(pair.new,rootNew),await ids(pair.old,rootOld));
   assert.deepEqual(await pair.new.locator('.legacy-settings-project-name').allTextContents(),await pair.old.locator('[class*=PresetProjectItem-name],[class*=CustomProjectItem-name]').allTextContents());
   await compare(pair,'.focus-project-toolbar','.legacy-settings-project-toolbar');
   await compare(pair,'.focus-project-reset','.legacy-settings-project-toolbar button');
   await compare(pair,'[class*=ProjectManagement-content]','.legacy-settings-project-rows',['x','y','width','height']);
   await compare(pair,'[data-project-group=presetProjects]','.legacy-settings-project-row',['x','y','width','height','background']);
   await compare(pair,'.focus-project-handle','.legacy-settings-project-handle',['x','y','width','height','color']);
   assert.equal(await pair.new.locator(rootNew+' [data-project-group=customProjects] button[draggable=true]').count(),0);
   const original=await ids(pair.new,rootNew);
   for(const[p,root,handle,ghost]of [[pair.old,rootOld,'.focus-project-handle','.focus-project-drag-preview'],[pair.new,rootNew,'.legacy-settings-project-handle','.legacy-project-drag-preview']])await drag(p,root,handle,ghost);
   assert.deepEqual(await ids(pair.new,rootNew),await ids(pair.old,rootOld));
   for(const[p,root,handle,ghost]of [[pair.old,rootOld,'.focus-project-handle','.focus-project-drag-preview'],[pair.new,rootNew,'.legacy-settings-project-handle','.legacy-project-drag-preview']]){
    const before=await ids(p,root),r=await p.locator(root+' '+handle).first().boundingBox();await p.mouse.move(r.x+10,r.y+10);await p.mouse.down();await p.mouse.move(r.x+10,r.y+60,{steps:5});await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await p.locator(ghost).count(),0);assert.deepEqual(await ids(p,root),before);assert.equal(await p.locator(root).isVisible(),true);
    await p.locator(root+' '+handle).nth(1).focus();await p.keyboard.press('ArrowUp');await p.waitForTimeout(220);
   }
   assert.deepEqual(await ids(pair.new,rootNew),await ids(pair.old,rootOld));
   const saved=await ids(pair.new,rootNew);await pair.new.reload();await pair.new.getByTestId('app-shell').waitFor();await pair.new.locator('[data-view=settings]').click();await pair.new.locator('[data-settings-tab=projects]').click();assert.deepEqual(await ids(pair.new,rootNew),saved);
   await pair.old.locator('.focus-project-reset').click();await pair.new.locator('.legacy-settings-project-toolbar button').click();await pair.new.waitForTimeout(250);assert.deepEqual(await ids(pair.new,rootNew),original);assert.deepEqual(await ids(pair.new,rootNew),await ids(pair.old,rootOld));
   await pair.old.locator('[class*=CustomProjectItem-delete]').first().click();await pair.new.locator('.legacy-settings-project-delete').first().click();
   await compare(pair,'[class*=ConfirmDialog-root]','.legacy-settings-project-delete-dialog',['x','y','width','height','color','background']);
   await pair.old.locator('[class*=ConfirmDialog-cancel]').click();await pair.new.locator('.legacy-settings-project-delete-dialog footer button').first().click();await pair.new.locator('.legacy-settings-project-delete-dialog').waitFor({state:'detached'});
   await tab(pair,'general',locale);
   await compare(pair,'[class*=GeneralSettings-root] table:first-of-type .react-switch-bg','.legacy-settings-content>.domain-setting .legacy-switch',['width','height','background']);
   for(const p of [pair.old,pair.new]){const s=p===pair.old?'[class*=GeneralSettings-root] table:first-of-type [role=checkbox]':'.legacy-settings-content>.domain-setting .legacy-switch';await p.locator(s).first().click()}
   await pair.new.waitForTimeout(280);
   await compare(pair,'[class*=GeneralSettings-root] table:first-of-type .react-switch-bg','.legacy-settings-content>.domain-setting .legacy-switch',['width','height','background']);
   assert.equal(await pair.new.locator('.legacy-switch').first().evaluate(e=>getComputedStyle(e,'::after').transitionDuration),'0.25s, 0.25s, 0.15s');
   await pair.new.locator('[data-testid=prototype-language]').click();assert.equal(await pair.new.locator('.legacy-settings-menu [aria-selected=true]').evaluate(e=>getComputedStyle(e).backgroundImage.includes('new-task-project-selected')),true);await pair.new.keyboard.press('Escape');
   await tab(pair,'pomodoro',locale);await pair.new.locator('.legacy-settings-content').evaluate(e=>e.scrollTop=400);
   await tab(pair,'appearance',locale);
   assert.equal(await pair.new.locator('.legacy-settings-content').evaluate(e=>e.scrollTop),0,'each settings subpage starts at the top');
   assert.equal(await pair.new.locator('.legacy-custom-theme').count(),2,'Bing cache is not a custom theme');
   assert.deepEqual(await pair.new.locator('.legacy-custom-theme .legacy-theme').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['First image','Later image']);
   await pair.old.locator('[data-theme-id=__bing_daily__]').click();await pair.new.locator('.legacy-bing').click();await pair.new.waitForFunction(()=>document.querySelector('.legacy-bing')?.getAttribute('aria-pressed')==='true');
   await compare(pair,'[data-theme-id=__bing_daily__]>div:first-child','.legacy-bing>span',['width','height','borderRadius']);
   assert.equal(await pair.new.locator('.legacy-bing>span').evaluate(e=>getComputedStyle(e).borderColor),'rgb(253, 85, 83)');assert.equal(await pair.new.locator('.legacy-bing .legacy-theme-selected').count(),1);
   await pair.old.locator('[data-theme-id=custom_first]').click();await pair.new.getByRole('button',{name:'First image',exact:true}).click();await pair.new.waitForFunction(()=>document.querySelector('[aria-label="First image"]')?.getAttribute('aria-pressed')==='true');
   assert.equal(await pair.new.locator('[aria-label="First image"]>span').evaluate(e=>getComputedStyle(e).borderColor),'rgb(253, 85, 83)');assert.equal(await pair.new.locator('.legacy-bing').getAttribute('aria-pressed'),'false');
   // Hold the real fetch at the transport boundary. A stale cached image activates
   // immediately, while other theme choices remain available and cancel the fetch.
   const held=[];let mode='hold';
   await pair.new.route(/^https:/,async route=>{
    if(mode==='hold')await new Promise(resolve=>held.push(resolve));
    if(mode==='fail')return route.abort();
    if(/biturl|HPImageArchive/.test(route.request().url()))return route.fulfill({json:{url:'https://www.bing.com/synthetic.png'}}).catch(()=>{});
    return route.fulfill({contentType:'image/png',body:image}).catch(()=>{});
   });
   await pair.new.evaluate(()=>{const key='FocusTodoStandalone.data.lexible-custom-themes',rows=JSON.parse(localStorage.getItem(key));rows.__bing_daily__.updatedAt=Date.now()-86400000;localStorage.setItem(key,JSON.stringify(rows))});
   await pair.new.locator('.legacy-bing').click();await pair.new.waitForFunction(()=>document.querySelector('.legacy-bing')?.getAttribute('aria-busy')==='true');
   await pair.new.waitForFunction(()=>document.querySelector('.legacy-bing')?.getAttribute('aria-pressed')==='true');
   await pair.new.getByTestId('close-page').click();await pair.new.locator('.domain-overlay').waitFor({state:'detached'});await pair.new.locator('[data-view=settings]').click();await pair.new.locator('[data-settings-tab=appearance]').click();assert.equal(await pair.new.locator('.legacy-bing').getAttribute('aria-busy'),'true','download state survives closing settings');
   assert.equal(await pair.new.getByRole('button',{name:'Ocean',exact:true}).isDisabled(),false,'Bing must not take the global busy lock');
   await pair.new.getByRole('button',{name:'Ocean',exact:true}).click();held.splice(0).forEach(resolve=>resolve());
   await pair.new.waitForFunction(()=>document.querySelector('.legacy-bing')?.getAttribute('aria-busy')==='false');
   assert.equal(await pair.new.getByRole('button',{name:'Ocean',exact:true}).getAttribute('aria-pressed'),'true');
   // Failure without a cached image leaves the chosen theme and permits retry.
   await pair.new.evaluate(()=>{const key='FocusTodoStandalone.data.lexible-custom-themes',rows=JSON.parse(localStorage.getItem(key));delete rows.__bing_daily__;localStorage.setItem(key,JSON.stringify(rows))});
   mode='fail';await pair.new.locator('.legacy-bing').click();await pair.new.locator('.legacy-settings-notice').waitFor();assert.equal(await pair.new.getByRole('button',{name:'Ocean',exact:true}).getAttribute('aria-pressed'),'true');
   mode='ok';await pair.new.locator('.legacy-bing').click();await pair.new.waitForFunction(()=>document.querySelector('.legacy-bing')?.getAttribute('aria-pressed')==='true');
   await pair.new.waitForFunction(()=>document.querySelector('.workspace-floating-timer')?.style.backgroundImage.includes('data:image/'));
   assert.equal(await pair.new.locator('.legacy-custom-theme').count(),2,'successful Bing download is still a single Bing card');
   const choosing=pair.new.waitForEvent('filechooser');await pair.new.locator('.legacy-upload').click();await(await choosing).setFiles({name:'synthetic-import.png',mimeType:'image/png',buffer:image});
   const uploaded=pair.new.getByRole('button',{name:'synthetic-import.png',exact:true});await uploaded.waitFor();await pair.new.waitForFunction(()=>document.querySelector('[aria-label="synthetic-import.png"]')?.getAttribute('aria-pressed')==='true');
   assert.equal(await uploaded.locator('>span').evaluate(e=>getComputedStyle(e).borderColor),'rgb(253, 85, 83)');
   pair.new.once('dialog',dialog=>dialog.accept());await pair.new.getByRole('button',{name:(locale==='en'?'Delete':'删除')+': synthetic-import.png',exact:true}).click();await uploaded.waitFor({state:'detached'});assert.equal(await pair.new.getByRole('button',{name:'Leaf',exact:true}).getAttribute('aria-pressed'),'true');
   await tab(pair,'about',locale);const links=await pair.new.locator('.legacy-platforms a').evaluateAll(es=>es.map(e=>e.href));assert.equal(links.length,6);await pair.old.evaluate(()=>{window.__links=[];window.open=url=>window.__links.push(url)});for(const platform of ['apple','android','windows','mac','chrome','edge'])await pair.old.locator('img[src="img/setting-logo-'+platform+'.png"]').click();assert.deepEqual(links,await pair.old.evaluate(()=>window.__links));
   console.log('PASS settings pointer, persistence, switches, themes, links '+locale+' '+(dark?'dark':'light'));
  }finally{await pair.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
