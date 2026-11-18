/* Inspector deletion: actual legacy dialog, cancellation, child flags and history choice. */
const {paired,copyFixture,metrics,assert,fs,path}=require('./ui-restore-helpers.cjs');
const deadlines = [
 ['Inspector no date', 0, 0, null, false],
 ['Inspector same day', 0, 3, null, false],
 ['Inspector tomorrow', 1, 23, null, false],
 ['Inspector later', 7, 23, null, false],
 ['Inspector other year', 1, 23, 2027, false],
 ['Inspector overdue', -1, 23, null, true],
];
async function checkDetails(o,n,locale,dark) {
 await o.locator('#id-task-tasks').click();
 await n.locator('[data-view=tasks]').click();
 for (const [name,,,,overdue] of deadlines) {
  await o.getByText(name,{exact:true}).click();
  await n.getByRole('button',{name,exact:true}).click();
  const oldValue=o.locator('[class*=DeadlineItem-value] span'), value=n.locator('.legacy-detail-deadline .legacy-detail-value');
  assert.equal(await value.innerText(),await oldValue.innerText(),name);
  assert.equal(await value.evaluate(el=>getComputedStyle(el).color),await oldValue.evaluate(el=>getComputedStyle(el).color),name);
  assert.equal(await value.getAttribute('data-overdue'),overdue?'true':null,name);
  assert.equal(await n.locator('.legacy-detail-deadline summary>span').first().innerText(),await o.locator('[class*=DeadlineItem-title]').innerText());
 }
 for (const icon of ['detail-close','add-pomodoro','detail-delete']) {
  const read=el=>{const {x,y,width,height}=el.getBoundingClientRect();return {x,y,width,height}};
  const oldIcon=await o.locator('img[src="img/'+icon+'.png"]').evaluate(read);
  const newIcon=await n.locator('.workspace-details footer img[src*="/'+icon+'-"]').evaluate(read);
  assert.equal(newIcon.width,oldIcon.width,icon);
  assert.equal(newIcon.height,oldIcon.height,icon);
  for (const axis of ['x','y'])assert(Math.abs(newIcon[axis]-oldIcon[axis])<=1,icon+' '+axis);
 }
 await n.screenshot({path:path.join(output,'task-details-'+locale+(dark?'-dark':'-light')+'.png')});
}
const output=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance/inspector-dialogs'),results=[];
async function rows(page,store){return page.evaluate(store=>new Promise((resolve,reject)=>{const r=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>{db.close();resolve(q.result)}};r.onerror=()=>reject(r.error)}),store)}
async function check(locale,dark){
 const pair=await paired({locale,dark}),o=pair.old,n=pair.new,zh=locale==='zh-CN';
 try{
  await o.locator('[class*=TaskNewItem] input').first().fill('Inspector sample');await o.locator('[class*=TaskNewItem] input').first().press('Enter');await o.locator('[class*=TaskItem-name-]').filter({hasText:'Inspector sample'}).waitFor();
  await o.evaluate(async deadlines=>{const snapshot=await FocusLocalData.snapshot(),task=snapshot.indexedDB.Task[0],db=await FocusLocalData.open();await FocusLocalData.transaction(db,['Task','Subtask','Pomodoro'],'readwrite',tx=>{
   tx.objectStore('Task').put({...task,hasSubtask:true});
   const today=new Date();
   for (const [index,[name,offset,hour,year]] of deadlines.entries()) {
    const deadline=hour?+new Date(year??today.getFullYear(),today.getMonth(),today.getDate()+offset,hour):0;
    tx.objectStore('Task').put({...task,id:'inspector-deadline-'+index,name,deadline});
   }tx.objectStore('Subtask').put({id:'inspector-child',taskId:task.id,name:'Inspector child',objType:'SUBTASK',state:0,isFinished:false,order:0});tx.objectStore('Pomodoro').put({id:'inspector-record',objType:'POMODORO',taskId:task.id,subtaskId:'',state:0,endDate:Date.now(),interval:1500,pomodoroInterval:1500});
  })},deadlines);await o.reload();await o.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await copyFixture(pair);
  await checkDetails(o,n,locale,dark);
  await o.locator('[class*=TaskItem-name-]').filter({hasText:'Inspector sample'}).click();await n.getByRole('button',{name:'Inspector sample',exact:true}).click();
  await o.locator('[class*=SubtaskItem-delete]').click();await n.getByLabel((zh?'删除子任务':'Delete subtask')+': Inspector child',{exact:true}).click();
  const a=(await metrics(o,{root:'[class*=ConfirmDialog-root]'})).root,b=(await metrics(n,{root:'.legacy-task-delete'})).root;
  for(const field of ['x','y','width','height'])assert(Math.abs(a[field]-b[field])<=1,field+': '+a[field]+'/'+b[field]);for(const field of ['font','background','borderRadius'])assert.equal(a[field],b[field]);
  assert.equal(await n.locator('.legacy-delete-content strong').innerText(),await o.locator('[class*=ConfirmDialog-title]').innerText());assert.equal(await n.locator('.legacy-delete-content p').innerText(),await o.locator('[class*=ConfirmDialog-detail] p').innerText());
  await o.locator('[class*=ConfirmDialog-cancel]').click();await n.locator('.legacy-task-delete footer button:first-child').click();await n.locator('.legacy-task-delete').waitFor({state:'hidden'});assert.equal((await rows(n,'Subtask')).filter(row=>row.state===0).length,1);
  await n.getByLabel((zh?'删除子任务':'Delete subtask')+': Inspector child',{exact:true}).click();await n.locator('.legacy-task-delete .primary').click();await n.locator('.legacy-task-delete').waitFor({state:'hidden'});assert.equal((await rows(n,'Subtask')).filter(row=>row.state===0).length,0);assert.equal((await rows(n,'Task')).find(row=>row.name==='Inspector sample').hasSubtask,false);
  await n.locator('.legacy-detail-bottom').getByRole('button',{name:zh?'删除':'Delete',exact:true}).click();const keep=n.getByRole('checkbox',{name:zh?'保留专注历史':'Keep focus history',exact:true});assert(await keep.isChecked());await n.locator('.legacy-task-delete footer button:first-child').click();await n.locator('.legacy-task-delete').waitFor({state:'hidden'});assert.equal((await rows(n,'Task')).find(row=>row.name==='Inspector sample').state,0);
  await n.locator('.legacy-detail-bottom').getByRole('button',{name:zh?'删除':'Delete',exact:true}).click();if(dark)await keep.uncheck();await n.locator('.legacy-task-delete .primary').click();await n.locator('.workspace-details').waitFor({state:'hidden'});assert.equal((await rows(n,'Task')).find(row=>row.name==='Inspector sample').state,-1);assert.equal((await rows(n,'Pomodoro'))[0].state,dark?-1:0);assert.equal(await n.locator('dialog[open]').count(),0);
  for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}results.push({locale,dark,passed:true,subtaskDialog:{old:a,new:b},historyPreserved:!dark});console.log('PASS inspector dialogs '+locale+' '+dark);
 }finally{await pair.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results},null,2))}
}
(async()=>{fs.mkdirSync(output,{recursive:true});for(const locale of ['zh-CN','en'])for(const dark of [false,true])await check(locale,dark)})().catch(error=>{console.error(error.stack);process.exitCode=1});
