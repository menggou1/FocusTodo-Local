/* D-R3 motion: old 1.9.3 and integrated React with reduced-motion disabled. */
process.env.FOCUS_RESTORE_SHARED = process.env.FOCUS_RESTORE_SHARED || '1';
const { paired, copyFixture, assert, fs, path } = require('./ui-restore-helpers.cjs');
const out = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || 'dist/acceptance/d-r3');
const results = [];
const selectors = old => old
  ? { root: '.Timer-root-1NNf3', surface: '.FullscreenTimer-root-1wlsO', float: '.FloatTimer-root-3_uz_', widget: '.WidgetView-root-28i7L', flipFront: '.FlipDigitView-frontTopAnimation-3ER4N', flipBack: '.FlipDigitView-backBottomAnimation-1kFoX', clock: '.FloatTimer-countdown-Hwcmh', canvas: '.FloatTimer-dial-3YvkG canvas', expand: '.FloatTimer-zoomup-3tTgo' }
  : { root: '.domain-full-timer', surface: '.workspace-timer-expanded', float: '.workspace-floating-timer', widget: '.legacy-timer-widgets', flipFront: '.legacy-flip-front-top.animating', flipBack: '.legacy-flip-back-bottom.animating', clock: '.workspace-floating-timer .workspace-clock span', canvas: '.legacy-floating-progress', expand: '.legacy-timer-float-expand' };
const near = (a, b, tolerance = 1) => Math.abs(Number(a) - Number(b)) <= tolerance;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pair = await paired({ locale: 'en', reducedMotion: 'no-preference' });
  try {
    const old = pair.old, next = pair.new;
    for (const page of [old, next]) { await page.evaluate(() => document.fonts.ready); }

    // Floating: same minute format, ring, and hover-only expand hit area.
    const oldClock = (await old.locator(selectors(true).clock).innerText()).trim();
    const newClock = (await next.locator(selectors(false).clock).innerText()).trim();
    assert.equal(oldClock, '25'); assert.equal(newClock, '25');
    assert(await old.locator(selectors(true).canvas).count() === 1);
    assert(await next.locator(selectors(false).canvas).count() === 1);
    await old.locator(selectors(true).float).hover(); await next.locator(selectors(false).float).hover();
    const oldExpand = await old.locator(selectors(true).expand).boundingBox(), newExpand = await next.locator(selectors(false).expand).boundingBox();
    assert.deepEqual(newExpand, oldExpand);

    const freeze = async (page, isOld, phase) => page.evaluate(async ({ isOld, phase }) => {
      const sel = isOld
        ? { root: '.Timer-root-1NNf3', surface: '.FullscreenTimer-root-1wlsO', float: '.FloatTimer-root-3_uz_', expand: '.FloatTimer-zoomup-3tTgo', close: '.FullscreenTimer-zoomdown-10U6T' }
        : { root: '.domain-full-timer', surface: '.workspace-timer-expanded', float: '.workspace-floating-timer', expand: '.legacy-timer-float-expand', close: '.legacy-timer-close' };
      document.querySelector(phase === 'open' ? sel.expand : sel.close).click();
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (document.querySelector(phase === 'open' ? sel.root : sel.float) && (phase === 'close' || document.querySelector(sel.surface))) break;
      }
      const target = document.querySelector(phase === 'open' ? sel.root : sel.float);
      const root = document.querySelector(sel.root), surface = document.querySelector(sel.surface);
      const animations = [...new Set([root, target, surface, document.querySelector(sel.float), !isOld && phase === 'close' ? document.querySelector('.workspace-floating-timer>.workspace-clock') : null].filter(Boolean).flatMap(element => element.getAnimations()))];
      for (const animation of animations) animation.pause();
      return [0, 125, 250].map(time => {
        for (const animation of animations) { animation.pause(); animation.currentTime = time; }
        const rect = target.getBoundingClientRect();
        return { rect: [rect.x, rect.y, rect.width, rect.height], opacity: phase === 'open' && surface ? getComputedStyle(surface).opacity : getComputedStyle(!isOld && phase === 'close' ? document.querySelector('.workspace-floating-timer>.workspace-clock') : target).opacity };
      });
    }, { isOld, phase });
    const oldOpen = await freeze(old, true, 'open'), newOpen = await freeze(next, false, 'open');
    for (let i = 0; i < 3; i++) {
      assert(near(oldOpen[i].rect[0], newOpen[i].rect[0]) && near(oldOpen[i].rect[1], newOpen[i].rect[1]) && near(oldOpen[i].rect[2], newOpen[i].rect[2]) && near(oldOpen[i].rect[3], newOpen[i].rect[3]), 'expand geometry frame ' + i + ': ' + JSON.stringify([oldOpen[i].rect, newOpen[i].rect]));
      assert(near(oldOpen[i].opacity, newOpen[i].opacity, .01), 'expand fade frame ' + i + ': ' + oldOpen[i].opacity + ' / ' + newOpen[i].opacity);
    }
    await old.waitForTimeout(300); await next.waitForTimeout(300);

    const oldClose = await freeze(old, true, 'close'), newClose = await freeze(next, false, 'close');
    for (let i = 0; i < 3; i++) {
      assert(near(oldClose[i].rect[0], newClose[i].rect[0]) && near(oldClose[i].rect[1], newClose[i].rect[1]) && near(oldClose[i].rect[2], newClose[i].rect[2]) && near(oldClose[i].rect[3], newClose[i].rect[3]), 'collapse geometry frame ' + i + ': ' + JSON.stringify([oldClose[i].rect, newClose[i].rect]));
      assert(near(oldClose[i].opacity, newClose[i].opacity, .01), 'collapse fade frame ' + i + ': ' + oldClose[i].opacity + ' / ' + newClose[i].opacity);
    }
    await old.waitForTimeout(300); await next.waitForTimeout(300);

    // Widget rail: 150 ms linear width transition, then content unmount.
    await old.locator(selectors(true).float).hover(); await next.locator(selectors(false).float).hover();
    await old.locator(selectors(true).expand).click(); await next.locator(selectors(false).expand).click();
    await old.waitForTimeout(350); await next.waitForTimeout(350);
    const oldWidgetStart = await old.locator(selectors(true).widget).evaluate(e => getComputedStyle(e).width);
    const newWidgetStart = await next.locator(selectors(false).widget).evaluate(e => getComputedStyle(e).width);
    const oldTransition = await old.locator(selectors(true).widget).evaluate(e => getComputedStyle(e).transitionDuration);
    const newTransition = await next.locator('.legacy-timer-widget-rail').evaluate(e => getComputedStyle(e).transitionDuration);
    assert.equal(oldTransition, '0.15s'); assert.equal(newTransition, '0.15s');
    const newWidgetMid = await next.evaluate(() => { document.querySelector('.legacy-timer-widget-toggle').click(); return new Promise(resolve => setTimeout(() => resolve(document.querySelector('.legacy-timer-widgets') ? getComputedStyle(document.querySelector('.legacy-timer-widgets')).width : null), 75)); });
    assert(parseFloat(newWidgetStart) > parseFloat(newWidgetMid) && parseFloat(newWidgetMid) > 0, 'new widget rail progresses through its width: '+newWidgetStart+' -> '+newWidgetMid);
    await old.waitForTimeout(120); await next.waitForTimeout(120);
    assert.equal(await next.locator(selectors(false).widget).count(), 0, 'widget content unmounts after the 150ms collapse');
    await next.getByRole('button', { name: 'Toggle widgets' }).click(); await next.waitForTimeout(200);
    assert.equal(await next.locator(selectors(false).widget).count(), 1, 'widget content remounts on expansion');
    await next.waitForTimeout(200);

    // FlipClock: 600ms linear half-flip, front 0 -> -180, back 180 -> 0.
    await old.locator('[class*=FullscreenTimer-flipClockImg]').click(); await next.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await old.waitForTimeout(400); await next.waitForTimeout(400);
    const oldFlipRoot = old.locator('[class*=FlipClock-root]'), newFlipRoot = next.locator('.legacy-flip-clock');
    await old.clock.install(); await next.clock.install();
    await oldFlipRoot.hover(); await next.waitForTimeout(100);
    await oldFlipRoot.locator('[class*=FlipClock-timerActionStart]').click(); await newFlipRoot.getByRole('button', { name: 'Start', exact: true }).click();
    await old.clock.fastForward(1100); await next.clock.fastForward(1100);
    const flipFrames = async (page, isOld) => {
      const sel = selectors(isOld);
      await page.waitForFunction(sel => !!document.querySelector(sel.flipFront), sel, { timeout: 5000 });
      return page.evaluate(sel => {
        const front = document.querySelector(sel.flipFront), back = document.querySelector(sel.flipBack);
        const animations = [...front.getAnimations(), ...back.getAnimations()];
        const read = time => {
          for (const animation of animations) { animation.pause(); animation.currentTime = time; }
          return { front: getComputedStyle(front).transform, back: getComputedStyle(back).transform };
        };
        return { duration: animations[0]?.effect.getTiming().duration, easing: animations[0]?.effect.getTiming().easing, frames: [read(0), read(300), read(600)] };
      }, sel);
    };
    const oldFlip = await flipFrames(old, true), newFlip = await flipFrames(next, false);
    assert.equal(newFlip.duration, oldFlip.duration); assert.equal(newFlip.duration, 600);
    assert.equal(newFlip.easing, oldFlip.easing);
    assert.deepEqual(newFlip.frames, oldFlip.frames);
    await oldFlipRoot.locator('[class*=FlipClock-close]').click(); await newFlipRoot.locator('.legacy-flip-close').click();
    await old.locator('[class*=FullscreenTimer-zoomdown]').click(); await next.locator('.legacy-timer-close').click();
    await old.waitForTimeout(300); await next.waitForTimeout(300);

    await old.evaluate(async () => { const now = Date.now(); await FocusLocalData.forestSet('LaunchReward', JSON.stringify([{ date: now - 25 * 3600000, count: 1, isGotDailyLoginReward: false, isGotContinueLoginReward: false }, { date: now - 1000, count: 2, isGotDailyLoginReward: false, isGotContinueLoginReward: false }])); });
    await copyFixture(pair);
    await old.locator('[class*=HomeHeader-forest]').click(); await next.locator('[data-view=forest]').click();
    const mature = next.locator('.legacy-forest-sun[data-mature=true]').first();
    await mature.waitFor();
    const beforeSun = await mature.evaluate(e => getComputedStyle(e).transform);
    await mature.click();
    await next.waitForFunction(() => document.querySelector('.legacy-forest-sun.collecting'));
    const sunAnimation = await next.locator('.legacy-forest-sun.collecting').evaluate(e => e.getAnimations().map(a => ({ name: a.animationName, duration: a.effect.getTiming().duration, easing: a.effect.getTiming().easing })));
    assert.equal(sunAnimation[0].duration, 1000); assert.equal(sunAnimation[0].easing, 'ease-in-out');
    await next.waitForTimeout(500);
    const midSun = await next.locator('.legacy-forest-sun.collecting').evaluate(e => getComputedStyle(e).transform);
    assert.notEqual(midSun, beforeSun);
    await next.waitForFunction(() => !document.querySelector('.legacy-forest-sun.collecting'), { timeout: 4000 });
    await next.waitForFunction(() => document.querySelector('.domain-tree')?.getAnimations().length > 0, { timeout: 3000 });
    const treeAnimation = await next.locator('.domain-tree').evaluate(e => e.getAnimations().map(a => ({ duration: a.effect.getTiming().duration, easing: a.effect.getTiming().easing })));
    assert.equal(treeAnimation[0].duration, 800);

    results.push({ name: 'timer/fullscreen/flip/widget motion', passed: true, open: newOpen, close: newClose, widget: { oldTransition, newTransition, oldStart: oldWidgetStart, newMid: newWidgetMid }, flip: newFlip, forest: { sunAnimation, treeAnimation } });
    console.log('PASS timer/fullscreen/flip/widget motion');
  } catch (error) {
    results.push({ name: 'timer/fullscreen/flip/widget motion', passed: false, error: error.stack });
    await pair.new.screenshot({ path: path.join(out, 'motion-failure.png') }).catch(() => {});
    console.error('FAIL timer/fullscreen/flip/widget motion\n' + error.stack);
  } finally {
    await pair.close();
    fs.writeFileSync(path.join(out, 'motion-results.json'), JSON.stringify({ results }, null, 2));
  }
  if (!results.every(row => row.passed)) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1 });
