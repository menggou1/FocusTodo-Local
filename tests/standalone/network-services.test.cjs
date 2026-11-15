const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const { createApplication } = require('./core-helpers.cjs');
const picture = () => new Response(new Blob(['synthetic'], { type:'image/jpeg' }), { headers:{'Content-Type':'image/jpeg'} });
const metadata = () => new Response(JSON.stringify({url:'https://www.bing.com/synthetic.jpg',copyright:'synthetic'}),{headers:{'Content-Type':'application/json'}});
const image = async () => ({dataUrl:'data:image/jpeg;base64,AA==',thumbnail:'data:image/jpeg;base64,AQ=='});
async function app(t,transport,extra={}) { const h=await createApplication({application:{fetch:transport,image,...extra}});t.after(h.dispose);await h.app.settings.set('externalNetwork',true);return h; }

test('explicit network policy matches legacy same-origin/exact Bing opt-in without wrapping browser globals',async t=>{
    const {permitsRequest}=await import('../../standalone/services/network.mjs');
    let enabled=false;const origin='http://127.0.0.1:59000';
    const window={FocusSettings:{networkEnabled:()=>enabled},XMLHttpRequest:function(){},fetch:async()=>true};window.window=window;
    const context=vm.createContext({window,location:{href:origin+'/',origin},URL,Request,Event,TextEncoder,Blob,DOMException,setTimeout,clearTimeout});
    vm.runInContext(fs.readFileSync(require.resolve('../../src/js/local-network.js'),'utf8'),context);window.FocusLocalNetwork.install({});
    for(enabled of [false,true])for(const url of [origin+'/asset','https://www.bing.com/image','https://bing.com/image','https://th.bing.com/image','https://bing.biturl.top/?format=json','https://bing.com.attacker.invalid/image','http://www.bing.com/image','https://user@bing.com/image','https://www.bing.com:444/image']){
        const old=await window.fetch(url).then(()=>true,()=>false);assert.equal(permitsRequest(url,origin,enabled),old,url);
    }
    const h=await app(t,async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');return metadata()});
    await h.app.network.request('https://www.bing.com/metadata');
    await h.app.settings.set('externalNetwork',false);await assert.rejects(h.app.network.request('https://www.bing.com/metadata'),error=>error.code==='network-blocked');
});
test('network redirects, response size, timeout and cancellation fail without committing settings',async t=>{
    let mode='redirect';const h=await app(t,async(url,options)=>{
        if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'https://evil.invalid/'}});
        if(mode==='oversize')return new Response('a'.repeat(256*1024+1));
        return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
    });
    await assert.rejects(h.app.network.request('https://www.bing.com/x'));
    mode='oversize';await assert.rejects(h.app.network.request('https://www.bing.com/x'),/too large/);
    mode='wait';await assert.rejects(h.app.network.request('https://www.bing.com/x','json',{timeout:10}),error=>error.code==='timeout');
    const controller=new AbortController(),pending=h.app.network.request('https://www.bing.com/x','json',{signal:controller.signal});controller.abort();
    await assert.rejects(pending,error=>error.code==='cancelled');
    const optOut=assert.rejects(h.app.network.request('https://www.bing.com/x'),error=>error.code==='cancelled');await h.app.settings.set('externalNetwork',false);await optOut;
});
test('wallpaper cache expires across a local day and TTL; offline failure retains cached selection',async t=>{
    let calls=0,offline=false;const h=await app(t,async(url)=>{calls++;if(offline)throw new Error('offline');return url.includes('synthetic.jpg')?picture():metadata()});
    const first=await h.app.wallpaper.bing();assert.equal(calls,2);assert.equal(h.app.themes.read().active,'__bing_daily__');
    assert.deepEqual(await h.app.wallpaper.bing(),first);assert.equal(calls,2);
    h.clock.value+=43200001;await h.app.wallpaper.bing();assert.equal(calls,4);
    h.clock.value=new Date(new Date(h.clock.value).setHours(23,59,0,0)).getTime();await h.app.wallpaper.bing();const before=calls;
    h.clock.value+=120000;await h.app.wallpaper.bing();assert.equal(calls,before+2);
    h.clock.value+=86400000;offline=true;await assert.rejects(h.app.wallpaper.bing());
    assert.equal(h.app.themes.read().active,'__bing_daily__');assert(h.app.wallpaper.read().__bing_daily__.dataUrl);
});
test('new theme selection and opt-out cancel in-flight/queued Bing work before persistence',async t=>{
    let release,entered;const wait=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{entered=resolve});
    const h=await app(t,async(url)=>{if(url.includes('synthetic.jpg')){entered();await wait;return picture()}return metadata()});
    const pending=assert.rejects(h.app.wallpaper.bing());await started;await h.app.wallpaper.classic('Sea');release();await pending;
    assert.equal(h.app.themes.read().theme,'Sea');assert.equal(h.app.wallpaper.read().__bing_daily__,undefined);
    const id=await h.app.wallpaper.add(new Blob(['image'],{type:'image/png'}),'Synthetic');assert(id.startsWith('custom_'));
    await h.app.wallpaper.classic('Leaf');await h.app.wallpaper.select(id);assert.equal(h.app.themes.read().active,id);
    await h.app.wallpaper.remove(id);assert.equal(h.app.themes.read().theme,'Leaf');
    await assert.rejects(h.app.wallpaper.select('missing'));
});
test('opt-out intent cancels a queued cached activation before either operation acquires storage ownership',async t=>{
    const h=await app(t,async url=>url.includes('synthetic.jpg')?picture():metadata());await h.app.wallpaper.bing();await h.app.wallpaper.classic('Leaf');
    let entered,release;const started=new Promise(resolve=>{entered=resolve}),held=new Promise(resolve=>{release=resolve});
    const owner=h.app.repository.themeStorageOperation(async()=>{entered();await held});await started;
    const cached=assert.rejects(h.app.wallpaper.bing(),error=>error.code==='cancelled');
    const optOut=h.app.settings.set('externalNetwork',false);release();await owner;await cached;await optOut;
    assert.equal(h.app.themes.read().theme,'Leaf');assert.equal(h.app.settings.getSnapshot().externalNetwork,false);
});

test('wallpaper snapshots publish activation before stale-cache download completes and release loading after cancellation/failure',async t=>{
    let release,entered,hold=false,offline=false;
    const h=await app(t,async url=>{
        if(offline)throw new Error('offline');
        if(hold&&!url.includes('synthetic.jpg')){entered();await new Promise(resolve=>{release=resolve});}
        return url.includes('synthetic.jpg')?picture():metadata();
    });
    const states=[],unsubscribe=h.app.wallpaper.subscribe(()=>states.push(h.app.wallpaper.getSnapshot()));t.after(unsubscribe);
    await h.app.wallpaper.bing();await h.app.wallpaper.classic('Leaf');
    const version=h.app.wallpaper.getSnapshot().version;h.clock.value+=86400000;hold=true;
    const started=new Promise(resolve=>{entered=resolve}),pending=assert.rejects(h.app.wallpaper.bing());await started;
    assert.equal(h.app.wallpaper.getSnapshot().loading,true);
    assert(h.app.wallpaper.getSnapshot().version>version,'cached activation publishes before network completion');
    assert.equal(h.app.themes.read().active,'__bing_daily__');
    await h.app.wallpaper.classic('Ocean');assert.equal(h.app.wallpaper.getSnapshot().loading,false);release();await pending;
    hold=false;offline=true;await assert.rejects(h.app.wallpaper.bing());assert.equal(h.app.wallpaper.getSnapshot().loading,false);
    assert(states.some(state=>state.loading));assert(states.some(state=>!state.loading));
});
