/* R4/R5: independent legacy oracle, isolated contexts and synthetic data only. */
const {paired,copyFixture,assert,fs,path,root}=require('./ui-restore-helpers.cjs');
const out=path.join(root,'.agent-temp/d-v-r4-r5');
const settle=p=>p.waitForTimeout(300);
async function ready(p){await p.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady);await p.evaluate(()=>document.fonts.ready)}
async function seed(pair){
 const o=pair.old,input=o.locator('[class*=TaskNewItem] input').first();await input.fill('R45 template');await input.press('Enter');await o.getByText('R45 template',{exact:true}).waitFor();
 const backup=await o.evaluate(()=>FocusLocalData.snapshot()),task=backup.indexedDB.Task[0],project=backup.indexedDB.Project.find(p=>p.type===7005);
 backup.indexedDB.Project.push(...[
  {id:'r45-a',name:'R45 A',type:1000,order:-30000},
  {id:'r45-folder',name:'R45 Folder',type:2000,order:10000},
  {id:'r45-child',name:'R45 Child',type:1000,parentId:'r45-folder',order:20000},
  {id:'r45-b',name:'R45 B',type:1000,order:40000},
  {id:'r45-empty',name:'R45 Empty',type:2000,order:60000},
 ].map(p=>({...project,...p,expanded:true,orderingRule:3})));
 backup.indexedDB.Task=Array.from({length:8},(_,i)=>({...task,id:'r45-'+i,name:'R45 '+i,projectId:i<4?project.id:['r45-a','r45-child','r45-b',project.id][i-4],order:i*10000,priority:i%4,deadline:+new Date('2026-11-08T23:59:59+08:00')}));
 await o.evaluate(b=>new Promise((resolve,reject)=>{const r=indexedDB.open('PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['Project','Task'],'readwrite');for(const table of ['Project','Task']){tx.objectStore(table).clear();for(const row of b.indexedDB[table])tx.objectStore(table).put(row)}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}),backup);
 await o.reload();await ready(o);await copyFixture(pair);
}
async function measure(loc){return loc.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,borderRadius:s.borderRadius}})}
async function equal(a,b,label,fields=['x','y','width','height']){const [old,current]=await Promise.all([measure(a),measure(b)]);for(const key of fields)typeof old[key]==='number'?assert(Math.abs(old[key]-current[key])<1,`${label} ${key}: ${old[key]} / ${current[key]}`):assert.equal(current[key],old[key],label+' '+key);return {label,old,current}}
async function dbRows(n,table){return n.evaluate(table=>new Promise((resolve,reject)=>{const r=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>reject(q.error)}}),table)}
async function drag(p,source,target,{cancel=false,preview=true}={}){
 const a=await source.boundingBox(),b=await target.boundingBox();await p.mouse.move(a.x+Math.min(80,a.width/2),a.y+a.height/2);await p.mouse.down();await p.mouse.move(a.x+Math.min(80,a.width/2),a.y+a.height/2+8,{steps:3});await p.mouse.move(b.x+Math.min(80,b.width/2),b.y+b.height-2,{steps:12});
 if(preview){assert.equal(await p.locator('.workspace-drag-preview').count(),1);assert.equal(await p.evaluate(()=>getSelection().toString()),'')}
 if(cancel)await p.keyboard.press('Escape');await p.mouse.up();await settle(p);assert.equal(await p.locator('.workspace-drag-preview').count(),0);
}
async function run(pair){
 const o=pair.old,n=pair.new,evidence=[];
 await seed(pair);
 const oldTask=id=>o.locator('[class*=TaskItem-task]').filter({has:o.getByText('R45 '+id,{exact:true})}),newTask=id=>n.locator('.workspace-task[data-task-id="r45-'+id+'"]');
 // 8: Default Tasks first, then each custom project's stored order, including children.
 assert.deepEqual(await n.locator('.workspace-task-group>h2').allTextContents(),await o.locator('[class*=TaskGroup-title]').allTextContents());
 const oldSidebar=await o.locator('#projects-list li[id]').evaluateAll(es=>es.map(e=>e.id)),newSidebar=await n.locator('.sidebar-custom').evaluateAll(es=>es.map(e=>e.dataset.projectId));assert.deepEqual(newSidebar,oldSidebar);
 // 14: visible artwork, crop and alignment, including a non-square uploaded portrait.
 for(const custom of [false,true]){
  if(custom){await o.evaluate(async()=>{const c=document.createElement('canvas');c.width=80;c.height=30;const ctx=c.getContext('2d');ctx.fillStyle='#4670f6';ctx.fillRect(0,0,80,30);ctx.fillStyle='#ff5155';ctx.fillRect(20,0,30,30);await FocusLocalData.saveProfile('avatar',c.toDataURL())});await o.reload();await ready(o);await copyFixture(pair)}
  for(const width of [1280,1024]){await o.setViewportSize({width,height:900});await n.setViewportSize({width,height:900});evidence.push(await equal(o.locator('[class*=HomeHeader-portrait]'),n.locator('.workspace-avatar'),'avatar'));assert.deepEqual(await n.locator('.workspace-avatar').screenshot(),await o.locator('[class*=HomeHeader-portrait]').screenshot(),'avatar actual pixels')}
 }
 await o.setViewportSize({width:1280,height:900});await n.setViewportSize({width:1280,height:900});
 // 9: actual pointer moves, root order, parent changes, cancellation and reload.
 const list=id=>n.locator('.sidebar-item[data-project-id="r45-'+id+'"]');
 await drag(n,list('a'),list('b'));let projects=await dbRows(n,'Project');assert(projects.find(p=>p.id==='r45-a').order>projects.find(p=>p.id==='r45-b').order);
 await drag(n,list('a'),n.locator('.sidebar-empty-folder'));projects=await dbRows(n,'Project');assert.equal(projects.find(p=>p.id==='r45-a').parentId,'r45-empty');
 const before=JSON.stringify(projects);await drag(n,list('b'),list('folder'),{cancel:true});assert.equal(JSON.stringify(await dbRows(n,'Project')),before,'cancel never persists');
 await n.reload();await n.getByTestId('app-shell').waitFor();assert.equal(await list('a').evaluate(e=>e.classList.contains('sidebar-child')),true);
 // 10: full task rows drag; only custom views persist, using the moved row alone.
 await n.locator('.workspace-nav[data-project-id="id-task-tasks"]').click();const taskBefore=await dbRows(n,'Task');await drag(n,newTask(0),newTask(3));let tasks=await dbRows(n,'Task');assert(tasks.find(t=>t.id==='r45-0').order>tasks.find(t=>t.id==='r45-3').order);for(const row of tasks.filter(t=>t.id!=='r45-0'))assert.deepEqual(row,taskBefore.find(t=>t.id===row.id));
 await n.locator('.workspace-nav[data-project-id="id-deadline-today"]').click();const sortedBefore=JSON.stringify(await dbRows(n,'Task'));await drag(n,newTask(1),newTask(3));assert.equal(JSON.stringify(await dbRows(n,'Task')),sortedBefore,'non-custom springs back');
 // 13: context priority buttons and original artwork centered in each hit area.
 await copyFixture(pair);await oldTask(1).click({button:'right',position:{x:40,y:20}});await newTask(1).click({button:'right',position:{x:40,y:20}});await settle(n);
 for(let i=0;i<4;i++){const a=o.locator('[class*=TaskPriorityMenuItem-priority]>span').nth(i),b=n.locator('.legacy-priority-options>button').nth(i);evidence.push(await equal(a,b,'context priority'));const rect=await b.boundingBox(),icon=await b.locator('img').boundingBox();assert.equal(icon.x,rect.x+5);assert.equal(icon.y,rect.y+5)}
 await o.mouse.click(1100,30);await n.mouse.click(1100,30);await settle(n);
 // 1–7: responsive settings controls, stable content node, rapid keys and upload.
 await n.locator('.workspace-profile').click();await n.locator('.workspace-profile-menu').waitFor();await settle(n);assert.equal(await n.locator('.workspace-profile-menu').evaluate(e=>getComputedStyle(e).opacity),'1');await n.mouse.click(1100,30);await settle(n);
 await o.locator('img[src="img/header-setting.png"]').click();await n.locator('[data-view=settings]').click();await settle(n);
 const volume=n.locator('input[type=range]').first();await volume.scrollIntoViewIfNeeded();const vr=await volume.boundingBox();await n.mouse.move(vr.x+vr.width-2,vr.y+vr.height/2);await n.mouse.down();await n.mouse.move(vr.x+vr.width*.27,vr.y+vr.height/2,{steps:25});assert.equal(await volume.isDisabled(),false);const value=await volume.inputValue();assert(Number(value)<40);assert.equal(await volume.evaluate(e=>e.style.getPropertyValue('--volume')),value+'%');await n.mouse.up();await n.waitForFunction(v=>localStorage.getItem('FocusTodoStandalone.data.RtnVol')===v,value);
 const content=await n.locator('.legacy-settings-content').elementHandle();await n.locator('[data-settings-tab=general]').click();assert(await content.evaluate(e=>e.isConnected),'tab content retains its node');
 const toggle=n.locator('.legacy-settings [type=checkbox]').first();const checked=await toggle.isChecked();await toggle.click();assert.equal(await toggle.isChecked(),!checked);assert.equal(await toggle.isDisabled(),false);
 await n.locator('[data-settings-tab=pomodoro]').click();await n.locator('.legacy-settings-select select').first().click();await n.locator('.legacy-settings-menu').getByRole('option',{name:/^26(?:分钟|\s)/}).click();await n.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.WorkInterval')==='1560');
 await n.locator('[data-settings-tab=projects]').click();const handle=n.locator('.legacy-settings-project-handle').first();await handle.focus();const scroll=await n.locator('.legacy-settings-project-rows').evaluate(e=>e.scrollTop);for(let i=0;i<12;i++)await n.keyboard.press('ArrowDown');await settle(n);assert.equal(await n.locator('.legacy-settings-project-rows').evaluate(e=>e.scrollTop),scroll);assert.equal(await n.locator('.legacy-settings-content').evaluate(e=>e.scrollTop),0);
 await o.locator('[class*=Settings-menuName]').filter({hasText:/^(外观|Appearance)$/}).click();await n.locator('[data-settings-tab=appearance]').click();
 const uploadOld=o.getByText(/^(本地上传|Upload image)$/).last();await uploadOld.scrollIntoViewIfNeeded();await n.locator('.legacy-upload').scrollIntoViewIfNeeded();evidence.push(await equal(uploadOld.locator('..'),n.locator('.legacy-upload-placeholder'),'upload'));
 await o.locator('[class*=Settings-close]').click();await n.getByTestId('close-page').click();await settle(n);
 // 11–12: minutes at 60/90/480 and popup geometry, fonts, hover and checkmark.
 await o.locator('#id-task-history').click();await n.locator('.workspace-nav[data-project-id="id-task-history"]').click();await o.locator('[class*=TaskRegion-pomodoroAdd]').click();await n.locator('.legacy-history-add').click();await settle(n);
 for(const minutes of [60,90,480]){
  await o.locator('[class*=IntervalItem-value]').click();await n.locator('.legacy-record-field').last().locator('summary').click();await settle(n);
  evidence.push(await equal(o.locator('.popover'),n.locator('.legacy-record-duration-popover'),'duration popup'));
  const a=o.locator('[class*=IntervalInput-option]').nth(minutes-1),b=n.locator('.legacy-record-duration-picker>button').nth(minutes-1);await a.scrollIntoViewIfNeeded();await b.scrollIntoViewIfNeeded();await a.hover();await b.hover();await equal(a,b,'duration option',['width','height','font','background']);await a.click();await b.click();await settle(n);assert.equal(await n.locator('.legacy-record-field').last().locator('.legacy-record-value').innerText(),await o.locator('[class*=IntervalItem-value]').innerText());
 }
 assert.equal(await n.locator('.workspace-error').count(),0);
 return evidence;
}
(async()=>{fs.mkdirSync(out,{recursive:true});const results=[];for(const locale of ['zh-CN','en'])for(const dark of [false,true]){if(process.env.FOCUS_TEST_FILTER&&!new RegExp(process.env.FOCUS_TEST_FILTER).test(locale+' '+(dark?'dark':'light')))continue;const pair=await paired({locale,dark,reducedMotion:'no-preference'});try{const evidence=await run(pair);assert.deepEqual(pair.handles[1].errors,[]);results.push({locale,dark,passed:true,evidence});console.log('PASS R4/R5',locale,dark?'dark':'light')}catch(error){await pair.old.screenshot({path:path.join(out,'failure-old.png')});await pair.new.screenshot({path:path.join(out,'failure-new.png')});throw error}finally{await pair.close()}}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2))})().catch(error=>{console.error(error);process.exitCode=1});
