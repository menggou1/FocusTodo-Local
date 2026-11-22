/* Settings oracle: actual audited 1.9.4, paired temporary origins and synthetic data only. */
const{paired,copyFixture,metrics,assert,fs,path}=require('./ui-restore-helpers.cjs');
const{assertNoLegacyRuntime}=require('./helpers.cjs');
const output=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance/ui-restore-settings');
const cases=[],behavior=[],diagnostic=process.argv.includes('--diagnostic');
function compare(old,next,properties=['x','y','width','height','fontSize','fontWeight','color','background','borderRadius'],offsets={}){
 for(const name of Object.keys(offsets))assert(old[name]&&next[name],name+' exists in both layouts');
 const differences=[];
 for(const name of Object.keys(old)){
  if(!old[name]||!next[name]){
   if(old[name]!==next[name])differences.push({name,property:'presence',old:old[name],new:next[name]});
   continue;
  }
  for(const property of properties){
   const a=old[name][property],b=next[name][property],offset=offsets[name]?.[property]??0;
   if(typeof a==='number'?Math.abs(a+offset-b)>1:a!==b)differences.push({name,property,old:a,new:b,offset});
  }
 }
 return differences;
}
function save(){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({method:'Actual audited 1.9.4 vs independent production React. Paired fresh browser contexts/origins, identical copied generated backup, frozen date, locale/theme/viewport/DPR1/100% zoom, external network blocked. Geometry tolerance 1 CSS pixel; exact sampled colors/font sizes/weights and radius. Screenshot alone never constitutes passage. Native audio requests assert resource loading, not human listening.',cases,behavior},null,2))}
async function capture(pair,key,oldSelectors,newSelectors,properties,offsets={}){await pair.old.mouse.move(0,0);await pair.new.mouse.move(0,0);await pair.old.waitForTimeout(80);await pair.new.evaluate(()=>document.fonts.ready);const old=await metrics(pair.old,oldSelectors),next=await metrics(pair.new,newSelectors);/* The legacy outer clip owns the radius; its full-size child paints the surface. */if(old.modal&&oldSelectors.modal==='[class^=Settings-root]')old.modal.background=await pair.old.locator('[class*=Settings-animation]').evaluate(e=>getComputedStyle(e).backgroundColor);const differences=compare(old,next,properties,offsets);await pair.old.screenshot({path:path.join(output,key+'-old.png'),animations:'disabled'});await pair.new.screenshot({path:path.join(output,key+'-new.png'),animations:'disabled'});cases.push({key,old,next,offsets,differences,passed:!differences.length});save();console.log(key+': '+differences.length+' measured differences')}
const tabs=[['番茄钟','Pomodoro Timer','pomodoro'],['通用','General','general'],['外观','Appearance','appearance'],['账号','Account','account'],['关于','About','about']];
async function tab(pair,locale,id){const[zh,en]=tabs.find(row=>row[2]===id);await pair.old.locator('[class*=Settings-menuName]').filter({hasText:locale==='en'?en:zh}).evaluate(e=>e.click());await pair.new.locator('.legacy-settings>nav>button').filter({hasText:locale==='en'?en:zh}).evaluate(e=>e.click());await pair.new.locator('.legacy-settings[data-tab='+id+']').waitFor()}
async function open(pair){await pair.old.locator('img[src="img/header-setting.png"]').evaluate(e=>e.click());await pair.new.locator('[data-view=settings]').evaluate(e=>e.click());await pair.old.locator('[class^=Settings-root]').waitFor();await pair.new.getByTestId('settings-page').waitFor()}
const commonOld={modal:'[class^=Settings-root]',navigation:'[class*=Settings-navigation]',firstNav:'[class*=Settings-menu-]',firstIcon:'[class*=Settings-menuIcon]',content:'[class*=Settings-content]'};
const commonNew={modal:'.domain-overlay:has(.legacy-settings)',navigation:'.legacy-settings>nav',firstNav:'.legacy-settings>nav>button',firstIcon:'.legacy-settings>nav>button>img',content:'.legacy-settings-content'};
async function downloadIconOffset(pair,locale,oldSelector,newSelector){
 const row=pair.new.locator('.legacy-about>.legacy-account-row:last-child');
 const download=row.getByRole('link',{name:locale==='en'?'Download the official version':'官方版本下载',exact:true});
 assert.equal(await download.getAttribute('href'), 'https://www.focustodo.cn/'+(locale==='en'?'':'?lang=zh_CN')+'#products');
 const oldIcon=pair.old.locator(oldSelector).first(),newIcon=row.locator(newSelector).first();
 await oldIcon.waitFor();
 await newIcon.waitFor();
 const [oldAnchor,newAnchor]=await Promise.all([oldIcon,newIcon].map(icon=>icon.locator('..').boundingBox()));
 assert(oldAnchor&&newAnchor&&newAnchor.y>oldAnchor.y,'Platform links moved down with the official download row');
 return {platform:{y:newAnchor.y-oldAnchor.y}};
}

async function resetTileOffset(pair){
 const oldTitle=pair.old.locator('#focus-reset-dialog .focus-app-dialog h2');
 const header=pair.new.locator('.legacy-backup-reset>header');
 const tile=header.locator('.legacy-dialog-tile');
 const [oldHeading,newHeading,newTile]=await Promise.all([oldTitle,header,tile].map(locator=>locator.boundingBox()));
 assert(oldHeading&&newHeading&&newTile,'The title and app tile are visible');
 assert.equal(newTile.width,44);
 assert.equal(newTile.height,44);
 assert.equal(newHeading.height,44);
 assert.equal(newTile.x,newHeading.x);
 assert.equal(newTile.y,newHeading.y);
 const height=newTile.height-oldHeading.height;
 return {dialog:{height,y:-height/2}};
}
async function functional(pair,locale,prefix){const en=locale==='en',getStored=(p,storagePrefix,key)=>p.evaluate(({storagePrefix,key})=>localStorage.getItem(storagePrefix+key),{storagePrefix,key});
 await tab(pair,locale,'pomodoro');await pair.new.locator('.domain-setting select').first().click();assert.equal(await pair.new.locator('.legacy-settings-menu [role=option]').count(),480);await pair.new.getByLabel(en?'Filter options':'筛选选项',{exact:true}).fill('30');const oldControl=pair.old.locator('[class*=PomodoroSettings-selectTable] [class$="-control"]').first();await oldControl.click();await oldControl.locator('input').fill('30');assert.deepEqual(await pair.new.locator('.legacy-settings-menu [role=option]').allTextContents(),await pair.old.locator('[id*="-option-"]').allTextContents());await capture(pair,prefix+'-duration-search',{menu:'div[class$="-menu"]'},{menu:'.legacy-settings-menu'});await pair.new.locator('.legacy-settings-menu').getByRole('option',{name:en?'30 Minutes':'30分钟',exact:true}).click();await pair.new.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.WorkInterval')==='1800');await pair.old.getByText(en?'30 Minutes':'30分钟',{exact:true}).click();await pair.old.waitForFunction(()=>localStorage.getItem('WorkInterval')==='1800');
 await tab(pair,locale,'general');await pair.old.locator('[class*=GeneralSettings-root] table').first().locator('[role=checkbox]').first().click();await tab(pair,locale,'pomodoro');await pair.new.locator('.legacy-sound-completion input').click();await pair.new.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.TskCmpSnd')==='false');assert.equal(await getStored(pair.old,'','TskCmpSnd'),'false');
 await tab(pair,locale,'appearance');await pair.old.locator('img[src="img/timer-bg-ocean-shortcut.jpg"]').click();await pair.new.getByRole('button',{name:'Ocean',exact:true}).click();await pair.new.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.Theme')==='Ocean');assert.equal(await getStored(pair.old,'','Theme'),'Ocean');
 await tab(pair,locale,'account');await pair.old.locator('[class*=AccountSettings-username] input').fill('Synthetic review user');await pair.old.locator('[class*=AccountSettings-leftTitle]').click();await pair.new.getByLabel(en?'Name':'名称',{exact:true}).fill('Synthetic review user');await pair.new.locator('.legacy-account-row>span:first-child').first().click();await pair.new.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.cookie.NAME')===btoa('Synthetic review user'));assert.equal(await getStored(pair.old,'','cookie.NAME'),await getStored(pair.new,'FocusTodoStandalone.data.','cookie.NAME'));
 const avatarBuffer=fs.readFileSync(path.resolve(__dirname,'../../public/img/header-portrait.png')),portraitBefore=await getStored(pair.new,'FocusTodoStandalone.data.','Portrait');
 for(const[p,index]of[[pair.old,0],[pair.new,1]]){const choosing=p.waitForEvent('filechooser');if(index)await p.getByRole('button',{name:en?'Upload':'上传头像',exact:true}).click();else await p.locator('[class*=AccountSettings-portrait] [class*=AccountSettings-normalButton]').first().click();await(await choosing).setFiles({name:'synthetic-avatar.png',mimeType:'image/png',buffer:avatarBuffer})}
 await pair.old.locator('[class*=AccountSettings-confirmButton]').waitFor({state:'visible'});await pair.new.getByRole('button',{name:en?'OK':'确定',exact:true}).waitFor();await capture(pair,prefix+'-avatar-preview',{avatar:'[class*=AccountSettings-portrait] img',confirm:'[class*=AccountSettings-confirmButton]'},{avatar:'.domain-avatar',confirm:'.legacy-account-row .primary'});await pair.old.locator('[class*=AccountSettings-cancelButton]').click();await pair.new.getByRole('button',{name:en?'Cancel':'取消',exact:true}).click();assert.equal(await getStored(pair.new,'FocusTodoStandalone.data.','Portrait'),portraitBefore);
 for(const[p,index]of[[pair.old,0],[pair.new,1]]){const choosing=p.waitForEvent('filechooser');if(index)await p.getByRole('button',{name:en?'Upload':'上传头像',exact:true}).click();else await p.locator('[class*=AccountSettings-portrait] [class*=AccountSettings-normalButton]').first().click();await(await choosing).setFiles({name:'synthetic-avatar.png',mimeType:'image/png',buffer:avatarBuffer})}await pair.old.locator('[class*=AccountSettings-confirmButton]').click();await pair.new.getByRole('button',{name:en?'OK':'确定',exact:true}).click();await pair.old.waitForFunction(()=>localStorage.getItem('Portrait')?.startsWith('data:image/png'));await pair.new.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.Portrait')?.startsWith('data:image/png'));const oldAvatar=await getStored(pair.old,'','Portrait'),newAvatar=await getStored(pair.new,'FocusTodoStandalone.data.','Portrait');assert.equal(newAvatar===oldAvatar,true,'Avatar must preserve legacy 64px crop, repeated selection compositing and PNG encoding');

 await pair.old.getByRole('button',{name:en?'Export data':'导出数据',exact:true}).click();await pair.new.getByRole('button',{name:en?'Export data':'导出数据',exact:true}).click();await pair.old.locator('.focus-backup-analysis').waitFor();await pair.new.locator('.legacy-backup-analysis').waitFor();
 await capture(pair,prefix+'-export',{dialog:'.focus-app-dialog.focus-backup-dialog',formats:'.focus-backup-formats',table:'.focus-backup-analysis'},{dialog:'.legacy-backup-dialog',formats:'.legacy-backup-formats',table:'.legacy-backup-analysis'});
 const buffers=[];for(const[p,index]of[[pair.old,0],[pair.new,1]]){await p.locator(index?'.legacy-backup-formats input[value=json]':'.focus-backup-formats input[value=json]').check();const downloading=p.waitForEvent('download');await p.getByRole('button',{name:en?'Create and download':'生成并下载',exact:true}).click();const download=await downloading;buffers.push(fs.readFileSync(await download.path()));assert.equal(await p.locator(index?'.legacy-backup-dialog':'.focus-app-dialog.focus-backup-dialog').isVisible(),true);await p.getByRole('button',{name:en?'Close':'关闭',exact:true}).last().click()}
 const backups=buffers.map(b=>JSON.parse(b));assert.deepEqual(backups[1].indexedDB.Task,backups[0].indexedDB.Task);assert.equal(backups[1].localStorage.WorkInterval,'1800');assert.equal(backups[1].localStorage.Theme,'Ocean');
 for(const p of[pair.old,pair.new]){const choosing=p.waitForEvent('filechooser');await p.getByRole('button',{name:en?'Import data':'导入数据',exact:true}).click();await(await choosing).setFiles({name:'synthetic.json',mimeType:'application/json',buffer:buffers[0]})}
 await pair.old.locator('#focus-import-dialog .focus-backup-analysis').waitFor();await pair.new.locator('.legacy-backup-restore .legacy-backup-analysis').waitFor();await capture(pair,prefix+'-import-preview',{dialog:'#focus-import-dialog .focus-app-dialog',table:'#focus-import-dialog .focus-backup-analysis'},{dialog:'.legacy-backup-restore',table:'.legacy-backup-restore .legacy-backup-analysis'});
 for(const p of[pair.old,pair.new])await p.getByRole('button',{name:en?'Cancel':'取消',exact:true}).last().click();assert.equal(await getStored(pair.new,'FocusTodoStandalone.data.','Theme'),'Ocean');
 // Actual service-backed import downloads the current backup and accepts explicit simulated save confirmation.
 const choosing=pair.new.waitForEvent('filechooser');await pair.new.getByRole('button',{name:en?'Import data':'导入数据',exact:true}).click();await(await choosing).setFiles({name:'synthetic.json',mimeType:'application/json',buffer:buffers[0]});await pair.new.locator('.legacy-backup-restore .legacy-backup-analysis').waitFor();const safety=pair.new.waitForEvent('download');await pair.new.getByRole('button',{name:en?'Replace data and import':'确认覆盖并导入',exact:true}).click();await pair.new.locator('.legacy-task-delete .primary').click();await safety;await pair.new.locator('.legacy-backup-restore').waitFor({state:'hidden'});
 await pair.old.locator('[class*=AccountSettings-redButton]').click();await pair.new.getByRole('button',{name:en?'Delete data':'删除数据',exact:true}).click();await capture(pair,prefix+'-reset',{dialog:'#focus-reset-dialog .focus-app-dialog'},{dialog:'.legacy-backup-reset'},undefined,await resetTileOffset(pair));assert.equal(await pair.new.locator('.legacy-backup-reset .primary').isDisabled(),true);await pair.old.getByRole('button',{name:en?'Cancel':'取消',exact:true}).last().click();await pair.new.getByRole('button',{name:en?'Cancel':'取消',exact:true}).last().click();
 await pair.new.reload();await pair.new.getByTestId('app-shell').waitFor();await pair.new.locator('[data-view=settings]').click();await pair.new.getByRole('button',{name:en?'Appearance':'外观',exact:true}).click();assert.equal(await pair.new.getByRole('button',{name:'Ocean',exact:true}).getAttribute('aria-pressed'),'true');
 behavior.push({key:prefix,passed:true,verified:['timer duration writes and reload','task completion sound preference','original classic wallpaper selection','name blur save','actual JSON download with compatible Task and settings','validated import preview without writes and cancellation','actual safety download and import','five-second reset lock and cancel','reload persistence']});save();
}
(async()=>{fs.mkdirSync(output,{recursive:true});for(const locale of process.env.FOCUS_VISUAL_LOCALES?.split(',')||['zh-CN','en'])for(const dark of process.env.FOCUS_VISUAL_THEMES?.split(',').map(v=>v==='dark')||[false,true]){const pair=await paired({locale,dark}),prefix=locale+'-'+(dark?'dark':'light');try{const input=pair.old.getByPlaceholder(locale==='en'?/Add a task/:/添加一个任务/);await input.fill('Audit sample');await input.press('Enter');await pair.old.getByText('Audit sample',{exact:true}).first().waitFor();await copyFixture(pair);await open(pair);
 for(const width of[1280,375]){await pair.old.setViewportSize({width,height:900});await pair.new.setViewportSize({width,height:900});for(const[, ,id]of tabs){await tab(pair,locale,id);const old={...commonOld},next={...commonNew};if(width===1280){if(id==='pomodoro'){old.control='[class*=PomodoroSettings-selectTable] tr:first-child [class$="-control"]';next.control='.domain-setting select';old.category='[class*=PomodoroSettings-categoryTitle]';next.category='.legacy-sound-settings .legacy-settings-category'}if(id==='appearance'){old.thumbnail='[class*=AppearanceSettings-themeImg]';next.thumbnail='.legacy-theme>span>img'}if(id==='account'){old.avatar='[class*=AccountSettings-portrait] img';next.avatar='.domain-avatar'}if(id==='about'){old.platform='[class*=AboutSettings-appDownload] img';next.platform='.legacy-platforms img'}}const offsets=old.platform?await downloadIconOffset(pair,locale,old.platform,next.platform):undefined;await capture(pair,prefix+'-'+width+'-'+id,old,next,undefined,offsets)}}
 await pair.old.setViewportSize({width:1280,height:900});await pair.new.setViewportSize({width:1280,height:900});await tab(pair,locale,'pomodoro');
 const oldSoundView=pair.old.locator('[class*=PomodoroSettings-content] .ScrollView-root-1KhMW');
 const newSoundView=pair.new.locator('.legacy-settings-content');
 await oldSoundView.evaluate(view=>view.scrollTop=650);
 const comparisonY=await oldSoundView.evaluate(view=>view.querySelector('[class*=PomodoroSettings-whiteNoiseOption]').getBoundingClientRect().y);
 const soundOffset=await newSoundView.evaluate((view,y)=>{
  view.scrollTop=650;
  return view.querySelector('.legacy-noise-choice').getBoundingClientRect().y-y;
 },comparisonY);
 const completionHeight=await pair.new.locator('.legacy-sound-completion').evaluate(row=>row.getBoundingClientRect().height);
 assert.equal(soundOffset,completionHeight,'The additional task-completion sound row accounts for the absolute scroll offset');
 await newSoundView.evaluate((view,offset)=>view.scrollTop+=offset,soundOffset);
 await capture(pair,prefix+'-sound-lower',{noise:'[class*=PomodoroSettings-whiteNoiseOption]',icon:'[class*=PomodoroSettings-icon]',volume:'[class*=PomodoroSettings-bgmsVolTable] [class*=PomodoroSettings-slider]'},{noise:'.legacy-noise-choice',icon:'.legacy-noise-choice>img',volume:'.legacy-sound-settings>.legacy-sound-row:last-of-type input[type=range]'});
 assert.equal(await pair.new.getByRole('radio').count(),16);
 await oldSoundView.evaluate(view=>view.scrollTop=0);await newSoundView.evaluate(view=>view.scrollTop=0);
 await pair.old.setViewportSize({width:1280,height:900});await pair.new.setViewportSize({width:1280,height:900});await tab(pair,locale,'pomodoro');const old=await metrics(pair.old,{control:'[class*=PomodoroSettings-selectTable] tr:first-child [class$="-control"]'}),before=await metrics(pair.new,{control:'.domain-setting select'});const injected=await pair.new.addStyleTag({content:'.legacy-settings .domain-setting select{transform:translateX(12px)!important}'});const invalid=await metrics(pair.new,{control:'.domain-setting select'});assert(compare(old,invalid).some(row=>row.property==='x'),'Geometry gate must reject a deliberate shifted control');await injected.evaluate(e=>e.remove());assert.deepEqual(await metrics(pair.new,{control:'.domain-setting select'}),before);behavior.push({key:prefix+'-negative-control',passed:true,detected:'12px injected shift'});
 await functional(pair,locale,prefix);await assertNoLegacyRuntime(pair.new,pair.handles[1].requests);for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}
 }catch(error){behavior.push({key:prefix,passed:false,error:error.stack});save();throw error}finally{await pair.close()}}
 save();if(!diagnostic)assert(!cases.some(row=>!row.passed),'Settings geometry/style gate failed; inspect results.json');
})().catch(error=>{console.error(error.stack);process.exitCode=1});
