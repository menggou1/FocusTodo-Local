const {assert, evidence, fs, path} = require('./helpers.cjs');
const {prepare} = require('./calendar-motion.cjs');

const date = '2026-11-12';
const label = 'jyfpqglk';
const toggle = '.legacy-calendar-pane-toggle';
const panel = '.legacy-calendar-pane';

function capture(page, engine, name, options = {}) {
    return page.screenshot({path:path.join(evidence, `${engine}-${name}.png`), ...options});
}

async function blankHeader(page) {
    const location = await page.locator('.workspace-header').evaluate(el => {
        const box = el.getBoundingClientRect();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        return {x,y,hit:document.elementFromPoint(x,y) === el};
    });
    assert(location.hit, 'The pointer hits a non-interactive header blank');
    await page.mouse.click(location.x,location.y);
}

async function blankSlot(page, locale = 'en') {
    const slot = page.getByRole('button',{name:(locale === 'en' ? 'New schedule' : '新建安排') + ' ' + date + ' 08:30',exact:true});
    await slot.scrollIntoViewIfNeeded();
    await slot.click({position:{x:45,y:12}});
}

async function waitPane(page, expanded) {
    await page.waitForFunction(({toggle, panel, expanded}) => {
        const button = document.querySelector(toggle);
        const pane = document.querySelector(panel);
        return button.getAttribute('aria-expanded') === String(expanded) &&
            pane.getBoundingClientRect().width === (expanded ? 420 : 0) &&
            getComputedStyle(pane).visibility === (expanded ? 'visible' : 'hidden');
    }, {toggle,panel,expanded});
}

async function closeTrace(page, click, details) {
    await page.evaluate(({panel,toggle}) => {
        const pane = document.querySelector(panel), button = document.querySelector(toggle);
        const glyph = button.firstElementChild;
        const main = document.querySelector('.legacy-calendar-main');
        const samples = [], transitions = [];
        let frame;
        const sample = time => ({time, width:pane.getBoundingClientRect().width,
            glyph:getComputedStyle(glyph).transform,
            visibility:getComputedStyle(pane).visibility,
            expanded:button.getAttribute('aria-expanded'),
            mainMargin:parseFloat(getComputedStyle(main).marginRight)});
        const capture = time => {
            samples.push(sample(time));
            frame = requestAnimationFrame(capture);
        };
        const start = event => {
            if (event.propertyName === 'width') {
                const width = pane.getAnimations().find(animation => animation.transitionProperty === 'width');
                transitions.push({duration:width?.effect.getTiming().duration,
                    curve:getComputedStyle(pane).transitionTimingFunction});
            }
        };
        pane.addEventListener('transitionstart',start);
        frame = requestAnimationFrame(capture);
        window.readCalendarClose = () => {
            cancelAnimationFrame(frame);
            pane.removeEventListener('transitionstart',start);
            samples.push(sample(performance.now()));
            return {samples,transitions};
        };
    },{panel,toggle});
    await click();
    if (details) {
        await details.waitFor({state:'hidden'});
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.legacy-calendar-main')).marginRight === '0px');
    } else if (await page.locator(toggle).getAttribute('aria-expanded') === 'false') await waitPane(page,false);
    return page.evaluate(() => window.readCalendarClose());
}

function assertExit(trace) {
    assert(trace.samples.some(sample => sample.width > 0 && sample.width < 420 &&
        sample.visibility === 'visible' && sample.expanded === 'false'), 'The original drawer remains visible during its exit');
    assert(trace.samples.some(sample => sample.width === 0 && sample.visibility === 'hidden'), 'The exit reaches the closed state');
    assert(trace.transitions.some(transition => transition.duration === 220 && transition.curve.startsWith('ease-in-out')));
}

async function inspectGlyphs(page, card, engine, mark) {
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    const title = card.locator('.legacy-event-title>span');
    const box = await card.boundingBox();
    const geometry = await title.evaluate(el => {
        const css = getComputedStyle(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        return {title:el.getBoundingClientRect().toJSON(), text:range.getBoundingClientRect().toJSON(),
            lineHeight:css.lineHeight, fontSize:css.fontSize, fontFamily:css.fontFamily,
            overflow:css.overflow, container:getComputedStyle(el.parentElement).overflow};
    });
    const y = Math.max(Math.floor(box.y + 2),Math.floor(geometry.title.y - 4));
    const clip = {x:Math.floor(box.x + 4),y,width:Math.floor(Math.min(145,box.width - 8)),
        height:Math.floor(Math.min(46,box.y+box.height-y-1))};
    const actual = await capture(page,engine,mark,{clip});
    // A control from the same rendered card: expose ink falling outside the
    // title box while keeping the font, line box and siblings in place.
    await title.evaluate(el => { el.style.overflow = 'visible'; });
    let reference;
    try { reference = await capture(page,engine,mark+'-unclipped-control',{clip}); }
    finally { await title.evaluate(el => el.style.removeProperty('overflow')); }
    const pixels = await page.evaluate(async ([actual,reference]) => {
        async function decode(source) {
            const image = new Image();
            image.src = 'data:image/png;base64,' + source;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image,0,0);
            return {width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data};
        }
        const a = await decode(actual), b = await decode(reference);
        const rows = new Set();
        let different = 0;
        for (let i=0;i<a.data.length;i+=4) {
            if (a.data[i] === b.data[i] && a.data[i+1] === b.data[i+1] && a.data[i+2] === b.data[i+2]) continue;
            different++;
            rows.add(Math.floor(i / 4 / a.width));
        }
        return {different, rows:[...rows]};
    },[actual.toString('base64'),reference.toString('base64')]);
    return {geometry,pixels};
}

const cases = [
    ['calendar final acceptance blank closes both sidebars', {locale:'en',reducedMotion:'no-preference'}, async ({page},{engine}) => {
        await prepare(page,'en',[{id:'blank-acceptance',endDate:Date.parse(date+'T09:30:00+08:00'),interval:1800}]);
        const button = page.locator(toggle), details = page.locator('.legacy-record-inspector');
        const card = page.locator('[data-event-id="blank-acceptance"] .legacy-event-title');
        const traces = {details:{}};
        for (const [name, click] of [['inside',()=>blankSlot(page)],['outside',()=>blankHeader(page)]]) {
            await button.click();
            await waitPane(page,true);
            await capture(page,engine,'03-task-'+name+'-open');
            traces[name] = await closeTrace(page,click);
            await capture(page,engine,'03-task-'+name+'-result');
            if (await button.getAttribute('aria-expanded') === 'true') {
                await button.click();
                await waitPane(page,false);
            }
            await card.click();
            await details.waitFor();
            await page.waitForFunction(() => getComputedStyle(document.querySelector('.legacy-calendar-main')).marginRight === '340px');
            await capture(page,engine,'03-detail-'+name+'-open');
            traces.details[name] = await closeTrace(page,click,details);
            await capture(page,engine,'03-detail-'+name+'-result');
        }
        fs.writeFileSync(path.join(evidence,`${engine}-03-exit-traces.json`),JSON.stringify(traces,null,2)+'\n');
        assertExit(traces.inside);
        assertExit(traces.outside);
        for (const trace of Object.values(traces.details)) {
            assert(trace.samples.some(sample => sample.mainMargin > 0 && sample.mainMargin < 340),
                'The timeline visibly expands as the inspector closes');
            assert.equal(trace.samples.at(-1).mainMargin,0);
        }
    }],
    ...[['zh-CN',false,1],['zh-CN',true,1.25],['en',false,1.25],['en',true,1]].map(([locale,dark,deviceScaleFactor]) => [
        `calendar final acceptance rendered descenders ${locale} ${dark?'dark':'light'}`,
        {locale,deviceScaleFactor},async ({page},{engine,rows}) => {
            const en = locale === 'en';
            const mark = `04-${locale}-${dark?'dark':'light'}`;
            await page.locator('[data-view=settings]').click();
            await page.getByRole('button',{name:en?'Appearance':'外观',exact:true}).click();
            await page.getByTestId('prototype-theme').selectOption(dark?'dark':'light');
            await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,dark?'dark':'light');
            await page.getByTestId('close-page').click();
            const dateAt = Date.parse(date+'T15:05:00+08:00');
            await page.clock.setFixedTime(new Date(dateAt));
            await page.setViewportSize({width:1280,height:900});
            await page.getByRole('button',{name:en?'Schedule':'日程',exact:true}).click();
            const scroll = page.locator('.legacy-calendar-scroll');
            await scroll.evaluate(el => {el.scrollTop = 14*124;});
            const canvas = await scroll.locator('.domain-hours').boundingBox();
            const x = canvas.x + canvas.width/5, y = canvas.y + (14*60+20)*canvas.height/1440;
            await page.mouse.move(x,y);
            await page.mouse.down();
            await page.mouse.move(x,y+canvas.height/24,{steps:8});
            await page.mouse.up();
            const quick = page.locator('dialog.legacy-record-quick[open]');
            const input = quick.locator('.legacy-record-name>input');
            await input.pressSequentially(label);
            const draft = page.locator('.legacy-calendar-selection').filter({hasText:label});
            await draft.waitFor();
            await page.evaluate(() => document.fonts.ready.then(() => {}));
            await capture(page,engine,mark+'-while-typing');
            const draftGlyphs = await inspectGlyphs(page,draft,engine,mark+'-draft-pixels');
            assert.deepEqual(await rows(page,'Schedule'),[]);
            await quick.locator('form>footer>button[type=submit]').click();
            await quick.waitFor({state:'hidden'});
            const stored = await rows(page,'Schedule');
            assert.equal(stored.length,1);
            assert.equal(stored[0].interval,3600);
            assert.equal(stored[0].endDate,Date.parse(date+'T15:20:00+08:00'));
            assert.equal((await rows(page,'Task')).find(row=>row.id===stored[0].taskId).name,label);
            const card = page.locator(`[data-event-id="${stored[0].id}"]`);
            const time = await card.locator('small').innerText();
            assert.equal(time,'14:20–15:20');
            assert(await card.locator('.legacy-event-start').isVisible());
            await capture(page,engine,mark+'-saved-card',{clip:await card.boundingBox()});
            const inspected = await inspectGlyphs(page,card,engine,mark+'-title-pixels');
            fs.writeFileSync(path.join(evidence,`${engine}-${mark}-measurements.json`),
                JSON.stringify({draft:draftGlyphs,saved:inspected},null,2)+'\n');
            assert.equal(draftGlyphs.pixels.different,0,JSON.stringify(draftGlyphs));
            assert.equal(inspected.pixels.different,0,JSON.stringify(inspected));
        }
    ]),
];

module.exports = {cases};
