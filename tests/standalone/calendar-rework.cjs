const {assert, evidence, path} = require('./helpers.cjs');

const date = '2026-11-12';
const today = Date.parse(date + 'T08:00:00+08:00');
const title = 'jgy pq';
const toggle = '.legacy-calendar-pane-toggle';
const inspector = '.legacy-record-inspector';
const cases = [];

function task(id, name, order) {
    return {id, name, order, objType:'TASK', projectId:'id-task-tasks', state:0,
        isFinished:false, deadline:today + 12 * 3600000, creationDate:today, estimatePomoNum:1};
}

async function seed(page, tables) {
    await page.evaluate(tables => new Promise((resolve, reject) => {
        const request = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(Object.keys(tables), 'readwrite');
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => { db.close(); reject(tx.error); };
            for (const [store, entries] of Object.entries(tables)) {
                for (const row of entries) tx.objectStore(store).add(row);
            }
        };
    }), tables);
    await page.reload();
    await page.getByTestId('app-shell').waitFor();
}

for (const [locale, dark, compact] of [
    ['zh-CN', false, 375], ['zh-CN', true, 600], ['en', false, 820], ['en', true, 375],
]) {
    const t = (zh, en) => locale === 'en' ? en : zh;
    const key = locale + '-' + (dark ? 'dark' : 'light');
    async function capture(page, engine, name) {
        await page.evaluate(() => document.fonts.ready.then(() => {}));
        await page.screenshot({path:path.join(evidence, `rework-${engine}-${key}-${name}.png`)});
    }
    cases.push([`calendar rework seven requirements ${key}`, {locale}, async ({page}, {rows, engine}) => {
        await page.clock.setFixedTime(new Date(today));
        await page.locator('[data-view=settings]').click();
        await page.getByRole('button',{name:t('外观','Appearance'),exact:true}).click();
        await page.getByTestId('prototype-theme').selectOption(dark ? 'dark' : 'light');
        await page.waitForFunction(value => document.documentElement.dataset.theme === value, dark ? 'dark' : 'light');
        await page.getByTestId('close-page').click();

        // 4. Choose Someday in the workspace composer, then type before saving.
        await page.locator('[data-view=tasks]').click();
        const form = page.locator('.workspace-add-task');
        await form.locator('.workspace-quick-deadline-picker summary').click();
        const datePicker = page.locator('.workspace-picker-surface:not(.is-closing) .legacy-date-picker');
        const someday = datePicker.locator('.legacy-date-quick button').nth(3);
        await someday.click();
        assert.equal(await someday.getAttribute('aria-pressed'), 'true');
        await capture(page, engine, '04-someday-selected');
        await datePicker.locator('.primary').click();
        await datePicker.waitFor({state:'hidden'});
        await page.waitForFunction(() => localStorage.getItem('FocusTodoStandalone.data.DefaultDeadline') === '0');
        const name = form.locator('input');
        await name.pressSequentially(title);
        assert.equal(await name.inputValue(), title);
        assert.deepEqual(await rows(page,'Task'), []);
        await page.evaluate(() => document.fonts.ready.then(() => {}));
        const ink = await name.evaluate(input => {
            const css = getComputedStyle(input);
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
            const text = ctx.measureText(input.value);
            const height = input.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
            return {height, line:parseFloat(css.lineHeight), size:parseFloat(css.fontSize), ascent:text.actualBoundingBoxAscent,
                descent:text.actualBoundingBoxDescent, width:text.width, inputWidth:input.clientWidth,
                fontAscent:text.fontBoundingBoxAscent, fontDescent:text.fontBoundingBoxDescent};
        });
        assert.equal(ink.size, 14);
        assert(ink.line >= 22 && ink.height >= ink.line && ink.width < ink.inputWidth);
        const baseline = (ink.height + ink.fontAscent - ink.fontDescent) / 2;
        assert(ink.descent > 0 && baseline - ink.ascent >= 0 && baseline + ink.descent <= ink.height, JSON.stringify(ink));
        await capture(page, engine, '04-someday-typing');
        await name.press('Enter');
        await page.getByRole('button',{name:title,exact:true}).waitFor();
        assert.deepEqual((await rows(page,'Task')).map(row => [row.name,row.deadline]), [[title,0]]);
        assert.deepEqual(await rows(page,'Schedule'), []);

        const plan = task('calendar-plan-task', 'Plan', 10000);
        const focus = task('calendar-focus-task', 'Focus', 20000);
        const timed = {state:0, creationDate:today, subtaskId:'', sync:0, interval:1800};
        await seed(page, {
            Task:[plan,focus,task('calendar-third-task','Third',30000)],
            Schedule:[{...timed,id:'calendar-plan',taskId:plan.id,endDate:today+1800000,objType:'SCHEDULE',isAllDay:false}],
            Pomodoro:[{...timed,id:'calendar-focus',taskId:focus.id,endDate:today+5400000,objType:'POMODORO',pomodoroInterval:1800}],
        });
        const openCalendar = () => page.getByRole('button',{name:t('日程','Schedule'),exact:true}).click();
        await openCalendar();
        const scroll = page.locator('.legacy-calendar-scroll');
        await scroll.evaluate(node => { node.scrollTop = 8 * 124; });
        const panel = page.locator('#calendar-task-panel');
        const button = page.locator(toggle);
        await button.click();
        // 1. Sample the timeline titles and pane rows, including the narrow split.
        for (const width of [1280, compact]) {
            await page.setViewportSize({width,height:650});
            await page.evaluate(() => document.fonts.ready.then(() => {}));
            const layout = await page.evaluate(() => {
                const toggle = document.querySelector('.legacy-calendar-pane-toggle');
                const rect = toggle.getBoundingClientRect();
                const axis = document.querySelector('.legacy-calendar-body').getBoundingClientRect();
                const pane = document.querySelector('.legacy-calendar-pane').getBoundingClientRect();
                const text = [...document.querySelectorAll('.legacy-event-title>span,.legacy-calendar-task-name')];
                return {clear:axis.right <= pane.left && rect.bottom <= axis.top,
                    labels:text.map(el => {
                        const box = el.getBoundingClientRect(), range = document.createRange();
                        range.selectNodeContents(el);
                        const ink = [...range.getClientRects()];
                        range.setEnd(el.firstChild, 1);
                        const first = range.getBoundingClientRect();
                        const x = first.left + first.width / 2, y = Math.max(box.top + 1, first.top + first.height / 2);
                        const css = getComputedStyle(el);
                        const lineSpan = Math.max(...ink.map(line => line.top)) - Math.min(...ink.map(line => line.top));
                        return {name:el.textContent, font:parseFloat(css.fontSize), width:box.width, height:box.height,
                            inkWidths:ink.map(line => line.width), lineSpan,
                            fits:lineSpan + parseFloat(css.lineHeight) <= box.height + 1 &&
                                ink.every(line => line.left >= box.left - 1 && line.right <= box.right + 1),
                            separated:box.left >= rect.right || box.right <= rect.left || box.top >= rect.bottom || box.bottom <= rect.top,
                            hit:el.contains(document.elementFromPoint(x,y))};
                    })};
            });
            assert(layout.clear, `Calendar body, toggle and pane are separated at ${width}px`);
            assert(layout.labels.filter(label => label.name === 'Plan' || label.name === 'Focus').length === 4);
            assert(layout.labels.every(label => label.font >= 12 && label.separated && label.hit && label.fits), JSON.stringify(layout));
            await capture(page, engine, '01-toggle-' + width);
        }

        // 5. Measure the actual task rows and operate the shared thumb.
        const list = panel.locator('.legacy-calendar-task-list');
        const track = panel.locator('.legacy-local-scroll-track');
        const readList = () => list.evaluate(el => {
            const box = el.getBoundingClientRect();
            const rows = [...el.children].map(node => node.getBoundingClientRect());
            return {start:rows[0].top - box.top, gaps:rows.slice(1).map((row, i) => row.top - rows[i].bottom),
                remaining:box.bottom - rows.at(-1).bottom, client:el.clientHeight, scroll:el.scrollHeight,
                native:getComputedStyle(el).scrollbarWidth, shared:el.classList.contains('legacy-scroll-view')};
        });
        const short = await readList();
        assert(short.start <= 8 && short.gaps.length === 2 && short.gaps.every(gap => gap === 12));
        assert(short.remaining > 100 && short.client === short.scroll && short.shared && short.native === 'none');
        assert.equal(await track.getAttribute('hidden'), '');
        await capture(page, engine, '05-short-list');
        await seed(page, {Task:Array.from({length:24}, (_, i) => task('calendar-more-'+i,'Extra '+i,40000+i*10000))});
        await openCalendar();
        await button.click();
        const long = await readList();
        assert(long.gaps.every(gap => gap === 12) && long.scroll > long.client && long.shared && long.native === 'none');
        assert.equal(await track.getAttribute('hidden'), null);
        const bounds = await list.boundingBox();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 100);
        await page.mouse.wheel(0, 96);
        await page.waitForFunction(() => document.querySelector('.legacy-calendar-task-list').scrollTop > 0);
        const thumb = track.locator('.legacy-scroll-thumb');
        const thumbBox = await thumb.boundingBox();
        const trackBox = await track.boundingBox();
        await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(thumbBox.x + thumbBox.width / 2, trackBox.y + trackBox.height - 2, {steps:6});
        await page.mouse.up();
        assert(await list.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1));
        assert(await list.getByText('Extra 23',{exact:true}).evaluate(el => {
            const r = el.getBoundingClientRect();
            const viewport = el.closest('.legacy-calendar-task-list').getBoundingClientRect();
            return r.top >= viewport.top && r.bottom <= viewport.bottom &&
                [r.left + 4, r.right - 4].some(x => document.elementFromPoint(x, r.y + r.height / 2) === el);
        }));
        await capture(page, engine, '05-overflow-thumb');
        await button.click();
        await page.setViewportSize({width:1280,height:800});

        // 3. A real picker interaction preserves the inspector, blank chrome dismisses it.
        const details = page.locator(inspector);
        const card = id => page.locator(`[data-event-id="${id}"] .legacy-event-title`);
        await card('calendar-plan').click();
        await details.waitFor();
        const linkedTask = details.locator('.legacy-record-field').first().locator('.legacy-record-value');
        assert.equal(await linkedTask.innerText(), 'Plan');
        assert(await linkedTask.evaluate(el => {
            const box = el.getBoundingClientRect();
            const button = document.querySelector('.legacy-calendar-pane-toggle').getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(el);
            const ink = range.getBoundingClientRect();
            return box.top >= button.bottom && ink.right <= box.right + 1 &&
                el.contains(document.elementFromPoint(ink.x + ink.width / 2, ink.y + ink.height / 2));
        }), 'The toggle and the linked task name in the inspector do not overlap');
        await capture(page, engine, '01-toggle-with-details');
        const view = page.getByLabel(t('日程视图','Schedule view'),{exact:true});
        const options = page.locator('.legacy-settings-menu[role=listbox]');
        await view.click();
        await options.locator('[aria-selected=true]').click();
        assert(await details.isVisible());
        await capture(page, engine, '03-before-blank');
        const blank = await page.locator('.workspace-header').evaluate(el => {
            const box = el.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
            return {x, y, hit:document.elementFromPoint(x,y) === el};
        });
        assert(blank.hit);
        await page.mouse.click(blank.x, blank.y);
        await details.waitFor({state:'hidden'});
        await capture(page, engine, '03-after-blank');

        // 2. Both inspector paths block a write until confirmation.
        const originalTasks = await rows(page,'Task');
        for (const [id, store, other, dialogTitle] of [
            ['calendar-plan','Schedule','Pomodoro',t('删除此日程？','Delete this schedule?')],
            ['calendar-focus','Pomodoro','Schedule',t('删除此专注记录？','Delete this focus record?')],
        ]) {
            const original = await rows(page,store), related = await rows(page,other);
            await card(id).click();
            const remove = details.getByRole('button',{name:t('删除','Delete'),exact:true});
            const confirm = page.getByRole('dialog',{name:dialogTitle,exact:true});
            await remove.click();
            await confirm.waitFor();
            assert.deepEqual(await rows(page,store), original);
            await capture(page, engine, '02-confirm-' + store);
            await confirm.getByRole('button',{name:t('取消','Cancel'),exact:true}).click();
            await confirm.waitFor({state:'hidden'});
            assert.deepEqual(await rows(page,store), original);
            assert(await remove.evaluate(el => el === document.activeElement));
            await remove.click();
            await confirm.getByRole('button',{name:t('删除','Delete'),exact:true}).click();
            await details.waitFor({state:'hidden'});
            await card(id).waitFor({state:'hidden'});
            assert.deepEqual(await rows(page,store), original.map(row => row.id === id ? {...row,state:-1} : row));
            assert.deepEqual(await rows(page,other), related);
            assert.deepEqual(await rows(page,'Task'), originalTasks);
        }

        // 6–7. Shared popup semantics, grid modes and localized date navigation.
        await view.click();
        assert.deepEqual(await options.getByRole('option').allTextContents(), t(['日','周','月'],['Day','Week','Month']));
        assert.equal(await options.locator('[aria-selected=true]').innerText(), t('日','Day'));
        await capture(page, engine, '06-shared-view-menu');
        await options.getByRole('option',{name:t('周','Week'),exact:true}).click();
        assert.equal(await page.locator('.domain-calendar-day').count(), 7);
        await view.press('Enter');
        assert.equal(await options.locator('[aria-selected=true]').innerText(), t('周','Week'));
        await view.press('End');
        await view.press('Enter');
        assert.equal(await view.inputValue(),'month');
        assert.equal(await page.locator('.domain-calendar-day').count(),42);
        await view.click();
        await options.getByRole('option',{name:t('日','Day'),exact:true}).click();
        const day = page.locator('.domain-calendar-grid.day>.domain-calendar-day');
        await page.getByRole('button',{name:t('上一期','Previous period'),exact:true}).click();
        assert.equal(await day.getAttribute('data-date'), '2026-11-11');
        await page.getByRole('button',{name:t('回到今天','Back to Today'),exact:true}).click();
        assert.equal(await day.getAttribute('data-date'), date);
        assert((await page.locator('.legacy-calendar-day-title').innerText()).startsWith(t('今天','Today')));
        await capture(page, engine, '07-back-to-today');
    }]);
}

module.exports = {cases};
