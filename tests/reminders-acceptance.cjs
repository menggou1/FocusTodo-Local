/* Committed task reminders, persistent reads, completion and release badges. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),{createServer}=require('../scripts/server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})}),errors=[];
 const context=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:800,height:450}});
 await context.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());
 await context.addInitScript(()=>{
  window.__notifications=[];
  window.Notification=class{static permission='granted';constructor(title,options){window.__notifications.push({title,body:options.body})}close(){}};
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='FocusTodo.taskRemindersRead'&&window.__denyReminder)throw Error('Injected reminder read failure');return set.apply(this,arguments)};
 });
 async function ready(page){page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.FocusAppUI&&!document.documentElement.classList.contains('focus-starting'));await page.evaluate(()=>FocusLocalReady)}
 const p=await context.newPage();
 const bell=page=>page.getByRole('button',{name:'通知',exact:true});
 async function highlighted(page,expected){await page.waitForFunction(expected=>document.querySelector('[aria-label="通知"]').style.backgroundImage.includes('highlight')===expected,expected)}
 async function task(page,name,delay){return page.evaluate(async({name,delay})=>{
  const d=FocusLocalData,now=Date.now(),created=await d.createCalendarTask({name,count:0,interval:1500,startTime:now,projectId:d.defaultProjects().find(x=>x.type===7005).id});
  const task={...created.task,reminderDate:Date.now()+delay};await d.transaction(await d.open(),['Task'],'readwrite',tx=>tx.objectStore('Task').put(task));return task;
 },{name,delay})}
 async function change(page,id,values){await page.evaluate(async({id,values})=>{const d=FocusLocalData;await d.transaction(await d.open(),['Task'],'readwrite',tx=>{const store=tx.objectStore('Task'),get=store.get(id);get.onsuccess=()=>store.put({...get.result,...values})})},{id,values})}
 try{
  await ready(p);await highlighted(p,true);
  // A task read must leave the separate latest-release badge intact.
  const first=await task(p,'无需滚动即可查看的提醒',1500);
  await p.waitForFunction(()=>window.__notifications.some(n=>n.body.includes('无需滚动即可查看的提醒')));
  await bell(p).click();await p.locator('.focus-reminder-summary').waitFor();
  const position=await p.locator('.focus-task-reminders').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scroll:el.parentElement.scrollTop,height:innerHeight}});
  assert(position.top>0&&position.bottom<=position.height&&position.scroll===0,JSON.stringify(position));
  assert.match(await p.locator('.focus-task-reminders').innerText(),/无需滚动即可查看的提醒/);
  assert.match(await p.locator('.focus-task-reminders time').getAttribute('datetime'),/^20/);
  await highlighted(p,true); // Latest release remains unread.
  await p.locator('.focus-release-entry').first().click();await p.getByRole('button',{name:'关闭',exact:true}).click();await highlighted(p,false);
  const evidence=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'docs/acceptance');fs.mkdirSync(evidence,{recursive:true});
  if(await bell(p).getAttribute('aria-expanded')!=='true')await bell(p).click();
  await p.locator('.focus-reminder-summary').waitFor();
  await p.waitForFunction(()=>{const panel=document.querySelector('#notification-popover');return panel&&getComputedStyle(panel).opacity==='1'});
  await p.screenshot({path:path.join(evidence,'task-reminders.png')});
  await p.reload();await p.waitForFunction(()=>window.FocusAppUI&&!document.documentElement.classList.contains('focus-starting'));await highlighted(p,false);
  assert.equal(await p.evaluate(()=>window.__notifications.length),0,'Read reminders do not notify again after reload');
  // New occurrence of the same task is unread; an actual UI completion clears it.
  await p.getByText('任务',{exact:true}).first().click();
  await change(p,first.id,{reminderDate:Date.now()-10});await highlighted(p,true);
  await p.getByText(first.name,{exact:true}).first().waitFor();
  await p.locator('[class*=TaskItem-complete-]').first().click();
  await p.waitForFunction(async id=>(await FocusLocalData.snapshot()).indexedDB.Task.find(t=>t.id===id)?.isFinished,first.id);await highlighted(p,false);
  const second=await task(p,'跨页已读提醒',-100);
  await highlighted(p,true);const peer=await context.newPage();await ready(peer);await highlighted(peer,true);
  await bell(peer).click();await peer.locator('.focus-task-reminders').waitFor();await highlighted(p,false);await highlighted(peer,false);
  await change(p,second.id,{reminderDate:Date.now()-5});await highlighted(peer,false); // Visible peer reads the new occurrence.
  await peer.locator('header').click({position:{x:5,y:5}});await peer.locator('#notification-popover').waitFor({state:'detached'});
  await change(p,second.id,{reminderDate:Date.now()-1});await highlighted(p,true);await highlighted(peer,true);
  await change(p,second.id,{isFinished:true,finishedDate:Date.now()});await highlighted(p,false);await highlighted(peer,false);
  await peer.close();
  const failed=await task(p,'已读保存失败可重试',-100);
  await highlighted(p,true);await p.evaluate(()=>window.__denyReminder=true);await bell(p).click();await p.locator('.focus-task-reminders').waitFor();await highlighted(p,true);
  await p.evaluate(()=>{window.__denyReminder=false;window.dispatchEvent(new Event('focus'))});await highlighted(p,false);
  await change(p,failed.id,{state:-1});await p.waitForFunction(()=>!document.querySelector('.focus-reminder-summary'));
  const english=await browser.newContext({locale:'en',viewport:{width:960,height:720}});
  await english.addInitScript(()=>{localStorage.setItem('FocusTodo.language','en');localStorage.setItem('DarkMode','true')});
  await english.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());
  const ep=await english.newPage();await ready(ep);await task(ep,'An English task reminder',-100);
  await ep.getByRole('button',{name:'Notifications',exact:true}).click();await ep.locator('.focus-reminder-summary').waitFor();
  assert.match(await ep.locator('.focus-reminder-summary').innerText(),/Task reminders/);
  assert.doesNotMatch(await ep.locator('.focus-notification-panel').innerText(),/[\u3400-\u9fff]/);
  const surface=await ep.locator('.focus-notification-panel').evaluate(el=>({dark:document.body.classList.contains('dark'),background:getComputedStyle(el).backgroundColor}));
  assert(surface.dark&&Number(surface.background.match(/\d+/)[0])<100,surface.background);
  await ep.waitForFunction(()=>{const panel=document.querySelector('#notification-popover');return panel&&getComputedStyle(panel).opacity==='1'});
  await ep.screenshot({path:path.join(evidence,'task-reminders-en-dark.png')});await english.close();
  await context.close();assert.deepEqual(errors,[]);console.log('PASS due-time notification, visible first reminders, durable reads, new occurrences, UI completion, cross-tab read/completion, failed read retry and independent release badge');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
