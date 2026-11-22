const { paired, assert, fs, path } = require('./ui-restore-helpers.cjs');
const { evidence } = require('./helpers.cjs');

const output = path.join(evidence, 'mini-timer');
const legacyRoot = '.focus-mini-timer';
const currentRoot = '.workspace-mini-native';

async function openMini(pair, legacy, width) {
    const page = legacy ? pair.old : pair.new;
    const trigger = page.locator(legacy ? '.focus-timer-mini' : '.legacy-timer-float-mini');
    await trigger.locator('..').hover();
    await trigger.click();
    await page.waitForFunction(selector => documentPictureInPicture.window?.document.querySelector(selector),
        legacy ? legacyRoot : currentRoot);
    const popup = pair.handles[legacy ? 0 : 1].context.pages().find(other => other !== page);
    assert(popup, 'The actual Document Picture-in-Picture window opened');
    await popup.setViewportSize({ width, height:58 });
    return popup;
}

function geometry(popup, legacy) {
    return popup.evaluate(legacy => {
        const read = selector => {
            const node = document.querySelector(selector), rect = node.getBoundingClientRect(), style = getComputedStyle(node);
            return [rect.x, rect.y, rect.width, rect.height, style.fontSize, style.fontWeight, style.color];
        };
        return {
            dial: read(legacy ? '[class*=FloatTimer-dial]' : '.workspace-mini-native .workspace-clock'),
            text: read(legacy ? '[class*=FloatTimer-countdown]' : '.workspace-mini-native .workspace-clock span'),
            wallpaper: getComputedStyle(document.querySelector(legacy ? '.focus-mini-timer [class*=Timer-bgi]' : '.legacy-mini-wallpaper')).filter,
            action: read(legacy ? '[class*=FloatTimer-start-]' : '.workspace-mini-native .workspace-timer-controls button')
        };
    }, legacy);
}

async function capture(popup, name) {
    // Chromium can leave the archive's auxiliary font set pending. Capture
    // the painted native surface; computed geometry is asserted separately.
    const session = await popup.context().newCDPSession(popup);
    try {
        const {data} = await session.send('Page.captureScreenshot', {format:'png'});
        fs.writeFileSync(path.join(output,name+'.png'), Buffer.from(data,'base64'));
    } finally { await session.detach(); }
}

async function run(pair, theme) {
    const { old, new: page } = pair;
    for (const opener of [old, page]) {
        assert(await opener.evaluate(() => typeof documentPictureInPicture?.requestWindow === 'function'));
        await opener.evaluate(() => {
            const api = documentPictureInPicture, open = api.requestWindow.bind(api);
            api.requestWindow = size => { window.requestedMiniSize=size; return open(size); };
        });
    }
    const reference = await openMini(pair, true, 147);
    assert.deepEqual(await old.evaluate(() => window.requestedMiniSize), { width:147, height:58 });
    const baseline = await geometry(reference, true);
    await reference.locator('[class*=FloatTimer-root]').evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    await capture(reference,theme+'-archive-147x58');
    await reference.locator('.focus-mini-timer').hover();
    const left = await reference.locator('[class*=FloatTimer-miniModeImgZoomUp]').boundingBox();
    const right = await reference.locator('[class*=FloatTimer-zoomup] img').boundingBox();
    assert(left.x < 12 && right.x > 127);
    await old.evaluate(() => documentPictureInPicture.window.close());
    await old.waitForFunction(()=>!documentPictureInPicture.window);

    const mini = await openMini(pair, false, 147);
    assert.deepEqual(await page.evaluate(() => window.requestedMiniSize),
        { width:147, height:58, preferInitialWindowPlacement:true });
    const initial = await geometry(mini, false);
    assert.deepEqual(initial.dial.slice(0,4), baseline.dial.slice(0,4));
    assert.deepEqual(initial.action, baseline.action);
    assert.deepEqual(initial.text.slice(4), baseline.text.slice(4));
    assert.equal(initial.wallpaper, baseline.wallpaper);
    assert(await mini.locator(currentRoot+' .workspace-clock').evaluate(node=>getComputedStyle(node).fontSize==='18px'));
    assert.equal(await mini.locator(currentRoot+' .workspace-clock span').textContent(),'25');
    await mini.locator(currentRoot+' .workspace-timer-controls img').evaluate(image => image.decode());
    await mini.locator(currentRoot).evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    await capture(mini,theme+'-react-147x58');

    const viewport = [];
    for (const [width,height] of [[480,290],[126,52]]) {
        await mini.setViewportSize({width,height});
        const bounds = await mini.locator(currentRoot).boundingBox();
        const action = await mini.locator(currentRoot+' .workspace-timer-controls button').boundingBox();
        assert.equal(bounds.width,Math.min(width,147));
        assert.equal(bounds.height,Math.min(height,58));
        assert.equal(bounds.x,(width-bounds.width)/2);
        assert.equal(bounds.y,(height-bounds.height)/2);
        assert.equal(action.width,26);
        assert.equal(action.height,26);
        assert(action.x+action.width<=width&&action.y+action.height<=height);
        assert.equal(await mini.locator('.legacy-mini-wallpaper').evaluate(node=>getComputedStyle(node).backgroundSize),'cover');
        viewport.push({width,height,bounds,action});
        await capture(mini,theme+'-react-'+width+'x'+height);
    }
    await page.locator('[data-view=settings]').click();
    await page.locator('.domain-setting select').first().selectOption('1');
    await page.waitForFunction(()=>localStorage.getItem('FocusTodoStandalone.data.WorkInterval')==='60');
    await page.getByTestId('close-page').click();
    await page.getByTestId('settings-page').waitFor({state:'hidden'});
    const state = label => page.waitForFunction(label=>documentPictureInPicture.window?.document.querySelector('.workspace-mini-native')?.dataset.state===label,label);
    await mini.getByRole('button',{name:'Start',exact:true}).click();
    await state('work');
    await page.locator('[data-testid=timer-floating][data-state=work]').waitFor();
    await mini.getByRole('button',{name:'Pause',exact:true}).click();
    await state('pause');
    const paused = await mini.locator(currentRoot+' .workspace-timer-controls button').evaluateAll(nodes => nodes.map(node => {
        const r=node.getBoundingClientRect();return [r.x,r.y,r.right,r.bottom];
    }));
    assert(paused.every(([x,y,right,bottom])=>x>=0&&y>=0&&right<=126&&bottom<=52));
    await mini.getByRole('button',{name:'Continue',exact:true}).click();
    await state('work');
    await mini.locator('.legacy-mini-frame').hover();
    await mini.getByRole('button',{name:'Close mini timer',exact:true}).click();
    await page.waitForFunction(()=>!documentPictureInPicture.window);
    await page.locator('[data-testid=timer-floating][data-state=work]').waitFor();
    const reopened = await openMini(pair,false,147);
    await state('work');
    await page.clock.fastForward(61000);
    await state('waitingForRest');
    await reopened.getByRole('button',{name:'Start break',exact:true}).click();
    await state('rest');
    await page.locator('[data-testid=timer-floating][data-state=rest]').waitFor();
    await capture(reopened,theme+'-react-rest');
    await reopened.getByRole('button',{name:'Complete',exact:true}).click();
    await state('initial');

    await page.locator('[data-view=tasks]').click();
    const input = page.locator('.workspace-add-task input');
    await input.fill('Mini timer task');
    await input.press('Enter');
    await page.getByTestId('task-row').filter({hasText:'Mini timer task'}).locator('.workspace-task-start').click();
    await reopened.getByText('Mini timer task',{exact:true}).waitFor();
    await page.locator('.legacy-timer-close').click();
    await page.evaluate(()=>documentPictureInPicture.window.close());
    await page.waitForFunction(()=>!documentPictureInPicture.window);
    const attached = await openMini(pair,false,232);
    assert.deepEqual(await page.evaluate(()=>window.requestedMiniSize),{width:232,height:58,preferInitialWindowPlacement:true});
    assert.equal((await attached.locator(currentRoot).boundingBox()).width,232);
    await capture(attached,theme+'-react-task-232x58');
    return { baseline, initial, viewport };
}

(async () => {
    fs.mkdirSync(output,{recursive:true});
    for (const dark of [false,true]) {
        const pair = await paired({locale:'en',dark}),theme=dark?'dark':'light';
        try {
            await pair.new.clock.install({time:new Date('2026-11-08T12:00:00+08:00')});
            const result = await run(pair,theme);
            assert.deepEqual(pair.handles[1].errors,[]);
            fs.writeFileSync(path.join(output,theme+'-results.json'),JSON.stringify({ archive:pair.baseline, ...result },null,2));
            console.log('PASS '+theme+' native mini-timer geometry, window resizing and shared work/pause/rest state');
        } finally { await pair.close(); }
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
