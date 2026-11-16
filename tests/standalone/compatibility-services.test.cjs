const test=require('node:test'),assert=require('node:assert/strict');
const {createApplication,createHarness,rows,seed}=require('./core-helpers.cjs');
const clone=value=>structuredClone(value);

test('all import commit boundaries either preserve originals or recover a durable journal',async t=>{
    for(const point of ['transaction-start','maintenance-marker','pre-import-snapshot','replacement-rows','replacement-committed','settings-apply']){
        let armed=false,fired=false;
        const h=await createHarness({capabilities:{fault(name,detail){if(armed&&!fired&&name===point&&(name!=='transaction-start'||detail.mode==='readwrite')){fired=true;throw new Error('crash:'+point)}}}});t.after(h.dispose);
        await seed(h.data,'Task',[{id:'original'}]);h.storage.setItem('Keep','original');
        const target=clone(await h.data.snapshot());target.indexedDB.Task=[{id:'target'}];target.localStorage.Keep='target';
        armed=true;await assert.rejects(h.data.replace(target));assert(fired,point);h.dispose();
        const recovered=await createHarness({indexedDB:h.indexedDB,storage:h.physicalStorage});t.after(recovered.dispose);
        const expected=point==='replacement-committed'?'target':'original';
        assert.equal((await rows(recovered.data,'Task'))[0].id,expected,point);assert.equal(recovered.storage.getItem('Keep'),expected,point);
        assert.equal((await rows(recovered.data,'LocalMeta')).filter(row=>['settings-journal','maintenance'].includes(row.id)).length,0,point);
    }
});
test('every import database transaction and settings-key write boundary survives a one-shot failure',async t=>{
    let active=false,writes=0;const probe=await createHarness({capabilities:{fault(point,detail){if(active&&point==='transaction-start'&&detail.mode==='readwrite')writes++}}});t.after(probe.dispose);
    const fixture=await probe.data.snapshot();fixture.indexedDB.Task=[{id:'target'}];fixture.localStorage.Keep='target';active=true;
    await probe.data.replace(fixture);assert(writes>=4);
    for(let failAt=1;failAt<=writes;failAt++){
        let armed=false,count=0;const h=await createHarness({capabilities:{fault(point,detail){if(armed&&point==='transaction-start'&&detail.mode==='readwrite'&&++count===failAt)throw new Error('database boundary')}}});t.after(h.dispose);
        await seed(h.data,'Task',[{id:'original'}]);h.storage.setItem('Keep','original');const target=await h.data.snapshot();target.indexedDB.Task=[{id:'target'}];target.localStorage.Keep='target';
        armed=true;await assert.rejects(h.data.replace(target));armed=false;h.dispose();
        const recovered=await createHarness({indexedDB:h.indexedDB,storage:h.physicalStorage});t.after(recovered.dispose);
        const result=await recovered.data.snapshot(),id=result.indexedDB.Task[0].id;
        assert(['original','target'].includes(id));assert.equal(result.localStorage.Keep,id);assert.equal((await rows(recovered.data,'LocalMeta')).filter(row=>['maintenance','settings-journal'].includes(row.id)).length,0);
    }
    for(let failAt=1;failAt<=12;failAt++){
        const h=await createHarness();t.after(h.dispose);await seed(h.data,'Task',[{id:'original'}]);
        for(const key of ['Keep','Second','Third'])h.storage.setItem(key,'original');
        const before=await h.data.snapshot(),target=clone(before);target.indexedDB.Task=[{id:'target'}];target.localStorage.Keep='target';target.localStorage.Fourth='target';
        let count=0,fired=false;h.physicalStorage.fault=()=>{if(++count===failAt){fired=true;throw new Error('settings key boundary')}};
        await assert.rejects(h.data.replace(target));assert(fired);h.physicalStorage.fault=()=>{};h.dispose();
        const recovered=await createHarness({indexedDB:h.indexedDB,storage:h.physicalStorage});t.after(recovered.dispose);
        const result=await recovered.data.snapshot();assert.deepEqual(result.indexedDB,before.indexedDB);assert.deepEqual(result.localStorage,before.localStorage);
    }
});
test('recurring completion aborts parent, next task and copied subtasks as one transaction',async t=>{
    let fail=false;const h=await createApplication({application:{fault(point){if(fail&&point==='business-commit')throw new Error('business abort')}}});t.after(h.dispose);
    await h.app.business.command({type:'addTask',values:{id:'repeat',name:'Repeat',rCycle:1,rUnit:'days',deadline:h.clock.value,rFirstDeadline:h.clock.value}});
    await h.app.business.command({type:'addSubtask',values:{id:'child',name:'Child',taskId:'repeat'}});
    const before=h.app.business.getSnapshot();fail=true;await assert.rejects(h.app.business.command({type:'completeTask',id:'repeat'}),/business abort/);
    assert.strictEqual(h.app.business.getSnapshot(),before);
    assert.equal((await rows(h.app.repository,'Task')).length,1);assert.equal((await rows(h.app.repository,'Subtask')).length,1);assert.equal((await rows(h.app.repository,'Task'))[0].isFinished,false);
});
test('newer client protocol and legacy database names reject writers before mutation',async t=>{
    const h=await createApplication();t.after(h.dispose);
    await h.app.business.command({type:'addTask',values:{id:'keep',name:'Original'}});
    await seed(h.app.repository,'LocalMeta',[{id:'client-protocol',protocol:2,family:'FocusTodoStandalone',schemaVersion:3}]);
    await assert.rejects(h.app.business.command({type:'updateTask',id:'keep',changes:{name:'discard'}}),error=>error.code==='incompatible-client');
    await assert.rejects(createHarness({indexedDB:h.indexedDB,storage:h.physicalStorage}),error=>error.code==='incompatible-client');
    const {createDataService}=await import('../../standalone/services/data.mjs');let opened=0;
    assert.throws(()=>createDataService({indexedDB:{open(){opened++}},storage:h.storage,databaseName:'PomodoroDB6',timerCore:h.core,backupCodec:h.codec,now:()=>h.clock.value,randomUUID:()=>crypto.randomUUID(),encodeBase64:value=>value}),/isolated/);assert.equal(opened,0);
});
test('version naming migration preserves schema, data, unknown keys and old release read state',async t=>{
    const h=await createApplication();t.after(h.dispose);
    await h.app.business.command({type:'addTask',values:{id:'keep',name:'Synthetic',futureField:'preserve'}});
    await h.app.release.markRead(h.app.release.metadata.version);const before=await h.app.backup.export({format:'json'});h.dispose();
    const config=clone(require('../../release.json'));config.localVersion='2.0.0';config.updates.unshift({version:'2.0.0',date:config.date,title:'Independent',items:[]});
    const next=await createApplication({indexedDB:h.indexedDB,storage:h.physicalStorage,application:{appVersion:'2.0.0',releaseConfig:config}});t.after(next.dispose);
    const after=await next.app.backup.export({format:'json'});assert.equal(after.data.meta.dbVersion,3);assert.deepEqual(after.data.indexedDB,before.data.indexedDB);
    assert.equal(next.app.release.hasUnread(),true);assert.equal(after.data.localStorage['FocusTodo.releaseRead'],'7.1.1-local.1.9.3');
    await next.app.release.markRead('2.0.0');assert.equal(next.app.release.hasUnread(),false);
    next.dispose();
    const rollback=await createApplication({indexedDB:h.indexedDB,storage:h.physicalStorage});t.after(rollback.dispose);
    assert.deepEqual((await rollback.app.backup.export({format:'json'})).data.indexedDB,before.data.indexedDB);
    assert.equal(rollback.app.release.hasUnread(),true);
});
test('development candidate version labels exports without rewriting published history or read state',async t=>{
    const history=clone(require('../../release.json')),candidate=require('../../standalone/app-version.json');
    const h=await createApplication({application:{appVersion:candidate.localVersion,releaseConfig:{...history,...candidate}}});t.after(h.dispose);
    await h.app.business.command({type:'addTask',values:{id:'keep',name:'Synthetic'}});
    const before=await h.app.backup.export({format:'json'});
    assert.equal(h.app.release.metadata.version,'2.0.0');assert.equal(before.data.meta.patch,'2.0.0');assert.equal(before.data.meta.dbVersion,3);
    assert.deepEqual(h.app.release.entries().map(entry=>entry.version),history.updates.map(entry=>entry.version));
    assert.equal(h.app.release.hasUnread(),false);
    await h.app.release.markRead(history.updates[0].version);
    assert.equal((await h.app.backup.export({format:'json'})).data.localStorage['FocusTodo.releaseRead'],before.data.localStorage['FocusTodo.releaseRead']);
    assert.equal((await rows(h.app.repository,'Task'))[0].id,'keep');
});

test('v1/v2 imports preserve historical compatibility records and unsupported formats never start maintenance',async t=>{
    const h=await createApplication();t.after(h.dispose);
    const exported=await h.app.backup.export({format:'json'});
    for(const version of [1,2]){
        const input=clone(exported.data);input.meta.exportVersion=version;input.indexedDB.Group=[{groupId:'old-group',future:'preserve'}];input.indexedDB.GroupUser=[{id:'old-member',groupId:'old-group'}];input.indexedDB.Message=[{messageId:'old-message',body:'synthetic'}];input.localStorage.Unknown='preserve';
        await h.app.backup.restore(JSON.stringify(input));const after=(await h.app.backup.export({format:'json'})).data;
        for(const table of ['Group','GroupUser','Message'])assert.deepEqual(after.indexedDB[table],input.indexedDB[table]);assert.equal(after.localStorage.Unknown,'preserve');
    }
    const before=await h.app.backup.export({format:'json'}),bad=clone(before.data);bad.meta.dbVersion=4;
    await assert.rejects(h.app.backup.restore(JSON.stringify(bad)));assert.deepEqual((await h.app.backup.export({format:'json'})).data.indexedDB,before.data.indexedDB);
});
test('theme journal failure at each key boundary matches legacy rollback and preserves corrupt journals',async()=>{
    const {createThemeJournal}=await import('../../standalone/services/theme-journal.mjs'),oldFactory=require('../../src/js/local-theme-storage.js'),{MemoryStorage}=require('./core-helpers.cjs');
    for(let failAt=1;failAt<=7;failAt++){
        const make=factory=>{
            const storage=new MemoryStorage();storage.setItem('Theme','Leaf');let writes=0;
            const api=factory.create({get:key=>storage.getItem(key),set:(key,value)=>storage.setItem(key,value),remove:key=>storage.removeItem(key)});
            storage.fault=()=>{if(++writes===failAt)throw new Error('quota')};
            let error;try{api.commit({themes:'{"custom_old":{"dataUrl":"data:image/png;base64,AA=="}}',active:'custom_old',theme:'custom_old'})}catch(failure){error=failure}
            storage.fault=()=>{};api.recover();return{value:api.read(),failed:!!error};
        };
        assert.deepEqual(make(createThemeJournal({now:()=>1,random:()=>0.5})),make(oldFactory),'boundary '+failAt);
    }
    const {MemoryStorage:Storage}=require('./core-helpers.cjs'),storage=new Storage();storage.setItem('FocusTodo.themeJournal','broken');
    const api=createThemeJournal({now:()=>1,random:()=>0.5}).create({get:key=>storage.getItem(key),set:(key,value)=>storage.setItem(key,value),remove:key=>storage.removeItem(key)});
    assert.throws(()=>api.recover(),error=>error.recoveryRequired===true);assert.equal(storage.getItem('FocusTodo.themeJournal'),'broken');
});
