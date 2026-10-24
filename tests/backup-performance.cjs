/* Optional generated-data benchmark. Fresh browser contexts never touch user data. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
function playwright() {
    try { return require('playwright'); } catch (_) {
        return require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    }
}
const output = path.resolve(process.argv[2] || path.join(root, 'docs/acceptance/backup-performance.json'));
const sizes = (process.env.FOCUS_BENCHMARK_MB || '1,10,50').split(',').map(Number);
if (sizes.some(n => !Number.isFinite(n) || n <= 0 || n > 60)) throw new Error('FOCUS_BENCHMARK_MB must contain positive MB sizes up to 60.');
const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404); response.end(); return;
    }
    response.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const executablePath = process.env.FOCUS_TEST_BROWSER || (!process.env.FOCUS_TEST_BUNDLED_BROWSER &&
        ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync));
    let browser;
    const report = {
        createdAt: new Date().toISOString(), version: require('../package.json').version,
        environment: { platform: process.platform, release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, systemMemoryBytes: os.totalmem(), node: process.version },
        method: {
            units: 'decimal MB (1 MB = 1,000,000 UTF-8 bytes)',
            input: 'Deterministic generated linked tasks/subtasks/focus records, or a valid PNG of deterministic random RGB pixels plus a small linked history. No private fixtures.',
            verification: 'Benchmark compares all table counts, sorted first/last task IDs, summed focus duration, and every setting value. Full per-record field/relationship and rendered-theme acceptance belongs to the browser regression suite. Compression ratios describe these generated inputs only.',
            timings: 'Milliseconds in an isolated storage fixture running production APIs; gzip encode includes scope preparation/JSON/UTF-8/compression, decode includes decompression/JSON/scope validation. Business validation is timed separately. Restore uses backup:false to omit download initiation; the durable rollback journal remains enabled.',
            responsiveness: '20 ms interval on the same browser main thread. maxIntervalGapMs is observed elapsed time; maxIntervalDelayMs subtracts the intended 20 ms. This measures storage/codec main-thread stalls, not rendered React application throughput.',
            memory: 'Chromium performance.memory sampled at stage boundaries and every 20 ms with --enable-precise-memory-info. sampledPeakUsedJSHeapBytes excludes browser process/native image/Blob memory and cannot catch every allocation peak during blocked JavaScript; it is not process peak RSS.',
            scope: 'One run per size/profile, no fixed speed guarantees. Image data remains in localStorage in 1.3.0; oversized image restore must fail and preserve the original state. Generation time is excluded from operation timings.'
        }, results: []
    };
    try {
        browser = await playwright().chromium.launch({ headless: true, args: ['--enable-precise-memory-info'], ...(executablePath ? { executablePath } : {}) });
        report.environment.browser = browser.version();
        for (const profile of ['task-history', 'image-heavy']) for (const mb of sizes) {
            const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
            const page = await context.newPage();
            page.setDefaultTimeout(300000);
            const started = Date.now();
            try {
                await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
                await page.goto(origin + '/tests/storage-fixture.html');
                for (const file of ['js/local-release.js', 'js/local-timer-core.js', 'js/local-backup.js', 'js/local-data.js']) await page.addScriptTag({ url: origin + '/' + file });
                await page.evaluate(() => window.FocusLocalReady);
                const result = await page.evaluate(async ({ profile, targetBytes }) => {
                    const d = window.FocusLocalData, codec = window.FocusLocalBackup;
                    const baseline = await d.snapshot(), input = structuredClone(baseline);
                    const imageKey = codec.THEMES_KEY, activeKey = codec.ACTIVE_KEY;
                    input.meta.exportDate = '2026-01-01T00:00:00.000Z';
                    input.localStorage.Theme = 'Leaf';
                    delete input.localStorage[imageKey]; delete input.localStorage[activeKey];
                    let seed = 0x13579bdf;
                    function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; }
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    function noise(length) { let text = ''; for (let i = 0; i < length; i++) text += alphabet[random() % alphabet.length]; return text; }
                    const template = 'Generated benchmark description; no real account or task data. '.repeat(16);
                    let approximate = JSON.stringify(input).length, taskNumber = 0;
                    function addGroup() {
                        const i = taskNumber++, id = 'benchmark-task-' + i, subtaskId = 'benchmark-subtask-' + i;
                        const task = { id, name: 'Synthetic task ' + i, projectId: 'benchmark-project', objType: 'TASK', state: 0, sync: 1, pomodoroTime: 3000, pomodoroNumber: 2, detail: template + noise(128) };
                        const subtask = { id: subtaskId, name: 'Synthetic subtask ' + i, taskId: id, state: 0, sync: 1 };
                        const focus = [0, 1].map(n => ({ id: 'benchmark-focus-' + i + '-' + n, taskId: id, subtaskId: n ? subtaskId : '', endDate: 1767225600000 - (i * 2 + n) * 1800000, interval: 1500, pomodoroInterval: 1500, type: 0, sync: 1 }));
                        input.indexedDB.Task.push(task); input.indexedDB.Subtask.push(subtask); input.indexedDB.Pomodoro.push(...focus);
                        approximate += JSON.stringify(task).length + JSON.stringify(subtask).length + JSON.stringify(focus).length + 4;
                    }
                    input.indexedDB.Project.push({ id: 'benchmark-project', name: 'Synthetic project', type: 1000, state: 0, sync: 1 });
                    let image;
                    if (profile === 'task-history') while (approximate < targetBytes) addGroup();
                    else {
                        for (let i = 0; i < 25; i++) addGroup();
                        // Real, decodable high-entropy PNG approximates already-compressed wallpaper data.
                        const canvas = document.createElement('canvas');
                        const side = Math.max(1, Math.round(Math.sqrt(Math.max(1000, targetBytes - approximate) / 4.57)));
                        canvas.width = canvas.height = side;
                        const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(side, side);
                        for (let i = 0; i < pixels.data.length; i += 4) { const value = random(); pixels.data[i] = value & 255; pixels.data[i + 1] = (value >>> 8) & 255; pixels.data[i + 2] = (value >>> 16) & 255; pixels.data[i + 3] = 255; }
                        ctx.putImageData(pixels, 0, 0);
                        const dataUrl = canvas.toDataURL('image/png');
                        const probe = new Image(); probe.src = dataUrl; await probe.decode();
                        input.localStorage[imageKey] = JSON.stringify({ custom_benchmark: { id: 'custom_benchmark', name: 'Synthetic noisy PNG', dataUrl } });
                        input.localStorage[activeKey] = 'custom_benchmark'; input.localStorage.Theme = 'custom_benchmark';
                        image = { width: side, height: side, dataUrlBytes: dataUrl.length, decodedSuccessfully: true };
                        canvas.width = canvas.height = 1;
                    }
                    const sourceBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
                    function summary(snapshot) {
                        const table = snapshot.indexedDB, taskIds = table.Task.map(row => row.id).sort();
                        return { counts: Object.fromEntries(Object.keys(table).sort().map(name => [name, table[name].length])), firstTask: taskIds[0], lastTask: taskIds.at(-1),
                            focusSeconds: table.Pomodoro.reduce((n, row) => n + row.interval, 0), settings: JSON.stringify(Object.keys(snapshot.localStorage).sort().map(key => [key, snapshot.localStorage[key]])) };
                    }
                    const expected = summary(d.validate(input)), original = summary(baseline);
                    const environment = { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemoryGB: navigator.deviceMemory || null, compressionSupported: codec.compressionSupported() };
                    const stages = {}, heaps = [];
                    let last = performance.now(), maxGap = 0, peakHeap = 0;
                    function sample() {
                        const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now;
                        const used = performance.memory?.usedJSHeapSize || 0; peakHeap = Math.max(peakHeap, used);
                    }
                    function heap(stage) { sample(); heaps.push({ stage, usedJSHeapBytes: performance.memory?.usedJSHeapSize || null, totalJSHeapBytes: performance.memory?.totalJSHeapSize || null }); }
                    const interval = setInterval(sample, 20);
                    async function timed(name, action) {
                        heap(name + ':before'); const start = performance.now();
                        try { return await action(); } finally { stages[name] = Math.round((performance.now() - start) * 10) / 10; heap(name + ':after'); await new Promise(resolve => setTimeout(resolve, 0)); }
                    }
                    let seeded = false, seedError, restored = false, restoreError, encoded, decoded, validated, exported;
                    try {
                        try { await timed('seedRestoreMs', () => d.replace(input, { backup: false })); seeded = true; }
                        catch (error) { seedError = { name: error.name, message: error.message }; }
                        if (seeded) exported = await timed('exportSnapshotMs', () => d.snapshot());
                        else exported = input;
                        encoded = await timed('encodeGzipMs', () => codec.encode(exported, { includeWallpapers: true, format: 'gzip' }));
                        decoded = await timed('decodeGzipMs', () => codec.decode(encoded.bytes));
                        validated = await timed('validateBusinessMs', () => d.validate(decoded.data));
                        try { await timed('restoreMs', () => d.replace(validated, { backup: false })); restored = true; }
                        catch (error) { restoreError = { name: error.name, message: error.message }; }
                        const after = await timed('verifySnapshotMs', () => d.snapshot()), actual = summary(after);
                        const matches = (a, b) => JSON.stringify(a) === JSON.stringify(b);
                        const fidelity = restored ? matches(actual, expected) : matches(actual, seeded ? expected : original);
                        const quotaFailure = !restored && /quota|exceeded|storage/i.test((restoreError?.name || '') + ' ' + (restoreError?.message || ''));
                        const pass = fidelity && (restored || profile === 'image-heavy' && quotaFailure && !seeded);
                        return { profile, targetBytes, sourceBytes, sourceToTargetRatio: sourceBytes / targetBytes, image, environment,
                            counts: expected.counts, totalFocusSeconds: expected.focusSeconds, stages, exportMeasuredFromDatabase: seeded,
                            compressedBytes: encoded.size, encodedRawBytes: encoded.rawBytes, reductionPercent: Math.round((1 - encoded.size / encoded.rawBytes) * 1000) / 10,
                            seeded, seedError, restored, restoreError, fidelityVerified: fidelity, expectedLocalStorageQuotaFailure: quotaFailure,
                            response: { intervalMs: 20, maxIntervalGapMs: Math.round(maxGap * 10) / 10, maxIntervalDelayMs: Math.round(Math.max(0, maxGap - 20) * 10) / 10 },
                            memory: { sampledPeakUsedJSHeapBytes: peakHeap || null, jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || null, observations: heaps }, passed: pass };
                    } finally { clearInterval(interval); }
                }, { profile, targetBytes: mb * 1000000 });
                result.elapsedMs = Date.now() - started;
                report.results.push(result);
                console.log((result.passed ? 'PASS ' : 'FAIL ') + profile + ' ~' + mb + ' MB: ' + result.sourceBytes + ' bytes -> ' + result.compressedBytes + ', restore=' + (result.restored ? 'success' : result.restoreError?.name));
            } catch (error) {
                report.results.push({ profile, targetBytes: mb * 1000000, passed: false, error: error.stack || error.message, elapsedMs: Date.now() - started });
                console.error('FAIL ' + profile + ' ~' + mb + ' MB: ' + error.message);
            } finally { await context.close(); }
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
        }
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
    report.passed = report.results.length === sizes.length * 2 && report.results.every(result => result.passed);
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log('Report: ' + output);
    if (!report.passed) process.exitCode = 1;
})().catch(error => { server.close(); console.error(error); process.exitCode = 1; });
