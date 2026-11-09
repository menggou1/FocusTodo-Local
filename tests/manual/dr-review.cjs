/* D-R only: temporary browser contexts, no daily browser profile. */
const {chromium}=require('playwright');
const {createServer}=require('../../scripts/server.cjs');
const {createStandaloneServer}=require('../../scripts/standalone-server.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {copyFixture}=require('../standalone/ui-restore-helpers.cjs');
(async()=>{const servers=[createServer(),createStandaloneServer()];let browser;
try{for(const server of servers)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const urls=servers.map(s=>'http://127.0.0.1:'+s.address().port+'/');
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const check=process.argv.includes('--check');browser=await chromium.launch({headless:check,...(executablePath?{executablePath}:{})});
const locale=process.argv.includes('--en')?'en':'zh-CN',dark=process.argv.includes('--dark'),width=Number(process.argv.find(v=>v.startsWith('--width='))?.split('=')[1]||1280);
assert(Number.isInteger(width)&&width>=320&&width<=3840,'Width must be 320..3840');
const pages=[];for(const url of urls){const context=await browser.newContext({locale,timezoneId:'Asia/Shanghai',viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:dark?'dark':'light'});await context.route('**/*',route=>/^https?:/.test(route.request().url())&&!route.request().url().startsWith(url)?route.abort():route.continue());const page=await context.newPage();await page.goto(url);pages.push(page)}
await pages[0].waitForFunction(()=>window.FocusLocalReady&&document.querySelector('[class*=HomeHeader-forest]')&&!document.documentElement.classList.contains('focus-starting'));await pages[1].getByTestId('app-shell').waitFor();
if(!process.argv.includes('--empty')){
 const backup=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/acceptance/2.0.0-dr/demo.json'),'utf8'));
 const from=new Date(backup.meta.exportDate),to=new Date();from.setHours(0,0,0,0);to.setHours(0,0,0,0);const delta=+to-+from;
 const shift=value=>{if(typeof value==='number'&&value>1e12)return value+delta;if(Array.isArray(value))return value.map(shift);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,shift(item)]));return value};
 backup.indexedDB=shift(backup.indexedDB);
 for(const [key,value]of Object.entries(backup.localStorage))try{const decoded=JSON.parse(value);if(decoded&&typeof decoded==='object')backup.localStorage[key]=JSON.stringify(shift(decoded))}catch{}
 backup.localStorage['FocusTodo.language']=locale;backup.localStorage.DarkMode=String(dark);
 await pages[0].evaluate(async backup=>{for(const [key,value]of Object.entries(backup.localStorage))localStorage.setItem(key,String(value));await new Promise((resolve,reject)=>{const r=indexedDB.open('PomodoroDB6',3);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,names=Object.keys(backup.indexedDB).filter(n=>db.objectStoreNames.contains(n)),tx=db.transaction(names,'readwrite');for(const name of names){const store=tx.objectStore(name);store.clear();for(const row of backup.indexedDB[name])store.put(row)}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})},backup);
}else await pages[0].evaluate(({locale,dark})=>{localStorage.setItem('FocusTodo.language',locale);localStorage.setItem('DarkMode',String(dark))},{locale,dark});
await pages[0].reload();await pages[0].waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));await pages[0].evaluate(()=>FocusLocalReady);
const snapshot=await copyFixture({old:pages[0],new:pages[1]});
const candidate=await pages[1].evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('FocusTodoStandalone.PomodoroDB6',3);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('Task').objectStore('Task').getAll();q.onsuccess=()=>{db.close();resolve(q.result)}}}));assert.deepEqual(candidate,snapshot.indexedDB.Task);
for(const page of pages)await page.evaluate(()=>document.fonts.ready);
console.log('Old 1.9.3: '+urls[0]+'\nNew D candidate: '+urls[1]+'\n'+locale+' / '+(dark?'dark':'light')+' / '+width+'x900 / DPR 1 / '+candidate.length+' identical synthetic tasks\nTemporary separate contexts; external network blocked. Close the browser or Ctrl+C to stop.');
if(check){fs.mkdirSync('dist/acceptance/dr-review',{recursive:true});for(let i=0;i<2;i++)await pages[i].screenshot({path:'dist/acceptance/dr-review/'+(i?'new':'old')+'-startup.png'});fs.writeFileSync('dist/acceptance/dr-review/preview-check.json',JSON.stringify({urls,isolatedContexts:2,temporaryProfile:true,externalNetworkBlocked:true,oldReady:true,newReady:true,browser:browser.version()},null,2));await browser.close()}else await new Promise(resolve=>browser.once('disconnected',resolve));
}finally{if(browser?.isConnected())await browser.close();await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))))}})().catch(error=>{console.error(error);process.exitCode=1});
