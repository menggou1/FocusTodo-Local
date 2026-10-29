/* Exercise the original forest UI with isolated local data and no external network. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),{createServer}=require('../scripts/server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});const context=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1280,height:900}}),errors=[],external=[];
 await context.addInitScript(()=>{localStorage.setItem('Sunlight','100');localStorage.setItem('LaunchReward',JSON.stringify([{date:Date.now()-25*3600000,count:1,isGotDailyLoginReward:false,isGotContinueLoginReward:false}]));const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='FocusTodo.forestState'&&(window.__denyForest||window.__denyForestOnce)){window.__denyForestOnce=false;throw new Error('Injected forest storage failure')};return set.apply(this,arguments)};});
 await context.route('**/*',r=>{if(/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)){external.push(r.request().url());return r.abort()}return r.continue()});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function ready(p){await p.goto(base);await p.waitForFunction(()=>window.FocusLocalData&&document.querySelector('#root')?.innerText&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady)}
 try {
  await ready(page);
  const old=Date.now()-25*3600000;
  await page.evaluate(endDate=>FocusLocalData.putPomodoro({id:'forest-pomodoro',objType:'POMODORO',endDate,interval:1500,pomodoroInterval:1500,isManual:false,taskId:'',subtaskId:'',state:0,sync:0}),old);
  await page.evaluate(async date=>{const d=FocusLocalData,db=await d.open();await d.transaction(db,['Task'],'readwrite',(tx,done)=>{tx.objectStore('Task').put({id:'forest-task',name:'森林测试任务',finishedDate:date,isFinished:true,state:0,projectId:'',sync:0});done()})},old);
  await page.mouse.click(1255,25);await page.getByText('通用',{exact:true}).click();
  const row=page.locator('[class*=GeneralSettings-root] tr').filter({hasText:'专注森林'}),toggle=row.getByRole('checkbox');await row.waitFor();assert.equal(await toggle.getAttribute('aria-checked'),'true');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'false');await page.locator('[class^=Settings-close-]').click();await page.locator('[class^=Settings-root-]').waitFor({state:'detached'});assert.equal(await page.locator('[class*=HomeHeader-forest]').count(),0);
  await ready(page);assert.equal(await page.locator('[class*=HomeHeader-forest]').count(),0);
  await page.mouse.click(1255,25);await page.getByText('通用',{exact:true}).click();await toggle.click();await page.locator('[class^=Settings-close-]').click();
  await page.locator('[class*=HomeHeader-forest]').click();const forest=page.locator('[class*=Forest-container]');await forest.waitFor();
  await page.waitForFunction(()=>document.querySelector('[class*=ForestSection-expBarText]')?.textContent.includes('120g'));
  await forest.getByText('5g',{exact:true}).waitFor();
  const positions=await forest.locator('[id^=sun-]').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.includes('25g')).map(n=>({id:n.id,left:n.style.left,top:n.style.top})));
  await forest.getByText('25g',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[class*=ForestSection-expBarText]')?.textContent.includes('145g'));
  await page.waitForTimeout(1200);
  const afterPositions=await forest.locator('[id^=sun-]').evaluateAll(nodes=>nodes.map(n=>({id:n.id,left:n.style.left,top:n.style.top})));
  for(const before of positions) assert.deepEqual(afterPositions.find(x=>x.id===before.id),before);
  await page.evaluate(()=>window.__denyForestOnce=true);await forest.getByText('5g',{exact:true}).click();
  await page.waitForFunction(()=>{const n=[...document.querySelectorAll('[id^=sun-]')].find(n=>n.textContent.includes('5g'));return n&&n.style.opacity==='1'});
  await forest.getByText('5g',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[class*=ForestSection-expBarText]')?.textContent.includes('150g'));
  assert.equal(await page.evaluate(()=>FocusLocalData.forestGet('Sunlight')),150);
  const duplicate=await page.evaluate(date=>FocusLocalData.collectForest({itemType:0,id:'forest-pomodoro',date,powerValue:25}),old);assert.equal(duplicate.collected,false);assert.equal(await page.evaluate(()=>FocusLocalData.forestGet('Sunlight')),150);
  const guide=forest.locator('img[src*=forest-help]');await guide.click();await page.getByText('专注森林攻略',{exact:true}).waitFor();
  const guideText=await page.locator('[class*=Guide-guideSection]').innerText();for(const term of ['329900g','没有每日上限','100 颗','48 小时','手动新增','暂停时间'])assert(guideText.includes(term),term);
  await page.waitForTimeout(500);const lastGuide=page.locator('[class*=Guide-guideSection]').getByText(/森林最多同时显示 100 颗/);await lastGuide.scrollIntoViewIfNeeded();assert(await lastGuide.isVisible());fs.mkdirSync('dist',{recursive:true});await page.screenshot({path:path.resolve('dist/forest-guide.png')});
  await page.keyboard.press('Escape').catch(()=>{});
  const snapshot=await page.evaluate(()=>FocusLocalData.snapshot());assert(snapshot.localStorage['FocusTodo.forestState']);
  await page.evaluate(async snapshot=>{await FocusLocalData.replace(snapshot,{backup:false});await FocusLocalData.replace(snapshot,{backup:false})},snapshot);
  assert.equal(await page.evaluate(()=>FocusLocalData.forestGet('Sunlight')),150);
  await page.evaluate(()=>{window.__denyForest=true});
  const failed=await page.evaluate(async date=>{try{await FocusLocalData.collectForest({itemType:1,id:'failure-task',date,powerValue:5});return false}catch(e){return true}},old);assert.equal(failed,true);await page.evaluate(()=>{window.__denyForest=false});assert.equal(await page.evaluate(()=>FocusLocalData.forestGet('Sunlight')),150);assert(!JSON.parse(await page.evaluate(()=>FocusLocalData.forestGet('TaskReward'))).some(x=>x.id==='failure-task'));
  const loginDate=await page.evaluate(()=>JSON.parse(FocusLocalData.forestGet('LaunchReward')).find(row=>Date.now()-row.date>86400000).date);
  const login=await page.evaluate(date=>FocusLocalData.collectForest({itemType:2,id:'',date,powerValue:30}),loginDate);assert(login.collected);
  const repeatLogin=await page.evaluate(date=>FocusLocalData.collectForest({itemType:2,id:'',date,powerValue:30}),loginDate);assert.equal(repeatLogin.collected,false);
  const peer=await context.newPage();peer.on('pageerror',e=>errors.push(e.message));await ready(peer);
  const claim=date=>({itemType:1,id:'shared-task',date,powerValue:5});
  const pair=await Promise.all([page.evaluate(item=>FocusLocalData.collectForest(item),claim(old)),peer.evaluate(item=>FocusLocalData.collectForest(item),claim(old))]);
  assert.equal(pair.filter(x=>x.collected).length,1);assert.equal(await page.evaluate(()=>FocusLocalData.forestGet('Sunlight')),185);await peer.close();
  const tooEarly=await page.evaluate(async()=>{try{await FocusLocalData.collectForest({itemType:1,id:'early',date:Date.now()-3600000,powerValue:5});return false}catch(e){return true}});assert(tooEarly);
  const expired=await page.evaluate(async()=>{try{await FocusLocalData.collectForest({itemType:1,id:'expired',date:Date.now()-49*3600000,powerValue:5});return false}catch(e){return true}});assert(expired);
  const remaining=await page.evaluate(async date=>{const d=FocusLocalData;let a=await d.collectForest({itemType:1,id:'cap-a',date,powerValue:790});let b=await d.collectForest({itemType:1,id:'cap-b',date,powerValue:10});return [a,b,d.forestGet('Sunlight')]},old);
  assert.equal(remaining[0].collected,true);assert.equal(remaining[1].collected,true);assert.equal(remaining[2],985);
  const rapid=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai'});await rapid.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());
  const rp=await rapid.newPage(),rapidErrors=[];rp.on('pageerror',e=>rapidErrors.push(e.message));await ready(rp);
  await rp.evaluate(async()=>{const d=FocusLocalData,db=await d.open(),date=Date.now()-25*3600000;await d.putPomodoro({id:'rapid-pomo',endDate:date,interval:1500,pomodoroInterval:1500,isManual:false,taskId:'',subtaskId:'',state:0});await d.transaction(db,['Task'],'readwrite',(tx,done)=>{tx.objectStore('Task').put({id:'rapid-task',name:'test',finishedDate:date,isFinished:true,state:0});done()})});
  await rp.locator('[class*=HomeHeader-forest]').click();await rp.locator('[class*=Forest-container]').getByText('25g',{exact:true}).waitFor();await rp.locator('[class*=Forest-container]').getByText('5g',{exact:true}).waitFor();
  await rp.evaluate(()=>{for(const value of ['25g','5g']){const n=[...document.querySelectorAll('[id^=sun-]')].find(x=>x.textContent.includes(value));n.querySelector('img').click()}});
  await rp.waitForFunction(()=>FocusLocalData.forestGet('Sunlight')===50);await rp.waitForTimeout(1600);
  assert.equal(await rp.locator('[id^=sun-]').filter({hasText:/25g|5g/}).count(),0);assert.deepEqual(rapidErrors,[]);await rapid.close();
  const badge=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai'});await badge.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());
  const bpBadge=await badge.newPage();await ready(bpBadge);await bpBadge.evaluate(async()=>{let d=FocusLocalData,now=Date.now()-25*3600000;for(const [id,interval] of [['short-a',10],['short-b',90]])await d.putPomodoro({id,endDate:now,interval,pomodoroInterval:1500,isManual:false,taskId:'',subtaskId:'',state:0})});
  await bpBadge.locator('[class*=HomeHeader-forest]').click();await bpBadge.locator('[class*=Forest-container]').getByText('1g',{exact:true}).first().waitFor();assert.equal(await bpBadge.locator('[class*=Forest-container]').getByText('1g',{exact:true}).count(),2);
  await bpBadge.locator('[class*=Forest-closeBtn]').click();await bpBadge.waitForFunction(()=>document.querySelector('[class*=HomeHeader-badge]')?.textContent==='2');await badge.close();
  const enContext=await browser.newContext({locale:'en',viewport:{width:1280,height:900}});
  await enContext.addInitScript(()=>localStorage.setItem('FocusTodo.language','en'));
  await enContext.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());
  const en=await enContext.newPage();await ready(en);await en.locator('[class*=HomeHeader-forest]').click();
  await en.locator('[class*=Forest-container]').waitFor();assert.match(await en.locator('[class*=Forest-container]').innerText(),/Forest/);assert.doesNotMatch(await en.locator('[class*=Forest-container]').innerText(),/[\u3400-\u9fff]/);await en.locator('[class*=Forest-container] img[src*=forest-help]').click();await en.locator('[class*=Guide-guideSection]').waitFor();const guideEn=await en.locator('[class*=Guide-guideSection]').innerText();for(const term of ['329900g','no daily collection limit','100 items','48 hours','Manually added'])assert(guideEn.includes(term),term);await enContext.close();
  for(const persisted of [false,true]) {
   const broken=await browser.newContext({locale:'zh-CN'});await broken.addInitScript(persisted=>{localStorage.setItem('Sunlight','undefined');if(persisted)localStorage.setItem('FocusTodo.forestState',JSON.stringify({version:1,fields:{Sunlight:'undefined',LaunchReward:'[]',DailyTaskReward:'[]',PomodoroReward:'[]',TaskReward:'[]'},day:'',awarded:0}))},persisted);
   await broken.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(base)?r.abort():r.continue());const bp=await broken.newPage();const issues=[];bp.on('pageerror',e=>issues.push(e.message));await ready(bp);await bp.locator('[class*=HomeHeader-forest]').click();await bp.locator('[class*=Forest-container]').waitFor();assert.equal(await bp.evaluate(()=>FocusLocalData.forestGet('Sunlight')),0);assert.deepEqual(issues,[]);await broken.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS original forest switch, UI, local reward collection, backup, deduplication, write failure, unlimited collection and offline');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1});