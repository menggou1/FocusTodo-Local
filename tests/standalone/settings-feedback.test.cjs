const test=require('node:test'),assert=require('node:assert/strict');

test('volume feedback uses the original wav after 100ms, cancels stale samples and never overlaps',async()=>{
 const {createAudioService}=await import('../../standalone/services/audio.mjs');
 const timers=new Map(),played=[];let id=0;
 const audio=createAudioService({settings:{getSnapshot:()=>({}),subscribe:()=>()=>{}},visible:()=>true,
  setTimeout(fn,delay){assert.equal(delay,100);timers.set(++id,fn);return id},clearTimeout(id){timers.delete(id)},
  createAudio(file){const a={file,paused:true,play(){this.paused=false;played.push(this);return Promise.resolve()},pause(){this.paused=true},removeAttribute(){},load(){}};return a}});
 for(let i=1;i<100;i++)audio.volumeTip(i/100);assert.equal(timers.size,1);assert.equal(played.length,0);
 const finish=()=>{const [id,callback]=timers.entries().next().value;timers.delete(id);callback()};finish();
 assert.equal(played[0].file,'VolumeTip.wav');assert.equal(played[0].volume,.99);audio.volumeTip(.375);assert.equal(played[0].paused,true);finish();assert.equal(played[1].volume,.375);
 audio.volumeTip(0);assert.equal(timers.size,0);assert(played.every(a=>a.paused));audio.volumeTip(.5);audio.suspend();assert.equal(timers.size,0);audio.volumeTip(.25);audio.dispose();assert.equal(timers.size,0);
});

test('active white noise follows fractional preview across timer updates, then returns to committed settings',async()=>{
 const {createAudioService}=await import('../../standalone/services/audio.mjs');
 let changed;const state={bgMusic:'bgm_Rain',whiteNoiseVolume:50},played=[];
 const audio=createAudioService({settings:{getSnapshot:()=>state,subscribe(fn){changed=fn;return()=>{}}},visible:()=>true,
  locks:{request:async(_name,_options,callback)=>callback()},createAudio(file){const a={file,paused:true,play(){this.paused=false;played.push(this);return Promise.resolve()},pause(){this.paused=true},removeAttribute(){},load(){}};return a}});
 audio.setTimerState('work');await new Promise(setImmediate);assert.equal(played.length,1);const background=played[0];assert.equal(background.volume,.5);
 audio.previewWhiteNoiseVolume(.37625);audio.setTimerState('work');assert.equal(background.volume,.37625);assert.equal(state.whiteNoiseVolume,50);assert.equal(played.length,1,'preview does not restart the background');
 state.whiteNoiseVolume=37.625;changed();state.whiteNoiseVolume=62;changed();assert.equal(background.volume,.62,'committed volume releases the preview');
 audio.previewWhiteNoiseVolume(.123);audio.previewWhiteNoiseVolume(null);assert.equal(background.volume,.62,'cancelled/failed preview restores stored volume');audio.dispose();
});
