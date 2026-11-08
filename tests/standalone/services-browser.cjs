/* Real IndexedDB, crash/reload and cross-tab checks; temporary origins only. */
const http = require('node:http');
const { assert, fs, path, root, evidence, launch, contextFor, assertNoLegacyRuntime } = require('./helpers.cjs');

async function main() {
    const { build } = await import('vite');
    const built = await build({
        configFile: false, root, logLevel: 'silent',
        build: { write: false, minify: false, sourcemap: false,
            lib: { entry: path.join(__dirname, 'services-harness.mjs'), name: 'SyntheticServicesTest', formats: ['iife'] } },
    });
    const output = (Array.isArray(built) ? built : [built]).flatMap(item => item.output).find(item => item.type === 'chunk').code;
    const server = http.createServer((request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        if (request.url === '/') {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end('<!doctype html><html lang="en"><title>Synthetic service test</title><script src="/harness.js"></script></html>');
        } else if (request.url === '/harness.js') {
            response.setHeader('Content-Type', 'text/javascript'); response.end(output);
        } else if (request.url === '/__prototype/session.json') {
            response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({kind:'isolated-prototype',origin:'http://' + request.headers.host}));
        } else if (request.url === '/redirect') {
            response.writeHead(302,{Location:'https://evil.invalid/leak'});response.end();
        } else { response.writeHead(404); response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const engines = process.env.FOCUS_STANDALONE_ENGINES?.split(',').map(value => value.trim()).filter(Boolean) || ['chromium', 'firefox', 'webkit'];
    assert(engines.length && engines.every(engine => ['chromium', 'firefox', 'webkit'].includes(engine)));
    const results = [], versions = {};
    async function run(browser, engine, name, body, options = {}) {
        const h = await contextFor(browser, origin);
        try {
            await h.page.goto(origin);
            await body(h);
            assert.deepEqual(h.errors.filter(message=>!options.expectedPageError?.(message)), []); assert.deepEqual(h.external, []);
            await assertNoLegacyRuntime(h.page, h.requests);
            results.push({ engine, name, passed: true, ...(h.errors.length?{expectedPageErrors:h.errors}:{}) }); console.log('PASS ' + engine + ': ' + name);
        } catch (error) {
            results.push({ engine, name, passed: false, error: error.stack }); console.error('FAIL ' + engine + ': ' + name + '\n' + error.stack);
        } finally { await h.context.close(); }
    }
    try {
        for (const engine of engines) {
            const browser = await launch(engine); versions[engine] = browser.version();
            try {
                await run(browser, engine, 'namespaced persistence, timer rollback and reload recovery', async ({ page }) => {
                    await page.evaluate(async () => {
                        localStorage.setItem('WorkInterval', 'legacy-sentinel');
                        await startServices();
                        await coreServices.business.command({type:'addTask',values:{id:'task',name:'Synthetic task'}});
                        await coreServices.timer.command({ type: 'start', sessionId: 'browser-timer', taskId: 'task', config: { interval: 60 } });
                        syntheticClock += 90000;
                        failAt = 'timer-commit';
                        try { await coreServices.timer.command({ type: 'pause' }); throw new Error('Abort did not reject'); }
                        catch (error) { if (!error.message.includes('Synthetic fault')) throw error; }
                        if (coreServices.timer.getSnapshot().state !== 'work') throw new Error('Uncommitted timer was published');
                        failAt = null;
                        await coreServices.timer.command({ type: 'pause' });
                        const backup = await coreServices.backup.export({ format: 'json' });
                        if (backup.data.indexedDB.Pomodoro.reduce((n, row) => n + row.interval, 0) !== 90) throw new Error('Atomic duration mismatch');
                        if (localStorage.getItem('WorkInterval') !== 'legacy-sentinel') throw new Error('Legacy storage changed');
                    });
                    await page.reload();
                    await page.evaluate(async () => {
                        await startServices({ noLocks: true, noChannel: true });
                        if (coreServices.timer.getSnapshot().state !== 'pause') throw new Error('Paused session lost on reload');
                        const names = (await indexedDB.databases()).map(db => db.name).sort();
                        if (names.some(name => !name.startsWith('FocusTodoStandalone.'))) throw new Error('Unexpected legacy database');
                        if (serviceErrors.length) throw new Error(serviceErrors.join('\n'));
                    });
                });
                await run(browser, engine, 'crash between rows and settings resumes durable import journal', async ({ page }) => {
                    await page.evaluate(async () => {
                        await startServices({ noLocks: true, noChannel: true });
                        const exported = await coreServices.backup.export({ format: 'json' });
                        exported.data.indexedDB.Task = [{ id: 'recovered-task', name: 'Synthetic task', unknownField: 'preserve' }];
                        exported.data.localStorage.UnknownKey = 'preserve';
                        failAt = 'replacement-committed';
                        try { await coreServices.backup.restore(JSON.stringify(exported.data)); throw new Error('Crash did not reject'); }
                        catch (error) { if (!error.message.includes('Synthetic fault')) throw error; }
                        if (!coreServices.repository.maintenance) throw new Error('Interrupted import was not blocked');
                    });
                    await page.reload();
                    const restored = await page.evaluate(async () => {
                        await startServices({ noLocks: true, noChannel: true });
                        const result = await coreServices.backup.export({ format: 'json' });
                        return { task: result.data.indexedDB.Task[0], key: result.data.localStorage.UnknownKey,
                            journal: await coreServices.repository.read(['LocalMeta'], (tx, done) => {
                                const request = tx.objectStore('LocalMeta').getAll(); request.onsuccess = () => done(request.result.filter(row => ['maintenance','settings-journal'].includes(row.id)));
                            }) };
                    });
                    assert.deepEqual(restored, { task: { id: 'recovered-task', name: 'Synthetic task', unknownField: 'preserve' }, key: 'preserve', journal: [] });
                });
                await run(browser, engine, 'two tabs without Web Locks or broadcasts cannot duplicate focus records', async ({ page, context }) => {
                    const peer = await context.newPage(); const peerErrors = [];
                    peer.on('pageerror', error => peerErrors.push(error.message));
                    try {
                        await page.evaluate(() => startServices({ noLocks: true, noChannel: true }));
                        await peer.goto(origin); await peer.evaluate(() => startServices({ noLocks: true, noChannel: true }));
                        await page.evaluate(() => coreServices.timer.command({ type: 'start', sessionId: 'shared', config: { interval: 60 } }));
                        await Promise.all([page, peer].map(tab => tab.evaluate(async () => {
                            syntheticClock += 120000; await coreServices.timer.command({ type: 'pause', expectedSession: 'shared' });
                        })));
                        const states = await Promise.all([page, peer].map(tab => tab.evaluate(async () => {
                            await coreServices.timer.refresh();
                            const result = await coreServices.backup.export({ format: 'json' });
                            return { timer: coreServices.timer.getSnapshot(), rows: result.data.indexedDB.Pomodoro };
                        })));
                        assert.deepEqual(states[0], states[1]);
                        assert.equal(states[0].rows.reduce((n, row) => n + row.interval, 0), 120);
                        assert.equal(new Set(states[0].rows.map(row => row.id)).size, states[0].rows.length);
                        assert.deepEqual(peerErrors, []);
                    } finally { await peer.close(); }
                });
                await run(browser, engine, 'broadcast refresh and schema versionchange invalidate stale clients', async ({ page, context }) => {
                    const peer = await context.newPage();
                    try {
                        await page.evaluate(() => startServices());
                        await peer.goto(origin); await peer.evaluate(() => startServices());
                        await page.evaluate(() => coreServices.timer.command({ type: 'start', sessionId: 'broadcast' }));
                        await peer.waitForFunction(() => coreServices.timer.getSnapshot()?.sessionId === 'broadcast');
                        await page.evaluate(() => coreServices.dispose());
                        await page.evaluate(() => new Promise((resolve, reject) => {
                            const request = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 4);
                            request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error);
                        }));
                        await peer.waitForFunction(() => serviceEvents.some(event => event.type === 'versionchange'));
                        assert.equal(await peer.evaluate(async () => {
                            try { await coreServices.timer.command({ type: 'pause' }); return false; }
                            catch (error) { return /invalidated/.test(error.message); }
                        }), true);
                    } finally { await peer.close(); }
                });
                await run(browser, engine, 'maintenance owner page closes and a peer recovers without Web Locks or broadcasts', async ({ page, context }) => {
                    const owner = await context.newPage();
                    try {
                        await owner.goto(origin);
                        await owner.evaluate(async () => {
                            await startServices({ noLocks: true, noChannel: true });
                            await coreServices.repository.write(['Task'], tx => tx.objectStore('Task').put({ id: 'original' }));
                            holdBackup = true;
                            const exported = await coreServices.backup.export({ format: 'json' });
                            exported.data.indexedDB.Task = [{ id: 'must-not-commit' }];
                            window.pendingImport = coreServices.backup.restore(JSON.stringify(exported.data)).catch(() => {});
                        });
                        await owner.waitForFunction(() => window.backupWaiting);
                        // Starting a peer waits for the live ownership transaction;
                        // a page with no Web Locks cannot steal it using a timeout.
                        await page.evaluate(() => { window.peerStarted = false; window.starting = startServices({ noLocks: true, noChannel: true }).then(() => { peerStarted = true; }); });
                        await page.waitForFunction(async () => (await indexedDB.databases()).length === 2);
                        assert.equal(await page.evaluate(() => peerStarted), false);
                        await owner.close();
                        await page.waitForFunction(() => peerStarted);
                        const result = await page.evaluate(async () => (await coreServices.backup.export({ format: 'json' })).data.indexedDB.Task);
                        assert.deepEqual(result, [{ id: 'original' }]);
                    } finally { await owner.close(); }
                });
                await run(browser, engine, 'blocked schema upgrade rejects startup, preserves rows and can be retried', async ({ page, context }) => {
                    const peer = await context.newPage();
                    try {
                        await page.evaluate(() => new Promise((resolve, reject) => {
                            const request = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 2);
                            request.onupgradeneeded = () => request.result.createObjectStore('Task', { keyPath: 'id' });
                            request.onsuccess = () => {
                                window.oldConnection = request.result;
                                const transaction = oldConnection.transaction('Task', 'readwrite');
                                transaction.objectStore('Task').put({ id: 'old-row', unknown: 'preserve' });
                                transaction.oncomplete = resolve;
                            };
                            request.onerror = () => reject(request.error);
                        }));
                        await peer.goto(origin);
                        const rejected = await peer.evaluate(async () => {
                            try { await startServices(); return false; }
                            catch (error) { return error.message.includes('升级等待'); }
                        });
                        assert.equal(rejected, true);
                        await page.evaluate(() => oldConnection.close());
                        await peer.evaluate(() => startServices());
                        const result = await peer.evaluate(async () => (await coreServices.backup.export({ format: 'json' })).data.indexedDB.Task);
                        assert.deepEqual(result, [{ id: 'old-row', unknown: 'preserve' }]);
                    } finally { await peer.close(); }
                });
                await run(browser, engine, 'fixed Phase B client rejects persisted C data and newer protocols reject C writers', async ({page}) => {
                    await page.evaluate(async()=>{
                        await startServices();
                        let blocked=false;try{await verifyOldIsolation()}catch(_){blocked=true}if(!blocked)throw new Error('Old client accepted C persistence');
                        await coreServices.business.command({type:'addTask',values:{id:'sentinel',name:'Keep'}});
                        await coreServices.repository.write(['LocalMeta'],tx=>tx.objectStore('LocalMeta').put({id:'client-protocol',protocol:2,family:'FocusTodoStandalone'}));
                        try{await coreServices.business.command({type:'updateTask',id:'sentinel',changes:{name:'discard'}});throw new Error('New protocol was accepted')}
                        catch(error){if(error.code!=='incompatible-client')throw error}
                        coreServices.dispose();
                        try{await startServices();throw new Error('Incompatible startup was accepted')}
                        catch(error){if(error.code!=='incompatible-client')throw error}
                    });
                });
                await run(browser, engine, 'native fetch rejects redirects before the target is contacted; image conversion and theme persistence work', async ({page}) => {
                    let target=false;
                    await page.route('https://evil.invalid/**',route=>{target=true;return route.abort()});
                    await page.evaluate(async origin=>{
                        await startServices();await coreServices.settings.set('externalNetwork',true);
                        let rejected=false;try{await coreServices.network.request(origin+'/redirect')}catch(_){rejected=true}if(!rejected)throw new Error('Redirect accepted');
                        const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1200;canvas.getContext('2d').fillRect(0,0,2000,1200);
                        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
                        const expected=await oldImage(blob),id=await coreServices.wallpaper.add(blob,'Synthetic image');const value=coreServices.wallpaper.read()[id];
                        if(!value.dataUrl.startsWith('data:image/jpeg;')||!value.thumbnail.startsWith('data:image/jpeg;'))throw new Error('Image conversion failed');
                        if(value.dataUrl!==expected.dataUrl||value.thumbnail!==expected.thumbnail)throw new Error('Image output differs from the legacy converter');
                        const compressed=await convertImage(blob,{thumbnailFromCompressed:true}),oldCompressed=await oldImage(blob,true);
                        if(compressed.dataUrl!==oldCompressed.dataUrl||compressed.thumbnail!==oldCompressed.thumbnail)throw new Error('Bing thumbnail output differs from the legacy converter');
                        await coreServices.wallpaper.remove(id);if(coreServices.themes.read().theme!=='Leaf')throw new Error('Removed active theme was not reset');
                    },origin);
                    assert.equal(target,false);
                },{expectedPageError:message=>engine==='webkit'&&/\/redirect due to access control checks\.$/.test(message)});
                await run(browser, engine, 'native Web Locks transfer automatic audio ownership when a page suspends', async ({page,context}) => {
                    const peer=await context.newPage();
                    try{
                        await page.evaluate(async()=>{await startServices();await coreServices.settings.set('bgMusic','bgm_Rain')});
                        await peer.goto(origin);await peer.evaluate(()=>startServices());
                        await page.evaluate(()=>coreServices.timer.command({type:'start',mode:'countup',sessionId:'audio'}));
                        await page.waitForFunction(()=>audioTrace.some(row=>row.kind==='play'&&row.audio.loop&&!row.audio.paused));
                        await peer.evaluate(()=>coreServices.timer.refresh());
                        const playing=async tab=>tab.evaluate(()=>audioTrace.filter(row=>row.kind==='play'&&row.audio.loop&&!row.audio.paused).length);
                        assert.equal(await playing(page)+await playing(peer),1);
                        await page.evaluate(()=>coreServices.suspend());
                        await peer.waitForFunction(()=>audioTrace.some(row=>row.kind==='play'&&row.audio.loop&&!row.audio.paused));
                        assert.equal(await playing(page),0);assert.equal(await playing(peer),1);
                    }finally{await peer.close()}
                });
                await run(browser, engine, 'no-broadcast polling refreshes peer tasks and no-lock mode preserves manual audio', async ({page,context}) => {
                    const peer=await context.newPage();
                    try{
                        await page.evaluate(()=>startServices({noLocks:true,noChannel:true}));await peer.goto(origin);await peer.evaluate(()=>startServices({noLocks:true,noChannel:true}));
                        await page.evaluate(async()=>{await coreServices.settings.set('bgMusic','bgm_Rain');await coreServices.timer.command({type:'start',mode:'countup'});await coreServices.business.command({type:'addTask',values:{id:'peer',name:'Peer task'}})});
                        await peer.waitForFunction(()=>coreServices.business.getSnapshot().tasks.some(row=>row.id==='peer'));
                        assert.equal(await page.evaluate(()=>audioTrace.some(row=>row.audio.loop)),false);
                        await page.evaluate(()=>coreServices.audio.audition('bgm_Rain.m4a',0.5));assert.equal(await page.evaluate(()=>audioTrace.filter(row=>!row.audio.loop).length),1);
                    }finally{await peer.close()}
                });
                if(engine==='chromium')await run(browser, engine, 'renderer crash releases ownership and a new page recovers the committed import journal', async({page,context})=>{
                    const owner=await context.newPage();
                    try{
                        await owner.goto(origin);await owner.evaluate(async()=>{await startServices({noLocks:true,noChannel:true});const input=(await coreServices.backup.export({format:'json'})).data;
                            input.indexedDB.Task=[{id:'crash-sentinel',name:'Recovered'}];failAt='replacement-committed';try{await coreServices.backup.restore(JSON.stringify(input))}catch(_){} });
                        const session=await context.newCDPSession(owner), crashed=owner.waitForEvent('crash',{timeout:5000});
                        session.send('Page.crash').catch(()=>{});await crashed;
                        await page.evaluate(()=>startServices({noLocks:true,noChannel:true}));
                        assert.equal(await page.evaluate(()=>coreServices.business.getSnapshot().tasks[0].id),'crash-sentinel');
                    }finally{await owner.close()}
                });
            } finally { await browser.close(); }
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.mkdirSync(evidence, { recursive: true });
        fs.writeFileSync(path.join(evidence, 'standalone-services-results.json'), JSON.stringify({
            method: 'Temporary origins, synthetic namespaced data, real IndexedDB; no production profile. WebKit is not real Safari.', engines, versions, results,
        }, null, 2) + '\n');
    }
    if (results.some(result => !result.passed)) throw new Error('Core service browser acceptance failed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
