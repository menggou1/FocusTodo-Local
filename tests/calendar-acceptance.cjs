/* Isolated real browser UI and IndexedDB transactions; no personal database. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('../scripts/server.cjs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const evidence = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || path.join(root, 'docs/acceptance'));
fs.mkdirSync(evidence, { recursive: true });
(async () => {
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER && ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const results = [];
    async function scenario(name, body, locale = 'zh-CN', dark = false) {
        if (process.env.FOCUS_CALENDAR_FILTER && !name.includes(process.env.FOCUS_CALENDAR_FILTER)) return;
        const context = await browser.newContext({ locale, timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 } });
        const errors = [], external = [];
        await context.addInitScript(({ locale, dark }) => {
            localStorage.setItem('FocusTodo.language', locale); if (dark) localStorage.setItem('DarkMode', 'true');
            let api, timer;
            Object.defineProperty(window, 'FocusCalendar', { configurable: true, get: () => api, set(value) {
                api = value; const controller = api.attachController, timeline = api.attachTimeline;
                api.attachController = function(component, options) { window.__calendar = component; return controller(component, options); };
                api.attachTimeline = function(component, ...args) { window.__timeline = component; return timeline(component, ...args); };
            } });
            Object.defineProperty(window, 'FocusLocal', { configurable: true, get: () => timer, set(value) {
                timer = value; const attach = timer.attachTimer;
                timer.attachTimer = function(component, options) { window.__timer = component; return attach(component, options); };
            } });
        }, { locale, dark });
        await context.route('**/*', route => {
            if (/^https?:/.test(route.request().url()) && !route.request().url().startsWith(url)) { external.push(route.request().url()); return route.abort(); }
            return route.continue();
        });
        const page = await context.newPage(); page.on('pageerror', error => errors.push(error.stack));
        try {
            await page.goto(url); await ready(page); await calendar(page, locale);
            await body(page, context);
            assert.deepEqual(errors, [], 'No browser errors'); assert.deepEqual(external, [], 'No external requests');
            results.push({ name, passed: true }); console.log('PASS ' + name);
        } catch (error) {
            await page.screenshot({ path: path.join(root, 'dist/calendar-failure.png') }).catch(() => {});
            console.error('Browser notices: ' + await page.locator('.focus-local-notice').allTextContents());
            results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack);
        }
        finally { await context.close(); }
    }
    async function ready(page) {
        await page.waitForFunction(() => window.__timer && document.querySelector('#root')?.innerText && !document.documentElement.classList.contains('focus-starting'));
        await page.evaluate(() => FocusLocalReady);
    }
    async function calendar(page, locale = 'zh-CN') {
        await page.getByText(locale === 'en' ? 'Schedule' : '日程', { exact: true }).click();
        await page.waitForFunction(() => window.__calendar?._isMounted && window.__timeline?.timelineRef.current);
    }
    async function waitForData(page, predicate, argument) {
        const limit = Date.now() + 10000;
        while (!(await page.evaluate(predicate, argument))) {
            if (Date.now() > limit) throw new Error('Timed out waiting for committed calendar data');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    const snapshot = page => page.evaluate(() => FocusLocalData.snapshot());
    const blocks = page => page.locator('.focus-calendar-event:not(.focus-calendar-preview)');
    async function slot(page, minutes = 100, completed = false) {
        const element = page.locator('[class*="timelineScroll"]').first();
        const box = await element.boundingBox();
        await element.evaluate(el => { el.scrollTop = 0; });
        return { x: box.x + box.width * (completed ? .75 : .25), y: box.y + minutes * await page.evaluate(() => window.__timeline.getMinuteHeight()) };
    }
    async function waitNativePopover(page,id) {
        await page.locator('#'+id).waitFor();
        await page.waitForFunction(id=>{let node=document.getElementById(id);if(!node)return false;for(;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.99)return false;return true;},id);
    }
    async function setPomodoros(page,count,minutes,scope=page.locator('.focus-schedule-native-fields')) {
        await scope.locator('.PomodoroItem-root-2imI9').click();
        const popup=page.locator('#pomodoro-selection-popover');await popup.waitFor();
        const wheels=popup.locator('ul.InputUL-options-1tHVO');
        await wheels.nth(0).evaluate((el,index)=>{el.scrollTop=index*30;el.dispatchEvent(new Event('scroll',{bubbles:true}));},count);
        await wheels.nth(1).evaluate((el,index)=>{el.scrollTop=index*30;el.dispatchEvent(new Event('scroll',{bubbles:true}));},minutes-1);
        await popup.getByText('确定',{exact:true}).click();await popup.waitFor({state:'detached'});
    }
    async function chooseProject(page,name,scope=page.locator('.focus-schedule-native-fields')) {
        await scope.locator('.ProjectItem-root-37Zqb tr').click();
        const popup=page.locator('#project-selection-popover');await popup.waitFor();
        await popup.getByText(name,{exact:true}).click();await popup.waitFor({state:'detached'});
    }
    async function create(page, name = 'Calendar task', minutes = 100) {
        const position = await slot(page, minutes); await page.mouse.dblclick(position.x, position.y);
        await page.locator('#focus-calendar-name').fill(name);
        await setPomodoros(page,3,30);
        await page.getByRole('button', { name: '确定', exact: true }).click();
        await page.locator('.focus-calendar-dialog').waitFor({ state: 'detached' });
        await blocks(page).first().waitFor();
    }
    try {
        await scenario('double click creates task and spaced plans atomically, persists and exports', async page => {
            await create(page, 'Quick calendar task');
            const data = await snapshot(page), task = data.indexedDB.Task.find(row => row.name === 'Quick calendar task');
            assert(task); const plans = data.indexedDB.Schedule.filter(row => row.taskId === task.id).sort((a, b) => a.endDate - b.endDate);
            assert.equal(plans.length, 3); assert.equal(task.estimatePomoNum, 3); assert.equal(task.pomodoroInterval, 1800);
            assert.equal(plans[1].endDate - plans[0].endDate, 2100000);
            assert.equal(await page.evaluate(value => new Date(value).getHours(), task.deadline), 23);
            await page.evaluate(data => FocusLocalData.replace(data, { backup: false }), data);
            await page.reload(); await ready(page); if (!(await blocks(page).count())) await calendar(page);
            assert.equal(await blocks(page).count(), 3);
            assert.equal((await snapshot(page)).indexedDB.Task.filter(row => row.id === task.id).length, 1);
            await page.screenshot({ path: path.join(evidence, 'calendar-1.7.1.png') });
        });
        await scenario('upward and downward selections work; completed column and cancel never write', async page => {
            for (const reverse of [false, true]) {
                const a = await slot(page, reverse ? 180 : 120), b = await slot(page, reverse ? 120 : 180);
                await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
                await page.locator('#focus-calendar-name').waitFor();
                assert((await page.locator('.focus-schedule-native-fields .PomodoroItem-interval-1paXe').innerText()).includes('60'));
                await page.keyboard.press('Escape'); assert.equal(await page.locator('.focus-calendar-preview').count(), 0);
            }
            const a = await slot(page, 100, true); await page.mouse.dblclick(a.x, a.y);
            assert.equal(await page.locator('.focus-calendar-dialog').count(), 0);
            const data = await snapshot(page); assert.equal(data.indexedDB.Task.length, 0); assert.equal(data.indexedDB.Schedule.length, 0);
        });
        await scenario('schedule transaction failure leaves no orphan task and UI can retry once', async page => {
            await page.evaluate(() => {
                const add = IDBObjectStore.prototype.add;
                IDBObjectStore.prototype.add = function(...args) {
                    if (this.name === 'Schedule' && window.__failCalendar !== false) { window.__failCalendar = false; throw new DOMException('Injected calendar failure', 'QuotaExceededError'); }
                    return add.apply(this, args);
                };
            });
            const position = await slot(page); await page.mouse.dblclick(position.x, position.y);
            await page.locator('#focus-calendar-name').fill('Retry task'); await page.getByRole('button', { name: '确定', exact: true }).click();
            await page.getByRole('alert').filter({ hasText: '保存失败' }).waitFor();
            let data = await snapshot(page); assert.equal(data.indexedDB.Task.length, 0); assert.equal(data.indexedDB.Schedule.length, 0);
            await page.getByRole('button', { name: '确定', exact: true }).click(); await page.locator('.focus-calendar-dialog').waitFor({ state: 'detached' });
            data = await snapshot(page); assert.equal(data.indexedDB.Task.length, 1); assert.equal(data.indexedDB.Schedule.length, 1);
        });
        await scenario('overlapping plans and records have separate hit targets, project colors and timer start guards', async page => {
            await create(page, 'Start me');
            const originalId = await page.evaluate(async () => {
                const snapshot = await FocusLocalData.snapshot(), plan = snapshot.indexedDB.Schedule[0];
                await FocusLocalData.putSchedule({ ...plan, id: 'overlap-plan', endDate: plan.endDate + 300000 });
                await FocusLocalData.putPomodoro({ id: 'completed-record', objType: 'POMODORO', taskId: plan.taskId, subtaskId: '',
                    creationDate: plan.endDate, endDate: plan.endDate, interval: 300, pomodoroInterval: 1800, state: 0, sync: 0 });
                return plan.id;
            });
            await page.waitForFunction(() => document.querySelectorAll('[data-category="scheduled"]').length === 4);
            const a = await page.locator('[data-event-id="' + originalId + '"]').boundingBox(), b = await page.locator('[data-event-id="overlap-plan"]').boundingBox();
            assert(a.x + a.width <= b.x || b.x + b.width <= a.x, 'Overlapping blocks are side by side');
            assert.equal(await page.locator('[data-category="completed"] .focus-calendar-start').count(), 0);
            await page.locator('[data-category="scheduled"] .focus-calendar-start').first().click();
            await page.waitForFunction(() => window.__timer.localTimer && window.__timer.props.task?.name === 'Start me');
            assert.equal((await page.evaluate(() => FocusLocalData.session())).state, 'work');
            await page.evaluate(async () => { await window.__timer.localTimer.run('stop'); window.__timer.zoomDown(); });
            await page.evaluate(async () => {
                const db = await FocusLocalData.open(); await FocusLocalData.transaction(db, ['Task'], 'readwrite', tx => {
                    const store = tx.objectStore('Task'), request = store.getAll(); request.onsuccess = () => request.result.forEach(task => store.put({ ...task, isFinished: true }));
                });
            });
            await page.locator('[data-category="scheduled"] .focus-calendar-start').first().click();
            await page.locator('.focus-local-notice').filter({ hasText: '该任务已完成' }).waitFor();
            assert.notEqual((await page.evaluate(() => FocusLocalData.session())).state, 'work');
        });
        await scenario('native date selection and scroll restore work across navigation and refresh', async page => {
            const scroll = page.locator('[class*="timelineScroll"]').first();
            await scroll.evaluate(el => { el.scrollTop = 500; el.dispatchEvent(new Event('scroll')); });
            await page.evaluate(() => window.__calendar.handleCalendarDatePicker({ stopPropagation() {} }));
            const datePicker=page.locator('#deadline-selection-popover'); await waitNativePopover(page,'deadline-selection-popover');
            await page.screenshot({path:path.join(evidence,'schedule-native-date.png')});
            await datePicker.locator('.datepicker-days .next').click();
            await datePicker.locator('.datepicker-days td.day:not(.old):not(.new)').filter({hasText:/^2$/}).click();
            await page.waitForFunction(() => window.__calendar.state.calendarDate.format('YYYY-MM-DD') === '2026-11-02');
            assert.equal(await scroll.evaluate(el => el.scrollTop), 500);
            await page.reload(); await ready(page); await calendar(page);
            assert.equal(await scroll.evaluate(el => el.scrollTop), 500);
            const position = await slot(page); await page.mouse.dblclick(position.x, position.y); await page.keyboard.press('Escape');
            assert.equal(await page.locator('.focus-calendar-dialog').count(), 0);
        });
        await scenario('plan movement, resizing, copy/delete and failed writes keep committed data', async page => {
            await create(page, 'Move and resize', 90);
            let data = await snapshot(page);
            const plan = data.indexedDB.Schedule.sort((a, b) => a.endDate - b.endDate)[0];
            const block = page.locator('[data-event-id="' + plan.id + '"]');
            let box = await block.boundingBox();
            await page.mouse.move(box.x + 20, box.y + 9); await page.mouse.down();
            await page.mouse.move(box.x + 20, box.y + 9 + 124, { steps: 10 }); await page.mouse.up();
            await page.waitForFunction(({ id, end }) => window.__calendar.state.calendarDayScheduledEvents.find(row => row.id === id)?.end === end, { id: plan.id, end: plan.endDate + 3600000 });
            assert.equal((await snapshot(page)).indexedDB.Schedule.find(row => row.id === plan.id).endDate, plan.endDate + 3600000);
            const handle = block.locator('[class*="eventResizeHandle"]'); box = await handle.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 62, { steps: 10 }); await page.mouse.up();
            await page.waitForFunction(id => window.__calendar.state.calendarDayScheduledEvents.find(row => row.id === id)?.raw.interval === 3600, plan.id);
            await block.click({ button: 'right' }); await page.getByText('复制', { exact: true }).click();
            await page.waitForFunction(() => document.querySelectorAll('.focus-calendar-event').length === 4);
            const before = await snapshot(page), ids = data.indexedDB.Schedule.map(row => row.id);
            const copy = before.indexedDB.Schedule.find(row => !ids.includes(row.id));
            assert.equal(copy.interval, 3600); assert.equal(copy.endDate, plan.endDate + 3600000 + 1800000 + 3900000);
            await page.locator('[data-event-id="' + copy.id + '"]').click({ button: 'right' }); await page.getByText('删除', { exact: true }).click();
            await waitForData(page, async id => (await FocusLocalData.snapshot()).indexedDB.Schedule.find(row => row.id === id).state === -1, copy.id);
            const error = await page.evaluate(async id => {
                const put = FocusLocalData.putSchedule; FocusLocalData.putSchedule = () => Promise.reject(new Error('Injected move failure'));
                const event = window.__calendar.state.calendarDayScheduledEvents.find(row => row.id === id);
                try { await window.__calendar.handleCalendarEventDrop({ event, startTime: event.start + 3600000, endTime: event.end + 3600000 }); }
                finally { FocusLocalData.putSchedule = put; }
                return document.getElementById('focus-local-notice').textContent;
            }, plan.id);
            assert(error.includes('Injected move failure'));
            data = await snapshot(page); assert.equal(data.indexedDB.Schedule.find(row => row.id === plan.id).endDate, plan.endDate + 5400000);
        });
        await scenario('calendar writes refresh another tab and completed-record association without stale names', async (page, context) => {
            const peer = await context.newPage(); await peer.goto(url); await ready(peer); await calendar(peer);
            await create(page, 'Peer task'); await peer.locator('.focus-calendar-event').first().waitFor();
            const record = await page.evaluate(async () => {
                const { indexedDB: data } = await FocusLocalData.snapshot(), task = data.Task[0];
                const record = { id: 'edit-record', objType: 'POMODORO', taskId: task.id, subtaskId: '', creationDate: Date.now(),
                    endDate: data.Schedule[0].endDate, interval: 1500, pomodoroInterval: 1500, state: 0, sync: 0 };
                await FocusLocalData.putPomodoro(record); return record;
            });
            await page.locator('[data-event-id="edit-record"]').click();
            await page.waitForFunction(() => window.__calendar.state.calendarPomodoroDetail?.id === 'edit-record');
            await peer.evaluate(record => FocusLocalData.putPomodoro({ ...record, taskId: '', interval: 600 }), record);
            await page.waitForFunction(() => window.__calendar.state.calendarPomodoroDetail?.taskId === '');
            await page.waitForFunction(() => document.querySelector('[data-event-id="edit-record"]')?.textContent.includes('10m'));
            assert((await page.locator('[data-event-id="edit-record"]').innerText()).includes('未指定任务'));
        });
        await scenario('task context menu saves next week as seven days ahead', async page => {
            await create(page, 'Deadline task'); await page.getByText('任务', { exact: true }).first().click();
            await page.getByText('Deadline task', { exact: true }).first().click({ button: 'right' });
            await page.getByText('下周到期', { exact: true }).click();
            await waitForData(page, async () => { const snapshot = await FocusLocalData.snapshot(); return snapshot.indexedDB.Task[0].deadline === FocusCalendar.deadlineInSevenDays(); });
        });
        await scenario('estimate cap, custom list, top ordering and maintenance exclusion preserve data', async page => {
            await page.evaluate(async () => {
                const db = await FocusLocalData.open(); await FocusLocalData.transaction(db, ['Project'], 'readwrite', tx =>
                    tx.objectStore('Project').add({ ...FocusLocalData.defaultProjects().find(row => row.type === 7005), id: 'custom-calendar', type: 1000, name: 'My list', order: 10000, color: 'DF542A' }));
            });
            // Refresh the actual project model before opening the dialog.
            await page.reload(); await ready(page); await calendar(page);
            const position = await slot(page); await page.mouse.dblclick(position.x, position.y);
            await page.locator('#focus-calendar-name').fill('Seven pomodoros'); await setPomodoros(page,7,25);
            await chooseProject(page,'My list');
            await page.getByRole('button', { name: '确定', exact: true }).click(); await page.locator('.focus-calendar-dialog').waitFor({ state: 'detached' });
            const data = await snapshot(page); assert.equal(data.indexedDB.Schedule.length, 5);
            assert.equal(data.indexedDB.Task[0].estimatePomoNum, 7); assert.equal(data.indexedDB.Task[0].projectId, 'custom-calendar');
            assert(data.indexedDB.Task[0].order < 0);
            const message = await page.evaluate(async () => {
                const db = await FocusLocalData.open(); await FocusLocalData.transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').put({ id: 'maintenance', stage: 'fixture' }));
                try { await FocusLocalData.createCalendarTask({ name: 'Blocked task', startTime: Date.now(), interval: 1500, count: 1, projectId: 'custom-calendar' }); return ''; }
                catch (error) { return error.message; }
                finally { await FocusLocalData.transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').delete('maintenance')); }
            });
            assert(message.includes('维护'));
            assert.equal((await snapshot(page)).indexedDB.Task.length, 1);
        });
        await scenario('schedule is reorderable and hideable in system list management', async page => {
            await page.mouse.click(1255,25); await page.getByText('清单管理',{exact:true}).click();
            const row = page.locator('[data-project-id="id-task-schedule"]'); await row.waitFor();
            assert((await row.innerText()).includes('日程')); assert.equal(await row.locator('.focus-project-handle').count(),1);
            const before = (await snapshot(page)).indexedDB.Project.find(row => row.id === 'id-task-schedule').order;
            await row.locator('.focus-project-handle').focus(); await page.keyboard.press('ArrowUp');
            await waitForData(page, async order => (await FocusLocalData.snapshot()).indexedDB.Project.find(row => row.id === 'id-task-schedule').order !== order, before);
            await row.getByRole('checkbox').click({force:true});
            await waitForData(page, async () => (await FocusLocalData.snapshot()).indexedDB.Project.find(row => row.id === 'id-task-schedule').state === 1);
            await page.reload(); await ready(page);
            assert.equal(await page.getByText('日程',{exact:true}).count(),0);
            await page.mouse.click(1255,25); await page.getByText('清单管理',{exact:true}).click();
            const hidden = page.locator('[data-project-id="id-task-schedule"]'); await hidden.waitFor();
            await hidden.getByRole('checkbox').click({force:true});
            await waitForData(page, async () => (await FocusLocalData.snapshot()).indexedDB.Project.find(row => row.id === 'id-task-schedule').state === 0);
            assert.notEqual((await snapshot(page)).indexedDB.Project.find(row => row.id === 'id-task-schedule').order,before);
        });
        await scenario('month view loads records, scrolls to final week and opens a selected day', async page => {
            await create(page,'Month task');
            await page.locator('.focus-schedule-view').selectOption('month');
            const grid=page.locator('[class*="CalendarMonthView-gridWrapper"]'); await grid.waitFor();
            await page.locator('[class*="CalendarMonthView-eventItem"]').first().waitFor();
            const size=await grid.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));assert(size.scroll>size.height);
            await grid.hover();await page.mouse.wheel(0,900);
            await page.waitForFunction(()=>document.querySelector('[class*="CalendarMonthView-gridWrapper"]').scrollTop>0);
            await page.screenshot({path:path.join(evidence,'schedule-month.png')});
            const cell=page.locator('[class*="CalendarMonthView-cell-"]').last();await cell.scrollIntoViewIfNeeded();
            await cell.click();await page.waitForFunction(()=>window.__calendar.state.calendarViewMode==='day');
        });
        for(const mode of ['countup','countdown'])await scenario(mode+' pause then repeated stop never creates zero-minute history',async page=>{
            await page.evaluate(async mode=>{
                await window.__timer.localTimer.run('start',{mode,taskId:'',subtaskId:'',config:{interval:1500}});
                const reduce=FocusTimerCore.reduce;
                FocusTimerCore.reduce=function(session,action,now){
                    if(action.type==='pause')session={...session,cursorAt:now-27000,observedAt:now-27000,phaseElapsed:0,totalSeconds:0,recordedSeconds:0,spans:[]};
                    return reduce(session,action,now);
                };
                try{await window.__timer.localTimer.run('pause');}finally{FocusTimerCore.reduce=reduce;}
                await window.__timer.localTimer.run('stop');await window.__timer.localTimer.run('stop');
            },mode);
            const data=await snapshot(page);assert.equal(data.indexedDB.Pomodoro.length,1);assert.equal(data.indexedDB.Pomodoro[0].interval,27);
            assert.equal(data.indexedDB.Task.length,0,'A focus record must not create a task');
            const legacy=await page.evaluate(()=>Number(27).secondsToLocalHH_MM());assert(legacy.includes('0'));
            await page.getByText('已完成',{exact:true}).first().click();
            await page.locator('[class*="PomodoroItem-interval"]').filter({hasText:'27秒'}).waitFor();
            assert.equal(await page.locator('[class*="PomodoroItem-interval"]').filter({hasText:'0分钟'}).count(),0);
            await page.screenshot({path:path.join(evidence,'history-subminute-'+mode+'.png')});
        });
        await scenario('invalid zero-duration legacy record is absent without deleting saved data',async page=>{
            await page.evaluate(()=>FocusLocalData.putPomodoro({id:'legacy-zero',objType:'POMODORO',state:0,interval:0,pomodoroInterval:1500,endDate:Date.now(),taskId:'',subtaskId:'',sync:0}));
            await page.getByText('已完成',{exact:true}).first().click();
            assert.equal(await page.locator('[class*="PomodoroItem-root"]').count(),0);
            assert.equal((await snapshot(page)).indexedDB.Pomodoro.length,1,'Keep legacy data intact');
        });
        await scenario('native quick-task fields keep edits in a draft and cancellation writes nothing',async page=>{
            const point=await slot(page,100);await page.mouse.dblclick(point.x,point.y);
            const form=page.locator('.focus-calendar-dialog');
            assert.equal(await form.locator('select,details,input[type=number],input[type=date]').count(),0);
            assert.equal((await form.locator('.PomodoroItem-estimatedPomoNum-BaLFC').innerText()).trim(),'0');
            assert((await form.locator('.PomodoroItem-interval-1paXe').innerText()).includes('25'));
            await form.locator('.PomodoroItem-root-2imI9').click();
            await waitNativePopover(page,'pomodoro-selection-popover');
            await page.screenshot({path:path.join(evidence,'schedule-native-pomodoro.png')});
            await page.keyboard.press('Escape');await page.locator('#pomodoro-selection-popover').waitFor({state:'detached'});
            await setPomodoros(page,1000,480);
            assert.equal((await form.locator('.PomodoroItem-estimatedPomoNum-BaLFC').innerText()).trim(),'1000');
            await form.locator('.ProjectItem-root-37Zqb tr').click();await waitNativePopover(page,'project-selection-popover');
            await page.screenshot({path:path.join(evidence,'schedule-native-project.png')});
            await page.keyboard.press('Escape');await page.locator('#project-selection-popover').waitFor({state:'detached'});
            const data=await snapshot(page);assert.equal(data.indexedDB.Task.length,0);assert.equal(data.indexedDB.Schedule.length,0);
            await page.keyboard.press('Escape');await form.waitFor({state:'detached'});
            assert.equal(await page.locator('#pomodoro-selection-popover,#project-selection-popover').count(),0);
        });
        await scenario('original task-detail fields retain native persistence outside a schedule draft',async page=>{
            await create(page,'Existing native task');
            await page.evaluate(async()=>{
                const db=await FocusLocalData.open();await FocusLocalData.transaction(db,['Project'],'readwrite',tx=>tx.objectStore('Project').put({
                    ...FocusLocalData.defaultProjects().find(row=>row.type===7005),id:'native-destination',type:1000,name:'Native destination',order:10000
                }));
            });await page.reload();await ready(page);
            await page.getByText('任务',{exact:true}).first().click();
            await page.getByText('Existing native task',{exact:true}).first().click();
            const scope=page.locator('#root');await scope.locator('.PomodoroItem-root-2imI9').waitFor();
            await setPomodoros(page,5,40,scope);
            await waitForData(page,async()=>{const task=(await FocusLocalData.snapshot()).indexedDB.Task[0];return task.estimatePomoNum===5&&task.pomodoroInterval===2400;});
            await chooseProject(page,'Native destination',scope);
            await waitForData(page,async()=>(await FocusLocalData.snapshot()).indexedDB.Task[0].projectId==='native-destination');
        });
        await scenario('selection has rounded corners and visible text matches the reference sizes',async page=>{
            const start=await slot(page,100),end=await slot(page,130);
            await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
            const selection=page.locator('.focus-calendar-selection');await selection.waitFor();
            assert.equal(await selection.evaluate(el=>getComputedStyle(el).borderRadius),'8px');
            const sizes=await page.evaluate(()=>({
                list:getComputedStyle(document.querySelector('.ProjectItem-name-3IyjO')).fontSize,
                search:getComputedStyle(document.querySelector('.SearchItem-searchInput-a6ypV')).fontSize,
                username:getComputedStyle(document.querySelector('.HomeHeader-username-2_ExH')).fontSize,
                heading:getComputedStyle(document.querySelector('.CalendarDayView-weekday-20TDc')).fontSize,
                time:getComputedStyle(document.querySelector('.CalendarDayView-timeLabel-2NbT4')).fontSize
            }));assert.deepEqual(sizes,{list:'18px',search:'18px',username:'18px',heading:'22px',time:'14px'});
            await page.screenshot({path:path.join(evidence,'schedule-selection.png')});
            await page.mouse.up();await page.keyboard.press('Escape');
        });
        await scenario('official-style day, task sidebar and compact quick task render together',async page=>{
            await page.evaluate(async()=>{
                const start=new Date();start.setHours(12,50,0,0);
                const first=await FocusLocalData.createCalendarTask({name:'0',projectId:'id-task-tasks',startTime:start.getTime(),interval:1500,count:1,shortBreak:300});
                start.setHours(14,5,0,0);
                await FocusLocalData.createCalendarTask({name:'2',projectId:'id-task-tasks',startTime:start.getTime(),interval:6060,count:1,shortBreak:300});
                const db=await FocusLocalData.open();await FocusLocalData.transaction(db,['Task'],'readwrite',tx=>tx.objectStore('Task').put({...first.task,id:'visual-completed-task',name:'1'}));
                start.setHours(14,20,0,0);
                await FocusLocalData.putPomodoro({id:'visual-completed',objType:'POMODORO',state:0,interval:3960,pomodoroInterval:1500,endDate:start.getTime(),taskId:'visual-completed-task',subtaskId:'',sync:0});
            });
            await page.locator('[data-event-id="visual-completed"]').waitFor();
            const scroll=page.locator('[class*="timelineScroll"]').first();await scroll.evaluate(el=>el.scrollTop=12.5*124);
            const completed=page.locator('[data-event-id="visual-completed"]');
            assert.equal(await completed.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
            await page.screenshot({path:path.join(evidence,'schedule-day.png')});
            await page.locator('.focus-schedule-add').click();
            await page.locator('[class*="CalendarView-taskListTrigger"]').click();
            await page.locator('#calendar-task-list-popover').waitFor();
            await page.waitForFunction(()=>{
                let node=document.getElementById('calendar-task-list-popover');
                if(!node)return false;
                for(;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.99)return false;
                return true;
            });
            await page.screenshot({path:path.join(evidence,'schedule-task-panel.png')});
            await page.locator('#calendar-task-list-popover').getByText('明天',{exact:true}).click();
            await page.locator('[class*="CalendarView-taskPaneClose"]').click();
            await page.evaluate(()=>{const date=new Date();date.setHours(13,50,0,0);window.__calendar.openQuickTask(date.getTime(),3000)});
            assert.equal(await page.locator('.focus-schedule-native-fields .PomodoroItem-root-2imI9').count(),1);
            assert.equal(await page.locator('.focus-calendar-dialog select, .focus-calendar-dialog details').count(),0);
            await page.screenshot({path:path.join(evidence,'schedule-quick.png')});
            await page.keyboard.press('Escape');
        });
        await scenario('English dark quick task stays within a narrow viewport', async page => {
            await page.setViewportSize({ width: 600, height: 720 });
            await page.evaluate(() => window.__calendar.openQuickTask(Date.now(), 1500));
            const form = page.getByRole('dialog'); await form.waitFor(); assert((await form.innerText()).includes('Add task'));
            assert(!(await form.innerText()).includes('unavailable in English'));
            const box = await form.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 600);
            assert.equal(await form.getAttribute('data-dark'), 'true');
            await page.screenshot({ path: path.join(evidence, 'calendar-english-dark-1.7.1.png') });
            await page.keyboard.press('Escape');
        }, 'en', true);
    } finally {
        fs.writeFileSync(path.join(evidence, 'calendar-results.json'), JSON.stringify({ version: require('../package.json').version, results }, null, 2) + '\n');
        await browser.close(); await new Promise(resolve => server.close(resolve));
    }
    if (results.some(result => !result.passed)) process.exitCode = 1;
    console.log(`${results.filter(result => result.passed).length}/${results.length} calendar scenarios passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
