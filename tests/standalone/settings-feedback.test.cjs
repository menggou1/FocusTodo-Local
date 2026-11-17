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
