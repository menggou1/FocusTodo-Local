/* Real list drag interactions on an isolated origin and fresh browser profiles. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const release=require('../release.json');
// Native drag CDP commands have no action timeout. Fail the process (including
// launch/cleanup) instead of leaving a CI worker waiting for the job deadline.
const suiteWatchdog=setTimeout(()=>{console.error('FAIL list acceptance exceeded 180 seconds');process.exit(1)},180000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
const server=http.createServer((request,response)=>{
  const name=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':decodeURIComponent(name)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){response.writeHead(404);response.end();return}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  let passed=0;
  async function scenario(name,locale,reducedMotion,body){
    const context=await browser.newContext({locale,viewport:{width:1280,height:900},reducedMotion});
    await context.route('**/*',route=>/^https?:/.test(route.request().url())&&!route.request().url().startsWith(url)?route.abort():route.continue());
    await context.addInitScript(()=>{
      window.__listAnimations=[];const animate=Element.prototype.animate;
      Element.prototype.animate=function(){if(this.hasAttribute('data-project-id'))window.__listAnimations.push(this.dataset.projectId);return animate.apply(this,arguments)};
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const watchdog=setTimeout(()=>{console.error('FAIL list scenario exceeded 90 seconds: '+name);process.exit(1)},90000);
    try{
      await page.goto(url);await page.evaluate(()=>window.FocusLocalReady);
      await page.waitForFunction(()=>document.querySelector('#root').children.length);
      await page.evaluate(async()=>{
        const db=await FocusLocalData.open();await FocusLocalData.transaction(db,['Project'],'readwrite',tx=>{
          for(let i=0;i<3;i++)tx.objectStore('Project').put({id:'drag-list-'+i,objType:1,creationDate:Date.now(),state:0,name:'Drag list '+i,order:10000+i*10000,color:'AEBDC3',isDefault:false,parentId:'',orderingRule:0,type:1000,imageName:'',expanded:true,sync:0});
        });
      });
      await page.reload();await page.evaluate(()=>window.FocusLocalReady);await page.waitForFunction(()=>document.querySelector('#root').children.length);
      await page.mouse.click(1255,25);await page.getByText(locale==='en-US'?'Projects':'清单管理',{exact:true}).click();
      await page.locator('[data-project-group="customProjects"]').first().waitFor();
      await body(page);assert.deepEqual(errors,[]);passed++;console.log('PASS '+name);
    }finally{await context.close();clearTimeout(watchdog)}
  }
  const group=(page,type)=>page.locator('[data-project-group="'+type+'"]');
  async function beginDrag(page,source,target){
    await source.scrollIntoViewIfNeeded();const from=await source.boundingBox(),to=await target.boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
    await page.mouse.move(from.x+from.width/2+6,from.y+from.height/2+6,{steps:4});
    await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});
  }
  try{
    await scenario('visible handles, invalid-group feedback, insertion indicator and persisted handle drag','zh-CN','no-preference',async page=>{
      const preset=group(page,'presetProjects'),custom=group(page,'customProjects'),manager=page.locator('.focus-project-management');
      assert.equal(await page.locator('.focus-project-handle').count(),await preset.count()+await custom.count());
      assert.equal(await preset.first().locator('.focus-project-handle span').count(),3);
      assert.match(await page.locator('.focus-project-hint').innerText(),/三条杠/);
      const first=await preset.first().getAttribute('data-project-id'),second=await preset.nth(1).getAttribute('data-project-id');
      await beginDrag(page,preset.first().locator('.focus-project-handle'),preset.nth(1));
      assert.equal(await manager.getAttribute('data-drag-group'),'presetProjects');
      await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-project-group="customProjects"]')).opacity)<.5);
      assert.equal(await preset.nth(1).getAttribute('data-drop-position'),'after');
      fs.mkdirSync(path.join(root,'docs/acceptance'),{recursive:true});await page.screenshot({path:path.join(root,'docs/acceptance/list-drag-'+release.localVersion+'.png')});
      await page.mouse.up();await page.waitForFunction(id=>document.querySelector('[data-project-group="presetProjects"]').dataset.projectId===id,second);
      assert.equal(await manager.getAttribute('data-drag-group'),null);assert.equal(await page.locator('[data-drop-position]').count(),0);
      assert((await page.evaluate(()=>window.__listAnimations.length))>0);
      await beginDrag(page,custom.first().locator('.focus-project-handle'),preset.first());
      assert.equal(await manager.getAttribute('data-drag-group'),'customProjects');
      await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-project-group="presetProjects"]')).opacity)<.5);
      await page.mouse.up();assert.equal(await custom.first().getAttribute('data-project-id'),'drag-list-0');
      await page.reload();await page.evaluate(()=>window.FocusLocalReady);await page.mouse.click(1255,25);await page.getByText('清单管理',{exact:true}).click();
      assert.equal(await preset.first().getAttribute('data-project-id'),second);assert.equal(await preset.nth(1).getAttribute('data-project-id'),first);
      await beginDrag(page,preset.first().locator('.focus-project-handle'),preset.nth(1));await page.keyboard.press('Escape');await page.mouse.up();
      assert.equal(await manager.getAttribute('data-drag-group'),null);assert.equal(await page.locator('[data-drop-position]').count(),0);
    });
    await scenario('keyboard handle ordering and reduced motion','en-US','reduce',async page=>{
      const preset=group(page,'presetProjects'),custom=group(page,'customProjects'),manager=page.locator('.focus-project-management');
      assert.match(await page.locator('.focus-project-hint').innerText(),/three-line handle/);
      const handle=custom.first().locator('.focus-project-handle');await handle.focus();await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>document.querySelector('[data-project-group="customProjects"]').dataset.projectId==='drag-list-1');
      assert.equal(await page.locator(':focus').evaluate(element=>element.closest('[data-project-id]').dataset.projectId),'drag-list-0');
      assert.equal(await page.evaluate(()=>window.__listAnimations.length),0);
      assert.equal(await preset.first().evaluate(element=>getComputedStyle(element).transitionDuration),'0s');
    });
    // Isolate a rejected native control gesture from later keyboard/native drag
    // protocols; Playwright's Chromium interception can otherwise wait forever.
    await scenario('protected action controls do not initiate ordering','en-US','reduce',async page=>{
      const custom=group(page,'customProjects'),manager=page.locator('.focus-project-management');
      await beginDrag(page,custom.first().locator('[class*="CustomProjectItem-hide"]'),custom.nth(1));await page.mouse.up();
      assert.equal(await manager.getAttribute('data-drag-group'),null);assert.equal(await custom.first().getAttribute('data-project-id'),'drag-list-0');
    });
    console.log('List ordering acceptance: '+passed+' scenarios passed.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));clearTimeout(suiteWatchdog)}
})().catch(error=>{console.error(error);process.exit(1)});
