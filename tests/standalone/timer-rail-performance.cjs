/* Diagnostic measurements, not a machine-independent FPS acceptance threshold. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,assert,fs,path}=require('./ui-restore-helpers.cjs');
const out=path.resolve('dist/acceptance/d-v-timer-refinement');
(async()=>{const pair=await paired({locale:'en',reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:900}}}),results=[],videos=pair.handles.map(h=>h.page.video());try{
 const pages=[['old',pair.old,true],['new',pair.new,false]];
 for(const [label,page,old]of pages){
  await page.clock.install({time:new Date('2026-11-08T12:00:00+08:00')});await page.locator(old?'[class*=FloatTimer-root]':'[data-testid=timer-floating]').hover();await page.locator(old?'[class*=FloatTimer-zoomup]':'.legacy-timer-float-expand').click();await page.waitForTimeout(350);await page.locator(old?'.FullscreenTimer-action-2wf6l':'.legacy-timer-actions button.primary').click();await page.waitForTimeout(100);
 }
 for(const [label,page,old]of pages){
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  await page.evaluate(old=>{window.__historyWidthWrites=0;window.__frameGaps=[];window.__recordFrames=true;let last=performance.now();const frame=now=>{window.__frameGaps.push(now-last);last=now;if(window.__recordFrames)requestAnimationFrame(frame)};requestAnimationFrame(frame);const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width');Object.defineProperty(HTMLCanvasElement.prototype,'width',{get(){return d.get.call(this)},set(value){if(this.matches(old?'.TodayDetail-detailCanvas-3BoIg,.TodayDetail-summaryCanvas-a1ZD5':'.timer-history-canvas-content>canvas,.legacy-timer-history-summary canvas'))window.__historyWidthWrites++;d.set.call(this,value)},configurable:true})},old);
  const before=await cdp.send('Performance.getMetrics');for(let i=0;i<6;i++){await page.locator(old?'.WidgetView-indicator-1bJ-c':'.legacy-timer-widget-toggle').click();await page.waitForTimeout(250)}const beforeIdle=await page.evaluate(()=>window.__historyWidthWrites);await page.waitForTimeout(1200);
  const after=await cdp.send('Performance.getMetrics'),events=await page.evaluate(()=>{window.__recordFrames=false;return{widthWrites:window.__historyWidthWrites,gaps:window.__frameGaps}}),map=p=>Object.fromEntries(p.metrics.map(m=>[m.name,m.value])),a=map(before),b=map(after);
  results.push({label,widthWrites:events.widthWrites,idleWidthWrites:events.widthWrites-beforeIdle,frames:events.gaps.length,maxGap:Math.max(...events.gaps),over34ms:events.gaps.filter(g=>g>34).length,layoutCount:b.LayoutCount-a.LayoutCount,layoutSeconds:b.LayoutDuration-a.LayoutDuration,taskSeconds:b.TaskDuration-a.TaskDuration});await cdp.detach();
 }
 // Keep the optimistic presentation local; a failed preference write rolls back.
 await pair.new.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='FocusTodoStandalone.data.WidgetExpanded'){Storage.prototype.setItem=original;throw new DOMException('Synthetic preference failure','QuotaExceededError')}return original.call(this,key,value)}});
 await pair.new.locator('.legacy-timer-widget-toggle').click();await pair.new.getByRole('alert').waitFor();await pair.new.waitForFunction(()=>document.querySelector('.legacy-timer-widget-rail').dataset.expanded==='true'&&document.querySelector('.legacy-timer-widget-toggle').getAttribute('aria-busy')==='false');
 assert.equal(await pair.new.evaluate(()=>localStorage.getItem('FocusTodoStandalone.data.WidgetExpanded')),'true');
 assert.equal(await pair.new.locator('.legacy-timer-widget-toggle').evaluate(e=>getComputedStyle(e).opacity),'1');
 fs.writeFileSync(path.join(out,'toggle-rollback.json'),JSON.stringify({passed:true,expanded:true,stored:'true',buttonOpacity:1},null,2));
 fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));console.log('PASS local widget preference failure rolls back without changing button opacity');
}finally{for(const h of pair.handles)await h.context.close();for(let i=0;i<2;i++)await videos[i].saveAs(path.join(out,(i?'new':'old')+'-rail-motion.webm'));await pair.close()}})().catch(e=>{console.error(e);process.exitCode=1});
