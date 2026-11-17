const {paired,assert,fs,path,root}=require('./ui-restore-helpers.cjs');
const legacy=require('../helpers/legacy-runtime.cjs');
const {evidence}=require('./helpers.cjs');
(async()=>{
 const source=fs.readFileSync(legacy.file('src/js/main.js'),'utf8');
 assert(source.includes('darkModeOptions=[{value:!1,label:e.i18n.prop("apr_light")},{value:!0,label:e.i18n.prop("apr_dark")},{value:null,label:e.i18n.prop("apr_sys")}]'));
 assert(source.includes('startVolumeTip(e/100)'));assert(source.includes('p.start("VolumeTip.wav",e)'));assert(source.includes('},100))'));
 assert(fs.readFileSync(legacy.file('public/audio/VolumeTip.wav')).equals(fs.readFileSync(path.join(root,'public/audio/VolumeTip.wav'))));
 const pair=await paired({reducedMotion:'no-preference',volumeTipFixture:true});
 try{
  const p=pair.old;await p.locator('img[src="img/header-setting.png"]').click();await p.locator('[class*=Settings-menuName]').filter({hasText:'外观'}).click();
  const control=p.locator('[class*=AppearanceSettings-root] [class*=control]').first();await control.click();
  const menu=p.locator('[class$="-menu"]');await menu.waitFor();assert.deepEqual(await menu.locator('[id*="-option-"]').allTextContents(),['浅色','深色','跟随系统']);
  await control.click({position:{x:190,y:15}});await menu.waitFor({state:'hidden'});
  await control.click();await p.locator('[class*=Settings-title]').click();await menu.waitFor({state:'hidden'});await p.locator('[class*=Settings-menuName]').filter({hasText:'番茄钟'}).click();
  const duration=p.locator('[class*=PomodoroSettings-root] [class*=control]').first();await duration.click();await p.locator('[class$="-menu"]').waitFor();assert.equal(await p.locator('[class$="-menu"] img[src="img/new-task-project-selected.png"]').count(),1);await p.keyboard.press('Escape');
  const alarm=p.locator('[class*=PomodoroSettings-root] [class*=control]').nth(4);await alarm.click();await p.locator('[class$="-menu"]').waitFor();
  assert.equal(await p.locator('[class$="-menu"] img[src="img/new-task-project-selected.png"]').count(),1);
  const preview=p.locator('[class$="-menu"] img[src="img/setting-play.png"]').first(),check=p.locator('[class$="-menu"] img[src="img/new-task-project-selected.png"]');
  await preview.locator('..').hover();const previewRect=await preview.boundingBox(),checkRect=await check.boundingBox();assert(previewRect.x+previewRect.width<=checkRect.x);
  const dir=evidence;fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'legacy-alarm.png')});await p.keyboard.press('Escape');
  const slider=p.locator('[class*=PomodoroSettings-root] .ftd-slider-thumb').first(),r=await slider.boundingBox();
  await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x-73,r.y+5,{steps:20});await p.mouse.up();
  const volume=await p.evaluate(()=>Number(localStorage.getItem('RtnVol')));assert(volume>0&&volume<100);
  const style=await slider.locator('..').evaluate(e=>({border:getComputedStyle(e).borderWidth,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}));assert.equal(style.border,'0px');
  console.log('PASS legacy 1.9.4 reference: order, toggle/outside, red checks, previews left of check, borderless 200px slider, drag, VolumeTip.wav + 100ms; baseline '+legacy.commit,style,volume);
 }finally{await pair.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

