/* Compare reports with isolated contexts and generated records only. */
const {paired,copyFixture,metrics,assert,fs,path}=require('./ui-restore-helpers.cjs');
const output=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'.agent-temp/d-v-reports');
const results=[];
const {seed}=require('./ui-fixtures.cjs');
function near(a,b,label,props=['x','y','width','height']){for(const prop of props)assert(Math.abs(a[prop]-b[prop])<=1,`${label}.${prop}: ${a[prop]} vs ${b[prop]}`)}
async function colors(page,selector){return page.locator(selector).evaluate(canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();for(let i=0;i<d.length;i+=4)if(d[i+3])colors.add([d[i],d[i+1],d[i+2]].join(','));return [...colors]})}
async function reports(pair){await pair.old.locator('[class*=HomeHeader-report]').click();const p=pair.new;await p.evaluate(()=>{window.reportFrames=[];const start=performance.now(),sample=()=>{const root=document.querySelector('[data-testid=reports-page]');if(root)window.reportFrames.push({t:performance.now()-start,busy:root.getAttribute('aria-busy'),reveal:document.querySelector('.legacy-review-scroll canvas')?.dataset.reveal,height:document.querySelector('.legacy-review-scroll canvas')?.clientHeight,pixels:document.querySelector('.legacy-review-scroll canvas')?.height,dpr:devicePixelRatio});if(performance.now()-start<500)requestAnimationFrame(sample)};requestAnimationFrame(sample)});await pair.new.locator('[data-view=reports]').click();await pair.new.getByTestId('report-total').waitFor();await pair.old.waitForTimeout(350)}
async function closeReports(pair){await pair.old.locator('[class*=Report-close]').click();await pair.new.getByTestId('close-page').click()}
async function run(locale,dark){
 const zh=locale.startsWith('zh'),pair=await paired({locale,dark,reducedMotion:'no-preference'}),o=pair.old,p=pair.new,key=locale+'-'+(dark?'dark':'light');
 try{
  await reports(pair);assert.equal(await p.locator('.legacy-report-empty').count(),2);assert.equal(await p.getByTestId('report-total').innerText(),'0');await closeReports(pair);
  await seed(pair);
  // The sidebar and all flat list selectors consume the same stored order.
  const expected=[zh?'任务':'Tasks','Blue list','Red list','Green list'];
  await p.locator('.workspace-quick-project').click();
  assert.deepEqual(await p.locator('.workspace-picker-surface.workspace-quick-project-picker [role=option]>span:nth-child(2)').allTextContents(),expected);
  await p.keyboard.press('Escape');
  await p.getByRole('button',{name:'Blue list',exact:true}).first().click();
  await p.locator('.workspace-task-name').filter({hasText:'Reports task 4'}).click();
  await p.locator('.workspace-details .legacy-detail-field').filter({has:p.locator('summary>img[src*=detail-project]')}).locator('summary').click();
  assert.deepEqual(await p.locator('.workspace-picker-surface .legacy-project-options [role=option]>span:nth-child(2)').allTextContents(),expected);
  await p.keyboard.press('Escape');await p.locator('.legacy-detail-bottom').getByRole('button',{name:zh?'关闭':'Close',exact:true}).click();
  // History headings, grouping, duration and actual row geometry use the oracle.
  await o.getByText(zh?'已完成':'Completed',{exact:true}).first().click();await p.getByRole('button',{name:zh?'已完成':'Completed',exact:true}).click();
  await o.locator('[class*=HistoryItemGroup-title]').waitFor();
  assert.equal(await p.locator('.legacy-history-day h2').first().innerText(),await o.locator('[class*=HistoryItemGroup-title]').first().innerText());
  const oldHistory=await metrics(o,{task:'[class*=HistoryTaskItem-task]',record:'[class*=HistoryPomodoroItem-root]'}),newHistory=await metrics(p,{task:'.legacy-history-task',record:'.domain-history-row'});
  near(oldHistory.task,newHistory.task,'history task');near(oldHistory.record,newHistory.record,'history record');
  assert.deepEqual(await p.locator('.legacy-history-record-title small').allTextContents(),await o.locator('[class*=HistoryPomodoroItem-interval]').allTextContents());
  assert.equal(await p.locator('.workspace-summary').isVisible(),false);
  await p.locator('.domain-history-row').first().hover();const hovered=await p.locator('.domain-history-row').first().evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(hovered,'rgba(0, 0, 0, 0)');
  // Folder controls: same typography/geometry, original image decodes in Vite.
  for(const [page,isOld]of [[o,true],[p,false]]){await page.getByText('Reports folder',{exact:true}).first().click({button:'right'});await page.getByText(zh?'编辑清单夹':'Edit Folder',{exact:true}).last().click();}
  await o.locator('[class*=FolderEditer-root]').waitFor();await p.locator('.legacy-project-editor[open]').waitFor();
  const oldFolder=await metrics(o,{cancel:'[class*=FolderEditer-cancel]',confirm:'[class*=FolderEditer-confirm]',create:'[class*=FolderEditer-createOption-]',plus:'[class*=FolderEditer-createOptionIcon]'}),newFolder=await metrics(p,{cancel:'.legacy-project-editor footer button',confirm:'.legacy-project-editor footer .primary',create:'.legacy-folder-lists>button',plus:'.legacy-folder-lists>button>i'});
  for(const part of Object.keys(oldFolder)){near(oldFolder[part],newFolder[part],'folder '+part);assert.equal(oldFolder[part].font,newFolder[part].font);assert.equal(oldFolder[part].color,newFolder[part].color)}
  assert(await p.locator('.legacy-project-palette img').evaluate(e=>e.complete&&e.naturalWidth>0));
  for(const label of ['#4670F6','#EC6B66']){await p.getByRole('button',{name:label,exact:true}).click();assert(await p.getByRole('button',{name:label,exact:true}).locator('img').evaluate(e=>e.naturalWidth>0))}
  await o.locator('[class*=FolderEditer-cancel]').click();await p.locator('.legacy-project-editor footer button').first().click();
  // Observe the actual opening sequence, then compare the settled frame.

  await reports(pair);
  const opening=await p.evaluate(()=>window.reportFrames);assert(opening.filter(row=>row.height).every(row=>Math.abs(row.pixels-row.height*row.dpr)<=1),'Every visible frame uses final canvas geometry');assert(opening.some(row=>Number(row.reveal)>0&&Number(row.reveal)<1),'Records reveal progressively: '+JSON.stringify(opening));
  assert.equal(await p.locator('.legacy-review-scroll canvas').getAttribute('data-reveal'),'1');
  const oldMetrics=await metrics(o,{frame:'[class*=Report-width]',stat:'[class*=Summary-item]',review:'[class*=ReviewChart-root]',focus:'[class*=FocusTime-root]',distribution:'[class*=ProjectChart-root]',goals:'[class*=DailyGoal-root]',bar:'[class*=BarChart-root]'}),nextMetrics=await metrics(p,{frame:'.legacy-reports',stat:'.legacy-report-stat',review:'.legacy-review-chart',focus:'.legacy-focus-time',distribution:'.legacy-project-chart',goals:'.legacy-goals',bar:'.legacy-bar-chart'});
  for(const part of Object.keys(oldMetrics))near(oldMetrics[part],nextMetrics[part],'report '+part);
  const oc=await o.locator('[class*=Report-close] img').boundingBox(),pc=await p.getByTestId('close-page').boundingBox();near({x:oc.x,y:oc.y},{x:pc.x,y:pc.y+16},'close artwork',['x','y']);
  assert(await p.evaluate(()=>{const timer=document.querySelector('.workspace-floating-timer'),r=timer.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('.legacy-report-overlay')!==null}),'Report covers timer');
  assert.equal(await p.getByTestId('report-total').innerText(),String(Math.round((3620+1500+90+30+25)/60*100)/100));
  assert.equal(await p.locator('.legacy-doughnut-slice').count(),3,'Two sub-5% slices group as Other');
  assert.equal(await p.locator('.legacy-doughnut-slice text').count(),6,'Every chart slice has duration and name guides');
  assert.deepEqual(await p.locator('.domain-distribution small').allTextContents(),await o.locator('[class*=ProjectChart-projectdata]').allTextContents());
  // The intentionally corrected previous-month dates must never regress.
  assert.deepEqual(await p.locator('.domain-goal-grid>button>span').allTextContents().then(rows=>rows.slice(0,6)),['26','27','28','29','30','31']);
  for(const [label,value]of [[zh?'周':'Weekly','week'],[zh?'月':'Monthly','month'],[zh?'年':'Yearly','year']]){
   await p.getByRole('group',{name:(zh?'报表周期':'Report period')+' options',exact:true}).getByRole('button',{name:label,exact:true}).click();
   assert(Number(await p.getByTestId('report-total').innerText())>0);
   assert.equal(await p.getByLabel(zh?'报表周期':'Report period',{exact:true}).inputValue(),value);
  }
  await p.getByRole('group',{name:(zh?'报表周期':'Report period')+' options',exact:true}).getByRole('button',{name:zh?'周':'Weekly',exact:true}).click();assert((await p.locator('.legacy-focus-time .legacy-report-date label').innerText()).includes('-'));
  await p.locator('.legacy-focus-mode>button').click();for(const mode of [zh?'显示清单':'Show Projects',zh?'显示标签':'Show Tags',zh?'显示任务':'Show Tasks']){const option=p.getByRole('menuitem',{name:mode,exact:true});assert.equal(await option.count(),1);await option.click();await p.locator('.legacy-focus-mode>button').click()}await p.keyboard.press('Escape');
  // Wheel movement stays inside the goal picker, outer page scroll dismisses it.
  await p.locator('.legacy-goals header button').click();const wheel=p.locator('.legacy-goal-popover [role=listbox]');await wheel.focus();await p.keyboard.press('ArrowDown');assert.equal(await wheel.locator('[aria-selected=true]').innerText(),zh?'4小时':'4h');
  const before=await wheel.evaluate(e=>e.scrollTop);await wheel.hover();await p.mouse.wheel(0,35);await p.waitForTimeout(80);assert((await wheel.evaluate(e=>e.scrollTop))>before);assert.equal(await p.locator('.legacy-goal-popover').count(),1);
  await p.locator('.legacy-report-overlay>.domain-overlay-body').evaluate(e=>e.scrollTop=30);await p.locator('.legacy-goal-popover').waitFor({state:'hidden'});
  await p.locator('.legacy-goals header button').click();await p.locator('.legacy-goal-popover [role=listbox]').focus();await p.keyboard.press('ArrowUp');await p.locator('.legacy-goal-popover footer .primary').click();await p.locator('.legacy-goal-popover').waitFor({state:'hidden'});
  assert((await p.evaluate(()=>JSON.parse(localStorage.getItem('FocusTodoStandalone.data.Goals')).at(-1).value))===120);
  // Every chart granularity retains fifteen real buckets and returns to day.
  for(const label of [zh?'时长图周期':'Focus chart period',zh?'任务图周期':'Task chart period'])for(const value of ['week','month','year','day']){await p.getByLabel(label,{exact:true}).selectOption(value);await p.waitForTimeout(20);assert.equal(JSON.parse(await p.locator('.legacy-bar-canvas').first().getAttribute('data-series')).length,15)}
  // Both chart types retain every contributing list color, including task counts.
  for(let i=0;i<2;i++){const painted=await colors(p,`.legacy-bar-chart:nth-child(${i+1}) canvas`);for(const color of ['70,112,246','236,107,102','160,206,98'])assert(painted.includes(color),'Stacked chart '+i+' color '+color)}
  await p.locator('.legacy-report-overlay>.domain-overlay-body').evaluate(e=>e.scrollTop=9999);await o.locator('[class*=Report-scrollContent]').evaluate(e=>e.scrollTop=9999);
  const graph=p.locator('.legacy-bar-canvas').last(),r=await graph.boundingBox(),left=Number(await graph.getAttribute('data-chart-left'));await p.mouse.move(r.x+left+(r.width-left-15)+7,r.y+150);await p.waitForTimeout(20);assert((await colors(p,'.legacy-bar-chart:last-child canvas')).includes('253,85,83'),'Real bar hover paints the red tooltip');
  const fault=await p.addStyleTag({content:'.legacy-report-overlay{z-index:1!important}'});assert.equal(await p.evaluate(()=>{const timer=document.querySelector('.workspace-floating-timer'),r=timer.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('.legacy-report-overlay')!==null}),false,'Occlusion regression is detectable');await fault.evaluate(e=>e.remove());
  await p.screenshot({path:path.join(output,key+'-new-bars.png')});await o.screenshot({path:path.join(output,key+'-old-bars.png')});
  await closeReports(pair);await p.reload();await p.getByTestId('app-shell').waitFor();await p.locator('[data-view=reports]').click();await p.locator('.legacy-goals header button').waitFor();assert((await p.locator('.legacy-goals header button').innerText()).includes('2'));
  for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}
  results.push({key,passed:true,checks:['global selector order','history rows and formats','folder controls and original check image','base paint and progressive records','report frame geometry','timer occlusion and negative control','all distribution labels/legend','correct goal dates','periods and filters','native goal wheel and outer scroll','goal persistence','both colored charts and hover']});
 }finally{await pair.close()}
}
module.exports={seed};
if(require.main===module)(async()=>{fs.mkdirSync(output,{recursive:true});for(const locale of ['zh-CN','en'])for(const dark of [false,true]){await run(locale,dark);console.log(locale+' '+(dark?'dark':'light')+' passed')}fs.writeFileSync(path.join(output,'reports-results.json'),JSON.stringify({results},null,2))})().catch(error=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'reports-failure.json'),JSON.stringify({error:error.stack,results},null,2));console.error(error.stack);process.exitCode=1});
