const test=require('node:test'),assert=require('node:assert/strict');

test('committed volume feedback uses the original WAV and replaces the previous sample without overlap',async()=>{
 const {createAudioService}=await import('../../standalone/services/audio.mjs');
 const played=[];
 const audio=createAudioService({settings:{getSnapshot:()=>({}),subscribe:()=>()=>{}},visible:()=>true,
  createAudio(file){return {file,paused:true,play(){assert(played.every(a=>a.paused));this.paused=false;played.push(this);return Promise.resolve()},pause(){this.paused=true},removeAttribute(){},load(){}}}});
 audio.volumeTip(.99);
 assert.equal(played[0].file,'VolumeTip.wav');assert.equal(played[0].volume,.99);
 audio.volumeTip(.375);
 assert.equal(played[0].paused,true);assert.equal(played[1].volume,.375);
 played[0].onerror();
 assert.equal(played[1].paused,false,'A late event from the previous sample does not stop the new one');
 audio.volumeTip(0);assert(played.every(a=>a.paused));
 audio.volumeTip(.5);audio.suspend();assert(played.every(a=>a.paused));
 audio.volumeTip(.25);audio.dispose();assert(played.every(a=>a.paused));
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
