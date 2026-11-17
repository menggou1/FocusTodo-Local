const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createServer } = require('../../scripts/server.cjs');
const baseline = 'f102da8919e810006b6611aabcef5f0159057d61';
process.chdir(path.resolve(__dirname, '../..'));
if (execFileSync('git', ['diff','--name-only',baseline,'--','src','public','scripts/server.cjs','scripts/runtime-layout.json'], {encoding:'utf8'}).trim()) throw Error('Runtime differs from baseline');
(async () => {
    const output = path.resolve('dist/acceptance/audit-task'); fs.mkdirSync(output,{recursive:true});
    const server=createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const base='http://127.0.0.1:'+server.address().port;
    const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    let browser;
    try {
        browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
        const context=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
        try {
            await context.route('**/*',route=>/^https?:/.test(route.request().url())&&!route.request().url().startsWith(base)?route.abort():route.continue());
            const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-07T12:00:00+08:00'));
            await page.goto(base);await page.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await page.evaluate(()=>FocusLocalReady);
            const input=page.getByPlaceholder(/添加一个任务/);await input.fill('Audit task');await input.press('Enter');await page.getByText('Audit task',{exact:true}).first().click();
            const sub=page.getByPlaceholder('添加子任务...');await sub.fill('Audit subtask');await sub.press('Enter');await page.getByText('Audit subtask',{exact:true}).waitFor();
            await page.getByText('添加备注...').click();const remark=page.getByPlaceholder('添加备注...');await remark.fill('Audit note');await remark.blur();
            await page.waitForFunction(async()=>{const x=await FocusLocalData.snapshot();return x.indexedDB.Task.some(t=>t.name==='Audit task'&&t.remark==='Audit note')&&x.indexedDB.Subtask.some(s=>s.name==='Audit subtask')});
            const before=await page.evaluate(async()=>{const x=await FocusLocalData.snapshot(),task=x.indexedDB.Task.find(t=>t.name==='Audit task'),sub=x.indexedDB.Subtask.find(t=>t.name==='Audit subtask');return {task:{id:task.id,name:task.name,remark:task.remark,rUnit:task.rUnit,rValue:task.rValue},subtask:{id:sub.id,taskId:sub.taskId,name:sub.name}}});
            if(before.subtask.taskId!==before.task.id)throw Error('Subtask association is incorrect');
            await page.screenshot({path:path.join(output,'task-fields.png'),animations:'disabled'});
            await page.getByText('重复',{exact:true}).click();await page.locator('#deadline-selection-popover').waitFor();const repeatOptions=await page.locator('#deadline-selection-popover').innerText();await page.screenshot({path:path.join(output,'repeat-options.png'),animations:'disabled'});await page.keyboard.press('Escape');
            await page.reload();await page.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await page.evaluate(()=>FocusLocalReady);
            const after=await page.evaluate(async()=>{const x=await FocusLocalData.snapshot(),task=x.indexedDB.Task.find(t=>t.name==='Audit task'),sub=x.indexedDB.Subtask.find(t=>t.name==='Audit subtask');return {task:{id:task.id,name:task.name,remark:task.remark,rUnit:task.rUnit,rValue:task.rValue},subtask:{id:sub.id,taskId:sub.taskId,name:sub.name}}});
            if(JSON.stringify(after)!==JSON.stringify(before))throw Error('Task fields changed after reload');
            if(errors.length)throw Error('Page errors encountered');
            fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({baseline,browser:browser.version(),node:process.version,platform:os.release(),method:'Generated task data, fixed time, isolated loopback, zh-CN/Asia-Shanghai, 1280x900, reduced motion. Tests create, subtask and note persistence; repeat popup only is observed.',before,after,repeatOptions,errors},null,2)+'\n');
            console.log('PASS task fields and subtask survive reload; repeat options captured');
        }finally{await context.close()}
    }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
