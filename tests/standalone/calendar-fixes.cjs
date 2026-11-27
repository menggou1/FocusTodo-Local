const {assert}=require('./helpers.cjs');
const {prepare}=require('./calendar-motion.cjs');

const date='2026-11-12';
const today=Date.parse(date+'T08:00:00+08:00');
const toggle='.legacy-calendar-pane-toggle';
const inspector='.legacy-record-inspector';

async function manyLists(page){
    await page.evaluate(()=>new Promise((resolve,reject)=>{
        const open=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);
        open.onerror=()=>reject(open.error);
        open.onsuccess=()=>{
            const db=open.result,tx=db.transaction('Project','readwrite'),store=tx.objectStore('Project');
            tx.oncomplete=()=>{db.close();resolve()};
            tx.onabort=()=>{db.close();reject(tx.error)};
            for(let i=0;i<22;i++)store.add({id:'calendar-list-'+i,objType:'PROJECT',state:0,type:1000,
                name:'Calendar list '+String(i).padStart(2,'0')+' — long enough to need ellipsis at narrow sizes',
                creationDate:Date.now(),color:'4670F6',order:i*10000});
        };
    }));
    await page.reload();
    await page.getByRole('button',{name:'Schedule',exact:true}).click();
}

async function clockCalendar(page,locale){
    await page.clock.setFixedTime(new Date(today));
    await page.getByRole('button',{name:locale==='en'?'Schedule':'日程',exact:true}).click();
}

const cases=[
    ['calendar pane toggle stays visible and leaves a narrow drag target',{},async({page},{rows})=>{
        await prepare(page,'en',[]);
        const button=page.locator(toggle);
        for(const width of [1280,1000,820,600,375]){
            await page.setViewportSize({width,height:560});
            for(const expanded of [false,true]){
                assert.equal(await button.getAttribute('aria-expanded'),String(expanded));
                const hit=await button.evaluate(el=>{
                    const r=el.getBoundingClientRect();
                    return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight
                        && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                });
                assert(hit,'The pane toggle is visible and hittable at '+width+' px, expanded='+expanded);
                if(expanded){
                    const picker=await page.locator('.legacy-calendar-list-picker>summary').boundingBox();
                    const bounds=await button.boundingBox();
                    assert(picker.x+picker.width<=bounds.x,'The project trigger leaves room for the pane toggle');
                }
                await button.click();
            }
        }
        assert.equal(await page.locator('#calendar-task-panel').getAttribute('inert'),'');
        await button.click();
        const task=await page.locator('.legacy-calendar-task').boundingBox();
        const timeline=page.locator('.legacy-calendar-scroll');
        const viewport=await timeline.boundingBox();
        const day=await timeline.locator('.domain-calendar-day').boundingBox();
        const target={x:day.x+10,y:viewport.y+30};
        assert(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.matches('.domain-time-slot'),target),
            'The open task pane leaves an exposed time slot at 375 px');
        const ghost=page.locator('.legacy-calendar-task-drag');
        await page.mouse.move(task.x+10,task.y+8);
        await page.mouse.down();
        await page.mouse.move(task.x+20,task.y+8);
        await ghost.locator('div').getByText('Unplaced',{exact:true}).waitFor();
        await page.mouse.move(target.x,target.y,{steps:4});
        await ghost.locator('div').getByText(/^Starts /).waitFor();
        await page.mouse.up();
        await page.locator('.domain-time-event.schedule:not(.legacy-calendar-selection)').waitFor();
        const schedules=await rows(page,'Schedule');
        assert.equal(schedules.length,1);
        assert.equal(schedules[0].taskId,'calendar-task');
        assert.equal(schedules[0].interval,3000);
    }],
    ['calendar project menu aligns, sizes naturally and scrolls only when needed',{},async({page})=>{
        await clockCalendar(page,'en');
        const trigger=page.locator('.legacy-calendar-list-picker>summary');
        const popup=page.locator('.workspace-picker-surface:not(.is-closing) .legacy-calendar-project-menu');
        const track=page.locator('.workspace-picker-surface:not(.is-closing):has(.legacy-calendar-project-menu)>.legacy-scroll-track');
        const inspectMenu=menu=>{
            const box=menu.getBoundingClientRect(),items=[...menu.querySelectorAll('[role=option]')];
            const tops=items.map(el=>el.getBoundingClientRect().top);
            return {left:box.left,top:box.top,right:box.right,bottom:box.bottom,client:menu.clientHeight,
                scroll:menu.scrollHeight,first:tops[0]-box.top,ordered:tops.every((top,i)=>i===0||top>tops[i-1]),
                shared:menu.classList.contains('legacy-scroll-view')};
        };
        await page.locator(toggle).click();
        await trigger.click();
        await popup.waitFor();
        const short=await popup.evaluate(inspectMenu),anchor=await trigger.boundingBox();
        assert(Math.abs(short.left-anchor.x)<=1 && short.top>=anchor.y+anchor.height);
        assert(short.ordered && short.first<=10 && short.shared);
        assert.equal(short.client,short.scroll,'A short list sizes to its rows');
        assert.equal(await track.getAttribute('hidden'),'');
        await page.keyboard.press('Escape');
        assert(await trigger.evaluate(el=>document.activeElement===el));

        await manyLists(page);
        await page.setViewportSize({width:600,height:260});
        await page.locator(toggle).click();
        await trigger.click();
        await popup.waitFor();
        const long=await popup.evaluate(inspectMenu);
        assert(long.left>=4 && long.right<=596 && long.top>=4 && long.bottom<=256.5);
        assert(long.ordered && long.first<=10 && long.shared && long.scroll>long.client);
        assert.equal(await track.getAttribute('hidden'),null);
        const box=await popup.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.wheel(0,300);
        await page.waitForFunction(()=>document.querySelector('.legacy-calendar-project-menu')?.scrollTop>0);
        await page.waitForFunction(()=>document.querySelector('.workspace-picker-surface .legacy-scroll-track')?.dataset.visible==='true');
        await popup.getByRole('option',{name:/Calendar list 21/}).click();
        await popup.waitFor({state:'hidden'});
        await trigger.click();
        assert.equal(await popup.getByRole('option',{name:/Calendar list 21/}).getAttribute('aria-selected'),'true');
    }],
    ['calendar detail closes from workspace blanks and leaves interactive controls usable',{},async({page})=>{
        const saved={id:'blank-dismiss',endDate:today+90*60000,interval:1800};
        await prepare(page,'en',[saved]);
        const card=page.locator('[data-event-id="blank-dismiss"] .legacy-event-title'),details=page.locator(inspector);
        const open=async()=>{await card.click();await details.waitFor()};
        const clickBlank=async(selector,x,y)=>{
            const box=await page.locator(selector).boundingBox();
            const point={x:box.x+x,y:box.y+(y ?? box.height-12)};
            const hit=await page.evaluate(({selector,x,y})=>document.elementFromPoint(x,y)?.matches(selector),{selector,...point});
            assert(hit,'The pointer hits the intended blank region '+selector);
            await page.mouse.click(point.x,point.y);
            await details.waitFor({state:'hidden'});
        };
        await open();
        await details.locator('.legacy-record-field>summary').first().click();
        await page.locator('.workspace-picker-surface:not(.is-closing) .legacy-record-task-picker').waitFor();
        await page.keyboard.press('Escape');
        assert(await details.isVisible(),'An inspector field remains usable');
        const dateTrigger=page.locator('.legacy-calendar-date>summary');
        await dateTrigger.click();
        await page.locator('.workspace-picker-surface:not(.is-closing) .legacy-calendar-date-popover').waitFor();
        await page.keyboard.press('Escape');
        assert(await details.isVisible(),'Outside date picker leaves the inspector open');
        await clickBlank('.workspace-header',248,24);
        await open();
        await clickBlank('.workspace-projects',100);
        await open();
        await clickBlank('.legacy-calendar-toolbar',page.viewportSize().width/2-342,1);
        await open();
        await page.getByRole('button',{name:'New schedule '+date+' 08:30',exact:true}).click({position:{x:25,y:8}});
        await details.waitFor({state:'hidden'});
    }],
    ['calendar context and detail deletion share a confirmation and preserve the task',{},async({page},{rows})=>{
        const saved=[{id:'delete-detail',endDate:today+90*60000,interval:1800},
            {id:'delete-context',endDate:today+150*60000,interval:1800}];
        await prepare(page,'en',saved);
        const card=id=>page.locator('[data-event-id="'+id+'"] .legacy-event-title');
        const dialog=page.getByRole('dialog',{name:'Delete this schedule?',exact:true});
        const details=page.locator(inspector);
        const original=await rows(page,'Schedule'),tasks=await rows(page,'Task');
        await card('delete-detail').click();
        const remove=details.getByRole('button',{name:'Delete',exact:true});
        await remove.click();
        await dialog.waitFor();
        const message=await dialog.locator('p').innerText();
        assert.deepEqual(await rows(page,'Schedule'),original);
        await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
        await dialog.waitFor({state:'hidden'});
        assert(await details.isVisible());
        assert(await remove.evaluate(el=>document.activeElement===el),'Cancellation returns focus to Delete');
        assert.deepEqual(await rows(page,'Schedule'),original);
        await remove.click();
        await dialog.getByRole('button',{name:'Delete',exact:true}).click();
        await details.waitFor({state:'hidden'});
        assert.deepEqual(await rows(page,'Schedule'),original.map(row=>row.id==='delete-detail'?{...row,state:-1}:row));
        await card('delete-context').click({button:'right'});
        await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
        assert.equal(await dialog.locator('p').innerText(),message);
        await dialog.getByRole('button',{name:'Delete',exact:true}).click();
        await card('delete-context').waitFor({state:'hidden'});
        assert.deepEqual(await rows(page,'Schedule'),original.map(row=>({...row,state:-1})));
        assert.deepEqual(await rows(page,'Task'),tasks);
    }],
    ...['en','zh-CN'].flatMap(locale=>[false,true].map(dark=>[
        'calendar quick name, shared view picker and Back to Today in '+locale+' '+(dark?'dark':'light'),
        {locale,deviceScaleFactor:dark?1.25:1},
        async({page},{rows})=>{
            const en=locale==='en';
            await page.locator('[data-view=settings]').click();
            await page.getByRole('button',{name:en?'Appearance':'外观',exact:true}).click();
            await page.getByTestId('prototype-theme').selectOption(dark?'dark':'light');
            await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,dark?'dark':'light');
            await page.getByTestId('close-page').click();
            await clockCalendar(page,locale);
            await page.setViewportSize({width:dark?820:1280,height:650});
            const view=page.getByLabel(en?'Schedule view':'日程视图',{exact:true});
            const options=page.locator('.legacy-settings-menu[role=listbox]');
            assert(await view.evaluate(el=>el.parentElement.classList.contains('legacy-settings-select')
                && getComputedStyle(el).appearance==='none' && getComputedStyle(el).backgroundImage!=='none'));
            await view.click();
            assert.deepEqual(await options.getByRole('option').allTextContents(),en?['Day','Week','Month']:['日','周','月']);
            assert.equal(await options.locator('[aria-selected=true]').innerText(),en?'Day':'日');
            await options.getByRole('option',{name:en?'Week':'周',exact:true}).click();
            assert.equal(await view.inputValue(),'week');
            assert.equal(await page.locator('.domain-calendar-day').count(),7);
            await view.press('Enter');
            assert.equal(await options.locator('[aria-selected=true]').innerText(),en?'Week':'周');
            assert.notEqual(await options.locator('[aria-selected=true]').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
            await view.press('End');
            await view.press('Enter');
            assert.equal(await view.inputValue(),'month');
            assert.equal(await page.locator('.domain-calendar-day').count(),42);
            await view.click();
            await options.getByRole('option',{name:en?'Day':'日',exact:true}).click();
            const day=page.locator('.domain-calendar-grid.day>.domain-calendar-day');
            await page.getByRole('button',{name:en?'Previous period':'上一期',exact:true}).click();
            assert.equal(await day.getAttribute('data-date'),'2026-11-11');
            await page.getByRole('button',{name:en?'Back to Today':'回到今天',exact:true}).click();
            assert.equal(await day.getAttribute('data-date'),date);

            await page.getByRole('button',{name:(en?'New schedule':'新建安排')+' '+date+' 09:00',exact:true})
                .dblclick({position:{x:25,y:8}});
            const quick=page.locator('dialog.legacy-record-quick');
            const input=quick.locator('.legacy-record-name>input');
            await input.fill('jgy pq');
            await page.evaluate(()=>document.fonts.ready.then(()=>{}));
            assert(await input.evaluate(el=>{
                const css=getComputedStyle(el),height=parseFloat(css.lineHeight),font=parseFloat(css.fontSize);
                return font===14 && el.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)>=height && height>=22;
            }),'Quick input has room for descenders at its original font size');
            await quick.locator('.legacy-record-pomodoro>summary').click();
            const pomodoro=quick.locator('.legacy-pomodoro-picker');
            await pomodoro.getByRole('listbox').nth(1).press('Home');
            await pomodoro.locator('footer>.primary').click();
            const preview=page.locator('.legacy-calendar-selection .legacy-event-title>span');
            assert.equal(await preview.innerText(),'jgy pq');
            assert(await preview.evaluate(el=>{
                const range=document.createRange();range.selectNodeContents(el);
                const text=range.getBoundingClientRect(),line=el.getBoundingClientRect(),card=el.closest('.domain-time-event').getBoundingClientRect();
                return text.top>=line.top-0.5 && text.bottom<=line.bottom+0.5
                    && line.top>=card.top && line.bottom<=card.bottom && text.width>0;
            }),'The descender line and its text fit in the minimum-height draft card');
            await quick.locator('form>footer>button[type=submit]').click();
            await quick.waitFor({state:'hidden'});
            const tasks=(await rows(page,'Task')).filter(row=>row.name==='jgy pq');
            assert.equal(tasks.length,1);
            assert.equal(tasks[0].estimatePomoNum,0);
            const schedules=await rows(page,'Schedule');
            assert.equal(schedules.length,1,'Quick creation keeps the existing minimum of one schedule');
            assert.equal(schedules[0].taskId,tasks[0].id);
            assert.equal(schedules[0].interval,60);
        }
    ])),
];

module.exports={cases};
