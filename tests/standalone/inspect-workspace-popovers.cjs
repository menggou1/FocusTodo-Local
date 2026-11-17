const {paired,fs,path}=require('./ui-restore-helpers.cjs');
(async()=>{const pair=await paired(),page=pair.old,out='dist/acceptance/ui-restore/popovers';fs.mkdirSync(out,{recursive:true});try{
const ready=async()=>{await page.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await page.evaluate(()=>FocusLocalReady);await page.evaluate(()=>document.fonts.ready)};
await page.getByPlaceholder(/添加一个任务/).fill('Audit sample');await page.getByPlaceholder(/添加一个任务/).press('Enter');
for(const [name,selector] of [['priority','[class*=TitleItem-priority]'],['pomodoro','[class*=PomodoroItem-root]'],['deadline','[class*=DeadlineItem-root]'],['project','[class*=ProjectItem-root-37]'],['reminder','[class*=ReminderItem-root]'],['repeat','[class*=RepetitionItem-root]'],['tags','[class*=TagAdd-root]']]){
 await page.reload();await ready();await page.getByText('Audit sample',{exact:true}).first().click();await page.waitForTimeout(300);await page.locator(selector).click();await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'old-'+name+'.png')});fs.writeFileSync(path.join(out,'old-'+name+'.html'),await page.locator('body').innerHTML());console.log(name);
}
for(const[name,selector]of[['new-list','[class*=ProjectNewItem-title]'],['new-tag','[class*=ProjectNewItem-tag]'],['new-folder','[class*=ProjectNewItem-folder]']]){await page.reload();await ready();await page.locator(selector).click();await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'old-'+name+'.png')});fs.writeFileSync(path.join(out,'old-'+name+'.html'),await page.locator('body').innerHTML());console.log(name)}
}finally{await pair.close()}})().catch(e=>{console.error(e);process.exitCode=1});
