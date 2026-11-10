const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const { createApplication, rows, seed, MemoryStorage } = require('./core-helpers.cjs');
const { localData } = require('../helpers/local-data.cjs');
const { legacyOracle } = require('./legacy-oracle.cjs');
const clone = value => JSON.parse(JSON.stringify(value));

async function pair(t) {
    const h = await createApplication(); t.after(h.dispose);
    const old = await localData();
    const oracle = legacyOracle({ db: await old.data.open(), storage: old.storage, now: () => h.clock.value, uuid: () => crypto.randomUUID() });
    return { ...h, oracle, old };
}
test('projects/tasks/subtasks CRUD, completion, search and tombstones match legacy managers', async t => {
    const { app, oracle, old } = await pair(t);
    const project = { id: 'list', name: 'Synthetic list', future: 'preserve' };
    assert.deepEqual(await app.business.command({ type: 'addProject', values: project }), clone(await oracle.projects().addProject(project)));
    const task = { id: 'task', name: 'Synthetic task', projectId: 'list', remark: 'A note', priority: 3, tags: '', future: { x: 1 } };
    assert.deepEqual(await app.business.command({ type: 'addTask', values: task }), clone(await oracle.tasks().addTask(task)));
    const subtask = { id: 'child', name: 'Needle child', taskId: 'task', order: 20000 };
    assert.deepEqual(await app.business.command({ type: 'addSubtask', values: subtask }), clone(await oracle.subtasks().addSubtask(subtask)));
    assert.deepEqual(await app.business.command({ type: 'updateTask', id: 'task', changes: { remark: 'Updated note' } }), clone(await oracle.tasks().updateTaskInfo('task', { remark: 'Updated note' })));
    assert.deepEqual(app.business.search('needle'), clone(await oracle.tasks().searchTasksByKeyword('needle')));
    assert.deepEqual(app.business.search('NOTE'), clone(await oracle.tasks().searchTasksByKeyword('NOTE')));
    assert.deepEqual(await app.business.command({ type: 'toggleSubtask', id: 'child' }), clone(await oracle.subtasks().switchSubtaskFinishedState('child')));
    assert.deepEqual(await app.business.command({ type: 'completeTask', id: 'task' }), clone(await oracle.tasks().completeTask('task')));
    assert.deepEqual(await app.business.command({ type: 'uncompleteTask', id: 'task' }), clone(await oracle.tasks().uncompleteTask('task')));
    await app.business.command({ type: 'removeTask', id: 'task' }); await oracle.tasks().deleteTask('task');
    const legacy = await old.data.snapshot();
    for (const [field, table] of [['tasks','Task'],['subtasks','Subtask'],['records','Pomodoro']]) assert.deepEqual(clone(app.business.getSnapshot()[field]), clone(legacy.indexedDB[table]));
});
test('recurrence matches old calendar arithmetic through leap days, month clamp, weekdays and catch-up', async t => {
    const h = await pair(t), { nextRepetitionDate } = await import('../../standalone/domain/recurrence.mjs');
    for (const zone of ['Asia/Shanghai','America/New_York']) {
        const previous = process.env.TZ; process.env.TZ = zone;
        try {
            for (const date of [new Date(2024,1,29,23,59,59,999),new Date(2026,0,31,23,59,59,999),new Date(2026,9,31,23,59,59,999)]) {
                for (const [rUnit,rValue] of [['days',''],['weeks','0,2,5'],['months',''],['years','']]) for (const rCycle of [1,2,4]) {
                    const task = { rCycle, rUnit, rValue, rFirstDeadline: date.getTime() }; let value = date.getTime();
                    for (let count = 0; count < 8; count++) { assert.equal(nextRepetitionDate(task,value), h.oracle.tasks().getNextRepetitionDate(task,value), zone + ' ' + rUnit); value = nextRepetitionDate(task,value); }
                }
            }
        } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
    }
    const task = { id: 'repeat', name: 'Repeating task', projectId: 'id-task-tasks', rCycle: 1, rUnit: 'days',
        rFirstDeadline: h.clock.value - 86400000, deadline: h.clock.value - 86400000, reminderDate: h.clock.value - 86400000 + 3600000 };
    await h.app.business.command({ type: 'addTask', values: task }); await h.oracle.tasks().addTask(task);
    await h.app.business.command({ type: 'addSubtask', values: { id:'repeat-child',taskId:'repeat',name:'Repeat child',order:0 } });
    await h.oracle.subtasks().addSubtask({ id:'repeat-child',taskId:'repeat',name:'Repeat child',order:0 });
    const result = await h.app.business.command({ type:'completeTask',id:'repeat' }), expected = clone(await h.oracle.tasks().completeTask('repeat'));
    const normalize = value => ({ finishedTask: value.finishedTask, newTask: { ...value.newTask,id:'generated',rId:'generated' } });
    assert.deepEqual(normalize(result), normalize(expected));
    assert.equal(h.app.business.getSnapshot().subtasks.filter(row=>row.taskId===result.newTask.id).length,1);
    await assert.rejects(h.app.business.command({type:'completeTask',id:'repeat'}), error=>error.code==='conflict');
});
test('history/report total, fractions, task/project aggregation and local day boundaries match legacy', async t => {
    const h = await pair(t), start=h.clock.value, end=start+86400000;
    const task={id:'task',name:'Report task',projectId:'id-task-tasks'};
    await h.app.business.command({type:'addTask',values:task}); await h.oracle.tasks().addTask(task);
    for(const [id,endDate,interval,taskId] of [['cross',start+1200000,1800,'task'],['later',start+4800000,600,''],['deleted',start+6000000,900,'task']]){
        const record={id,endDate,interval,pomodoroInterval:1500,taskId,subtaskId:'',state:id==='deleted'?-1:0};
        await seed(h.app.repository,'Pomodoro',[record]); await h.old.data.putPomodoro(record);
    }
    await h.app.business.refresh();
    const actual=h.app.business.report(start,end), legacy=clone(await h.oracle.records().fetchPomodoroTimeAndNum(start,end));
    assert.equal(actual.time,legacy.time); assert.equal(actual.count,legacy.count);
    assert.deepEqual(actual.byTask,clone(await h.oracle.records().fetchTimeAccumulatedByTask(start,end)));
    assert.deepEqual(actual.byProject,clone(await h.oracle.records().fetchTimeAccumulatedByProject(start,end)));
    const {calendarRange}=await import('../../standalone/domain/reports.mjs');
    const previous=process.env.TZ; process.env.TZ='America/New_York';
    try {const day=calendarRange(new Date(2026,10,1,12).getTime());assert.equal(day.end-day.start,25*3600000);}
    finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
    await assert.rejects(h.app.business.command({type:'addRecord',values:{interval:0,pomodoroInterval:1500}}));
});
test('settings defaults, values and clamps match old getters and failed writes retain snapshots', async t => {
    const h = await pair(t), {preferenceDefinitions}=await import('../../standalone/services/preferences.mjs');
    const widgetLegacy=h.oracle.module(299).default.shared;
    const oldValue=field=>field==='widgetOrder'?clone(widgetLegacy.allWidgets).map(Number):field==='visibleWidgets'?clone(widgetLegacy.widgets).map(Number):field==='widgetExpanded'?widgetLegacy.expanded:h.oracle.settings()[field];
    for(const [field,[key]] of Object.entries(preferenceDefinitions)){
        if(['language','externalNetwork'].includes(field))continue;
        assert.deepEqual(h.app.settings.getSnapshot()[field], oldValue(field),field);
        if(['widgetOrder','visibleWidgets','widgetExpanded'].includes(field))for(const value of field==='widgetExpanded'?['true','false','']:['2,0,1','1','']){h.storage.setItem(key,value);h.old.storage.setItem(key,value);h.app.settings.refresh();assert.deepEqual(h.app.settings.getSnapshot()[field],oldValue(field),field+' '+value)}
        if(['workInterval','shortBreakInterval','longBreakInterval','longBreakPomodoros','ringtoneVolume','whiteNoiseVolume','projectRegionWidth'].includes(field)){
            for(const value of ['1','900','-5','0','100000']){
                h.storage.setItem(key,value);h.old.storage.setItem(key,value);h.app.settings.refresh();
                assert.deepEqual(h.app.settings.getSnapshot()[field],h.oracle.settings()[field],field+' '+value);
            }
        }
    }
    h.physicalStorage.fault=(method,key)=>{if(method==='set'&&key.endsWith('.WorkInterval'))throw new Error('quota')};
    const before=h.app.settings.getSnapshot();await assert.rejects(h.app.settings.set('workInterval',900),/quota/);assert.strictEqual(h.app.settings.getSnapshot(),before);
    h.physicalStorage.fault=()=>{};await h.app.settings.saveProfile('name','合成用户');assert.equal(h.app.settings.profile().name,'合成用户');
    await assert.rejects(h.app.settings.saveProfile('avatar','https://example.invalid/picture'));
});
test('language fallback and release reads agree with old adapters without resetting storage', async t => {
    const h=await createApplication();t.after(h.dispose);
    const catalog=require('../../standalone/shared/catalog.json');
    for(const language of ['en','zh-CN']){
        await h.app.language.setPreference(language);
        const window={FocusLocaleCatalog:catalog},context=vm.createContext({window,localStorage:{getItem:()=>language},navigator:{languages:[language]},document:{documentElement:{}},btoa:value=>Buffer.from(value).toString('base64'),unescape,encodeURIComponent});
        vm.runInContext(fs.readFileSync(require.resolve('../../src/js/local-i18n.js'),'utf8'),context);
        for(const text of ['本地用户','专注完成','Untranslated user task','未知内容'])assert.equal(h.app.language.text(text),window.FocusI18n.text(text));
        for(const key of ['app_name','missing-key'])assert.equal(h.app.language.lookup(key),window.FocusI18n.lookupLegacy(key));
    }
    const current=h.app.release.metadata.version,old=h.app.release.metadata.updates.at(-1).version;
    assert.equal(h.app.release.hasUnread(),true);await h.app.release.markRead(old);assert.equal(h.app.release.hasUnread(),true);
    await h.app.release.markRead(current);assert.equal(h.app.release.hasUnread(),false);
    assert.equal(h.app.release.identify('7.1.1-local.1.9.3').kind,'legacy-local');assert.equal(h.app.release.identify('2.0.0').kind,'independent');
    assert.equal(h.app.release.identify('2.0.0-beta'),null);
    const {releaseMetadata}=await import('../../standalone/domain/release.mjs'),config=clone(require('../../release.json'));
    config.localVersion='2.0.0';config.updates.unshift({version:'2.0.0',date:config.date});const generated=releaseMetadata(config);assert.equal(generated.version,'2.0.0');
    assert(Object.isFrozen(generated.updates));assert(Object.isFrozen(generated.updates[0]));config.updates[0].version='discard';assert.equal(generated.updates[0].version,'2.0.0');
});
test('task detach and history commit atomically, stale edits and duplicate IDs cannot partially complete commands', async t => {
    const h=await createApplication();t.after(h.dispose);
    await h.app.business.command({type:'addTask',values:{id:'focus',name:'Focus',projectId:'id-task-tasks',pomodoroInterval:60}});
    await h.app.startForTask('focus','','countup');h.clock.value+=90000;
    await h.app.business.command({type:'removeTask',id:'focus',preserveHistory:true});await h.app.timer.refresh();
    assert.equal(h.app.timer.getSnapshot().state,'initial');assert.equal(h.app.timer.getSnapshot().taskId,'');
    assert.equal((await rows(h.app.repository,'Pomodoro')).reduce((n,row)=>n+row.interval,0),90);
    await assert.rejects(h.app.startForTask('focus'),error=>error.code==='conflict');
    await assert.rejects(h.app.business.command({type:'addProject',values:{id:'id-task-tasks',name:'duplicate'}}),{name:'ConstraintError'});
    const row=h.app.business.getSnapshot().projects.find(row=>row.id==='id-task-tasks');
    await assert.rejects(h.app.business.command({type:'updateProject',id:row.id,changes:{name:'discard'},expected:{order:row.order+1}}),error=>error.code==='conflict');
    assert.notEqual(h.app.business.getSnapshot().projects.find(item=>item.id===row.id).name,'discard');
});

test('preset task queries, calendar layout and record progress match legacy rules',async t=>{
    const h=await pair(t),date=new Date(h.clock.value);date.setHours(0,0,0,0);const start=date.getTime();
    for(const [id,deadline,priority]of [['none',0,0],['old',start-1,3],['today',start+3600000,2],['tomorrow',start+90000000,1]]){
        const values={id,name:id,deadline,priority,projectId:'id-task-tasks'};await h.app.business.command({type:'addTask',values});await h.oracle.tasks().addTask(values);
    }
    for(const type of [1000,7005,7000,4000,4001,4002,4003,4004,4006,4007,5001,5002,5003]){
        const view={id:'id-task-tasks',type};assert.deepEqual(clone(h.app.business.tasksInView(view)),clone(await h.oracle.tasks().fetchTasksOfProject(view)),String(type));
    }
    const oldCalendar=require('../../src/js/local-calendar.js');
    const events=[{id:'a',start:start-60000,end:start+30000},{id:'b',start:start+60000,end:start+120000},{id:'c',start:start+120000,end:start+3600000}];
    assert.deepEqual(h.app.calendar.layoutEvents(events,start,start+86400000,1),oldCalendar.layoutEvents(events,start,start+86400000,1));
    assert.equal(h.app.calendar.deadlineInSevenDays(start),oldCalendar.deadlineInSevenDays(start));
    await h.app.business.command({type:'addRecord',values:{id:'history',endDate:start+3600000,interval:30,pomodoroInterval:60,taskId:'today'}});
    assert.deepEqual(h.app.business.progress('today'),[0.5]);assert.equal(h.app.business.history({taskId:'today'}).length,1);assert.equal(h.app.calendar.events(start,start+86400000).length,1);
    assert.equal(h.app.business.buckets(start,start+86400000,'day')[0].time,30);
});
test('project visibility/folders/reordering and schedule/record edits preserve unrelated fields',async t=>{
    const h=await pair(t);
    for(const values of [{id:'folder',name:'Folder',type:2000,order:1},{id:'a',name:'A',parentId:'folder',order:2},{id:'b',name:'B',order:3}]){
        await h.app.business.command({type:'addProject',values});await h.oracle.projects().addProject(values);
    }
    await h.app.business.command({type:'addTask',values:{id:'task',name:'Task',projectId:'a'}});await h.oracle.tasks().addTask({id:'task',name:'Task',projectId:'a'});
    await h.app.business.command({type:'setProjectHidden',id:'a',hidden:true});await h.oracle.projects().hideProject('a');
    assert.equal(h.app.business.getSnapshot().tasks[0].state,1);
    await h.app.business.command({type:'setProjectHidden',id:'a',hidden:false});await h.oracle.projects().showProject('a');
    assert.deepEqual(clone(h.app.business.getSnapshot().tasks),clone((await h.old.data.snapshot()).indexedDB.Task));
    await h.app.business.command({type:'removeProject',id:'folder'});await h.oracle.projects().deleteProject(await h.oracle.projects().fetchProjectById('folder'));
    assert.equal(h.app.business.getSnapshot().projects.find(row=>row.id==='a').parentId,'');
    await h.app.business.command({type:'addProject',values:{id:'tag',name:'Tag',type:3000,order:4}});
    await h.app.business.command({type:'addTask',values:{id:'tagtask',name:'Tagged',projectId:'a',tags:'tag,keep'}});
    await h.app.business.command({type:'removeProject',id:'tag'});
    assert.equal(h.app.business.getSnapshot().tasks.find(row=>row.id==='tagtask').tags,'keep');
    await h.app.business.command({type:'updateProject',id:'a',changes:{name:'Updated',future:'preserve'}});await h.oracle.projects().updateProjectInfo('a',{name:'Updated',future:'preserve'});
    const snapshot=[{id:'a',order:2},{id:'b',order:3}];await h.app.business.command({type:'reorderProjects',snapshot,from:'a',to:'b'});
    assert.equal(h.app.business.getSnapshot().projects.find(row=>row.id==='a').order,3);
    await assert.rejects(h.app.business.command({type:'reorderProjects',snapshot,from:'a',to:'b'}),error=>error.code==='conflict');
    await h.app.business.command({type:'restoreProjectOrder'});
    const schedule={id:'plan',taskId:'task',endDate:h.clock.value+600000,interval:600};
    await h.app.business.command({type:'addSchedule',values:schedule});
    await h.app.business.command({type:'updateSchedule',id:'plan',changes:{endDate:schedule.endDate+60000},expected:schedule});
    await assert.rejects(h.app.business.command({type:'removeSchedule',id:'plan',expected:schedule}),error=>error.code==='conflict');
    await h.app.business.command({type:'removeSchedule',id:'plan'});assert.equal(h.app.business.getSnapshot().schedules[0].state,-1);
    await h.app.business.command({type:'addRecord',values:{id:'record',endDate:h.clock.value,interval:60,pomodoroInterval:1500}});
    await h.app.business.command({type:'updateRecord',id:'record',changes:{interval:90}});await h.app.business.command({type:'removeRecord',id:'record'});
    assert.equal(h.app.business.getSnapshot().records[0].state,-1);
    await h.app.business.command({type:'addSubtask',values:{id:'child',taskId:'task',name:'Child'}});await h.app.business.command({type:'updateSubtask',id:'child',changes:{name:'Edited'}});await h.app.business.command({type:'removeSubtask',id:'child'});
    assert.equal(h.app.business.getSnapshot().subtasks[0].state,-1);
});
test('forest rewards and achievement metrics match the old ledger and remain idempotent',async t=>{
    const h=await pair(t);h.clock.value=Date.now();
    vm.runInNewContext(fs.readFileSync(require.resolve('../../src/js/local-achievements.js'),'utf8'),{window:h.old.window,document:{},setTimeout:()=>0,clearTimeout:()=>{}});
    const reward={itemType:0,id:'synthetic-reward',date:h.clock.value-86401000,powerValue:5};
    assert.deepEqual(await h.app.forest.collect(reward),clone(await h.old.data.collectForest(reward)));
    assert.deepEqual(await h.app.forest.collect(reward),clone(await h.old.data.collectForest(reward)));
    for(const value of [{id:'a',state:0,endDate:h.clock.value,interval:3600,pomodoroInterval:1500},{id:'deleted',state:-1,endDate:h.clock.value,interval:3600,pomodoroInterval:1500}]){
        await seed(h.app.repository,'Pomodoro',[value]);await h.old.data.putPomodoro(value);
    }
    const actual=await h.app.forest.syncAchievements(),expected=clone(await h.old.data.syncAchievements());
    const normalize=value=>({...value,earned:Object.fromEntries(Object.keys(value.earned).map(key=>[key,0]))});
    assert.deepEqual(normalize(actual),normalize(expected));assert.equal((await h.app.forest.syncAchievements()).reward,0);
    assert.equal(h.app.forest.get('Sunlight'),h.old.data.forestGet('Sunlight'));
    await h.app.forest.set('DailyTaskReward','[]');assert.equal(h.app.forest.get('DailyTaskReward'),'[]');
    const before=h.app.forest.read();h.physicalStorage.fault=(method,key)=>{if(method==='set'&&key.endsWith('.FocusTodo.forestState'))throw new Error('quota')};
    await assert.rejects(h.app.forest.collect({...reward,id:'failed'}),/quota/);assert.deepEqual(h.app.forest.read(),before);
});
