const test=require('node:test'),assert=require('node:assert/strict');
const{createApplication}=require('./core-helpers.cjs');
const clone=value=>structuredClone(value);
async function snapshot(h){return {tables:(await h.data.snapshot()).indexedDB,storage:[...h.physicalStorage.values.entries()],backups:h.backups.length,timer:clone(h.app.timer.getSnapshot())}}
test('backup inspection validates JSON and Gzip without replacing rows, settings, timers or creating safety downloads',async t=>{
 const h=await createApplication();t.after(h.dispose);
 await h.app.business.command({type:'addTask',values:{id:'original',name:'Original',projectId:'id-task-tasks'}});
 await h.app.settings.set('workInterval',1800);
 const exported=await h.app.backup.export({format:'json'}),target=clone(exported.data);target.indexedDB.Task[0].name='Inspected replacement';target.localStorage.WorkInterval='600';
 const before=await snapshot(h);
 for(const format of ['json','gzip']){const encoded=await h.codec.encode(target,{format}),inspected=await h.app.backup.inspect(encoded.bytes);assert.equal(inspected.format,format);assert.equal(inspected.scope,'full');assert.equal(inspected.data.indexedDB.Task[0].name,'Inspected replacement');assert.equal(inspected.data.localStorage.WorkInterval,'600');assert.equal(inspected.decodedBytes,encoded.rawBytes);assert.deepEqual(await snapshot(h),before)}
 assert.deepEqual(h.app.business.getSnapshot().tasks.map(row=>row.name),['Original']);
 await h.app.backup.restore(JSON.stringify(target));assert.equal(h.backups.length,before.backups+1);assert.equal(h.app.business.getSnapshot().tasks[0].name,'Inspected replacement');assert.equal(h.app.settings.getSnapshot().workInterval,600);
});
test('backup inspection rejects malformed, duplicate, newer-schema and access-bearing prototype settings before any write',async t=>{
 const h=await createApplication();t.after(h.dispose);const good=(await h.app.backup.export({format:'json'})).data,before=await snapshot(h);
 const duplicate=clone(good);duplicate.indexedDB.Task=[{id:'same'},{id:'same'}];
 const missing=clone(good);delete missing.indexedDB.Task;
 const newer=clone(good);newer.meta.dbVersion=4;
 const invalidRecord=clone(good);invalidRecord.indexedDB.Pomodoro=[{id:'bad',endDate:Date.now(),interval:-1,pomodoroInterval:1500}];
 const unsafe=clone(good);Object.defineProperty(unsafe.localStorage,'__proto__',{value:'invalid',enumerable:true});
 for(const input of ['not json',new Uint8Array([0x1f,0x8b,0x12]),...([duplicate,missing,newer,invalidRecord,unsafe].map(value=>JSON.stringify(value)))]){await assert.rejects(h.app.backup.inspect(input));assert.deepEqual(await snapshot(h),before)}
});
test('inspection keeps restore safety-backup cancellation and atomicity unchanged',async t=>{
 const h=await createApplication({application:{saveBackup:async()=>{throw Object.assign(new Error('cancelled'),{code:'cancelled'})}}});t.after(h.dispose);
 await h.app.business.command({type:'addTask',values:{id:'keep',name:'Keep on cancellation'}});const target=clone((await h.app.backup.export({format:'json'})).data);target.indexedDB.Task=[];const before=await snapshot(h);
 await h.app.backup.inspect(JSON.stringify(target));await assert.rejects(h.app.backup.restore(JSON.stringify(target)),/cancelled/);assert.deepEqual((await snapshot(h)).tables,before.tables);assert.deepEqual((await snapshot(h)).storage,before.storage);assert.equal(h.app.business.getSnapshot().tasks[0].name,'Keep on cancellation');
});
