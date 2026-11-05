/* Shared controls against pre-refactor 9d39be5 computed styles, in isolated data. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{createServer}=require('../../scripts/server.cjs');
const baseline=require('../fixtures/controls-9d39be5.json');
const evidence=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance');
const props=['fontSize','fontFamily','fontWeight','lineHeight','height','width','padding','borderRadius','borderWidth','backgroundColor','color'];
const sidebar=Object.keys(require('../fixtures/sidebar-typography-cfd6449.json').metrics);
async function metrics(page,selectors){return page.evaluate(({selectors,props})=>Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{
    const node=document.querySelector(selector);if(!node)return[key,null];const style=getComputedStyle(node);
    return[key,Object.fromEntries(props.map(name=>[name,style[name]]))];
})),{selectors,props});}
function compare(actual,expected,message){
    for(const key of Object.keys(expected)){
        assert(actual[key],message+': '+key);
        for(const prop of props){
            const value=actual[key][prop],reference=expected[key][prop];
            // An auto-sized dropdown label follows the platform's glyph widths.
            // Check containment in the live control instead of a Windows text width.
            if(key==='value'&&prop==='width')continue;
            // Ignore the platform fallback tail and subpixel rounding.
            if(prop==='fontFamily')assert.equal(value.split(',')[0],reference.split(',')[0],message+': '+key+' '+prop);
            else if(prop==='width'&&reference.endsWith('px'))assert(Math.abs(parseFloat(value)-parseFloat(reference))<=2,message+': '+key+' '+prop+' '+value+' vs '+reference);
            else assert.equal(value,reference,message+': '+key+' '+prop);
        }
    }
}
(async()=>{
    fs.mkdirSync(evidence,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+server.address().port;
    const executablePath=process.env.FOCUS_TEST_BROWSER||(!process.env.FOCUS_TEST_BUNDLED_BROWSER&&['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})}),results=[];
    try{for(const locale of ['zh-CN','en'])for(const dark of [false,true]){
        const key=locale+'-'+(dark?'dark':'light'),context=await browser.newContext({locale,timezoneId:'Asia/Shanghai',viewport:{width:1280,height:900}}),errors=[],external=[];
        await context.addInitScript(({locale,dark})=>{localStorage.setItem('FocusTodo.language',locale);localStorage.setItem('DarkMode',String(dark))},{locale,dark});
        await context.route('**/*',route=>{if(/^https?:/.test(route.request().url())&&!route.request().url().startsWith(base)){external.push(route.request().url());return route.abort()}return route.continue()});
        const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
        try{
            await page.goto(base);await page.waitForFunction(()=>window.FocusLocalReady&&document.querySelector('[class*=HomeHeader-forest]')&&!document.documentElement.classList.contains('focus-starting'));
            await page.evaluate(()=>FocusLocalReady);await page.locator('.ProjectItem-name-3IyjO').first().waitFor();await page.evaluate(()=>document.fonts.ready);
            const unchanged=async width=>compare(await metrics(page,Object.fromEntries(sidebar.map(s=>[s,s]))),baseline.cases[key][width].sidebar,'Sidebar, search and header retain pre-refactor styles');
            for(const width of [1024,1280]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);await unchanged(width);}
            const fault=await page.addStyleTag({content:'.ProjectItem-name-3IyjO{font-size:18px!important}'});
            await assert.rejects(unchanged(1280),/pre-refactor styles/);await fault.evaluate(n=>n.remove());await unchanged(1280);
            await page.mouse.click(1255,25);
            const menu=name=>page.locator('[class*=Settings-menuName]').filter({hasText:name});
            for(const width of [1024,1280]){
                await page.setViewportSize({width,height:900});await menu(locale==='en'?'General':'通用').click();
                compare(await metrics(page,{track:'.react-switch-bg',handle:'.react-switch-handle'}),baseline.cases[key].switch,'Shared switches retain original geometry and theme');
                const language=page.locator('#focus-language .focus-ui-select__control');await language.waitFor();
                assert.equal(await page.locator('#focus-language select').count(),0,'Language uses the real shared select component');
                const languageStyle=await metrics(page,{control:'#focus-language .focus-ui-select__control'});
                compare(languageStyle,{control:baseline.cases[key].select.control},'Language shares existing settings select appearance');
                const toggle=page.locator('.react-switch-handle').first();const checked=await toggle.getAttribute('aria-checked');await toggle.click();assert.notEqual(await toggle.getAttribute('aria-checked'),checked);await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),checked);
                await language.click();const options=page.locator('#focus-language .focus-ui-select__option');await options.first().waitFor();
                assert.deepEqual(await options.allTextContents(),[locale==='en'?'Follow system':'跟随系统','简体中文','English']);
                const list=page.locator('#focus-language .focus-ui-select__menu');const box=await list.boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=900,'Menu stays inside viewport');
                await page.screenshot({path:path.join(evidence,'controls-'+key+'-'+width+'.png')});
                await page.keyboard.press('Escape');assert.equal(await list.count(),0,'Escape closes dropdown');assert.equal(await page.locator('[class^=Settings-root-]').count(),1,'Escape preserves settings');
                await menu(locale==='en'?'Pomodoro':'番茄钟').click();
                compare(await metrics(page,{control:'[class*=PomodoroSettings-selectTable] [class$=-control]',value:'[class*=PomodoroSettings-selectTable] [class$=-singleValue]'}),baseline.cases[key].select,'Existing dropdowns retain pre-refactor appearance');
                const legacy=page.locator('[class*=PomodoroSettings-selectTable] [class$=-control]').first();await legacy.click();await page.keyboard.press('Escape');
                const label=legacy.locator('[class$=-singleValue]');
                assert(await label.evaluate(node=>{
                    const text=node.getBoundingClientRect(),container=node.parentElement.getBoundingClientRect();
                    return text.width>0&&text.left>=container.left&&text.right<=container.right&&node.scrollWidth<=node.clientWidth;
                }),'Settings dropdown text fits its value container without clipping');
            }
            await page.locator('[class^=Settings-close-]').click();await page.locator('[class^=Settings-root-]').waitFor({state:'detached'});
            await page.locator('[class*=HomeHeader-forest]').click();await page.locator('[class*=Forest-container]').waitFor();
            const buttons=page.locator('.focus-ui-forest-action');assert.equal(await buttons.count(),3);
            const appearances=await buttons.evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return [s.width,s.height,s.margin,s.borderRadius,s.borderWidth,s.backgroundColor]}));
            assert(appearances.every(value=>JSON.stringify(value)===JSON.stringify(appearances[0])),'All three forest actions share the same atom');assert.equal(appearances[0][0],'36px');
            const toast=await page.evaluate(()=>{const node=document.createElement('div');node.className='ForestSection-tipToast-2V6vL';document.querySelector('[class*=Forest-container]').append(node);const value=getComputedStyle(node).whiteSpace;node.remove();return value});assert.equal(toast,'normal','Long forest notices still wrap after atomic text extraction');
            assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({name:key,passed:true});console.log('PASS shared controls '+key+' at 1024/1280px');
        }catch(error){results.push({name:key,passed:false,error:error.stack});await page.screenshot({path:path.join(evidence,'controls-failure-'+key+'.png')}).catch(()=>{});throw error;}
        finally{await context.close();}
    }}finally{fs.writeFileSync(path.join(evidence,'controls-results.json'),JSON.stringify({baseline:baseline.source,results},null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
