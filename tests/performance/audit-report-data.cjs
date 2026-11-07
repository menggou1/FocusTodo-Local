const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createServer } = require('../../scripts/server.cjs');
const baseline = 'f102da8919e810006b6611aabcef5f0159057d61';
process.chdir(path.resolve(__dirname, '../..'));
const changed = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src', 'public', 'scripts/server.cjs', 'scripts/runtime-layout.json'], { encoding: 'utf8' }).trim();
if (changed) throw Error('Runtime differs from audit baseline: ' + changed);
(async () => {
    const output = path.resolve('dist/acceptance/audit-report'); fs.mkdirSync(output, { recursive: true });
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
        const cases = [
            { id: 'shanghai-midnight', timezone: 'Asia/Shanghai', now: '2026-11-07T12:00:00+08:00', end: '2026-11-07T00:20:00+08:00' },
            { id: 'newyork-dst', timezone: 'America/New_York', now: '2026-11-01T12:00:00-05:00', end: '2026-11-01T01:20:00-05:00' }
        ], results = [];
        for (const sample of cases) {
            const context = await browser.newContext({ locale: 'zh-CN', timezoneId: sample.timezone, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
            try {
                await context.route('**/*', route => /^https?:/.test(route.request().url()) && !route.request().url().startsWith(base) ? route.abort() : route.continue());
                const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
                await page.clock.setFixedTime(new Date(sample.now)); await page.goto(base);
                await page.waitForFunction(() => window.FocusLocalReady && document.querySelector('[class*=HomeHeader-report]') && !document.documentElement.classList.contains('focus-starting')); await page.evaluate(() => FocusLocalReady);
                const input = page.getByPlaceholder(/添加一个任务/); await input.fill('Audit task A'); await input.press('Enter'); await page.getByText('Audit task A',{exact:true}).first().waitFor();
                await input.fill('Audit task B'); await input.press('Enter'); await page.getByText('Audit task B',{exact:true}).first().waitFor();
                const before = await page.evaluate(async end => {
                    const d = FocusLocalData, snap = await d.snapshot(), db = await d.open();
                    const a = snap.indexedDB.Task.find(row => row.name === 'Audit task A'), b = snap.indexedDB.Task.find(row => row.name === 'Audit task B');
                    const sub = { id:'audit-subtask', objType:'SUBTASK', taskId:a.id, name:'Audit subtask', state:0, isFinished:false, sync:0, creationDate:Date.now(), order:1 };
                    await d.transaction(db, ['Subtask'], 'readwrite', tx => tx.objectStore('Subtask').put(sub));
                    const endMs = Date.parse(end);
                    for (const r of [{id:'audit-cross-boundary',taskId:a.id,subtaskId:sub.id,endDate:endMs,interval:1800},{id:'audit-second',taskId:b.id,subtaskId:'',endDate:endMs+3600000,interval:600}])
                        await d.putPomodoro({ ...r, objType:'POMODORO', creationDate:endMs, pomodoroInterval:1500, isManual:false, state:0, sync:0 });
                    const after=await d.snapshot(); return {tasks:[a.id,b.id],records:after.indexedDB.Pomodoro.filter(x=>x.id.startsWith('audit-')).map(x=>({id:x.id,taskId:x.taskId,subtaskId:x.subtaskId,endDate:x.endDate,interval:x.interval})),subtask:sub.id};
                }, sample.end);
                if (before.records.length !== 2 || before.records.reduce((n,r)=>n+r.interval,0) !== 2400) throw Error('Seed data did not persist');
                await page.reload(); await page.waitForFunction(() => window.FocusLocalReady && document.querySelector('[class*=HomeHeader-report]') && !document.documentElement.classList.contains('focus-starting')); await page.evaluate(() => FocusLocalReady);
                await page.getByText('已完成',{exact:true}).first().click(); await page.waitForTimeout(600); await page.screenshot({path:path.join(output,sample.id+'-history.png'),animations:'disabled'});
                const history = (await page.locator('#root').innerText()).slice(0,12000);
                if (!history.includes('Audit subtask') || !history.includes('Audit task B') || !history.includes('30分钟') || !history.includes('10分钟')) throw Error('History did not render the seeded associations and durations');
                await page.getByText('日程',{exact:true}).first().click(); await page.locator('.focus-schedule-view').waitFor(); await page.waitForTimeout(500); await page.screenshot({path:path.join(output,sample.id+'-calendar.png'),animations:'disabled'});
                const calendar = (await page.locator('#root').innerText()).slice(0,12000);
                const calendarGeometry = await page.locator('.focus-calendar-event:not(.focus-calendar-preview)').evaluateAll(nodes => nodes.map(node => ({id:node.getAttribute('data-event-id'),title:node.getAttribute('title'),top:node.style.top,height:node.style.height})));
                if (calendarGeometry.length < 2) throw Error('Calendar did not create both event nodes');
                if (!calendar.includes('Audit subtask') || !calendar.includes('Audit task B') || !calendar.includes('30m') || !calendar.includes('10m')) throw Error('Calendar did not render expected records');
                await page.locator('[class*=HomeHeader-report]').click(); await page.waitForTimeout(1000); await page.screenshot({path:path.join(output,sample.id+'-report.png'),animations:'disabled'});
                const report = (await page.locator('#root').innerText()).slice(0,12000);
                const expectedToday = sample.id === 'shanghai-midnight' ? 30 : 40;
                if (!report.includes('总专注时间\n40\n分钟') || !report.includes('今日专注时间\n' + expectedToday + '\n分钟') || !report.includes('Audit task A') || !report.includes('Audit task B')) throw Error('Report totals or task labels differ from expected');
                const roundTrip = await page.evaluate(async () => { const d=FocusLocalData, before=await d.snapshot(), encoded=await FocusLocalBackup.encode(before,{format:'json'}), decoded=await FocusLocalBackup.decode(encoded.bytes); await d.replace(decoded.data,{backup:false}); const after=await d.snapshot(); const pick=x=>x.indexedDB.Pomodoro.filter(r=>r.id.startsWith('audit-')).map(r=>JSON.stringify(r)).sort(); return JSON.stringify(pick(before))===JSON.stringify(pick(after)); });
                if (!roundTrip) throw Error('Backup round trip changed the focus records');
                const snapshot = await page.evaluate(() => FocusLocalData.snapshot());
                if (snapshot.indexedDB.Pomodoro.filter(x=>x.id.startsWith('audit-')).length!==2) throw Error('Records missing after reload');
                if(errors.length) throw Error('Browser page error');
                results.push({ ...sample, seed:before, history, calendar, calendarGeometry, report, backupRoundTrip:roundTrip, errors }); console.log('PASS captured '+sample.id);
            } finally { await context.close(); }
        }
        fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({ baseline,browser:browser.version(),node:process.version,platform:os.release(),method:'Generated data only; 30-minute interval crossing local midnight or DST fall-back plus a 10-minute task interval; fixed time; isolated fresh browser contexts. Screenshots and text record observed UI, not a claim that aggregations are correct.',results },null,2)+'\n');
    } finally { if(browser)await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error.stack);process.exitCode=1});
