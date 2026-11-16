/* R2+R3 only: read-only 1.9.3 oracle, fresh contexts, fixed 5513/5511 ports.
 * Evidence is temporary and may be removed after reporting the final run. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,copyFixture,assert,fs,path,root}=require('./ui-restore-helpers.cjs');
const {assertNoLegacyRuntime}=require('./helpers.cjs');
const out=path.join(root,'.agent-temp/d-v-r2-r3'),results=[];
const prior=process.env.FOCUS_RETEST_FAILED==='1'&&fs.existsSync(path.join(out,'results.json'))?JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8')):[];
const task=(p,name)=>p.locator('[class*=TaskItem-task],.workspace-task').filter({has:p.locator('[class*=TaskItem-name-],.workspace-task-name').filter({hasText:new RegExp('^'+name+'(?:\\s*#|$)')})}).first();
const settle=p=>p.waitForTimeout(320);
async function ready(p){await p.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await p.evaluate(()=>FocusLocalReady);await p.evaluate(()=>document.fonts.ready)}
async function rows(p,table){return p.evaluate(table=>new Promise((resolve,reject)=>{const r=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{db.close();resolve(q.result)}}}),table)}
async function seed(pair){
 const input=pair.old.locator('[class*=TaskNewItem] input').first();await input.fill('R23 template');await input.press('Enter');await pair.old.getByText('R23 template',{exact:true}).waitFor();
 const backup=await pair.old.evaluate(()=>FocusLocalData.snapshot()),base=backup.indexedDB.Task[0],project=backup.indexedDB.Project.find(x=>x.type===7005),now=+new Date('2026-11-08T12:00:00+08:00');
 backup.indexedDB.Task=Array.from({length:8},(_,mask)=>({...base,id:'status-'+mask,name:'R23 '+mask,order:mask*10000,estimatePomoNum:mask===7?3:0,hasSubtask:!!(mask&2),remark:mask&4?' ':'' ,reminderDate:mask&1?now-1:0,tags:mask===7?'r23-tag':''}));
 backup.indexedDB.Task.push({...base,id:'boundary',name:'R23 boundary',reminderDate:now,order:90000},{...base,id:'future',name:'R23 future',reminderDate:now+60000,order:100000});
 backup.indexedDB.Subtask=backup.indexedDB.Task.filter(x=>x.hasSubtask).map(x=>({id:x.id+'-child',taskId:x.id,name:'R23 child',objType:'SUBTASK',state:0,isFinished:false,order:0}));
 backup.indexedDB.Project.push({...project,id:'r23-list',type:1000,name:'R23 list',order:900000,color:'4670F6'},{...project,id:'r23-tag',type:3000,name:'R23 tag',order:910000,color:'4670F6'});
 await pair.old.evaluate(b=>new Promise((resolve,reject)=>{const r=indexedDB.open('PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['Task','Subtask','Project'],'readwrite');for(const k of ['Task','Subtask','Project']){tx.objectStore(k).clear();for(const row of b.indexedDB[k])tx.objectStore(k).put(row)}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}),backup);
 await pair.old.reload();await ready(pair.old);await copyFixture(pair);
}
async function measure(loc){return loc.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,fontSize:s.fontSize,borderRadius:s.borderRadius,backgroundSize:s.backgroundSize}})}
async function equal(a,b,label,fields=['x','y','width','height']){const [x,y]=await Promise.all([measure(a),measure(b)]);for(const k of fields)typeof x[k]==='number'?assert(Math.abs(x[k]-y[k])<=1,`${label} ${k}: ${x[k]} / ${y[k]}`):assert.equal(y[k],x[k],label+' '+k);return {label,old:x,new:y}}
async function artwork(a,b){const get=loc=>loc.evaluate(async e=>{const bg=getComputedStyle(e).backgroundImage,src=e.tagName==='IMG'?e.src:bg.slice(5,-2);return Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer()))});assert.deepEqual(await get(b),await get(a),'same original artwork')}
async function blank(pair){for(const p of [pair.old,pair.new])await p.mouse.click(700,25);await settle(pair.new)}
async function open(pair){await task(pair.old,'R23 7').locator('[class*=TaskItem-name-]').click();await task(pair.new,'R23 7').locator('.workspace-task-name').click();await settle(pair.new)}
async function nav(pair,id){await pair.old.locator('#'+id).click();await pair.new.locator('.workspace-nav[data-project-id="'+id+'"]').click();await settle(pair.new)}
async function menus(pair,position){for(const p of [pair.old,pair.new])await task(p,'R23 7').click({button:'right',...(position?{position}:{})});await settle(pair.new)}
async function run(pair,locale,dark){
 const o=pair.old,n=pair.new,zh=locale!=='en',ok=zh?'确定':'OK',cancel=zh?'取消':'Cancel',evidence=[];
 await seed(pair);
 const previous=prior.find(x=>x.locale===locale&&x.dark===dark),checks=[];
 async function check(group,fn){
  const saved=previous?.checks?.find(x=>x.group===group);
  if(saved?.passed&&!process.env.FOCUS_TEST_GROUPS?.split(',').includes(group)){checks.push(saved);return}
  try{await fn();checks.push({group,passed:true});console.log('PASS',locale,dark?'dark':'light',group)}
  catch(error){checks.push({group,passed:false,error:String(error.stack||error)});console.error('FAIL',locale,dark?'dark':'light',group,error.message);await o.screenshot({path:path.join(out,'failure-old-'+locale+'-'+dark+'-'+group+'.png')});await n.screenshot({path:path.join(out,'failure-new-'+locale+'-'+dark+'-'+group+'.png')});await o.reload();await ready(o);await seed(pair)}
 }
 await check('status',async()=>{
 // Missing status icons: all 8 combinations, whitespace note, past/equal/future reminders.
 for(let mask=0;mask<8;mask++){
  const a=task(o,'R23 '+mask).locator('[class*=TaskItem-reminder],[class*=TaskItem-subtask],[class*=TaskItem-remark]').filter({visible:true}),b=task(n,'R23 '+mask).locator('.workspace-task-status');
  assert.equal(await b.count(),((mask&1)?1:0)+((mask&2)?1:0)+((mask&4)?1:0));assert.equal(await a.count(),await b.count(),"old status count mask "+mask);
  for(let i=0;i<await a.count();i++){evidence.push(await equal(a.nth(i),b.nth(i),'status '+mask+' '+i,['x','y','width','height','backgroundSize']));await artwork(a.nth(i),b.nth(i))}
 }
 for(const name of ['R23 boundary','R23 future'])await artwork(task(o,name).locator('[class*=TaskItem-reminder]'),task(n,name).locator('.workspace-task-reminder'));
 });
 await check('profile',async()=>{
 // #8 profile menu content, geometry, hover and account action.
 await o.locator('[class*=HomeHeader-username]').click();await n.locator('.workspace-profile').click();await settle(n);
 evidence.push(await equal(o.locator('[class*=UserDropdownMenu-menuContainer]'),n.locator('.workspace-profile-menu'),'profile menu',['x','y','width','height','background','borderRadius']));
 assert.deepEqual(await n.locator('.workspace-profile-menu>button').allTextContents(),await o.locator('[class*=UserDropdownMenu-menu-K]').allTextContents());
 await o.locator('[class*=UserDropdownMenu-menu-K]').hover();await n.locator('.workspace-profile-menu>button').hover();await equal(o.locator('[class*=UserDropdownMenu-menu-K]'),n.locator('.workspace-profile-menu>button'),'profile hover',['background','color']);
 await n.locator('.workspace-profile-menu>button').click();await n.getByTestId('settings-page').waitFor();assert(await n.locator('.legacy-account-row').count()>0);await n.getByTestId('close-page').click();await blank(pair);
 });
 await check('footer',async()=>{
 // #10 footer artwork hit areas, unaffected project editor; parent footer CSS cannot leak.
 await equal(o.locator('[class*=ProjectNewItem-tag]'),n.locator('.workspace-sidebar>footer>button').nth(1),'tag footer');
 await equal(o.locator('[class*=ProjectNewItem-folder]'),n.locator('.workspace-sidebar>footer>button').nth(2),'folder footer');
 await o.locator('[class*=ProjectNewItem-title]').click();await n.locator('.workspace-sidebar>footer>button').first().click();await settle(n);
 await equal(o.locator('[class*=ProjectEditer-confirm]'),n.locator('.legacy-project-editor footer .primary'),'project editor button');
 await o.locator('[class*=ProjectEditer-cancel]').click();await n.locator('.legacy-project-editor footer button').first().click();await settle(n);
 });
 await check('tags',async()=>{
 await open(pair);
 // Added sidebar tag requirements: chips, removal and add-tag trigger.
 evidence.push(await equal(o.locator('[class*=Tag-root]').first(),n.locator('.legacy-detail-tag').first(),'selected sidebar tag',['x','y','width','height','background','borderRadius']));
 await equal(o.locator('[class*=TagAdd-root]'),n.locator('details.legacy-detail-tags>summary'),'add-tag trigger');
 await artwork(o.locator('[class*=TagAdd-icon]'),n.locator('.legacy-tag-add-content>.legacy-icon'));
 // #5 body portal extends left of the inspector and remains hit-testable.
 await o.locator('[class*=TagAdd-root]').click();await n.locator('details.legacy-detail-tags>summary').click();await settle(n);
 await equal(o.locator('.popover'),n.locator('.legacy-tags-popover'),'tag popup');
 assert(await n.locator('.legacy-tags-popover').evaluate(e=>{const r=e.getBoundingClientRect();return e.closest('.workspace-picker-surface').parentElement===document.body&&e.contains(document.elementFromPoint(r.x+20,r.y+20))}));
 await n.getByRole('checkbox',{name:'R23 tag',exact:true}).uncheck();await n.locator('.legacy-tags-picker').locator('button.primary').click();await settle(n);assert.equal(await n.locator('.legacy-detail-tag').count(),0);
 await blank(pair);await n.locator('details.legacy-detail-tags>summary').click();await n.getByRole('checkbox',{name:'R23 tag',exact:true}).check();await n.locator('.legacy-tags-picker').locator('button.primary').click();await blank(pair);
 });
 await check('priority',async()=>{
 await open(pair);
 // #6 independent priority options: no collision with horizontal context-menu icons.
 await o.locator('[class*=TitleItem-priority]').click();await n.locator('details.legacy-priority-picker>summary').click();await settle(n);
 evidence.push(await equal(o.locator('.popover'),n.locator('.legacy-detail-priority-options'),'priority popup'));
 assert.deepEqual(await n.locator('.legacy-detail-priority-options>button>span').allTextContents(),await o.locator('[class*=PriorityInput-title]').allTextContents());
 await o.locator('[class*=PriorityInput-option]').nth(2).click();await n.locator('.legacy-detail-priority-options>button').nth(2).click();await blank(pair);
 assert.equal((await rows(n,'Task')).find(x=>x.id==='status-7').priority,2);
 });
 await check('wheel',async()=>{
 await open(pair);
 // #3 shared native wheels: +60px = +2, click, hover, drag, snap, confirm persists.
 await o.locator('[class*=PomodoroItem-root]').click();await n.locator('details.legacy-detail-pomodoro>summary').click();await settle(n);
 await equal(o.locator('.popover'),n.locator('.legacy-pomodoro-popover'),'pomodoro popup');
 const a=o.locator('[class*=InputUL-options]').first(),b=n.locator('.legacy-scroll-wheel ul').first();
 await equal(a,b,'wheel',['width','height','background']);await a.hover();await b.hover();await o.mouse.wheel(0,60);await n.mouse.wheel(0,60);await n.waitForTimeout(850);
 assert.equal(await a.evaluate(e=>e.scrollTop),150);assert.equal(await b.evaluate(e=>e.scrollTop),150);
 await a.getByText('6',{exact:true}).click();await b.getByRole('option',{name:'6',exact:true}).click();await settle(n);
 await equal(a.getByText('6',{exact:true}),b.getByRole('option',{name:'6',exact:true}),'wheel hover',['background']);
 for(const [p,list]of [[o,a],[n,b]]){const r=await list.boundingBox();await p.mouse.move(r.x+30,r.y+75);await p.mouse.down();await p.mouse.move(r.x+30,r.y+15,{steps:4});await p.mouse.up()}
 await n.waitForTimeout(650);assert.equal(await a.evaluate(e=>e.scrollTop),await b.evaluate(e=>e.scrollTop));
 await o.locator('[class*=PomodoroInput-confirm]').click();await n.locator('.legacy-pomodoro-picker').locator('button.primary').click();await settle(n);
 assert.equal((await rows(n,'Task')).find(x=>x.id==='status-7').estimatePomoNum,(await o.evaluate(()=>FocusLocalData.snapshot())).indexedDB.Task.find(x=>x.id==='status-7').estimatePomoNum);
 });
 await check('submenu',async()=>{
 await open(pair);
 // #15 actual pointer traversal plus both viewport flips, then pick a date.
 for(const position of [{x:10,y:10},{x:600,y:35}]){
  await menus(pair,position);await o.getByText(zh?'设置到期日':'Set due date',{exact:true}).hover();await n.getByRole('menuitem',{name:zh?'设置到期日':'Set due date',exact:true}).hover();await settle(n);
  evidence.push(await equal(o.locator('[class*=Submenu-root]'),n.locator('.legacy-context-submenu'),'due-date submenu'));
  await n.locator('.legacy-context-submenu .legacy-date-month').hover();await n.waitForTimeout(240);assert(await n.locator('.legacy-context-submenu').isVisible(),'pointer can enter submenu');
  await blank(pair);
 }
 await menus(pair);await o.getByText(zh?'设置到期日':'Set due date',{exact:true}).hover();await n.getByRole('menuitem',{name:zh?'设置到期日':'Set due date',exact:true}).hover();await settle(n);
 await o.locator('[class*=Submenu-root] td.day:not(.old):not(.new)').filter({hasText:/^9$/}).click();await n.locator('.legacy-context-submenu button[aria-label="2026-11-09"]').click();await settle(n);
 assert.equal((await rows(n,'Task')).find(x=>x.id==='status-7').deadline,(await o.evaluate(()=>FocusLocalData.snapshot())).indexedDB.Task.find(x=>x.id==='status-7').deadline);
 });
 await check('confirm',async()=>{
 await nav(pair,'id-task-tasks');
 // #14 sidebar confirmation and #16 task confirmation share the same shell.
 await o.locator('#r23-list').click({button:'right'});await n.locator('.workspace-nav[data-project-id=r23-list]').click({button:'right'});await settle(n);
 await o.getByText(zh?'删除清单':'Delete Project',{exact:true}).click();await n.getByRole('menuitem',{name:zh?'删除清单':'Delete Project',exact:true}).click();await settle(n);
 await equal(o.locator('[class*=ConfirmDialog-root]'),n.locator('.legacy-task-delete'),'sidebar confirmation');await equal(o.locator('[class*=ConfirmDialog-confirm]'),n.locator('.legacy-task-delete .primary'),'sidebar confirm button');
 await o.locator('[class*=ConfirmDialog-cancel]').click();await n.locator('.legacy-task-delete').getByRole('button',{name:cancel,exact:true}).click();await settle(n);
 await menus(pair);await o.getByText(zh?'删除任务':'Delete Task',{exact:true}).click();await n.getByRole('menuitem',{name:zh?'删除任务':'Delete Task',exact:true}).click();await settle(n);
 await equal(o.locator('[class*=ConfirmDialog-root]'),n.locator('.legacy-task-delete'),'task confirmation');await equal(o.locator('[class*=ConfirmDialog-confirm]'),n.locator('.legacy-task-delete .primary'),'task confirm button');
 await o.locator('[class*=ConfirmDialog-cancel]').click();await n.locator('.legacy-task-delete').getByRole('button',{name:cancel,exact:true}).click();await settle(n);
 });
 await check('record',async()=>{
 // #10 manual record duration list, selected mark, scroll, original field artwork.
 await nav(pair,'id-task-history');await o.locator('[class*=TaskRegion-menu-2PouQ]').click();await n.locator('.legacy-history-add').click();await settle(n);
 await artwork(o.locator('[class*=TaskItem-icon-1JiDO]'),n.locator('.legacy-record-modal .legacy-record-field').nth(0).locator('.legacy-icon'));
 await artwork(o.locator('[class*=StartTimeItem-icon]'),n.locator('.legacy-record-modal .legacy-record-field').nth(1).locator('.legacy-icon'));
 await o.locator('[class*=IntervalItem-root]').click();await n.locator('.legacy-record-modal details.legacy-record-field').nth(2).locator('summary').click();await settle(n);
 await equal(o.locator('.popover'),n.locator('.legacy-record-duration-popover'),'duration menu');
 await equal(o.locator('[class*=IntervalInput-option]').filter({hasText:zh?'25分钟':'25 Minutes'}).first(),n.locator('.legacy-record-duration-picker>button[aria-selected=true]'),'duration selected row');
 assert.equal(await n.locator('.legacy-record-duration-picker>button').count(),480);
 await o.locator('[class*=IntervalInput-option]').filter({hasText:zh?'26分钟':'26 Minutes'}).first().click();await n.locator('.legacy-record-duration-picker>button').nth(25).click();await settle(n);assert.equal(await n.locator('.legacy-record-modal .legacy-record-field').nth(2).locator('.legacy-record-value').innerText(),zh?'26分钟':'26m');
 await o.locator('[class*=PomodoroNew-remove]').click();await n.locator('.legacy-record-modal footer').getByRole('button',{name:cancel,exact:true}).click();await settle(n);
 });
 await check('version',async()=>{
 // Independent candidate version; published history remains unchanged.
 await n.locator('[data-view=settings]').click();await n.getByTestId('settings-page').waitFor();await n.getByRole('button',{name:zh?'关于':'About',exact:true}).click();assert((await n.locator('.legacy-account-row').allTextContents()).some(s=>s.includes('2.0.0')));assert.equal(await n.title(),'FocusTodo 2.0.0');
 assert.equal((await rows(n,'LocalMeta')).find(x=>x.id==='client-protocol').appVersion,'2.0.0');
 });
 await check('record-inputs',async()=>{
  if(await n.locator('.domain-overlay[open]').count()){await n.getByTestId('close-page').click();await settle(n)}
  await nav(pair,'id-task-history');await o.locator('[class*=TaskRegion-menu-2PouQ]').click();await n.locator('.legacy-history-add').click();await settle(n);
  await o.locator('[class*=TaskItem-root-3BVzb]').click();await n.locator('.legacy-record-modal details.legacy-record-field').first().locator('summary').click();await settle(n);
  await equal(o.locator('.popover'),n.locator('.legacy-record-task-picker'),'record project popup');
  await o.locator('[class*=ProjectInput-option]').first().hover();await n.locator('.legacy-record-project-option').first().hover();await equal(o.locator('[class*=ProjectInput-option]').first(),n.locator('.legacy-record-project-option').first(),'record project hover',['x','y','width','height','background']);
  await o.locator('[class*=ProjectInput-option]').first().click();await n.locator('.legacy-record-project-option').first().click();await settle(n);
  await n.locator('.legacy-record-project-option').first().click();await n.waitForTimeout(40);assert.equal(await n.locator('.legacy-record-task-submenu.is-closing').count(),1);await n.waitForTimeout(150);assert.equal(await n.locator('.legacy-record-task-submenu').count(),0);await n.locator('.legacy-record-project-option').first().click();await settle(n);
  await equal(o.locator('[class*=TaskInput-root]'),n.locator('.legacy-record-task-submenu'),'record task submenu');
  assert.deepEqual(await n.locator('.legacy-record-task-scroll button>span').allTextContents(),await o.locator('[class*=TaskInput-name]').allTextContents(),'record tasks retain legacy primary-key order');
  await o.locator('[class*=TaskInput-option]').first().hover();await n.locator('.legacy-record-task-scroll button').first().hover();await equal(o.locator('[class*=TaskInput-option]').first(),n.locator('.legacy-record-task-scroll button').first(),'record task hover',['background','fontSize']);
  await o.locator('[class*=TaskInput-option]').first().click();await n.locator('.legacy-record-task-scroll button').first().click();await settle(n);
  await equal(o.locator('[class*=TaskItem-delete-1NiV8]'),n.locator('.legacy-record-unlink'),'record unlink hit area');
  await artwork(o.locator('[class*=TaskItem-delete-1NiV8]'),n.locator('.legacy-record-unlink'));
  await o.locator('[class*=TaskItem-delete-1NiV8]').click();await n.locator('.legacy-record-unlink').click();await settle(n);assert.equal(await n.locator('.legacy-record-unlink').count(),0);
  await o.locator('[class*=StartTimeItem-root]').click();await n.locator('.legacy-record-modal details.legacy-record-field').nth(1).locator('summary').click();await settle(n);
  await equal(o.locator('.popover'),n.locator('.legacy-date-popover'),'record start-time popup');await equal(o.locator('[class*=StartTimeInput-timepicker]'),n.locator('.legacy-record-time'),'record time controls');
  for(let i=0;i<2;i++)await equal(o.locator('[class*=StartTimeInput-timepicker] select').nth(i),n.locator('.legacy-record-time select').nth(i),'record time select '+i,['x','y','width','height','fontSize']);
  await o.locator('[class*=StartTimeInput-timepicker] select').first().selectOption('11');await n.getByRole('combobox',{name:zh?'小时':'Hours',exact:true}).selectOption('11');
  await o.locator('[class*=StartTimeInput-timepicker] select').nth(1).selectOption('00');await n.getByRole('combobox',{name:zh?'分钟':'Minutes',exact:true}).selectOption('0');
  await o.locator('[class*=StartTimeInput-confirm]').click();await n.locator('.legacy-date-picker footer .primary').click();await settle(n);
  assert.equal(await n.locator('.legacy-record-modal .legacy-record-value').nth(1).innerText(),await o.locator('[class*=StartTimeItem-value] span').innerText(),'record start time period');
  await o.locator('[class*=StartTimeItem-root]').click();await n.locator('.legacy-record-modal details.legacy-record-field').nth(1).locator('summary').click();await settle(n);
  await o.locator('[class*=StartTimeInput-remove]').click();await n.locator('.legacy-date-picker footer>button').first().click();await settle(n);assert.equal(await n.locator('.workspace-picker-surface').count(),0,'start-time Cancel closes only its popup');assert.equal(await n.locator('.legacy-record-modal[open]').count(),1);
  await o.locator('[class*=PomodoroNew-confirm]').click();await n.locator('.legacy-record-modal footer .primary').click();await settle(n);assert.equal(await n.locator('.legacy-record-modal[open]').count(),0,'record confirmation saves and closes');
  const expected=(await o.evaluate(()=>FocusLocalData.snapshot())).indexedDB.Pomodoro.at(-1),saved=(await rows(n,'Pomodoro')).at(-1);for(const key of ['endDate','interval','taskId'])assert.equal(saved[key],expected[key],'manual record persists '+key);

 });
 await check('motion',async()=>{
  // Compare real entry frames, then the actual 120ms menu exit lifetime.
  if(await n.locator('.domain-overlay[open]').count()){await n.getByTestId('close-page').click();await settle(n)}
  const sample=(p,selector)=>p.evaluate(selector=>new Promise(resolve=>{let start=null;const values=[],limit=performance.now()+2000;function tick(){const now=performance.now(),el=document.querySelector(selector);if(el){start??=now;values.push(new DOMMatrixReadOnly(getComputedStyle(el).transform).a)}if(start!==null&&now-start>300||now>limit)resolve(values);else requestAnimationFrame(tick)}requestAnimationFrame(tick)}),selector);
  const oldFrames=sample(o,'[class*=UserDropdownMenu-menuContainer]'),newFrames=sample(n,'.workspace-profile-menu');
  await o.locator('[class*=HomeHeader-username]').click();await n.locator('.workspace-profile').click();
  const frames=await Promise.all([oldFrames,newFrames]);for(let i=0;i<2;i++)assert(frames[i].some(scale=>scale>.1&&scale<1),'profile menu entry frames '+i+': '+frames[i].join(','));
  await settle(n);await o.mouse.click(700,25);await n.mouse.click(700,25);await n.waitForTimeout(40);
  assert(await n.locator('.workspace-profile-menu').count()>0,'exit remains mounted during transition');await settle(n);assert.equal(await n.locator('.workspace-profile-menu').count(),0);
  await nav(pair,'id-task-tasks');await menus(pair);await n.getByRole('menuitem',{name:zh?'设置到期日':'Set due date',exact:true}).hover();await settle(n);
  await n.locator('.legacy-context-submenu').hover();await n.mouse.move(700,25);await n.waitForTimeout(235);
  assert.equal(await n.locator('.legacy-context-submenu.is-closing').count(),1,'submenu retains its exit surface');await n.waitForTimeout(160);assert.equal(await n.locator('.legacy-context-submenu').count(),0);await blank(pair);
 });
 await check('tag-wrap',async()=>{
  await o.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('PomodoroDB6',3);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['Project','Task'],'readwrite'),projects=tx.objectStore('Project');for(let i=0;i<3;i++)projects.put({id:'r23-extra-'+i,type:3000,name:'R23 long sidebar tag '+i,color:'F4658C',state:0,order:920000+i});const q=tx.objectStore('Task').get('status-7');q.onsuccess=()=>tx.objectStore('Task').put({...q.result,tags:'r23-tag,r23-extra-0,r23-extra-1,r23-extra-2'});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}));
  await o.reload();await ready(o);await copyFixture(pair);await nav(pair,'id-task-tasks');await open(pair);
  await equal(o.locator('[class*=TagItem-root]'),n.locator('.legacy-detail-tag-row'),'wrapped tag region');
  assert.equal(await n.locator('.legacy-detail-tag').count(),4);for(let i=0;i<4;i++)await equal(o.locator('[class*=Tag-root]').nth(i),n.locator('.legacy-detail-tag').nth(i),'wrapped tag '+i,['x','y','width','height','background']);
  await equal(o.locator('[class*=TagAdd-root]'),n.locator('details.legacy-detail-tags>summary'),'wrapped add-tag trigger');
  await n.locator('.legacy-detail-tag>button').first().click();await settle(n);await n.reload();await n.getByTestId('app-shell').waitFor();await n.locator('.workspace-nav[data-project-id=id-task-tasks]').click();await task(n,'R23 7').locator('.workspace-task-name').click();assert.equal(await n.locator('.legacy-detail-tag').count(),3,'removing one chip preserves remaining tags after reload');
 });
 await assertNoLegacyRuntime(n,pair.handles[1].requests);
 for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.equal(h.requests.some(url=>new URL(url).port==='5500'),false)}
 return {locale,dark,evidence,checks};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
  if(process.env.FOCUS_TEST_FILTER&&!new RegExp(process.env.FOCUS_TEST_FILTER).test(locale+' '+(dark?'dark':'light')))continue;
  const pair=await paired({locale,dark,reducedMotion:'no-preference'});
  try{results.push(await run(pair,locale,dark));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2))}
  catch(error){await pair.old.screenshot({path:path.join(out,'failure-old-'+locale+'-'+dark+'.png')});await pair.new.screenshot({path:path.join(out,'failure-new-'+locale+'-'+dark+'.png')});throw error}
  finally{await pair.close()}
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));const failed=results.flatMap(x=>x.checks.filter(c=>!c.passed).map(c=>({locale:x.locale,dark:x.dark,...c})));console.log(JSON.stringify({combinations:results.length,groups:results.reduce((sum,x)=>sum+x.checks.length,0),failed:failed.length}));if(failed.length)throw new Error(failed.length+' component group(s) failed');
})().catch(error=>{console.error(error);process.exitCode=1});
