/* Real 1.9.3 oracle; fresh contexts on isolated preview ports only. */
process.env.FOCUS_RESTORE_SHARED='1';
const {paired,assert}=require('./ui-restore-helpers.cjs');
async function box(page,selector){return page.locator(selector).first().boundingBox()}
async function equalBox(pair,oldSelector,newSelector,label){
 const a=await box(pair.old,oldSelector),b=await box(pair.new,newSelector);
 for(const key of ['x','y','width','height'])assert(Math.abs(a[key]-b[key])<1,label+' '+key+': '+a[key]+' / '+b[key]);
}
(async()=>{
 for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
  const pair=await paired({locale,dark,reducedMotion:'no-preference'});
  try{for(const [width,height]of [[1280,900],[1024,600]]){
   for(const p of [pair.old,pair.new])await p.setViewportSize({width,height});
   await equalBox(pair,'[class*=TaskRegion-navigator]','.workspace-view-heading','heading');
   await equalBox(pair,'[class*=TaskRegion-sortMenu]','.workspace-sort','sort');
   await equalBox(pair,'[class*=Timer-root]','.workspace-floating-timer','floating timer');
   await equalBox(pair,'[class*=StatisticsRegion-root]','.workspace-summary','summary');
   await pair.new.locator('.workspace-sort-trigger').click();
   assert.equal(await pair.new.getByRole('menu').isVisible(),true);
   await pair.new.keyboard.press('Escape');
   assert.equal(await pair.new.getByRole('menu').count(),0);
   await pair.new.locator('[data-view=settings]').click();
   await pair.new.locator('.domain-overlay[open]').waitFor();
   assert.equal(await pair.new.locator('.workspace-floating-timer').evaluate(e=>{
    const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+10)?.closest('.domain-overlay')===document.querySelector('.domain-overlay');
   }),true,'modal backdrop covers timer outside its bounds');
   await pair.new.getByTestId('close-page').click();await pair.new.locator('.domain-overlay').waitFor({state:'detached'});
  }console.log('PASS workspace layout '+locale+' '+(dark?'dark':'light')+' at 1280/1024');
  }finally{await pair.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
