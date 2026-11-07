/* Isolated 1.9 behavior and ownership regressions; no personal data or live APIs. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{createServer}=require('../../scripts/server.cjs');
const evidence=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance');
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
const imageUrl='https://www.bing.com/acceptance.png';
const watchdog=setTimeout(()=>{console.error('1.9 acceptance exceeded four minutes');process.exit(1);},240000);
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})}),results=[];
 async function context(locale='zh-CN'){
  const ctx=await browser.newContext({locale,timezoneId:'Asia/Shanghai',viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{window.startupCsp=[];document.addEventListener('securitypolicyviolation',event=>startupCsp.push(event.blockedURI));let api;Object.defineProperty(window,'FocusLocal',{configurable:true,get:()=>api,set(value){api=value;const attach=value.attachTimer;value.attachTimer=(timer,options)=>{window.testTimer=timer;return attach(timer,options);};}});});
  await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return ctx;
 }
 async function page(ctx){const p=await ctx.newPage();p.on('dialog',d=>d.accept());await p.goto(base);await p.waitForFunction(()=>window.testTimer&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady);return p;}
 async function settings(p,name){await p.locator('header img[src="img/header-setting.png"]').click();await p.getByText(name,{exact:true}).click();}
 async function appearance(p){await settings(p,'外观');await p.locator('[data-theme-id="__bing_daily__"]').waitFor();}
 async function hoverFloat(p){
  const root=p.locator('[class*="FloatTimer-root"]');await root.waitFor();
  await root.evaluate(async element=>{await new Promise(requestAnimationFrame);await Promise.all(element.closest('[class^="Timer-root-"]').getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));});
  await root.hover();
 }
 async function seed(p,active=false,updatedAt=Date.now()){
  await p.evaluate(({active,updatedAt})=>{const c=document.createElement('canvas');c.width=c.height=2;const dataUrl=c.toDataURL();const themes={};for(const id of ['custom_a','custom_b','__bing_daily__'])themes[id]={name:id,dataUrl,thumbnail:dataUrl,updatedAt,createdAt:1};localStorage.setItem('lexible-custom-themes',JSON.stringify(themes));if(active){localStorage.setItem('Theme','__bing_daily__');localStorage.setItem('lexible-active-custom-theme','__bing_daily__');}},{active,updatedAt});
 }
 async function mock(p){await p.route('https://bing.biturl.top/**',r=>r.fulfill({json:{url:imageUrl}}));await p.route(imageUrl,r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:pixel}));}
 async function scenario(name,body){if(process.env.FOCUS_TEST_FILTER&&!name.includes(process.env.FOCUS_TEST_FILTER))return;const ctx=await context();try{await body(ctx);results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});throw error;}finally{await ctx.close();}}
 try{
  await scenario('default-off shared switch and existing bottom toast, keyboard and persisted opt-in',async ctx=>{
   const p=await page(ctx),external=[];p.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
   await settings(p,'通用');const toggle=p.locator('#focus-external-network');assert.equal(await toggle.isChecked(),false);
   assert.equal(await toggle.locator('..').locator('.react-switch-bg').evaluate(n=>getComputedStyle(n).height),'18px');
   await p.mouse.move(850,650);await p.mouse.wheel(0,600);
   await p.waitForFunction(()=>{const switcher=document.querySelector('#focus-external-network').parentElement.getBoundingClientRect(),panel=document.querySelector('[class*="Settings-root"]').getBoundingClientRect();return switcher.bottom<=panel.bottom&&switcher.top>=panel.top;});
   await p.waitForTimeout(250);
   await p.screenshot({path:path.join(evidence,'1.9-network-setting.png')});
   await p.getByText('外观',{exact:true}).click();const bing=p.locator('[data-theme-id="__bing_daily__"]');await bing.focus();await p.keyboard.press('Enter');
   await p.locator('#focus-local-notice').filter({hasText:'请打开外部联网'}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('lexible-active-custom-theme')),null);assert.deepEqual(external,[]);assert.deepEqual(await p.evaluate(()=>startupCsp),[]);
   await p.screenshot({path:path.join(evidence,'1.9-network-prompt.png')});
   await p.getByText('通用',{exact:true}).click();await toggle.focus();await p.keyboard.press('Space');assert.equal(await toggle.isChecked(),true);
   await p.reload();await p.evaluate(()=>FocusLocalReady);assert.equal(await p.evaluate(()=>FocusSettings.networkEnabled()),true);
  });
  await scenario('release entry reuses notification badge and only latest detail marks read across tabs',async ctx=>{
   const p=await page(ctx),peer=await page(ctx);await p.getByRole('button',{name:'通知',exact:true}).click();
   const entries=p.locator('.focus-release-entry'),dot=entries.first().locator('.focus-release-unread');await dot.waitFor();
   assert.equal(await dot.getAttribute('src'),'img/header-notification-highlight.png');assert.equal(await dot.evaluate(n=>getComputedStyle(n).clipPath),'inset(0px 0px 16px 16px)');
   await p.waitForTimeout(250);await p.screenshot({path:path.join(evidence,'1.9-unread-notification.png')});
   await entries.nth(1).click();await p.locator('#focus-update-dialog').getByRole('button',{name:'关闭',exact:true}).click();
   await p.locator('#focus-update-dialog').waitFor({state:'detached'});
   await p.waitForTimeout(250);const bell=p.getByRole('button',{name:'通知',exact:true});if(await bell.getAttribute('aria-expanded')!=='true')await bell.click();await dot.waitFor();
   await entries.first().click();await p.waitForFunction(()=>!document.querySelector('.focus-release-entry .focus-release-unread'));
   await peer.getByRole('button',{name:'通知',exact:true}).click();assert.equal(await peer.locator('.focus-release-entry .focus-release-unread').count(),0);
  });
  await scenario('Bing image download uses Blob; metadata and image redirects never contact destination',async ctx=>{
   const p=await page(ctx);await p.evaluate(()=>FocusSettings.setNetworkEnabled(true));let evil=0,fallback=0;
   await p.route('https://www.bing.com/redirect-destination',r=>{evil++;return r.abort();});
   await p.route('https://bing.biturl.top/**',r=>r.fulfill({status:302,headers:{location:'https://www.bing.com/redirect-destination','access-control-allow-origin':'*'}}));
   await p.route('https://www.bing.com/HPImageArchive.aspx**',r=>{fallback++;return r.fulfill({json:{url:imageUrl}});});
   await p.route(imageUrl,r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:pixel}));
   await appearance(p);await p.locator('[data-theme-id="__bing_daily__"]').click();await p.waitForFunction(()=>localStorage.getItem('Theme')==='__bing_daily__');assert.equal(fallback,1);assert.equal(evil,0);
   await p.getByText('通用',{exact:true}).click();await p.evaluate(()=>FocusSettings.setNetworkEnabled(false));await p.reload();await p.evaluate(()=>FocusLocalReady);
   await p.waitForFunction(()=>document.querySelector('[class*="Timer-bgi"]').style.backgroundImage.includes('data:image'));
   assert.equal(await p.evaluate(()=>FocusSettings.networkEnabled()),false);
   // Image redirect: keep the saved cache and reject the redirected download.
   await p.evaluate(()=>{FocusSettings.setNetworkEnabled(true);const themes=JSON.parse(localStorage.getItem('lexible-custom-themes'));themes.__bing_daily__.updatedAt=1;localStorage.setItem('lexible-custom-themes',JSON.stringify(themes));});
   await p.route('https://bing.biturl.top/**',r=>r.fulfill({json:{url:imageUrl}}));
   await p.route(imageUrl,r=>r.fulfill({status:302,headers:{location:'https://www.bing.com/redirect-destination','access-control-allow-origin':'*'}}));
   await appearance(p);await p.locator('[data-theme-id="__bing_daily__"]').click();await p.waitForFunction(()=>!document.querySelector('[data-theme-id="__bing_daily__"]').textContent.includes('下载中'));
   assert.equal(evil,0);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.updatedAt),1);
  });
  await scenario('day change refreshes within twelve hours; disabling networking cancels pending results',async ctx=>{
   const p=await page(ctx);const now=new Date('2026-11-07T00:10:00+08:00').getTime();await p.clock.install({time:now});await seed(p,false,now-3600000);await p.evaluate(()=>FocusSettings.setNetworkEnabled(true));await mock(p);
   await appearance(p);await p.locator('[data-theme-id="__bing_daily__"]').click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.updatedAt>new Date('2026-11-06T23:10:00+08:00').getTime());
   await p.evaluate(()=>{const themes=JSON.parse(localStorage.getItem('lexible-custom-themes'));themes.__bing_daily__.updatedAt=1;localStorage.setItem('lexible-custom-themes',JSON.stringify(themes));});
   let release;const gate=new Promise(r=>release=r);let started;const begin=new Promise(r=>started=r);
   await p.route('https://bing.biturl.top/**',async r=>{started();await gate;try{await r.fulfill({json:{url:imageUrl}});}catch(_){}});
   await p.locator('[data-theme-id="__bing_daily__"]').click();await begin;await p.evaluate(()=>FocusSettings.setNetworkEnabled(false));release();
   await p.waitForFunction(()=>!document.querySelector('[data-theme-id="__bing_daily__"]').textContent.includes('下载中'));
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.updatedAt),1);
  });
  await scenario('theme ownership serializes without Web Locks or BroadcastChannel and rejects stale choices',async ctx=>{
   await ctx.addInitScript(()=>{Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});Object.defineProperty(window,'BroadcastChannel',{value:undefined,configurable:true});});
   const p=await page(ctx);await seed(p);const peer=await page(ctx);await appearance(p);await appearance(peer);
   await p.evaluate(()=>{window.held=FocusLocalData.themeStorageOperation(()=>new Promise(resolve=>{window.releaseThemeLock=resolve;}));});await p.waitForFunction(()=>window.releaseThemeLock);
   await p.locator('[data-theme-id="custom_a"]').click();await peer.locator('[data-theme-id="custom_b"]').click();
   assert.equal(await p.evaluate(()=>localStorage.getItem('lexible-active-custom-theme')),null);
   await p.evaluate(()=>releaseThemeLock());await p.waitForFunction(()=>['custom_a','custom_b'].includes(localStorage.getItem('lexible-active-custom-theme')));
   const winner=await p.evaluate(()=>localStorage.getItem('lexible-active-custom-theme')),loser=winner==='custom_a'?peer:p;
   await loser.locator('#focus-local-notice').filter({hasText:'主题已在其他操作中修改'}).waitFor();
   assert.equal(await peer.evaluate(()=>localStorage.getItem('lexible-active-custom-theme')),winner);
   assert.equal(await p.evaluate(()=>localStorage.getItem('FocusTodo.themeJournal')),null);
  });
  await scenario('wallpaper timeout and offline failures retain the saved image without changing selection',async ctx=>{
   const p=await page(ctx);await seed(p,true,1);await p.evaluate(()=>FocusSettings.setNetworkEnabled(true));await p.clock.install();
   let release,started;const gate=new Promise(r=>release=r),begin=new Promise(r=>started=r);let fallback=0;
   await p.route('https://bing.biturl.top/**',async r=>{started();await gate;try{await r.abort();}catch(_){}});
   await p.route('https://www.bing.com/HPImageArchive.aspx**',r=>{fallback++;return r.fulfill({status:503,body:'unavailable'});});
   await appearance(p);const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.dataUrl);
   await p.locator('[data-theme-id="__bing_daily__"]').click();await begin;await p.clock.runFor(11000);release();
   await p.waitForFunction(()=>!document.querySelector('[data-theme-id="__bing_daily__"]').textContent.includes('下载中'));assert.equal(fallback,1);
   await ctx.setOffline(true);await p.locator('[data-theme-id="__bing_daily__"]').click();
   await p.waitForFunction(()=>!document.querySelector('[data-theme-id="__bing_daily__"]').textContent.includes('下载中'));
   assert.equal(await p.evaluate(()=>localStorage.getItem('Theme')),'__bing_daily__');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lexible-custom-themes')).__bing_daily__.dataUrl),saved);
  });
  await scenario('queued cached Bing selection cancels on opt-out and later classic choices win',async ctx=>{
   const p=await page(ctx);await seed(p);await p.evaluate(()=>FocusSettings.setNetworkEnabled(true));await appearance(p);
   async function hold(){await p.evaluate(()=>{window.held=FocusLocalData.themeStorageOperation(()=>new Promise(resolve=>{window.releaseThemeLock=resolve;}));});await p.waitForFunction(()=>window.releaseThemeLock);}
   async function drain(){await p.evaluate(async()=>{releaseThemeLock();await FocusLocalData.themeStorageOperation(()=>{});delete window.releaseThemeLock;});}
   await hold();await p.locator('[data-theme-id="__bing_daily__"]').click();await p.evaluate(()=>FocusSettings.setNetworkEnabled(false));await drain();
   assert.equal(await p.evaluate(()=>localStorage.getItem('lexible-active-custom-theme')),null);
   await hold();await p.locator('[data-theme-id="custom_a"]').click();await p.locator('img[src="img/timer-bg-ocean-shortcut.jpg"]').click();await drain();
   await p.waitForFunction(()=>localStorage.getItem('Theme')==='Ocean');assert.equal(await p.evaluate(()=>localStorage.getItem('lexible-active-custom-theme')),null);
  });
  await scenario('only the left mini button requests PiP; zoom and double click stay in-page',async ctx=>{
   const p=await page(ctx);await p.evaluate(()=>{window.miniRequests=0;Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:{requestWindow:()=>{miniRequests++;return Promise.reject(new Error('blocked'));}}});});
   await p.evaluate(()=>testTimer.zoomDown());await p.locator('[class*="FloatTimer-root"]').dblclick({position:{x:75,y:35}});
   const full=p.locator('[class*="FullscreenTimer-root"]');await full.waitFor();
   const bounds=await full.evaluate(root=>{const a=root.querySelector('.focus-timer-mini').getBoundingClientRect(),b=root.querySelector('[class*="FullscreenTimer-zoomdown"]').getBoundingClientRect();return {left:a.x,right:b.x};});assert(bounds.right>bounds.left);
   await full.locator('[class*="FullscreenTimer-zoomdown"]').click();assert.equal(await p.evaluate(()=>miniRequests),0);
   await hoverFloat(p);await p.locator('.FloatTimer-miniMode-1KgSp').click();
   await p.locator('#focus-local-notice').filter({hasText:'迷你窗口无法打开'}).waitFor();assert.equal(await p.evaluate(()=>miniRequests),1);
   await p.evaluate(()=>Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:undefined}));
   await hoverFloat(p);await p.locator('.FloatTimer-miniMode-1KgSp').click();await p.locator('#focus-local-notice').filter({hasText:'不支持独立迷你窗口'}).waitFor();
  });
  await scenario('native Document PiP reuses the official compact timer and existing commands',async ctx=>{
   const p=await page(ctx);await hoverFloat(p);await p.locator('.FloatTimer-miniMode-1KgSp').click();
   await p.waitForFunction(()=>documentPictureInPicture.window?.document.querySelector('.focus-mini-timer [class*="FloatTimer-root"]'));
   const mini=ctx.pages().find(target=>target!==p);await mini.setViewportSize({width:147,height:58});
   const click=selector=>p.evaluate(selector=>documentPictureInPicture.window.document.querySelector(selector).click(),selector);
   assert.equal(await p.evaluate(()=>documentPictureInPicture.window.document.querySelector('[class*="FloatTimer-content"] table').getBoundingClientRect().height),58);
   if(process.env.FOCUS_MINI_SCREENSHOT)await mini.screenshot({path:path.join(evidence,'1.9.1-native-mini.png'),animations:'disabled'});
   await click('[class*="FloatTimer-start-"]');await p.waitForFunction(()=>testTimer.localTimer.session?.state==='work');
   await click('[class*="FloatTimer-pause-"]');await p.waitForFunction(()=>testTimer.localTimer.session?.state==='pause');
   const peer=await page(ctx);await peer.evaluate(()=>testTimer.localTimer.run('resume'));
   await p.waitForFunction(()=>documentPictureInPicture.window.document.querySelector('.focus-mini-host').dataset.state==='work');
   await click('[class*="FloatTimer-pause-"]');await p.waitForFunction(()=>documentPictureInPicture.window.document.querySelector('[class*="FloatTimer-stop-"]'));
   await click('[class*="FloatTimer-stop-"]');await p.waitForFunction(()=>testTimer.localTimer.session.state==='initial');
   await p.evaluate(()=>documentPictureInPicture.window.close());await p.waitForFunction(()=>!documentPictureInPicture.window);
  });
 }finally{fs.writeFileSync(path.join(evidence,process.env.FOCUS_TEST_FILTER?'release-1.9-filtered.json':'release-1.9-results.json'),JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.close(r));clearTimeout(watchdog);}
})().catch(error=>{console.error(error);clearTimeout(watchdog);process.exitCode=1;});
