/* Storage failure/retry, close during flight and reduced motion must not own
   or interrupt the forest service's persistence. All data is generated. */
const {paired,fixture,open,sel,out}=require('./forest-parity.cjs');
const {assert,fs,path}=require('./ui-restore-helpers.cjs');
async function balance(page){return page.evaluate(()=>Number(JSON.parse(localStorage.getItem('FocusTodoStandalone.data.FocusTodo.forestState')).fields.Sunlight))}
(async()=>{const results=[];for(const reducedMotion of ['no-preference','reduce']){const p=await paired({locale:'en',reducedMotion}),r={reducedMotion};try{
 await fixture(p);await open(p.new,'new');const page=p.new;assert.equal(await balance(page),140);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;window.__storageSet=set;window.__failForest=true;Storage.prototype.setItem=function(k,v){if(k==='FocusTodoStandalone.data.FocusTodo.forestState'&&window.__failForest){window.__failForest=false;throw Error('Injected forest collection failure')}return set.apply(this,arguments)}});
 await page.locator(sel.new.sun).filter({hasText:'60g'}).click();await page.waitForFunction(()=>!document.querySelector('.legacy-forest-sun.collecting'));assert.equal(await balance(page),140);assert.equal(await page.locator(sel.new.sun).filter({hasText:'60g'}).count(),1);assert.equal(await page.locator('.legacy-forest-sun:disabled').count(),0);
 await page.evaluate(()=>Storage.prototype.setItem=window.__storageSet);await page.locator(sel.new.sun).filter({hasText:'60g'}).click();await page.waitForFunction(()=>!document.querySelector('.legacy-forest-sun.collecting'));assert.equal(await balance(page),200);
 // Both actions in one event turn exercise the unmount race reproducibly.
 await page.evaluate(()=>{document.querySelector('.legacy-forest-actions button:last-child').click();document.querySelector('[data-testid=close-page]').click()});await page.getByTestId('forest-page').waitFor({state:'detached'});await page.waitForFunction(()=>Number(JSON.parse(localStorage.getItem('FocusTodoStandalone.data.FocusTodo.forestState')).fields.Sunlight)===348);
 await open(page,'new');assert.equal(await page.locator('.legacy-forest-sun[data-mature=true]').count(),0);assert.equal(await balance(page),348);await page.reload();await page.getByTestId('app-shell').waitFor();assert.equal(await balance(page),348);
 assert.deepEqual(p.handles[1].errors,[]);r.passed=true;r.balance=348;console.log('PASS '+reducedMotion+' failure/retry and close-during-flight persistence');
 }catch(e){r.error=e.stack;throw e}finally{results.push(r);fs.writeFileSync(path.join(out,'collection-boundaries.json'),JSON.stringify(results,null,2));await p.close()}}})().catch(e=>{console.error(e);process.exitCode=1});
