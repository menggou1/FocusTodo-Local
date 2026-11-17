/* Cold dialog fonts: geometry must wait for the actual face, not a timer. */
const {paired,copyFixture,metrics,assert,fs,path}=require('./ui-restore-helpers.cjs');
const {seed}=require('./ui-fixtures.cjs');
const output=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance/font-readiness');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const pair=await paired({locale:'zh-CN',width:1280,height:800,reducedMotion:'no-preference'}),o=pair.old,n=pair.new;
 let release,requested;const hold=new Promise(resolve=>release=resolve),requestSeen=new Promise(resolve=>requested=resolve);
 try{
  await seed(pair);
  await o.evaluate(async()=>{const db=await FocusLocalData.open();await FocusLocalData.transaction(db,['Task'],'readwrite',tx=>{const store=tx.objectStore('Task'),q=store.get('reports-task-4');q.onsuccess=()=>store.put({...q.result,rCycle:1,rId:'font-repeat'})})});
  await o.reload();await o.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await copyFixture(pair);
  // Routing disables the HTTP cache. Hold only the real bundled bold face;
  // all product CSS, text, dimensions and native font rendering stay intact.
  await n.route(/NotoSansSC-Bold[^/]*\.ttf/,async route=>{requested();await hold;await route.continue()});
  await n.reload();await n.getByTestId('app-shell').waitFor();
  await o.locator('#z-blue').click();await n.locator('.workspace-nav[data-project-id="z-blue"]').click();
  await o.locator('[class*=TaskItem-task]').filter({hasText:'Reports task 4'}).click({button:'right'});await n.locator('[data-task-id="reports-task-4"]').click({button:'right'});
  await o.getByText('删除任务',{exact:true}).click();await n.getByRole('menuitem',{name:'删除任务',exact:true}).click();
  await n.locator('.legacy-task-delete.repeat').waitFor();
  await n.waitForFunction(()=>[...document.fonts].some(f=>f.family==='Noto Sans SC'&&f.weight==='700'&&f.status==='loading'));
  await requestSeen;
  const before=await n.locator('.legacy-task-delete.repeat').evaluate(e=>({box:e.getBoundingClientRect().toJSON(),title:e.querySelector('strong').getBoundingClientRect().toJSON(),fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status}))}));
  let resolved=false;
  const pending=metrics(n,{root:'.legacy-task-delete.repeat'}).then(value=>{resolved=true;return value});
  await n.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
  assert.equal(resolved,false,'Geometry must not resolve while the displayed font is loading');
  release();
  const actual=(await pending).root,expected=(await metrics(o,{root:'[class*=MultiActionsDialog-root]'})).root;
  assert(await n.evaluate(()=>[...document.fonts].some(f=>f.family==='Noto Sans SC'&&f.weight==='700'&&f.status==='loaded')));
  for(const field of ['x','y','width','height'])assert(Math.abs(actual[field]-expected[field])<=1,field+': '+actual[field]+' / '+expected[field]);
  for(const field of ['font','background','borderRadius'])assert.equal(actual[field],expected[field],field);
  for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}
  fs.writeFileSync(path.join(output,'dialog-font-readiness.json'),JSON.stringify({passed:true,before,actual,expected},null,2));
  console.log('PASS cold dialog font readiness '+JSON.stringify({pendingY:before.box.y,loadedY:actual.y,loadedHeight:actual.height}));
 }finally{release();await pair.close()}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
