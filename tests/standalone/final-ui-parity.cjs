/* Full-dialog inventory and final regressions. Fresh contexts and generated data only. */
const {paired,copyFixture,metrics,assert,fs,path}=require('./ui-restore-helpers.cjs');
const {seed}=require('./ui-fixtures.cjs');
const output=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance/final-ui');
const results=[];
async function equal(pair,oldSelector,newSelector,label,fields=['x','y','width','height','font','background','borderRadius']){
 const a=(await metrics(pair.old,{root:oldSelector})).root,b=(await metrics(pair.new,{root:newSelector})).root;
 assert(a&&b,label+' exists');
 for(const field of fields)typeof a[field]==='number'?assert(Math.abs(a[field]-b[field])<=1,`${label} ${field}: ${a[field]} / ${b[field]}`):assert.equal(b[field],a[field],label+' '+field);
 return {label,old:a,new:b};
}
async function settle(pair){await pair.new.waitForTimeout(300)}
async function cancel(pair,oldSelector,newSelector){await pair.old.locator(oldSelector).click();await pair.new.locator(newSelector).click();await settle(pair)}
async function run(locale,dark,width){
 const pair=await paired({locale,dark,width,height:800,reducedMotion:'no-preference'}),o=pair.old,n=pair.new,zh=locale==='zh-CN',key=locale+'-'+dark+'-'+width,checks=[];
 try{
  checks.push(await equal(pair,'[class*=TaskRegion-emptyImg-]','.workspace-empty-art','empty task artwork'));
  checks.push(await equal(pair,'[class*=TaskRegion-emptyTitle-]','.workspace-empty-title','empty task title'));
  await seed(pair);
  // Every creation shell, including the nested list editor inside a folder.
  for(const [oldOpen,index,type]of [['[class*=ProjectNewItem-title]',0,'Project'],['[class*=ProjectNewItem-tag]',1,'Tag'],['[class*=ProjectNewItem-folder]',2,'Folder']]){
   await o.locator(oldOpen).click();await n.locator('.workspace-sidebar>footer>button').nth(index).click();await settle(pair);
   checks.push(await equal(pair,`[class*=${type}Editer-root]`,'.legacy-project-editor',type+' editor'));
   checks.push(await equal(pair,`[class*=${type}Editer-confirm]`,'.legacy-project-editor footer .primary',type+' confirm'));
   if(type==='Folder'){
    await o.locator('[class*=FolderEditer-createOption-]').click();await n.locator('.legacy-folder-lists>button').click();await settle(pair);
    assert.equal(await n.locator('.legacy-project-editor[open]').count(),2);
    assert(await n.locator('.legacy-project-editor[open]').last().evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+50))}),'Nested dialog owns the top layer');
    await cancel(pair,'[class*=ProjectEditer-cancel]','.legacy-project-editor:last-of-type footer button:first-child');
   }
   await cancel(pair,`[class*=${type}Editer-cancel]`,'.legacy-project-editor footer button:first-child');
  }
  // Completed rows: compare rendered cards, groups, labels, neutral done icons and no summary.
  await o.locator('#id-task-history').click();await n.locator('.workspace-nav[data-project-id="id-task-history"]').click();
  await o.locator('[class*=HistoryItemGroup-title]').waitFor();
  assert.deepEqual(await n.locator('.legacy-history-day h2').allTextContents(),await o.locator('[class*=HistoryItemGroup-title]').allTextContents());
  checks.push(await equal(pair,'[class*=HistoryTaskItem-table]','.legacy-history-task','completed task card'));
  checks.push(await equal(pair,'[class*=HistoryPomodoroItem-table]','.domain-history-row','completed record card'));
  assert(await n.locator('.legacy-history-task input').evaluateAll(es=>es.every(e=>e.style.backgroundImage.includes('task_done_no_priority'))));
  assert.equal(await n.locator('.workspace-summary').isVisible(),false);
  // Manual record creation and its real date/duration/task pickers are covered by r2-r3 and calendar overlay suites.
  // Open the actual toolbar through its artwork, avoiding localized text assumptions.
  await o.locator('[class*=TaskRegion-menu-]').click();await n.locator('.legacy-history-add').click();await settle(pair);
  checks.push(await equal(pair,'[class*=PomodoroNew-root]','.legacy-record-modal','manual record'));
  await n.keyboard.press('Escape');await o.locator('[class*=PomodoroNew-remove]').click();await settle(pair);
  assert.equal(await n.locator('.legacy-record-modal').count(),0,'Escape closes once within the shared transition');
  // Repeating deletion uses the actual legacy three-action shell.
  await o.evaluate(async()=>{const db=await FocusLocalData.open();await FocusLocalData.transaction(db,['Task'],'readwrite',tx=>{const store=tx.objectStore('Task'),q=store.get('reports-task-4');q.onsuccess=()=>store.put({...q.result,rCycle:1,rId:'final-repeat'})})});
  await o.reload();await o.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await copyFixture(pair);
  await o.locator('#z-blue').click();await n.locator('.workspace-nav[data-project-id="z-blue"]').click();
  await o.locator('[class*=TaskItem-task]').filter({hasText:'Reports task 4'}).click({button:'right'});await n.locator('[data-task-id="reports-task-4"]').click({button:'right'});
  await o.getByText(zh?'删除任务':'Delete Task',{exact:true}).click();await n.getByRole('menuitem',{name:zh?'删除任务':'Delete Task',exact:true}).click();await settle(pair);
  checks.push(await equal(pair,'[class*=MultiActionsDialog-root]','.legacy-task-delete.repeat','repeating task deletion'));
  checks.push(await equal(pair,'[class*=MultiActionsDialog-action-]','.legacy-task-delete.repeat footer button:first-child','repeat action'));
  checks.push(await equal(pair,'[class*=MultiActionsDialog-cancel]','.legacy-task-delete.repeat footer button:last-child','repeat cancel'));
  await cancel(pair,'[class*=MultiActionsDialog-cancel]','.legacy-task-delete.repeat footer button:last-child');
  // Same task lifecycle as legacy: running stopwatch, paused play, resumed stopwatch, stopped play.
  await o.locator('#z-blue').click();await n.locator('.workspace-nav[data-project-id="z-blue"]').click();
  await o.locator('[class*=TaskItem-start-]').click();await n.locator('.workspace-task-start:not(:disabled)').click();await settle(pair);
  const icon=()=>n.locator('.workspace-task[data-task-id="reports-task-4"] .workspace-task-start img').getAttribute('src');
  assert((await icon()).includes('task-pomo-running'));
  await o.locator('[class*=FullscreenTimer-actionWithoutBackground]').filter({hasText:zh?'暂停':'Pause'}).click();await n.getByLabel(zh?'暂停':'Pause',{exact:true}).click();await n.locator('[data-testid=timer-expanded][data-state=pause]').waitFor();
  assert((await icon()).includes('task-start'));
  await o.getByText(zh?'继续':'Continue',{exact:true}).click();await n.getByLabel(zh?'继续':'Continue',{exact:true}).click();await n.locator('[data-testid=timer-expanded][data-state=work]').waitFor();assert((await icon()).includes('task-pomo-running'));
  await o.locator('[class*=FullscreenTimer-actionWithoutBackground]').filter({hasText:zh?'暂停':'Pause'}).click();await n.getByLabel(zh?'暂停':'Pause',{exact:true}).click();await n.locator('[data-testid=timer-expanded][data-state=pause]').waitFor();
  await o.getByText(zh?'停止':'Stop',{exact:true}).click();await n.getByLabel(zh?'停止':'Stop',{exact:true}).click();await settle(pair);
  checks.push(await equal(pair,'[class*=ConfirmDialog-root]','.legacy-task-delete','stop confirmation'));
  assert.deepEqual(await n.locator('.legacy-task-delete footer button').allTextContents(),await o.locator('[class*=ConfirmDialog-actions]>span').allTextContents());
  const mask=await o.locator('[class*=Overlay-mask]').last().evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(await n.locator('.legacy-task-delete').evaluate(e=>getComputedStyle(e,'::backdrop').backgroundColor),mask);
  await cancel(pair,'[class*=ConfirmDialog-cancel]','.legacy-task-delete button:first-child');
  assert((await icon()).includes('task-start'),'Cancel preserves paused state');
  await o.getByText(zh?'停止':'Stop',{exact:true}).click();await n.getByLabel(zh?'停止':'Stop',{exact:true}).click();
  await o.locator('[class*=ConfirmDialog-confirm]').click();await n.locator('.legacy-task-delete .primary').click();await settle(pair);
  assert((await icon()).includes('task-start'));
  await o.locator('[class*=FullscreenTimer-zoomdown]').click();await n.locator('.legacy-timer-close').click();await settle(pair);
  // Forest switch hides the actual header, persists after reload and restores it on enable.
  await n.locator('[data-view=settings]').click();await n.getByRole('button',{name:zh?'通用':'General',exact:true}).click();
  const forest=n.getByRole('checkbox',{name:zh?'专注森林':'Focus forest',exact:true});
  // The legacy label is "Forest" in English.
  const actual=await forest.count()?forest:n.getByRole('checkbox',{name:/Forest/i});
  await actual.uncheck();await n.getByTestId('close-page').click();await settle(pair);assert.equal(await n.locator('[data-view=forest]').count(),0);
  await n.reload();await n.getByTestId('app-shell').waitFor();assert.equal(await n.locator('[data-view=forest]').count(),0);
  await n.locator('[data-view=settings]').click();await n.getByRole('button',{name:zh?'通用':'General',exact:true}).click();await n.getByRole('checkbox',{name:zh?'专注森林':/Forest/i}).check();await n.getByTestId('close-page').click();await settle(pair);assert.equal(await n.locator('[data-view=forest]').count(),1);
  await n.reload();await n.getByTestId('app-shell').waitFor();assert.equal(await n.locator('[data-view=forest]').count(),1);
  // A long history exposes the former first-frame bitmap/CSS height mismatch.
  await n.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,tx=db.transaction('Pomodoro','readwrite');for(let i=0;i<70;i++)tx.objectStore('Pomodoro').put({id:'long-'+i,state:0,taskId:'reports-task-4',endDate:Date.now()-i*86400000,interval:1500,pomodoroInterval:1500});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}));
  await n.reload();await n.getByTestId('app-shell').waitFor();
  await n.evaluate(()=>{window.chartFrames=[];let end=0;const sample=()=>{const c=document.querySelector('.legacy-review-scroll canvas');if(c){if(!end)end=performance.now()+600;window.chartFrames.push({height:c.clientHeight,pixels:c.height,dpr:devicePixelRatio,reveal:Number(c.dataset.reveal),left:Number(c.dataset.chartLeft)})}if(!end||performance.now()<end)requestAnimationFrame(sample);else window.chartSamplingDone=true};requestAnimationFrame(sample)});
  await n.locator('[data-view=reports]').click();await n.waitForFunction(()=>window.chartSamplingDone);const frames=await n.evaluate(()=>window.chartFrames);
  assert(frames.length>5);assert(frames.every(f=>f.height>1000&&Math.abs(f.pixels-f.height*f.dpr)<=1&&f.left>0),'Final row spacing and axes exist in every visible frame');
  assert(frames.some(f=>f.reveal>0&&f.reveal<1)&&frames.at(-1).reveal===1,'Bottom-up reveal completes');
  await n.screenshot({path:path.join(output,key+'.png')});
  for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}
  results.push({key,passed:true,checks,frames});console.log('PASS final UI '+key);
 }catch(error){await n.screenshot({path:path.join(output,key+'-failure.png')}).catch(()=>{});results.push({key,passed:false,error:error.stack});throw error}
 finally{await pair.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results},null,2))}
}
(async()=>{fs.mkdirSync(output,{recursive:true});for(const locale of ['zh-CN','en'])for(const dark of [false,true])for(const width of [1280,1024])await run(locale,dark,width)})().catch(error=>{console.error(error.stack);process.exitCode=1});
