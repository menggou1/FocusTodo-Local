const {paired,fs,path}=require('./ui-restore-helpers.cjs');
(async()=>{const pair=await paired(),page=pair.old,out='dist/acceptance/ui-restore/record-popovers';fs.mkdirSync(out,{recursive:true});const capture=async name=>{await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'old-'+name+'.png')});fs.writeFileSync(path.join(out,'old-'+name+'.html'),await page.locator('body').innerHTML());console.log(name)};
try{
 await page.getByText('日程',{exact:true}).first().click();await page.locator('.focus-schedule-view').waitFor();await page.locator('[class*=CalendarDayView-timelineScroll]').dblclick({position:{x:100,y:100}});await capture('quick');await page.keyboard.press('Escape');
 await page.getByText('已完成',{exact:true}).first().click();await page.locator('[class*=TaskRegion-menu-2PouQ]').click();await capture('manual-record');
 await page.reload();await page.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await page.evaluate(()=>FocusLocalReady);
 await page.evaluate(async()=>{const date=new Date();date.setHours(0,0,0,0);await FocusLocalData.createCalendarTask({name:'Calendar sample',count:1,interval:1500,startTime:+date,projectId:'id-task-tasks',shortBreak:300,addToTop:true})});
 await page.getByText('日程',{exact:true}).first().click();await page.locator('.focus-calendar-event:not(.focus-calendar-preview)').first().click();await capture('schedule-details');
}finally{await pair.close()}})().catch(e=>{console.error(e);process.exitCode=1});
