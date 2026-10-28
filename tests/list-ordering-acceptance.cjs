/* Real list drag interactions on an isolated origin and fresh browser profiles. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const evidence = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || path.join(root, 'docs/acceptance'));
const release=require('../release.json');
// Bound launch, input and cleanup so a failed check cannot hold a CI worker.
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
      Element.prototype.animate=function(){if(this.hasAttribute('data-project-id'))window.__listAnimations.push({id:this.dataset.projectId,active:this.hasAttribute('data-reorder-active'),z:getComputedStyle(this).zIndex});return animate.apply(this,arguments)};
      window.__nativeDrags=0;window.addEventListener('dragstart',()=>window.__nativeDrags++);
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
    await scenario('system pointer dragging, invalid areas and active animation layer','zh-CN','no-preference',async page=>{
      const preset=group(page,'presetProjects'),custom=group(page,'customProjects'),manager=page.locator('.focus-project-management');
      assert.equal(await page.locator('.focus-project-handle').count(),await preset.count());
      assert.equal(await custom.locator('.focus-project-handle').count(),0);
      assert.equal(await custom.first().getAttribute('draggable'),'false');
      assert.equal(await preset.first().locator('.focus-project-handle span').count(),3);
      assert.match(await page.locator('.focus-project-hint').innerText(),/三条杠/);
      const first=await preset.first().getAttribute('data-project-id'),second=await preset.nth(1).getAttribute('data-project-id');
      await beginDrag(page,preset.first().locator('.focus-project-handle'),preset.nth(1));
      assert.equal(await manager.getAttribute('data-drag-group'),'presetProjects');
      await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-project-group="customProjects"]')).opacity)<.5);
      assert.equal(await preset.nth(1).getAttribute('data-drop-position'),'after');
      fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'list-drag-'+release.localVersion+'.png')});
      await page.mouse.up();await page.waitForFunction(id=>document.querySelector('[data-project-group="presetProjects"]').dataset.projectId===id,second);
      assert.equal(await manager.getAttribute('data-drag-group'),null);assert.equal(await page.locator('[data-drop-position]').count(),0);
      assert((await page.evaluate(()=>window.__listAnimations.length))>0);
      const active=await page.evaluate(()=>window.__listAnimations.find(item=>item.active));
      assert.equal(active.id,first);assert.equal(active.z,'10');
      await beginDrag(page,preset.first().locator('.focus-project-handle'),custom.first());
      assert.equal(await page.evaluate(()=>window.__nativeDrags),0);
      assert.equal(await page.locator('[data-drop-position]').count(),0);
      await page.mouse.up();assert.equal(await custom.first().getAttribute('data-project-id'),'drag-list-0');
      await page.reload();await page.evaluate(()=>window.FocusLocalReady);await page.mouse.click(1255,25);await page.getByText('清单管理',{exact:true}).click();
      assert.equal(await preset.first().getAttribute('data-project-id'),second);assert.equal(await preset.nth(1).getAttribute('data-project-id'),first);
      await beginDrag(page,preset.first().locator('.focus-project-handle'),preset.nth(1));await page.keyboard.press('Escape');await page.mouse.up();
      assert.equal(await manager.getAttribute('data-drag-group'),null);assert.equal(await page.locator('[data-drop-position]').count(),0);
    });
    await scenario('keyboard handle ordering and reduced motion','en-US','reduce',async page=>{
      const preset=group(page,'presetProjects'),custom=group(page,'customProjects'),manager=page.locator('.focus-project-management');
      assert.match(await page.locator('.focus-project-hint').innerText(),/system lists/);
      const first=await preset.first().getAttribute('data-project-id'), second=await preset.nth(1).getAttribute('data-project-id');
      const handle=preset.first().locator('.focus-project-handle');await handle.focus();await page.keyboard.press('ArrowDown');
      await page.waitForFunction(id=>document.querySelector('[data-project-group="presetProjects"]').dataset.projectId===id,second);
      assert.equal(await page.locator(':focus').evaluate(element=>element.closest('[data-project-id]').dataset.projectId),first);
      assert.equal(await page.evaluate(()=>window.__listAnimations.length),0);
      assert.equal(await preset.first().evaluate(element=>getComputedStyle(element).transitionDuration),'0s');
    });
    await scenario('default reset repairs system order and preserves hidden flags and custom folder data','en-US','reduce',async page=>{
      const custom=group(page,'customProjects'),manager=page.locator('.focus-project-management');
      const visibleIds=await group(page,'presetProjects').evaluateAll(items=>items.map(item=>item.dataset.projectId));
      const before=await page.evaluate(async()=>{
        const db=await FocusLocalData.open();
        return FocusLocalData.transaction(db,['Project'],'readwrite',(tx,done)=>{
          const store=tx.objectStore('Project'),request=store.getAll();request.onsuccess=()=>{
            const rows=request.result;rows.forEach(item=>{
              if(item.id==='drag-list-0')item.parentId='folder-check';
              if(item.id.startsWith('id-'))item.order=42;
              store.put(item);
            });done(rows);
          };
        });
      });
      await page.getByRole('button',{name:'Restore default system list order',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('.focus-project-management').hasAttribute('aria-busy'));
      const after=await page.evaluate(async()=>{const db=await FocusLocalData.open();return FocusLocalData.transaction(db,['Project'],'readonly',(tx,done)=>{const q=tx.objectStore('Project').getAll();q.onsuccess=()=>done(q.result)})});
      const defaults=await page.evaluate(()=>FocusLocalData.defaultProjects().map(item=>({id:item.id,order:item.order})));
      for(const old of before){const item=after.find(item=>item.id===old.id),original=defaults.find(item=>item.id===old.id);assert.deepEqual(item,original?{...old,order:original.order}:old)}
      assert.equal(await custom.locator('.focus-project-handle').count(),0);
      const expected=defaults.filter(item=>visibleIds.includes(item.id)).sort((a,b)=>a.order-b.order).map(item=>item.id);
      assert.deepEqual(await group(page,'presetProjects').evaluateAll(items=>items.map(item=>item.dataset.projectId)),expected);
    });
    console.log('List ordering acceptance: '+passed+' scenarios passed.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));clearTimeout(suiteWatchdog)}
})().catch(error=>{console.error(error);process.exit(1)});
