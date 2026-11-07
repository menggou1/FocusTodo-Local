/* Real Firefox/WebKit fallback checks, using isolated generated data only.
   Run after: npx playwright install firefox webkit. WebKit is not Safari. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const playwright=require('playwright'),{createServer}=require('../../scripts/server.cjs');
const evidence=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,results=[];
 try{for(const engine of ['firefox','webkit']){
  const browser=await playwright[engine].launch({headless:true});
  try{for(const locale of ['zh-CN','en']){
   const ctx=await browser.newContext({locale,timezoneId:'Asia/Shanghai',viewport:{width:1024,height:768},reducedMotion:'reduce'}),errors=[];
   await ctx.addInitScript(()=>{
    window.cspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.cspViolations.push({blockedURI:event.blockedURI,effectiveDirective:event.effectiveDirective,sourceFile:event.sourceFile,lineNumber:event.lineNumber}));
    Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
    Object.defineProperty(window,'BroadcastChannel',{configurable:true,value:undefined});window.CompressionStream=undefined;window.DecompressionStream=undefined;
    Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:undefined});
    let api;Object.defineProperty(window,'FocusLocal',{configurable:true,get:()=>api,set(value){api=value;const attach=value.attachTimer;value.attachTimer=(timer,options)=>{window.testTimer=timer;return attach(timer,options);};}});
   });
   await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));
   try{
    await p.goto(base);await p.waitForFunction(()=>{if(document.querySelector('#focus-startup')?.dataset.state==='error')throw Error('Startup failed');return window.testTimer&&!document.documentElement.classList.contains('focus-starting');});await p.evaluate(()=>FocusLocalReady);
    assert.notEqual(await p.evaluate(()=>typeof window.documentPictureInPicture?.requestWindow),'function');
    const taskInput=p.getByPlaceholder(locale==='en'?/Add a task/:/添加一个任务/);await taskInput.fill('Compatibility task');await taskInput.press('Enter');
    await p.waitForFunction(async()=>(await FocusLocalData.snapshot()).indexedDB.Task.length===1);
    await p.evaluate(()=>testTimer.localTimer.run('start'));await p.evaluate(()=>testTimer.localTimer.run('pause'));
    assert.equal(await p.evaluate(()=>testTimer.localTimer.session.state),'pause');await p.evaluate(()=>testTimer.openMiniWindow());await p.locator('[class*="FloatTimer-root"]').waitFor();
    await p.locator('#focus-local-notice').filter({hasText:locale==='en'?'in-page floating timer':'页内浮动计时器'}).waitFor();
    const backup=await p.evaluate(()=>FocusLocalData.snapshot());
    await p.reload();await p.waitForFunction(()=>window.testTimer&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady);
    await p.waitForFunction(()=>window.testTimer.localTimer.session?.state==='pause');
    assert.equal(await p.evaluate(()=>testTimer.localTimer.session.state),'pause');
    await p.evaluate(()=>testTimer.localTimer.run('stop'));
    await p.locator('header img[src="img/header-setting.png"]').click();await p.getByText(locale==='en'?'General':'通用',{exact:true}).click();
    assert.equal(await p.locator('#focus-external-network').isChecked(),false);
    await p.getByText(locale==='en'?'Appearance':'外观',{exact:true}).click();await p.locator('[data-theme-id="__bing_daily__"]').click();
    await p.locator('#focus-local-notice').filter({hasText:locale==='en'?'Please enable external networking':'请打开外部联网'}).waitFor();
    await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const dataUrl=canvas.toDataURL();localStorage.setItem('lexible-custom-themes',JSON.stringify({custom_engine:{name:'Generated',dataUrl,thumbnail:dataUrl,createdAt:1}}));});
    await p.getByText(locale==='en'?'General':'通用',{exact:true}).click();await p.getByText(locale==='en'?'Appearance':'外观',{exact:true}).click();await p.locator('[data-theme-id="custom_engine"]').click();
    await p.waitForFunction(()=>localStorage.getItem('Theme')==='custom_engine');
    await p.evaluate(async backup=>{const before=await FocusLocalData.snapshot();await FocusLocalData.replace(backup,{backup:false});window.imported=before.indexedDB.Task.length;},backup);
    await p.reload();await p.waitForFunction(()=>window.testTimer&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady);
    const after=await p.evaluate(()=>FocusLocalData.snapshot());assert.equal(after.indexedDB.Task.length,backup.indexedDB.Task.length);assert.equal(after.indexedDB.TimerSession[0].state,'pause');assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>cspViolations),[]);
    await p.screenshot({path:path.join(evidence,'capability-'+engine+'-'+locale+'.png')});
    results.push({engine,locale,passed:true});console.log('PASS '+engine+' '+locale+' startup, task, timer, recovery, theme, import and capability fallback');
   }catch(error){const diagnostic=await p.evaluate(()=>({startup:document.querySelector('#focus-startup')?.innerText,state:document.querySelector('#focus-startup')?.dataset.state,root:document.querySelector('#root')?.innerText.slice(0,300),csp:window.cspViolations})).catch(()=>null);results.push({engine,locale,passed:false,error:error.stack,errors,diagnostic});console.error(JSON.stringify({engine,locale,errors,diagnostic}));await p.screenshot({path:path.join(evidence,'capability-failure-'+engine+'-'+locale+'.png')}).catch(()=>{});throw error;}finally{await ctx.close();}
  }}finally{await browser.close();}
 }}finally{fs.writeFileSync(path.join(evidence,'capability-results.json'),JSON.stringify(results,null,2));await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
