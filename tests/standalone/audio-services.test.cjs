const test=require('node:test'),assert=require('node:assert/strict');
const {createApplication}=require('./core-helpers.cjs');
function lockManager(){const owners=new Map(),queues=new Map();return{
    request(name,options,body){if(typeof options==='function'){body=options;options={}}
        return new Promise((resolve,reject)=>{
            const entry={options,body,resolve,reject};const queue=queues.get(name)||[];queues.set(name,queue);queue.push(entry);
            options.signal?.addEventListener('abort',()=>{const index=queue.indexOf(entry);if(index>=0){queue.splice(index,1);reject(new DOMException('Aborted','AbortError'))}},{once:true});drain(name);
        });
    }};
    function drain(name){if(owners.has(name))return;const entry=queues.get(name)?.shift();if(!entry)return;if(entry.options.signal?.aborted){entry.reject(new DOMException('Aborted','AbortError'));drain(name);return}
        owners.set(name,entry);Promise.resolve().then(()=>entry.body()).then(entry.resolve,entry.reject).finally(()=>{owners.delete(name);drain(name)});
    }
}
function mediaFactory(rows){return file=>{const audio={file,volume:1,paused:true,play(){this.paused=false;rows.push({type:'play',audio:this});return Promise.resolve()},pause(){this.paused=true;rows.push({type:'pause',audio:this})},removeAttribute(){},load(){}};return audio}}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('automatic background audio hands off a browser lock, suspends on hide/dispose and never steals ownership',async t=>{
    const {createAudioService}=await import('../../standalone/services/audio.mjs');
    const locks=lockManager(),rows=[],listeners=new Set();let visible=true;
    const preferences={bgMusic:'bgm_Rain',whiteNoiseVolume:50,ringtoneVolume:75},settings={getSnapshot:()=>preferences,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
    const a=createAudioService({createAudio:mediaFactory(rows),locks,settings,visible:()=>visible}),b=createAudioService({createAudio:mediaFactory(rows),locks,settings,visible:()=>visible});
    t.after(()=>{a.dispose();b.dispose()});a.setTimerState('work');b.setTimerState('work');await turn();await turn();
    assert.equal(rows.filter(row=>row.type==='play').length,1);a.suspend();await turn();await turn();assert.equal(rows.filter(row=>row.type==='play').length,2);
    assert.equal(rows.filter(row=>row.type==='play')[0].audio.paused,true);visible=false;b.update();await turn();assert(rows.filter(row=>row.type==='play').every(row=>row.audio.paused));
    b.effect('alm_Timer.m4a');assert.equal(rows.at(-1).audio.volume,0.75);b.audition('bgm_Rain.m4a',0.3);b.auditionVolume(0.4);assert.equal(rows.at(-1).audio.volume,0.4);b.stopAudition();
});
test('no-lock audio fails closed for automatic playback but allows completion effects and manual audition',async()=>{
    const {createAudioService}=await import('../../standalone/services/audio.mjs');const rows=[],notices=[];
    const audio=createAudioService({createAudio:mediaFactory(rows),locks:null,visible:()=>true,notice:value=>notices.push(value),settings:{getSnapshot:()=>({bgMusic:'bgm_Rain',whiteNoiseVolume:100,ringtoneVolume:100}),subscribe:()=>()=>{}}});
    audio.setTimerState('work');audio.update();assert.equal(rows.length,0);assert.equal(notices.length,1);
    audio.effect('alm_Timer.m4a');audio.audition('bgm_Rain.m4a');assert.equal(rows.filter(row=>row.type==='play').length,2);audio.dispose();assert(rows.filter(row=>row.type==='play').every(row=>row.audio.paused));
});
test('reminders schedule the nearest future task, persist read keys and only request notification permission explicitly',async t=>{
    const notices=[],timeouts=[];let permissionRequests=0;
    class Notification{static permission='default';static async requestPermission(){permissionRequests++;this.permission='granted';return'granted'}constructor(title,options){notices.push({title,...options})}close(){}}
    const h=await createApplication({application:{notification:Notification,setTimeout:(callback,delay)=>{const handle={callback,delay,unref(){}};timeouts.push(handle);return handle},clearTimeout:()=>{}}});t.after(h.dispose);
    assert.equal(permissionRequests,0);await h.app.notifications.requestPermission();assert.equal(permissionRequests,1);
    await h.app.business.command({type:'addTask',values:{id:'reminder',name:'Synthetic reminder',reminderDate:h.clock.value+60000}});
    assert.equal(h.app.reminders.getSnapshot().due.length,0);assert(timeouts.some(item=>item.delay===60000));h.clock.value+=60000;h.app.reminders.refresh(true);
    assert.equal(notices.length,1);assert.equal(h.app.reminders.getSnapshot().unread.length,1);await h.app.reminders.markRead();assert.equal(h.app.reminders.getSnapshot().unread.length,0);h.app.reminders.refresh(true);assert.equal(notices.length,1);
    await h.app.business.command({type:'completeTask',id:'reminder'});assert.equal(h.app.reminders.getSnapshot().due.length,0);
});
test('the service scheduler owns ticks and completion audio; subtask switches settle the prior attribution',async t=>{
    const timeouts=[],media=[];const h=await createApplication({application:{createAudio:mediaFactory(media),setTimeout:(callback,delay)=>{const handle={callback,delay,unref(){}};timeouts.push(handle);return handle},clearTimeout:()=>{}}});t.after(h.dispose);
    await h.app.business.command({type:'addTask',values:{id:'task',name:'Task',pomodoroInterval:60}});
    for(const id of ['one','two'])await h.app.business.command({type:'addSubtask',values:{id,name:id,taskId:'task'}});
    await h.app.startForTask('task','one','countup');h.clock.value+=30000;await h.app.startForTask('task','two','countup');
    await h.app.business.refresh();assert.equal(h.app.business.getSnapshot().records[0].subtaskId,'one');
    h.clock.value+=60000;await timeouts.find(handle=>handle.delay===1000).callback();
    assert(media.some(row=>row.type==='play'&&row.audio.file==='alm_Timer.mp3'));
    await h.app.business.command({type:'completeTask',id:'task'});await h.app.timer.refresh();assert.equal(h.app.timer.getSnapshot().state,'initial');
});
module.exports={lockManager,mediaFactory};
test('audio effects, audition volumes and background lifecycle match the old adapter for the same commands',async()=>{
    const {createAudioService}=await import('../../standalone/services/audio.mjs'),fs=require('node:fs'),vm=require('node:vm');
    async function trace(legacy){
        const records=[],media=file=>({dataset:{},paused:true,volume:1,loop:false,
            play(){this.paused=false;records.push([file,this.volume,this.loop]);return Promise.resolve()},pause(){this.paused=true},removeAttribute(){},load(){}});
        const locks=lockManager(),preference={bgMusic:'bgm_Rain',whiteNoiseVolume:50,ringtoneVolume:75};
        let actions,dispose;
        if(legacy){
            const window=new EventTarget(),document=new EventTarget();document.hidden=false;
            Object.assign(window,{FocusTimerCore:{},FocusLocalData:{},FocusI18n:{text:value=>value}});
            vm.runInNewContext(fs.readFileSync(require.resolve('../../src/js/local-timer-ui.js'),'utf8'),{window,document,navigator:{locks},Audio:function(file){return media(file.replace('./audio/',''))},AbortController,Event,console,setTimeout,clearTimeout});
            const player={timerState:'initial'};window.FocusLocal.attachAudio(player,preference);
            actions={start:()=>player.startBgm('work'),effect:()=>player.start('alm_Timer.mp3',0.75),audition:()=>player.startAudition('bgm_Rain.m4a',0.3),stop:()=>player.stopAudition(true)};
            dispose=()=>window.dispatchEvent(new Event('pagehide'));
        }else{
            const audio=createAudioService({createAudio:media,locks,settings:{getSnapshot:()=>preference,subscribe:()=>()=>{}},visible:()=>true});
            actions={start:()=>audio.setTimerState('work'),effect:()=>audio.effect('alm_Timer.mp3',0.75),audition:()=>audio.audition('bgm_Rain.m4a',0.3),stop:()=>audio.stopAudition()};dispose=()=>audio.dispose();
        }
        for(const command of ['start','effect','audition','stop']){actions[command]();await turn();await turn()}dispose();await turn();return records;
    }
    assert.deepEqual(await trace(false),await trace(true));
});
