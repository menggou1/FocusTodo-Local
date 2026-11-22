const test = require('node:test');
const assert = require('node:assert/strict');
const { createApplication, seed } = require('./core-helpers.cjs');

test('one project snapshot keeps all presets before custom lists, stable ties and saved folder/order changes', async t => {
    const h = await createApplication(); t.after(h.dispose);
    const lists = [
        {id:'z-first',name:'First',type:1000,order:-90000,parentId:'folder'},
        {id:'folder',name:'Folder',type:2000,order:0},
        {id:'a-last',name:'Last',type:1000,order:10000},
    ];
    for (const values of lists) await h.app.business.command({type:'addProject',values});
    const snapshot = h.app.business.getSnapshot();
    const custom = snapshot.projects.filter(row=>row.type<4000);
    assert.deepEqual(custom.map(row=>row.id), ['z-first','folder','a-last']);
    assert(snapshot.projects.findIndex(row=>row.type<4000) > snapshot.projects.findLastIndex(row=>row.type>=4000));
    const stored = custom.map(row=>({id:row.id,order:row.order,parentId:row.parentId}));
    await h.app.business.command({type:'reorderProjects',from:'a-last',to:'z-first',snapshot:custom.map(({id,order})=>({id,order}))});
    await h.app.business.refresh();
    assert.deepEqual(h.app.business.getSnapshot().projects.filter(row=>row.type<4000).map(row=>row.id), ['a-last','z-first','folder']);
    assert.equal(h.app.business.getSnapshot().projects.find(row=>row.id==='z-first').parentId,'folder');
    assert.deepEqual(stored[0],{id:'z-first',order:-90000,parentId:'folder'},'Projection never mutates input snapshots');
    const {orderedProjects} = await import('../../standalone/domain/project-order.mjs');
    assert.deepEqual(orderedProjects([{id:'z',order:0,type:1000},{id:'a',order:0,type:1000}]).map(row=>row.id),['z','a']);
});

test('report cache invalidates after committed record edits and task/project reassociation', async t => {
    const h = await createApplication(); t.after(h.dispose);
    const { focusStacks } = await import('../../standalone/domain/reports.mjs');
    const task=await h.app.business.command({type:'addTask',values:{id:'task',name:'Task',projectId:'id-task-tasks'}});
    await seed(h.app.repository,'Pomodoro',[{id:'record',objType:'POMODORO',state:0,taskId:task.id,interval:1500,pomodoroInterval:1500,endDate:h.clock.value}]);
    await h.app.business.refresh();
    const get=()=>h.app.business.report(h.clock.value-3600000,h.clock.value+1);
    const before=get(); assert.equal(before.time,1500); assert.strictEqual(get(),before);
    const published=[];
    t.after(h.app.business.subscribe(()=>{
        const {tasks,projects}=h.app.business.getSnapshot();
        published.push(focusStacks(tasks,projects,[get()])[0]);
    }));
    await h.app.business.command({type:'addProject',values:{id:'new-list',name:'New'}});
    await h.app.business.command({type:'updateTask',id:task.id,changes:{projectId:'new-list'},expected:task});
    assert.deepEqual(get().byProject,{'new-list':1500});
    await h.app.business.command({type:'updateRecord',id:'record',changes:{interval:1800},expected:{interval:1500}});
    assert.equal(get().time,1800); assert.equal(before.time,1500);
    assert.deepEqual(published.at(-1),[{id:'new-list',seconds:1800,kind:'project'}]);
    const second=await h.app.business.command({type:'addProject',values:{id:'second',name:'Second',order:10000}});
    const secondTask=await h.app.business.command({type:'addTask',values:{name:'Second',projectId:second.id}});
    await h.app.business.command({type:'addRecord',values:{taskId:secondTask.id,interval:2400,pomodoroInterval:1500}});
    const lists=h.app.business.getSnapshot().projects.filter(project=>project.type===1000);
    await h.app.business.command({type:'reorderProjects',from:'second',to:'new-list',snapshot:lists.map(({id,order})=>({id,order}))});
    assert.deepEqual(published.at(-1),[{id:'second',seconds:2400,kind:'project'},{id:'new-list',seconds:1800,kind:'project'}]);
});

test('focus chart projects exact seconds through independent task and list ordering domains', async () => {
    const { aggregateRecords, calendarRange, focusStacks } = await import('../../standalone/domain/reports.mjs');
    const at = +new Date(2026, 10, 18, 12);
    const projects = [
        { id: 'large', type: 1000, order: Number.MAX_SAFE_INTEGER },
        { id: 'missing', type: 1000 },
        { id: 'first', type: 1000, order: -Number.MAX_SAFE_INTEGER },
        { id: 'system', type: 7005, order: Number.MAX_SAFE_INTEGER },
    ];
    const tasks = [
        { id: 'a', projectId: 'system', priority: 1, order: -Number.MAX_SAFE_INTEGER },
        { id: 'b', projectId: 'high-last', priority: 3 },
        { id: 'c', projectId: 'high-first', priority: 3, order: -Number.MAX_SAFE_INTEGER },
        { id: 'd', projectId: 'first', priority: 3 },
        { id: 'e', projectId: 'large', priority: 3 },
        { id: 'f', projectId: 'missing', priority: 3 },
    ];
    const input = [['a', 15], ['a', 75], ['b', 800], ['c', 100], ['d', 1500], ['e', 30], ['f', 900], ['deleted-task', 60]];
    const records = input.map(([taskId, interval]) => ({ taskId, interval, endDate: at, pomodoroInterval: 1500 }));
    const ranges = ['day', 'week', 'month', 'year'].map(period => calendarRange(at, period));
    const summaries = () => ranges.map(({start, end}) => aggregateRecords(records, start, end, tasks));
    const expected = [['high-first', 100], ['high-last', 800], ['system', 90], ['null', 60], ['first', 1500], ['missing', 900], ['large', 30]];
    const check = rows => {
        const reports = summaries();
        for (const [i, segments] of focusStacks(tasks, projects, reports).entries()) {
            assert.deepEqual(segments.map(({ id, seconds }) => [id, seconds]), rows);
            assert.deepEqual(segments.map(({ kind }) => kind), ['tasks', 'tasks', 'tasks', 'tasks', 'project', 'project', 'project']);
            assert.equal(segments.reduce((sum, { seconds }) => sum + seconds, 0), reports[i].time);
            assert.deepEqual(Object.fromEntries(segments.map(({id, seconds}) => [id, seconds])), reports[i].byProject);
        }
    };
    check(expected);
    projects[0].order = -Number.MAX_SAFE_INTEGER;
    records[0].interval = 3000;
    tasks[0].priority = 4;
    check([['system', 3075], ...expected.slice(0, 2), expected[3], expected[6], ...expected.slice(4, 6)]);
});

test('shared legacy display formats cover year/day boundaries, midnight, seconds and minute carry', async () => {
    const f=await import('../../standalone/domain/display.mjs');
    const now=new Date(2026,10,8,12);
    for(const [locale,today,tomorrow,past,cross] of [
        ['zh-CN','今天','明天','11月7日','2025年11月7日'],
        ['en','Today','Tomorrow','7 Nov','7 Nov 2025'],
    ]) {
        assert.equal(f.formatTaskDate(+now,locale,now),today);
        assert.equal(f.formatTaskDate(+new Date(2026,10,9),locale,now),tomorrow);
        assert.equal(f.formatTaskDate(+new Date(2026,10,7),locale,now),past);
        assert.equal(f.formatTaskDate(+new Date(2025,10,7),locale,now),cross);
    }
    assert.equal(f.formatClock(+new Date(2026,10,8,0,5)),'00:05');
    assert.equal(f.formatSecondsDuration(25,'zh-CN'),'25秒');
    assert.equal(f.formatSecondsDuration(90,'en'),'2m');
    assert.equal(f.formatMinutesDuration(60,'en'),'1h');
    assert.equal(f.formatMinutesDuration(61,'zh-CN'),'1小时1分钟');
    assert.equal(f.formatCompactDuration(3599),'1h');
    assert.equal(f.formatDateTime(+new Date(2026,10,8,12,5),'zh-CN'),'2026年11月8日 中午12:05');
});
