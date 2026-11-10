const {paired,fixture,open,sel,out}=require('./forest-parity.cjs');
const {assert,fs,path}=require('./ui-restore-helpers.cjs');
async function balance(page,key){return page.evaluate(key=>Number(JSON.parse(localStorage.getItem((key==='new'?'FocusTodoStandalone.data.':'')+'FocusTodo.forestState')).fields.Sunlight),key)}
async function flight(page,key,bulk,label){
 const sun=bulk?sel[key].sun:await page.locator(sel[key].sun).filter({hasText:'60g'}).evaluate(e=>e.id?'#'+CSS.escape(e.id):'[data-reward='+JSON.stringify(e.dataset.reward)+']');
 const start=await page.locator(sel[key].sun).evaluateAll(nodes=>nodes.map(e=>({id:e.id||e.dataset.reward,left:parseFloat(e.style.left),top:parseFloat(e.style.top),text:e.textContent})));
 await page.locator(bulk?sel[key].actions+':last-child':sun).click();
 await page.waitForFunction(s=>[...document.querySelectorAll(s)].some(e=>e.getAnimations().some(a=>a.effect.getTiming().duration===1000)),sun);
 const values=await page.locator(sun).evaluateAll((nodes,scene)=>{
  const parent=document.querySelector(scene).getBoundingClientRect();return nodes.flatMap(e=>{const a=e.getAnimations().find(a=>a.effect.getTiming().duration===1000);if(!a)return[];a.pause();a.currentTime=0;const r=e.getBoundingClientRect(),start={x:r.x+r.width/2-parent.x,y:r.y+r.height/2-parent.y};return[{id:e.id||e.dataset.reward,duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing,start,frames:[0,100,250,500,750,999].map(time=>{a.currentTime=time;const r=e.getBoundingClientRect(),s=getComputedStyle(e),m=new DOMMatrix(s.transform);return{time,x:r.x+r.width/2-parent.x,y:r.y+r.height/2-parent.y,scale:m.a,opacity:Number(s.opacity)}})}]});
 },sel[key].scene);
 assert.equal(values.length,bulk?22:1,key+' visible flight count');
 for(const value of values){assert.equal(value.duration,1000);assert.equal(value.easing,'ease-in-out');for(const f of value.frames){const progress=1-f.opacity;assert(Math.abs(f.scale-(1-.8*progress))<.0001,'scale/opacity stay synchronized');assert(Math.abs(f.x-(value.start.x+(190-value.start.x)*progress))<.08,'original x path');assert(Math.abs(f.y-(value.start.y+(447*.84-value.start.y)*progress))<.08,'original y path')}}
 for(const time of [0,250,500,750,999]){await page.locator(sun).evaluateAll((nodes,time)=>nodes.forEach(e=>e.getAnimations().filter(a=>a.effect.getTiming().duration===1000).forEach(a=>a.currentTime=time)),time);await page.screenshot({path:path.join(out,`${label}-${time}-${key}.png`)})}
 await page.locator(sun).evaluateAll(nodes=>nodes.forEach(e=>e.getAnimations().filter(a=>a.effect.getTiming().duration===1000).forEach(a=>{a.currentTime=0;a.play()})));
 await page.waitForFunction(s=>document.querySelector(s).getAnimations().some(a=>a.effect.getTiming().duration===800),sel[key].tree);const pulses=await page.locator(sel[key].tree).evaluate(e=>e.getAnimations().map(a=>({duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing,frames:a.effect.getKeyframes()})));
 await page.waitForTimeout(900);return{start,values,pulses,balance:await balance(page,key)};
}
async function run(){const results=[];for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
 const prefix=locale+'-'+(dark?'dark':'light'),pair=await paired({locale,dark,reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'flight-videos'),size:{width:1280,height:900}}}),r={prefix};
 try{
  await fixture(pair);for(const key of ['old','new'])await open(pair[key],key);r.before={old:await balance(pair.old,'old'),new:await balance(pair.new,'new')};assert.equal(r.before.old,r.before.new);
  for(const bulk of [false,true]){const mode=bulk?'multiple':'single';r[mode]={};for(const key of ['old','new'])r[mode][key]=await flight(pair[key],key,bulk,prefix+'-'+mode);const a=r[mode].old,b=r[mode].new;assert.equal(a.balance,b.balance);assert.deepEqual(a.values[0].frames.map(f=>[f.time,f.scale,f.opacity]),b.values[0].frames.map(f=>[f.time,f.scale,f.opacity]));assert.equal(b.pulses[0].duration,800);assert.equal(b.pulses[0].easing,'ease-in-out');assert.deepEqual(a.pulses,b.pulses)}
  assert.equal(r.multiple.new.balance-r.before.new,208);r.persisted={};for(const key of ['old','new']){await pair[key].reload();await(key==='old'?pair[key].waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting')):pair[key].getByTestId('app-shell').waitFor());await open(pair[key],key);r.persisted[key]=await balance(pair[key],key);assert.equal(r.persisted[key],r.multiple[key].balance);await pair[key].locator(sel[key].actions).first().click();await pair[key].waitForTimeout(350);assert.equal(await pair[key].locator('[data-achievement]').count(),9);assert.equal(await pair[key].locator(key==='old'?'.focus-achievement-trophy:not(.is-locked)':'.domain-achievement[data-earned=true]').count(),3)}
  for(const h of pair.handles){assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[])}r.passed=true;console.log('PASS '+prefix+' single/multiple path, timing, pulse, balance, achievements and reload');
 }catch(e){r.passed=false;r.error=e.stack;throw e}finally{results.push(r);fs.writeFileSync(path.join(out,'flight-results.json'),JSON.stringify(results,null,2));const videos=pair.handles.map(h=>h.page.video());for(const h of pair.handles)await h.context.close();for(let i=0;i<videos.length;i++)await videos[i].saveAs(path.join(out,`${prefix}-flight-${i?'new':'old'}.webm`));await pair.close()}
}}
run().catch(e=>{console.error(e);process.exitCode=1});
