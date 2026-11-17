/* D-V-Forest: actual 1.9.3 oracle, isolated generated data, fixed 5513/5511.
   No persistent browser profile and no stable-app connection. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,copyFixture,assert,fs,path}=require('./ui-restore-helpers.cjs');
const {execFileSync}=require('node:child_process');
const oracleCommit=execFileSync('git',['rev-parse','1.9.3^{}'],{encoding:'utf8'}).trim();
const out=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance/d-v-forest');
fs.mkdirSync(out,{recursive:true});
const sel={old:{open:'[class*=HomeHeader-forest]',root:'[class*=Forest-container]',scene:'[class*=ForestSection-forestSection]',sun:'[id^=sun-]',actions:'.focus-ui-forest-action',tree:'[class*=ForestSection-tree]',drawer:'[class*=DrawerView-drawer]',close:'[class*=DrawerView-closeBtn]',activity:'[class*=ActivitySection-activityContent] [class*=ScrollView-root]',help:'[class*=Guide-guideContent] [class*=ScrollView-root]',achievements:'[class*=RankingList-userList]'},new:{open:'[data-view=forest]',root:'.domain-overlay:has(.legacy-forest)',scene:'.domain-forest-scene',sun:'.legacy-forest-sun',actions:'.legacy-forest-actions button',tree:'.domain-tree',drawer:'.legacy-forest-drawer',close:'.legacy-forest-drawer-close',activity:'.legacy-forest-activity:not([data-drawer]) [data-forest-scroll]',help:'[data-drawer=help] [data-forest-scroll]',achievements:'[data-drawer=achievements] .legacy-forest-activity-list'}};
async function fixture(pair,count=20){
 await pair.old.locator('input').last().fill('Forest fixture');await pair.old.locator('input').last().press('Enter');await pair.old.waitForFunction(async()=>!!(await FocusLocalData.snapshot()).indexedDB.Task.length);
 await pair.old.evaluate(async count=>{
  const base=(await FocusLocalData.snapshot()).indexedDB.Task[0],d=FocusLocalData,date=Date.now()-25*3600000,db=await d.open();
  await d.transaction(db,['Task','Pomodoro'],'readwrite',(tx,done)=>{
   tx.objectStore('Task').clear();
   for(let i=0;i<count;i++)tx.objectStore('Task').put({...base,id:'forest-parity-'+i,name:'Forest generated '+i,finishedDate:date-i*1000,isFinished:true,state:0,projectId:'id-task-tasks',sync:0});
   for(let i=0;i<5;i++)tx.objectStore('Task').put({...base,id:'forest-open-'+i,name:'Forest workspace '+i,deadline:Date.now()+3600000,isFinished:false,state:0,projectId:'id-task-tasks',sync:0});
   tx.objectStore('Pomodoro').put({id:'forest-hour',endDate:date-2000,interval:3600,pomodoroInterval:1500,isManual:true,taskId:'',subtaskId:'',state:0,sync:0});done();
  });
  await d.forestSet('LaunchReward',JSON.stringify([{date,count:3,isGotDailyLoginReward:false,isGotContinueLoginReward:false},{date:Date.now()-1000,count:4,isGotDailyLoginReward:false,isGotContinueLoginReward:false}]));
  await d.syncAchievements();
 },count);
 // Refresh legacy Redux/manager caches as well as IndexedDB before copying.
 // Otherwise the forest data matches but its underlying workspace is stale.
 await pair.old.reload();await pair.old.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await pair.old.evaluate(()=>document.fonts.ready);
 await copyFixture(pair);
}
async function open(page,key){await page.evaluate(()=>{let seed=1973;Math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646}});await page.locator(sel[key].open).click();await page.locator(sel[key].sun).first().waitFor();await page.waitForTimeout(500)}
async function instrument(page){
 await page.addInitScript(()=>{window.__forestCommits=[];window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(r){this.renderers.set(1,r);return 1},onCommitFiberRoot(id,root){let forest=0;function visit(f){if(!f)return;const n=f.type?.name||f.type?.displayName||'';if(n==='Forest')forest++;visit(f.child);visit(f.sibling)}visit(root.current);window.__forestCommits.push({time:performance.now(),forest});performance.mark('forest-react-commit')},onCommitFiberUnmount(){},onPostCommitFiberRoot(){}}});
}
async function trace(page,key,label,bulk=true){
 const cdp=await page.context().newCDPSession(page),events=[];cdp.on('Tracing.dataCollected',e=>events.push(...e.value));await cdp.send('Performance.enable');await cdp.send('Profiler.enable');
 await page.evaluate(()=>{window.__forestCommits=[];window.__gaps=[];window.__mutations=[];window.__recording=true;let last=performance.now();function frame(now){window.__gaps.push(now-last);last=now;if(window.__recording)requestAnimationFrame(frame)}requestAnimationFrame(frame);window.__observer=new MutationObserver(records=>window.__mutations.push({time:performance.now(),count:records.length}));window.__observer.observe(document.getElementById('prototype-root')||document.body,{childList:true,subtree:true,attributes:true,characterData:true})});
 const before=await cdp.send('Performance.getMetrics');await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,cc,disabled-by-default-devtools.timeline',transferMode:'ReportEvents'});await cdp.send('Profiler.start');
 await page.locator(bulk?sel[key].actions+':last-child':key==='old'?'[id^=sun-]':'.legacy-forest-sun[data-mature=true]').first().click();await page.waitForTimeout(1950);
 const profile=(await cdp.send('Profiler.stop')).profile,after=await cdp.send('Performance.getMetrics');const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await done;
 const frames=await page.evaluate(()=>{window.__recording=false;window.__observer.disconnect();return{gaps:window.__gaps,commits:window.__forestCommits,mutations:window.__mutations}}),timings={};
 for(const e of events)if(e.ph==='X'&&['Layout','Paint','PrePaint','Layerize','CompositeLayers','Commit','UpdateLayoutTree','FireAnimationFrame','TimerFire','FunctionCall'].includes(e.name)){const t=timings[e.name]??={count:0,ms:0};t.count++;t.ms+=(e.dur||0)/1000}
 const metrics=p=>Object.fromEntries(p.metrics.map(x=>[x.name,x.value])),a=metrics(before),b=metrics(after),gaps=[...frames.gaps].sort((x,y)=>x-y);
 const counts=new Map(),nodes=new Map(profile.nodes.map(n=>[n.id,n]));for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
 const cpu=[...counts].map(([id,samples])=>({samples,...nodes.get(id).callFrame})).filter(n=>!n.url.startsWith('chrome-extension:')).sort((a,b)=>b.samples-a.samples).slice(0,20);
 const result={key,label,frames:gaps.length,p95Ms:gaps[Math.floor(gaps.length*.95)],maxMs:Math.max(...gaps),over34:gaps.filter(x=>x>34).length,scriptMs:(b.ScriptDuration-a.ScriptDuration)*1000,layoutMs:(b.LayoutDuration-a.LayoutDuration)*1000,taskMs:(b.TaskDuration-a.TaskDuration)*1000,reactCommits:frames.commits.length,mutationBatches:frames.mutations.length,timings,cpu};
 fs.writeFileSync(path.join(out,`${label}-${key}-trace.json.gz`),require('node:zlib').gzipSync(JSON.stringify({traceEvents:events})));fs.writeFileSync(path.join(out,`${label}-${key}-cpu.cpuprofile`),JSON.stringify(profile));fs.writeFileSync(path.join(out,`${label}-${key}-performance.json`),JSON.stringify({result,frames},null,2));await cdp.detach();return result;
}
async function performanceRun(label){const pair=await paired({locale:'en',reducedMotion:'no-preference'});try{await fixture(pair);for(const key of ['old','new']){await instrument(pair[key]);await pair[key].reload();await (key==='old'?pair[key].waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting')):pair[key].getByTestId('app-shell').waitFor());await open(pair[key],key)}const results=[];for(const key of ['old','new']){const r=await trace(pair[key],key,label);results.push(r);console.log(JSON.stringify(r))}fs.writeFileSync(path.join(out,label+'-performance.json'),JSON.stringify(results,null,2));}finally{await pair.close()}}
module.exports={paired,fixture,open,sel,out,trace,instrument,performanceRun,oracleCommit};
if(require.main===module)performanceRun(process.argv[2]||'baseline').catch(e=>{console.error(e);process.exitCode=1});
