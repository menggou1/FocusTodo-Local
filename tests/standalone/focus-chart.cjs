const { paired, assert, fs, path } = require('./ui-restore-helpers.cjs');
const { evidence } = require('./helpers.cjs');
const { seed } = require('./ui-fixtures.cjs');

async function samples(canvas) {
    return canvas.evaluate(node => {
        const ctx = node.getContext('2d');
        const { data } = ctx.getImageData(0, 0, node.width, node.height);
        const greenAlphas = new Set(), center = Math.round((node.clientWidth - 8) * devicePixelRatio);
        const column = [], alpha = [];
        for (let i = 0; i < data.length; i += 4) {
            const [r, g, b, a] = data.subarray(i, i + 4);
            if (r === 160 && g === 206 && b === 98 && a) greenAlphas.add(a);
            if ((i / 4) % node.width === center && a) {
                column.push([r, g, b].join(','));
                alpha.push(a);
            }
        }
        return { dpr: devicePixelRatio, css: [node.clientWidth, node.clientHeight], bitmap: [node.width, node.height],
            greenAlphas: [...greenAlphas], column: [...new Set(column)], alpha: [...new Set(alpha)],
            series: JSON.parse(node.dataset.series || 'null') };
    });
}

(async () => {
    const results = [];
    for (const deviceScaleFactor of [1, 2]) {
        const pair = await paired({ locale: 'en', dark: true, deviceScaleFactor });
        try {
            await seed(pair);
            await pair.old.locator('[class*=HomeHeader-report]').click();
            await pair.new.locator('[data-view=reports]').click();
            const chart = pair.new.getByRole('img', { name: 'Focus duration chart', exact: true });
            const reference = pair.old.locator('[class*=BarChart-root] canvas').first();
            await reference.waitFor();
            await chart.waitFor();
            const daily = { reference: await samples(reference), current: await samples(chart) };
            const assertPixels = !process.argv.includes('--measure-before');
            if (assertPixels) assert(daily.current.greenAlphas.includes(255), JSON.stringify(daily));
            // The preset Tasks and the blue list otherwise share the same color.
            // Give their fixture rows distinct colors and colliding sort indices.
            await pair.new.evaluate(() => new Promise((resolve, reject) => {
                const open = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3);
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                    const db = open.result, tx = db.transaction('Project', 'readwrite'), store = tx.objectStore('Project');
                    const get = store.get('id-task-tasks');
                    get.onsuccess = () => store.put({ ...get.result, color: 'D42251', order: 20000 });
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onabort = () => { db.close(); reject(tx.error); };
                };
            }));
            await pair.new.reload();
            await pair.new.locator('[data-view=reports]').click();
            await chart.waitFor();
            const series = [];
            for (const period of ['day', 'week', 'month', 'year']) {
                await pair.new.getByLabel('Focus chart period', { exact: true }).selectOption(period);
                const result = await samples(chart);
                assert.equal(result.series.at(-1), Math.round((3620 + 1500 + 90 + 30 + 25) / 36) / 100);
                if (assertPixels) {
                    const top = result.column.indexOf('212,34,81');
                    const blue = result.column.indexOf('70,112,246'), red = result.column.indexOf('236,107,102'), green = result.column.indexOf('160,206,98');
                    assert(top >= 0 && top < blue && blue < red && red < green, JSON.stringify({period, result}));
                }
                series.push({ period, ...result });
            }
            assert.deepEqual(pair.handles[1].errors, []);
            results.push({ deviceScaleFactor, daily, series });
        } finally { await pair.close(); }
    }
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, 'focus-chart.json'), JSON.stringify(results, null, 2));
    console.log('Focus stack Canvas samples saved for DPR 1 and 2');
})().catch(error => { console.error(error); process.exitCode = 1; });
