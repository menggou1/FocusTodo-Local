/* Test-only paired runtime. Never attaches to an installed browser profile. */
const {assert,fs,path,root,launch,contextFor}=require('./helpers.cjs');
const {createServer}=require('../../scripts/server.cjs');
const {createStandaloneServer}=require('../../scripts/standalone-server.cjs');
const {execFileSync}=require('node:child_process');
const baseline='f102da8919e810006b6611aabcef5f0159057d61';
async function paired({locale='zh-CN',dark=false,width=1280,height=900,reducedMotion='reduce',recordVideo}={}){
 assert.equal(execFileSync('git',['diff','--name-only',baseline,'--','src','public','scripts/server.cjs','scripts/runtime-layout.json'],{cwd:root,encoding:'utf8'}).trim(),'','Legacy oracle must remain the audited 1.9.3 runtime');
 const shared=process.env.FOCUS_RESTORE_SHARED==='1';
 const servers=shared?[]:[createServer(),createStandaloneServer()];
 for(const server of servers)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await launch('chromium'),handles=[];
 try{for(let i=0;i<2;i++){
  const origin=shared?'http://127.0.0.1:'+(i?Number(process.env.FOCUS_RESTORE_NEW_PORT||5511):5513):'http://127.0.0.1:'+servers[i].address().port;
  const h=await contextFor(browser,origin,{locale,viewport:{width,height},colorScheme:dark?'dark':'light',reducedMotion,...(recordVideo?{recordVideo}:{})});
  handles.push(h);await h.page.clock.setFixedTime(new Date('2026-11-08T12:00:00+08:00'));
  await h.context.addInitScript(({prefix,locale,dark})=>{localStorage.setItem(prefix+'FocusTodo.language',locale);localStorage.setItem(prefix+'DarkMode',String(dark))},{prefix:i?'FocusTodoStandalone.data.':'',locale,dark});
  await h.page.goto(origin);if(i)await h.page.getByTestId('app-shell').waitFor();else{await h.page.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await h.page.evaluate(()=>FocusLocalReady)}
  await h.page.evaluate(()=>document.fonts.ready);
 }
 return {old:handles[0].page,new:handles[1].page,handles,browser,baseline,async close(){await browser.close();await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))))}};
 }catch(error){await browser.close();await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));throw error}
}
async function copyFixture(pair){
 const backup=await pair.old.evaluate(()=>FocusLocalData.snapshot());
 await pair.new.evaluate(async backup=>{for(const [key,value]of Object.entries(backup.localStorage||{}))localStorage.setItem('FocusTodoStandalone.data.'+key,String(value));await new Promise((resolve,reject)=>{const request=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,names=Object.keys(backup.indexedDB).filter(name=>db.objectStoreNames.contains(name)),tx=db.transaction(names,'readwrite');for(const name of names){const store=tx.objectStore(name);store.clear();for(const row of backup.indexedDB[name])store.put(row)}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})},backup);
 await pair.new.reload();await pair.new.getByTestId('app-shell').waitFor();await pair.new.evaluate(()=>document.fonts.ready);return backup;
}
async function metrics(page,selectors){return page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([name,selector])=>{const el=document.querySelector(selector);if(!el)return[name,null];const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(!r.width||!r.height)return[name,null];return[name,{x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,borderRadius:s.borderRadius,padding:s.padding,display:s.display}]})),selectors)}
module.exports={paired,copyFixture,metrics,assert,fs,path,root};
