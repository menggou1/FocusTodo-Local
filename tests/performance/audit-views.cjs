const { chromium } = require('playwright');
const { createServer } = require('../../scripts/server.cjs');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), baseline = 'f102da8919e810006b6611aabcef5f0159057d61';
process.chdir(root);
const changed = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src', 'public', 'scripts/server.cjs', 'scripts/runtime-layout.json'], { encoding: 'utf8' }).trim();
if (changed) throw Error('Baseline runtime differs: ' + changed);
(async () => {
    const output = 'dist/acceptance/audit-views'; fs.mkdirSync(output, { recursive: true });
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
        const results = [];
        for (const locale of ['zh-CN', 'en']) for (const dark of [false, true]) {
            const context = await browser.newContext({ locale, timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
            try {
                await context.addInitScript(({locale,dark}) => { localStorage.setItem('FocusTodo.language',locale); localStorage.setItem('DarkMode',String(dark)); }, { locale, dark });
                await context.route('**/*', route => /^https?:/.test(route.request().url()) && !route.request().url().startsWith(origin) ? route.abort() : route.continue());
                const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
                await page.goto(origin); await page.waitForFunction(() => window.FocusLocalReady && document.querySelector('[class*=HomeHeader-forest]') && !document.documentElement.classList.contains('focus-starting')); await page.evaluate(() => FocusLocalReady); await page.evaluate(() => document.fonts.ready);
                const capture = async scene => {
                    await page.waitForTimeout(200);
                    const metrics = await page.evaluate(() => Object.fromEntries(['#root','[class*=HomeHeader-root]','[class*=Settings-root]','[class*=Forest-container]','.focus-achievements','.focus-schedule-view','[class*=Report]'].map(selector=>{const e=document.querySelector(selector);if(!e)return [selector,null];const s=getComputedStyle(e),r=e.getBoundingClientRect();return [selector,{width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor}]})));
                    const filename = `${locale}-${dark?'dark':'light'}-${scene}.png`; await page.screenshot({path:path.join(output,filename),fullPage:true,animations:'disabled'}); results.push({locale,dark,scene,filename,metrics,errors:[...errors]});
                };
                await capture('empty');
                const input = page.getByPlaceholder(locale==='en'?/Add a task/i:/添加一个任务/).first(); await input.fill('Audit sample'); await input.press('Enter'); await page.getByText('Audit sample',{exact:true}).first().waitFor(); await capture('task');
                await page.getByText('Audit sample',{exact:true}).first().click(); await capture('task-detail');
                await page.locator('[class*=FloatTimer-root]').hover(); await page.locator('.FloatTimer-zoomup-3tTgo').click(); await page.locator('[class*=FullscreenTimer-]').first().waitFor(); await capture('timer'); await page.reload(); await page.waitForFunction(()=>window.FocusLocalReady && document.querySelector('[class*=HomeHeader-forest]')&&!document.documentElement.classList.contains('focus-starting')); await page.evaluate(()=>FocusLocalReady);
                await page.getByText(locale==='en'?'Schedule':'日程',{exact:true}).first().click(); await page.locator('.focus-schedule-view').waitFor(); await capture('calendar-day'); await page.locator('.focus-schedule-view').selectOption('week'); await capture('calendar-week'); await page.locator('.focus-schedule-view').selectOption('month'); await page.locator('[class*=CalendarMonthView-gridWrapper]').waitFor(); await capture('calendar-month');
                await page.getByText(locale==='en'?'Completed':'已完成',{exact:true}).first().click(); await capture('history');
                await page.locator('[class*=HomeHeader-notification]').click(); await page.locator('#notification-popover').waitFor(); await capture('notification'); await page.locator('[class*=HomeHeader-notification]').click();
                await page.locator('[class*=HomeHeader-report]').click(); await capture('report'); await page.keyboard.press('Escape');
                await page.reload(); await page.waitForFunction(()=>window.FocusLocalReady && document.querySelector('[class*=HomeHeader-forest]')&&!document.documentElement.classList.contains('focus-starting')); await page.evaluate(()=>FocusLocalReady);
                await page.locator('[class*=HomeHeader-forest]').click(); await page.locator('[class*=Forest-container]').waitFor(); await capture('forest'); await page.locator('[class*=ForestSection-buttonGroup] img[src*=forest-badge]').click(); await page.locator('.focus-achievements').waitFor(); await capture('achievements');
                await page.reload(); await page.waitForFunction(()=>window.FocusLocalReady && document.querySelector('[class*=HomeHeader-forest]')&&!document.documentElement.classList.contains('focus-starting')); await page.evaluate(()=>FocusLocalReady);
                await page.mouse.click(1255,25); await page.locator('[class^=Settings-root-]').waitFor(); await capture('settings');
                await page.locator('[class*=Settings-menuName]').filter({hasText:locale==='en'?'Account':'账号'}).click(); await capture('account');
                await page.getByRole('button',{name:locale==='en'?'Export data':'导出数据',exact:true}).click(); await page.locator('#focus-backup-dialog').waitFor(); await capture('backup');
                if (errors.length) throw Error('Page errors encountered');
            } finally { await context.close(); }
        }
        fs.writeFileSync(path.join(output,'views.json'),JSON.stringify({baseline,browser:browser.version(),node:process.version,platform:os.release(),cpu:os.cpus()[0].model,method:'Fresh isolated synthetic context per locale/theme, 1280x900 DPR 1, reduced motion, network blocked, default app time; screenshots are point-in-time baseline, not exhaustive feature validation.',results},null,2)+'\n');
        console.log(`Captured ${results.length} scenes with ${browser.version()}`);
    } finally { if(browser)await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error.message);process.exitCode=1});
