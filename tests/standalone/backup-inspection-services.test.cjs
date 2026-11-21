const test=require('node:test'),assert=require('node:assert/strict');
const { gzipSync } = require('node:zlib');
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

test('portable backups cannot grant network access and cached Bing wallpaper survives restore', async t => {
    const url = 'https://www.bing.com/HPImageArchive.aspx';
    const key = 'FocusTodo.externalNetwork';
    const bing = '__bing_daily__', cached = 'data:image/jpeg;base64,AA==';
    let requests = 0;
    const h = await createApplication({ application: { fetch: async () => { requests++; return new Response('{}'); } } });
    t.after(h.dispose);
    for (const version of [1, 2]) {
        await h.app.settings.set('externalNetwork', true);
        const exported = await h.app.backup.export({ format: version === 1 ? 'json' : 'gzip' });
        assert.equal(Object.hasOwn(exported.data.localStorage, key), false);
        const legacy = clone(exported.data);
        legacy.meta.exportVersion = version;
        Object.assign(legacy.localStorage, {
            [key]: 'true', Theme: bing, 'lexible-active-custom-theme': bing,
            'lexible-custom-themes': JSON.stringify({ [bing]: { dataUrl: cached, updatedAt: h.clock.value } }),
        });
        const text = JSON.stringify(legacy);
        const input = version === 1 ? text : gzipSync(text);
        await h.app.backup.inspect(input);
        assert.equal(h.app.settings.getSnapshot().externalNetwork, true);
        await h.app.backup.restore(input);
        assert.equal(Object.hasOwn(h.backups.at(-1).localStorage, key), false);
        assert.equal(h.app.settings.getSnapshot().externalNetwork, false);
        assert.equal(h.app.themes.read().active, bing);
        assert.equal(h.app.wallpaper.read()[bing].dataUrl, cached);
        await assert.rejects(h.app.network.request(url), { code: 'network-blocked' });
    }
    assert.equal(requests, 0);
    await h.app.settings.set('externalNetwork', true);
    await h.app.network.request(url);
    assert.equal(requests, 1);
});
