/* R1 uses the unchanged 1.9.3 runtime as its oracle, on isolated ports only. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,copyFixture,assert,fs,path,root}=require('./ui-restore-helpers.cjs');
const out=path.join(root,'.agent-temp/d-v-r1');
const results=[];
const times=['00:00','05:59','06:00','08:59','09:00','11:29','11:30','12:00','12:29','12:30','17:59','18:00','23:59'];
const task=(page,name)=>page.locator('[class*=TaskItem-task],.workspace-task').filter({has:page.getByText(name,{exact:true})}).first();
const oldReady=async page=>{await page.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await page.evaluate(()=>FocusLocalReady);await page.evaluate(()=>document.fonts.ready)};
async function seed(pair){
 const input=pair.old.locator('[class*=TaskNewItem] input').first();
 await input.fill('R1 template');await input.press('Enter');await pair.old.getByText('R1 template',{exact:true}).waitFor();
 const backup=await pair.old.evaluate(()=>FocusLocalData.snapshot()),base=backup.indexedDB.Task[0],end=+new Date('2026-11-08T23:59:59.999+08:00');
 backup.indexedDB.Task=[...Array.from({length:4},(_,i)=>({...base,id:'repeat-'+i,name:'R1 repeat '+i,priority:i,rCycle:1,rUnit:'days',rFirstDeadline:end,order:i*10000})),
  {...base,id:'parent',name:'R1 parent',remark:'R1 note',hasSubtask:true,isExpanded:true,order:50000},
  {...base,id:'none',name:'R1 no date',deadline:0,order:60000},
  {...base,id:'done',name:'R1 done today',isFinished:true,finishedDate:end-3600000,order:70000},
  {...base,id:'before',name:'R1 done before',isFinished:true,finishedDate:end-86400000*10,order:80000},
  {...base,id:'yesterday',name:'R1 done yesterday',isFinished:true,finishedDate:end-86400000,order:81000},
  {...base,id:'last-year',name:'R1 done last year',isFinished:true,finishedDate:+new Date('2025-12-31T12:00:00+08:00'),order:82000},
  ...times.map((time,i)=>({...base,id:'reminder-'+i,name:'R1 reminder '+time,deadline:0,reminderDate:+new Date('2026-11-09T'+time+':00+08:00'),order:90000+i*10000}))];
 backup.indexedDB.Subtask=[{id:'child-a',objType:'SUBTASK',taskId:'parent',name:'R1 child A',state:0,isFinished:false,order:0},
  {id:'child-b',objType:'SUBTASK',taskId:'parent',name:'R1 child B',state:0,isFinished:true,order:10000},
  {id:'deleted-child',objType:'SUBTASK',taskId:'none',name:'Deleted',state:-1,isFinished:false,order:0}];
 backup.indexedDB.Pomodoro=Array.from({length:8},(_,i)=>({id:'record-'+i,taskId:'parent',subtaskId:i<2?'child-a':'child-b',endDate:end-(i+1)*3600000,interval:i===0?750:1500,pomodoroInterval:1500,state:0,sync:0}));
 backup.indexedDB.Project=backup.indexedDB.Project.map(row=>[4003,4004,4006].includes(row.type)?{...row,state:0}:row);
 await pair.old.evaluate(b=>new Promise((resolve,reject)=>{const req=indexedDB.open('PomodoroDB6',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,names=['Project','Task','Subtask','Pomodoro'],tx=db.transaction(names,'readwrite');for(const name of names){const store=tx.objectStore(name);store.clear();for(const row of b.indexedDB[name])store.put(row)}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}),backup);
 await pair.old.reload();await oldReady(pair.old);await copyFixture(pair);
}
async function measured(locator){return locator.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,color:s.color,borderRadius:s.borderRadius,background:s.backgroundColor,backgroundSize:s.backgroundSize,backgroundImage:s.backgroundImage,display:s.display,decoration:s.textDecorationLine}})}
async function equal(a,b,label,fields=['x','y','width','height']){
 const [left,right]=await Promise.all([measured(a),measured(b)]);
 for(const field of fields)typeof left[field]==='number'?assert(Math.abs(left[field]-right[field])<1,`${label} ${field}: ${left[field]} / ${right[field]}`):assert.equal(right[field],left[field],label+' '+field);
 return {label,left,right};
}
async function imageEqual(a,b,label){
 const source=async loc=>loc.evaluate(e=>e.tagName==='IMG'?e.src:getComputedStyle(e).backgroundImage);
 const bytes=async(loc,src)=>loc.page().evaluate(async src=>{const url=src.startsWith('url(')?src.slice(5,-2):src;return Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer()))},src);
 const hash=value=>require('node:crypto').createHash('sha256').update(Buffer.from(value)).digest('hex');
 assert.equal(hash(await bytes(a,await source(a))),hash(await bytes(b,await source(b))),label+' original artwork bytes');
}
async function nav(pair,id){await pair.old.locator('#'+id).click();await pair.new.locator('[data-project-id="'+id+'"] .workspace-nav').click();await pair.old.waitForTimeout(180)}
async function open(pair,name){await task(pair.old,name).locator('[class*=TaskItem-name-]').click();await task(pair.new,name).locator('.workspace-task-name').click();await pair.old.locator('[class*=SubtaskList-root]').waitFor();await pair.new.locator('.legacy-detail-subtasks').waitFor();await pair.old.waitForTimeout(300);}
async function rows(page,table){return page.evaluate(table=>new Promise((resolve,reject)=>{const r=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{db.close();resolve(q.result)}}}),table)}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
  if(process.env.FOCUS_TEST_FILTER&&!new RegExp(process.env.FOCUS_TEST_FILTER).test(locale+' '+(dark?'dark':'light')))continue;
  const pair=await paired({locale,dark});const o=pair.old,n=pair.new,evidence=[];
  try{
   await seed(pair);
   // #1 all priority artwork; hover preserves the repeat indicator.
   for(let i=0;i<4;i++){
    const a=task(o,'R1 repeat '+i).locator('[class*=TaskItem-complete] span'),b=task(n,'R1 repeat '+i).locator('input[type=checkbox]');
    await imageEqual(a,b,'repeat '+i);await b.hover();await imageEqual(a,b,'repeat hover '+i);
   }
   // #7 both the bundled avatar and a non-square custom image at two viewports.
   for(const width of [1280,1024]){await o.setViewportSize({width,height:900});await n.setViewportSize({width,height:900});evidence.push(await equal(o.locator('[class*=HomeHeader-portrait]'),n.locator('.workspace-avatar'),'avatar',['x','y','width','height','borderRadius']));}
   const profile=await o.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=30;c.getContext('2d').fillRect(0,0,80,30);return c.toDataURL()});
   await o.evaluate(async avatar=>{await FocusLocalData.saveProfile('avatar',avatar);await FocusLocalData.saveProfile('name','R1 '+'user '.repeat(8))},profile);await o.reload();await oldReady(o);await copyFixture(pair);
   for(const width of [1280,1024]){await o.setViewportSize({width,height:900});await n.setViewportSize({width,height:900});evidence.push(await equal(o.locator('[class*=HomeHeader-portrait]'),n.locator('.workspace-avatar'),'custom avatar',['x','y','width','height','borderRadius']));}
   await o.setViewportSize({width:1280,height:900});await n.setViewportSize({width:1280,height:900});
   // #4 presets with two statistics distribute across the full summary.
   for(const id of ['id-deadline-tomorrow','id-deadline-upcoming','id-deadline-someday','id-deadline-last7days','id-deadline-overdue']){
    await nav(pair,id);const a=o.locator('[class*=StatisticsRegion-item]'),b=n.locator('.workspace-summary-item');assert.equal(await a.count(),2);assert.equal(await b.count(),2);
    for(let i=0;i<2;i++)evidence.push(await equal(a.nth(i),b.nth(i),'two statistics '+i));
   }
   await nav(pair,'id-deadline-today');await open(pair,'R1 parent');
   // #13 no expansion, even when the saved task has isExpanded=true.
   const parent=task(n,'R1 parent');assert.equal(await parent.locator('[aria-expanded],.domain-inline-subtasks').count(),0);
   evidence.push(await equal(task(o,'R1 parent').locator('[class*=TaskItem-subtask]'),parent.locator('.workspace-task-subtask'),'subtask marker'));
   await imageEqual(task(o,'R1 parent').locator('[class*=TaskItem-subtask]'),parent.locator('.workspace-task-subtask'),'subtask marker');
   assert.equal(await parent.locator('.workspace-task-subtask').innerText(),'');
   evidence.push(await equal(task(o,'R1 parent').locator('[class*=TaskItem-remark]'),parent.locator('.workspace-task-subtask-remark'),'subtask and note columns'));
   // #12 exact detail geometry, completed appearance, hover delete and inline editing.
   await o.mouse.move(500,100);await n.mouse.move(500,100);
   assert.equal(await n.locator('.legacy-subtask-name').first().getAttribute('contenteditable'),'false');
   const mappings=[['[class*=SubtaskList-root]','.legacy-detail-subtasks'],['[class*=SubtaskList-separator-]','.legacy-subtask-separator:not(.bottom)'],['[class*=SubtaskItem-complete] span','.workspace-subtask>input'],['[class*=SubtaskItem-start] span','.legacy-subtask-start>.legacy-icon'],['[class*=SubtaskItem-name-]','.legacy-subtask-name'],['[class*=SubtaskNewItem-root] input','#new-subtask'],['[class*=SubtaskList-separator2-]','.legacy-subtask-separator.bottom']];
   for(const [a,b] of mappings)evidence.push(await equal(o.locator(a).first(),n.locator(b).first(),b));
   await equal(o.locator('[class*=SubtaskList-separator-]'),n.locator('.legacy-subtask-separator:not(.bottom)'),'subtask separator',['background']);
   for(let i=0;i<2;i++){
    await equal(o.locator('[class*=SubtaskItem-name-]').nth(i),n.locator('.legacy-subtask-name').nth(i),'child typography',['fontSize','lineHeight','fontWeight','color','decoration']);
    await imageEqual(o.locator('[class*=SubtaskItem-start] span').nth(i),n.locator('.legacy-subtask-start>.legacy-icon').nth(i),'child start '+i);
    evidence.push(await equal(o.locator('[class*=SubtaskItem-root]').nth(i),n.locator('.workspace-subtask').nth(i),'child row with focus records'));
   }
   const icons=o.locator('[class*=SubtaskItem-lessPomodoros] img');assert.equal(await icons.count(),2);
   for(let i=0;i<2;i++)await imageEqual(icons.nth(i),n.locator('.legacy-subtask-pomos').first().locator('img').nth(i),'partial pomodoro '+i);
   assert.equal(await n.locator('.legacy-subtask-pomos').nth(1).innerText(),await o.locator('[class*=SubtaskItem-value]').innerText());
   assert.equal(await n.locator('.legacy-subtask-start').nth(1).isDisabled(),true);
   assert.equal(await o.locator('[class*=SubtaskItem-delete] img').first().isVisible(),false);assert.equal(await n.locator('.legacy-subtask-delete img').first().isVisible(),false);
   await o.locator('[class*=SubtaskItem-root]').first().hover();await n.locator('.workspace-subtask').first().hover();evidence.push(await equal(o.locator('[class*=SubtaskItem-delete] img').first(),n.locator('.legacy-subtask-delete img').first(),'hover delete'));
   await imageEqual(o.locator('[class*=SubtaskItem-delete] img').first(),n.locator('.legacy-subtask-delete img').first(),'delete artwork');
   await o.locator('[class*=SubtaskItem-name-]').first().click();await n.locator('.legacy-subtask-name').first().click();
   assert.equal(await n.locator('.legacy-subtask-name').first().getAttribute('contenteditable'),await o.locator('[class*=SubtaskItem-name-]').first().getAttribute('contenteditable'));
   evidence.push(await equal(o.locator('[class*=SubtaskItem-root]').first(),n.locator('.workspace-subtask').first(),'selected subtask',['background']));
   await n.locator('.legacy-subtask-name').first().fill('R1 renamed');await n.locator('.legacy-subtask-name').first().press('Enter');await n.waitForFunction(()=>document.querySelector('.legacy-subtask-name')?.getAttribute('aria-label')?.endsWith('R1 renamed'));
   assert.equal((await rows(n,'Subtask')).find(row=>row.id==='child-a').name,'R1 renamed');assert.equal(await n.locator('dialog[open]').count(),0);
   await n.locator('.workspace-subtask>input').first().click();await n.waitForFunction(()=>document.querySelector('.legacy-subtask-name')?.dataset.finished==='true');assert.equal(await n.locator('.legacy-subtask-start').first().isDisabled(),true);
   await n.locator('.workspace-subtask>input').first().click();await n.waitForFunction(()=>document.querySelector('.legacy-subtask-name')?.dataset.finished==='false');
   await n.reload();await n.getByTestId('app-shell').waitFor();await open(pair,'R1 parent');assert.equal(await n.locator('.legacy-subtask-name').first().innerText(),'R1 renamed');
   await n.locator('.legacy-subtask-name').first().click();await n.locator('.legacy-subtask-name').first().fill('R1 discarded');await n.locator('.legacy-subtask-name').first().press('Escape');assert.equal(await n.locator('.legacy-subtask-name').first().innerText(),'R1 renamed');
   const add=n.locator('#new-subtask');await add.fill('R1 added');await add.press('Enter');await n.getByRole('textbox',{name:/R1 added/}).waitFor();assert.equal((await rows(n,'Subtask')).filter(row=>row.state===0&&row.taskId==='parent').length,3);
   // #2 completion-day groups and a disabled start icon retain the row columns.
   await nav(pair,'id-task-tasks');for(const p of [o,n]){const toggle=p.locator('[class*=TaskRegion-title] > div,.workspace-completed-toggle').filter({hasText:locale==='en'?'Show Completed Tasks':'显示已完成任务'});if(await toggle.count())await toggle.click();}
   const a=o.locator('[class*=TaskRegion-finishedTasks] [class*=TaskGroup-title]'),b=n.locator('.workspace-completed-section h2');assert.deepEqual(await b.allTextContents(),await a.allTextContents());assert.equal(await b.count(),4);
   for(const p of [o,n])await p.evaluate(()=>document.querySelectorAll('[class*=ScrollView],.workspace-task-scroll').forEach(e=>e.scrollTop=0));
   evidence.push(await equal(task(o,'R1 done today').locator('[class*=TaskItem-name-]'),task(n,'R1 done today').locator('.workspace-task-name'),'completed name'));
   const toggle=n.locator('.workspace-completed-toggle');await toggle.click();assert.equal(await n.locator('.workspace-completed-section h2').count(),0);await toggle.click();assert.equal(await n.locator('.workspace-completed-section h2').count(),4);
   // #11 zero deadline and deleted child do not produce a marker.
   await open(pair,'R1 no date');assert.equal(await task(n,'R1 no date').locator('.workspace-task-subtask').count(),0);
   const oldDue=o.locator('[class*=DeadlineItem-value]'),newDue=n.locator('.legacy-detail-field').filter({has:n.locator('img[src*=detail-deadline]')}).locator('.legacy-detail-value');assert.equal(await newDue.innerText(),await oldDue.innerText());
   // #18 actual rendered labels at every Chinese meridiem boundary and English am/pm.
   for(const time of times){await open(pair,'R1 reminder '+time);assert.equal(await n.locator('.legacy-detail-field').filter({has:n.locator('img[src*=detail-reminder]')}).locator('.legacy-detail-value').innerText(),await o.locator('[class*=ReminderItem-value]').innerText(),'reminder '+time);}
   await open(pair,'R1 parent');
   await n.locator('.workspace-subtask').first().dragTo(n.locator('.workspace-subtask').nth(1));
   await n.waitForFunction(()=>document.querySelector('.legacy-subtask-name')?.textContent==='R1 child B');
   assert((await rows(n,'Subtask')).find(row=>row.id==='child-b').order<(await rows(n,'Subtask')).find(row=>row.id==='child-a').order);
   const added=n.locator('.workspace-subtask').filter({has:n.getByRole('textbox',{name:/R1 added/})});await added.hover();await added.locator('.legacy-subtask-delete').click();await n.locator('dialog[open] footer button').first().click();assert.equal(await added.count(),1);
   await added.hover();await added.locator('.legacy-subtask-delete').click();await n.locator('dialog[open] footer button').last().click();await added.waitFor({state:'detached'});
   await n.locator('.workspace-subtask').filter({has:n.getByRole('textbox',{name:/R1 renamed/})}).locator('.legacy-subtask-start').click();
   await n.getByTestId('timer-expanded').waitFor();assert.equal(await n.getByTestId('timer-expanded').getAttribute('data-state'),'work');assert.equal((await rows(n,'TimerSession'))[0].subtaskId,'child-a');
   assert.deepEqual(pair.handles.map(h=>h.errors),[[],[]]);assert(pair.handles.every(h=>h.requests.every(url=>!url.startsWith('http://127.0.0.1:5500'))));
   results.push({locale,dark,passed:true,evidence});console.log('PASS R1 '+locale+' '+(dark?'dark':'light'));
  }catch(error){results.push({locale,dark,passed:false,error:error.stack});await n.screenshot({path:path.join(out,'failure-'+locale+'-'+dark+'.png')});await o.screenshot({path:path.join(out,'failure-old-'+locale+'-'+dark+'.png')});fs.writeFileSync(path.join(out,'failure-old-'+locale+'-'+dark+'.html'),await o.locator('body').innerHTML());console.error(error.stack)}finally{await pair.close()}
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));assert(results.every(result=>result.passed),'R1 parity failed');
})().catch(error=>{console.error(error);process.exitCode=1});
