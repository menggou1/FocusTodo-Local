/* Isolated local achievements: real UI, committed data and repeat-safe rewards. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),{createServer}=require('../scripts/server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});const context=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1280,height:900}}),errors=[],external=[];
 await context.route('**/*',r=>{if(/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)){external.push(r.request().url());return r.abort()}return r.continue()});
 async function ready(p){p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForFunction(()=>window.FocusAchievements&&document.querySelector('#root')?.innerText&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady)}
 const p=await context.newPage();try{
  await ready(p);const icon=await p.locator('link[rel=icon]').getAttribute('href');assert.equal(new URL(icon,base+'/FocusTodo-Local/index.html').pathname,'/FocusTodo-Local/favicon.ico');assert.equal((await p.request.get(base+'/'+icon)).status(),200);await p.locator('[class*=HomeHeader-forest]').click();const entry=p.locator('[class*=ForestSection-buttonGroup] img[src*=forest-badge]');assert(await entry.evaluate(el=>el.complete&&el.naturalWidth>0&&getComputedStyle(el).borderRadius==='50%'));await entry.click();
  const panel=p.locator('.focus-achievements');await panel.waitFor();await p.locator('[data-achievement="focus-1"]').waitFor();assert.equal(await panel.locator('[data-achievement]').count(),9);
  assert.equal(await panel.locator('[data-achievement="focus-1"] img').getAttribute('src'),'img/rank-bronze.png');assert(await panel.locator('[data-achievement="focus-1"] img').getAttribute('class').then(s=>s.includes('is-locked')));
  await p.evaluate(async()=>{const d=FocusLocalData,db=await d.open(),now=Date.now(),project=d.defaultProjects().find(x=>x.type===7005);const created=await d.createCalendarTask({name:'任务',count:0,interval:1500,startTime:now,projectId:project.id});await d.transaction(db,['Pomodoro','Task'],'readwrite',(tx,done)=>{for(let i=0;i<3;i++)tx.objectStore('Pomodoro').put({id:'a'+i,endDate:now-i*86400000,interval:1200,pomodoroInterval:1500,state:0,taskId:'',subtaskId:'',isManual:false});tx.objectStore('Task').put({...created.task,isFinished:true,finishedDate:now});done()});window.dispatchEvent(new Event('focus-local-achievements-input'))});
  await p.waitForFunction(()=>FocusLocalData.forestGet('Sunlight')===60);await p.waitForFunction(()=>!document.querySelector('[data-achievement="focus-1"] img')?.classList.contains('is-locked'));
  assert(!await panel.locator('[data-achievement="days-3"] img').getAttribute('class').then(s=>s.includes('is-locked')));
  const peer=await context.newPage();await ready(peer);await Promise.all([p.evaluate(()=>FocusLocalData.syncAchievements()),peer.evaluate(()=>FocusLocalData.syncAchievements())]);assert.equal(await p.evaluate(()=>FocusLocalData.forestGet('Sunlight')),60);
  const snapshot=await p.evaluate(()=>FocusLocalData.snapshot());assert.equal(Object.keys(JSON.parse(snapshot.localStorage['FocusTodo.forestState']).achievements).length,3);
  await peer.close();await p.evaluate(async x=>{await FocusLocalData.replace(x,{backup:false});await FocusLocalData.replace(x,{backup:false});await FocusLocalData.syncAchievements()},snapshot);assert.equal(await p.evaluate(()=>FocusLocalData.forestGet('Sunlight')),60);
  await ready(p);await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>FocusLocalData.forestGet('Sunlight')),60);
  await p.locator('[class*=HomeHeader-forest]').click();await p.locator('[class*=ForestSection-buttonGroup] img[src*=forest-badge]').click();await p.locator('[data-achievement="focus-1"]').waitFor();await p.waitForTimeout(500);fs.mkdirSync('dist',{recursive:true});await p.screenshot({path:path.resolve('dist/forest-achievements.png')});
  const live=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1280,height:900}});await live.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());const lp=await live.newPage();await ready(lp);const input=lp.getByPlaceholder(/添加一个任务/);await input.fill('成就实时任务');await input.press('Enter');await lp.locator('[class*=TaskItem-complete-]').first().click();await lp.waitForFunction(()=>FocusLocalData.forestGet('Sunlight')===20);assert(JSON.parse(await lp.evaluate(()=>localStorage.getItem('FocusTodo.forestState'))).achievements['task-1']);await live.close();
  const tiers=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai'});await tiers.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__denyAchievement&&k==='FocusTodo.forestState')throw new Error('Injected achievement write failure');return set.apply(this,arguments)}});await tiers.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());const tp=await tiers.newPage();await ready(tp);
  const tierResult=await tp.evaluate(async()=>{
   const d=FocusLocalData,original=d.syncAchievements.bind(d),successful=[];
   let nextAutomatic;
   d.syncAchievements=async()=>{const result=await original();successful.push(result);if(nextAutomatic){nextAutomatic(result);nextAutomatic=null}return result};
   await d.syncAchievements(); // Drain startup work before inserting the fault fixture.
   window.__denyAchievement=true;
   const db=await d.open(),today=new Date();today.setHours(12,0,0,0);
   await d.transaction(db,['Pomodoro','Task'],'readwrite',(tx,done)=>{
    for(let i=0;i<30;i++){const day=new Date(today);day.setDate(day.getDate()-i);tx.objectStore('Pomodoro').put({id:'tier-'+i,interval:12000,endDate:day.getTime(),state:0})}
    for(let i=0;i<50;i++)tx.objectStore('Task').put({id:'tier-task-'+i,isFinished:true,state:0});done();
   });
   let failed=false;try{await d.syncAchievements()}catch(e){failed=true}
   const before=d.forestGet('Sunlight'),beforeEarned=JSON.parse(localStorage.getItem('FocusTodo.forestState')||'{}').achievements||{};
   // Force the actual automatic scheduler to win before the manual retry.
   // This deterministically reproduces 1.7.1's 0 !== 9 without delaying a DOM check.
   window.__denyAchievement=false;
   const automatic=new Promise(resolve=>nextAutomatic=resolve);FocusAchievements.schedule();await automatic;
   const first=await d.syncAchievements(),second=await d.syncAchievements();
   return {failed,before,beforeEarned,successful,first,second,total:d.forestGet('Sunlight'),earned:JSON.parse(localStorage.getItem('FocusTodo.forestState')).achievements};
  });
  assert(tierResult.failed);assert.equal(tierResult.before,0);assert.deepEqual(tierResult.beforeEarned,{});
  assert.equal(tierResult.first.unlocked.length,0,'Automatic sync has already committed all tiers');
  assert.equal(tierResult.successful.reduce((sum,r)=>sum+r.unlocked.length,0),9);
  assert.equal(tierResult.successful.reduce((sum,r)=>sum+r.reward,0),1860);
  assert.equal(Object.keys(tierResult.earned).length,9);assert.equal(tierResult.second.reward,0);assert.equal(tierResult.total,1860);
  fs.mkdirSync(path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'docs/acceptance'),{recursive:true});
  fs.writeFileSync(path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'docs/acceptance','achievement-retry.json'),JSON.stringify(tierResult,null,2)+'\n');
  await tiers.close();
  const english=await browser.newContext({locale:'en',timezoneId:'Asia/Shanghai',viewport:{width:960,height:720}});await english.addInitScript(()=>{localStorage.setItem('FocusTodo.language','en');localStorage.setItem('DarkMode','true')});await english.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());const ep=await english.newPage();await ready(ep);await ep.locator('[class*=HomeHeader-forest]').click();await ep.locator('[class*=ForestSection-buttonGroup] img[src*=forest-badge]').click();await ep.locator('[data-achievement="days-30"]').waitFor();const et=await ep.locator('.focus-achievements').innerText();assert.match(et,/Achievements/);assert.doesNotMatch(et,/[\u3400-\u9fff]/);await ep.locator('[data-achievement="days-30"]').scrollIntoViewIfNeeded();assert(await ep.locator('[data-achievement="days-30"]').isVisible());await english.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS original drawer, trophies, immediate rewards, concurrent tabs and repeated backup restore');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e.stack);process.exitCode=1});