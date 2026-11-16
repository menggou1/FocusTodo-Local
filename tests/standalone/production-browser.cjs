/* Same-origin upgrade using a synthetic 1.9.x database. Never connects to port 5500. */
const http=require('node:http');
const {createServer}=require('../../scripts/server.cjs');
const {createAppServer}=require('../../scripts/app-server.cjs');
const {assert,fs,path,evidence,launch,contextFor,assertNoLegacyRuntime}=require('./helpers.cjs');
const {gunzipSync}=require('node:zlib');
const release=require('../../release.json');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 const old=createServer(),app=createAppServer({basePath:'/FocusTodo-Local/'});
 let upgraded=false;
 const server=http.createServer((req,res)=>(upgraded?app:old).emit('request',req,res));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await launch('chromium');
 try{
  const h=await contextFor(browser,origin,{locale:'en'}),p=h.page;
  await h.context.addInitScript(()=>{if(!localStorage.getItem('FocusTodo.language'))localStorage.setItem('FocusTodo.language','en')});
  await p.clock.setFixedTime(new Date('2026-11-16T12:00:00+08:00'));await p.goto(origin);
  await p.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));
  await p.locator('[class*=TaskNewItem] input').first().fill('Production upgrade sample');await p.locator('[class*=TaskNewItem] input').first().press('Enter');
  await p.locator('[class*=TaskItem-name-]').filter({hasText:'Production upgrade sample'}).waitFor();
  const before=await p.evaluate(async()=>{localStorage.setItem('WorkInterval','1800');localStorage.setItem('FocusTodo.releaseRead','7.1.1-local.1.9.3');return FocusLocalData.snapshot()});
  upgraded=true;h.requests.length=0;await p.goto(origin+'/FocusTodo-Local/');await p.getByTestId('app-shell').waitFor();
  await assertNoLegacyRuntime(p,h.requests);
  const rows=()=>p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,q=db.transaction('Task').objectStore('Task').getAll();q.onsuccess=()=>{db.close();resolve(q.result)}};r.onerror=()=>reject(r.error)}));
  assert.deepEqual((await rows()).map(x=>[x.id,x.name]),before.indexedDB.Task.map(x=>[x.id,x.name]));
  assert.equal(await p.evaluate(()=>localStorage.getItem('WorkInterval')),'1800');
  assert.equal(await p.evaluate(()=>localStorage.getItem('FocusTodo.releaseRead')),'7.1.1-local.1.9.3');
  assert.equal(await p.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('FocusTodoStandalone.'))),false);
  assert.equal(await p.evaluate(async()=>(await indexedDB.databases()).some(db=>db.name.startsWith('FocusTodoStandalone.'))),false);
  await p.locator('.workspace-add-task input').fill('New React task');await p.locator('.workspace-add-task input').press('Enter');await p.getByText('New React task',{exact:true}).waitFor();assert.equal((await rows()).length,before.indexedDB.Task.length+1);
  await p.locator('[data-view=settings]').click();await p.getByRole('button',{name:'About',exact:true}).click();
  assert((await p.getByTestId('settings-page').innerText()).includes('2.0.0'));assert((await p.getByTestId('settings-page').innerText()).includes(release.date));
  await p.getByRole('button',{name:'Profile',exact:true}).click();await p.getByRole('button',{name:'Export data',exact:true}).click();await p.locator('.legacy-backup-analysis').waitFor();
  const download=p.waitForEvent('download',{timeout:30000});download.catch(()=>{});await p.getByRole('button',{name:'Create and download',exact:true}).click();const saved=await download,file=await saved.path();let bytes=fs.readFileSync(file);if(saved.suggestedFilename().endsWith('.gz'))bytes=gunzipSync(bytes);const backup=JSON.parse(bytes.toString('utf8'));
  assert(backup.indexedDB.Task.some(row=>row.id===before.indexedDB.Task[0].id));assert.equal(backup.localStorage.WorkInterval,'1800');assert.equal(backup.meta.exportVersion,2);
  await p.screenshot({path:path.join(evidence,'production-upgrade-backup.png')});
  for(const forbidden of ['js/main.js','patch.js','scripts/start.cjs','standalone/app/main.tsx','__prototype/session.json'])assert.equal((await p.request.get(origin+'/FocusTodo-Local/'+forbidden)).status(),404,forbidden);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
  fs.writeFileSync(path.join(evidence,'production-upgrade.json'),JSON.stringify({passed:true,version:release.localVersion,date:release.date,checks:['same-origin legacy IDs and settings','no namespace copy/reset','new React writes','about metadata','real backup download','relative project base','runtime allowlist','no legacy scripts/globals']},null,2));
  console.log('PASS production React upgrade, project-base resources, metadata and downloaded backup');
 }catch(error){for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:path.join(evidence,'production-failure.png')}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-3000))}throw error}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
