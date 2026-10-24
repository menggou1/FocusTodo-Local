const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { gzipSync, gunzipSync } = require('node:zlib');
const backup = require('../js/local-backup.js');

function fixture(version = 2) {
    return {
        meta: { app: 'FocusTodo', exportVersion: version, dbVersion: 3, exportDate: '2026-10-24T00:00:00.000Z' },
        indexedDB: {
            Project: [{ id: 'project', name: '项目 📚' }],
            Task: [{ id: 'task', projectId: 'project', title: '完整任务', actualPomodoros: 3 }],
            Subtask: [{ id: 'subtask', taskId: 'task', title: '子任务' }],
            Pomodoro: [{ id: 'focus', taskId: 'task', subtaskId: 'subtask', endDate: 1792800000000, interval: 1500, pomodoroInterval: 1500 }],
            Schedule: [], Group: [], GroupUser: [], Message: [],
            TimerSession: [{ id: 'active', sessionId: 'session', state: 'work', spans: [{ start: 1000, end: 2000 }], cursorAt: 2000 }]
        },
        localStorage: {
            Theme: 'custom_test', 'lexible-active-custom-theme': 'custom_test', WorkInterval: '1500',
            'lexible-custom-themes': JSON.stringify({ custom_test: { name: '壁纸', dataUrl: 'data:image/png;base64,YWJj', thumbnail: 'data:image/jpeg;base64,YQ==' } })
        }
    };
}
function withoutCapabilities() {
    const context = vm.createContext({ module: { exports: {} }, Blob, TextEncoder, TextDecoder, ArrayBuffer, Uint8Array });
    vm.runInContext(fs.readFileSync(require.resolve('../js/local-backup.js'), 'utf8'), context);
    return context.module.exports;
}
test('full compact JSON preserves complete data and unicode without mutating the snapshot', async () => {
    const input = fixture(), before = JSON.stringify(input);
    const encoded = await backup.encode(input, { format: 'json' });
    assert.equal(encoded.format, 'json'); assert.equal(encoded.scope, 'full');
    assert.equal(encoded.rawBytes, Buffer.byteLength(JSON.stringify(encoded.data)));
    assert.equal(encoded.size, encoded.rawBytes);
    const text = Buffer.from(encoded.bytes).toString('utf8');
    assert.equal(text, JSON.stringify(encoded.data)); assert(!text.includes('\n'));
    const decoded = await backup.decode(encoded.bytes);
    assert.deepEqual(decoded.data.indexedDB, input.indexedDB);
    assert.deepEqual(decoded.data.localStorage, input.localStorage);
    assert.equal(JSON.stringify(input), before);
    // The encoding boundary preserves running snapshots; business validation
    // converts them to recovery only when the data service accepts an import.
    assert.equal(decoded.data.indexedDB.TimerSession[0].state, 'work');
});
test('gzip is interoperable and identified from bytes independent of a filename', async () => {
    const encoded = await backup.encode(fixture());
    assert.equal(encoded.format, 'gzip'); assert.equal(encoded.extension, '.json.gz');
    assert.deepEqual(JSON.parse(gunzipSync(encoded.bytes)), encoded.data);
    assert(encoded.size < encoded.rawBytes);
    const gzipInMisnamedFile = new Blob([gzipSync(Buffer.from(JSON.stringify(fixture())))], { type: 'application/json' });
    const decoded = await backup.decode(gzipInMisnamedFile);
    assert.equal(decoded.format, 'gzip'); assert.equal(decoded.scope, 'full');
    const jsonWithGzipMime = new Blob([JSON.stringify(fixture())], { type: 'application/gzip' });
    assert.equal((await backup.decode(jsonWithGzipMime)).format, 'json');
});
test('v1/v2 ordinary JSON remains readable, including UTF-8 BOM', async () => {
    for (const version of [1, 2]) {
        const input = fixture(version);
        const decoded = await backup.decode('\ufeff  ' + JSON.stringify(input));
        assert.equal(decoded.scope, 'full'); assert.deepEqual(decoded.data, input);
    }
});
test('wallpaper omission is explicit, preserves task/history/timer data and uses Leaf', async () => {
    const input = fixture(), before = JSON.stringify(input);
    const encoded = await backup.encode(input, { includeWallpapers: false });
    assert.equal(encoded.scope, 'without-wallpapers');
    assert.equal(encoded.data.localStorage.Theme, 'Leaf');
    assert.equal(encoded.data.localStorage[backup.THEMES_KEY], undefined);
    assert.equal(encoded.data.localStorage[backup.ACTIVE_KEY], undefined);
    assert.deepEqual(encoded.data.indexedDB, input.indexedDB);
    const decoded = await backup.decode(encoded.bytes);
    assert.equal(decoded.scope, 'without-wallpapers');
    assert.equal(backup.analyze(decoded.data).wallpapers.resources, 0);
    assert.match(backup.filename(encoded), /-without-wallpapers-.*\.json\.gz$/);
    assert.equal(JSON.stringify(input), before);
    // A later/default encode is always full, even after an opt-out export.
    const next = await backup.encode(input);
    assert.equal(next.scope, 'full'); assert.equal(next.data.localStorage[backup.THEMES_KEY], input.localStorage[backup.THEMES_KEY]);
});
test('analysis reports record counts and UTF-8 serialized sizes, including original and thumbnail', () => {
    const input = fixture(), analysis = backup.analyze(input);
    assert.equal(analysis.totalBytes, Buffer.byteLength(JSON.stringify(input)));
    assert.equal(analysis.tasks.count, 2); assert.equal(analysis.focus.count, 1);
    assert.equal(analysis.other.count, 2); assert.equal(analysis.counts.Project, 1);
    assert.equal(analysis.tables.Task, Buffer.byteLength(JSON.stringify(input.indexedDB.Task)));
    assert.equal(analysis.wallpapers.count, 1); assert.equal(analysis.wallpapers.resources, 2);
    const theme = JSON.parse(input.localStorage[backup.THEMES_KEY]).custom_test;
    assert.equal(analysis.wallpapers.bytes, Buffer.byteLength(JSON.stringify(theme.dataUrl)) + Buffer.byteLength(JSON.stringify(theme.thumbnail)));
});
test('missing CompressionStream falls back to truthful JSON metadata and extension', async () => {
    const limited = withoutCapabilities();
    assert.equal(limited.compressionSupported(), false);
    const encoded = await limited.encode(fixture());
    assert.equal(encoded.format, 'json'); assert.equal(encoded.fallback, true);
    assert.equal(encoded.mime, 'application/json'); assert.equal(encoded.extension, '.json');
    assert.match(limited.filename(encoded), /-full-.*\.json$/);
    assert.deepEqual(JSON.parse(Buffer.from(encoded.bytes)), JSON.parse(JSON.stringify(encoded.data)));
    assert.equal((await limited.encode(fixture(), { format: 'json' })).fallback, false);
    await assert.rejects(limited.decode(new Uint8Array(gzipSync(JSON.stringify(fixture())))), /不支持 Gzip 解压/);
});
test('corrupt gzip, invalid UTF-8/JSON and unknown schema/scope fail during decoding', async () => {
    const valid = gzipSync(JSON.stringify(fixture()));
    await assert.rejects(backup.decode(valid.subarray(0, valid.length - 8)), /Gzip 解压失败/);
    const corrupt = Buffer.from(valid); corrupt[corrupt.length - 8] ^= 0xff;
    await assert.rejects(backup.decode(corrupt), /Gzip 解压失败/);
    await assert.rejects(backup.decode(new Uint8Array([0xff, 0xfe, 0x7b])), /UTF-8 JSON/);
    for (const input of ['not json', '{}', '[]', 'null']) await assert.rejects(backup.decode(input), /备份|JSON/);
    const unknown = fixture(); unknown.meta.exportVersion = 3;
    await assert.rejects(backup.decode(JSON.stringify(unknown)), /v1\/v2/);
    unknown.meta.exportVersion = 2; unknown.meta.scope = 'custom';
    await assert.rejects(backup.decode(JSON.stringify(unknown)), /范围标记未知/);
});
test('streamed decompression caps expanded bytes and also rejects large plain files', async () => {
    const input = fixture(); input.localStorage.Padding = 'a'.repeat(100000);
    const gzip = gzipSync(JSON.stringify(input)); assert(gzip.length < 2000);
    await assert.rejects(backup.decode(gzip, { maxBytes: 2000 }), /解码后超过/);
    await assert.rejects(backup.decode(JSON.stringify(input), { maxBytes: 2000 }), /超过大小限制/);
    await assert.rejects(backup.decode(new Blob([JSON.stringify(input)]), { maxBytes: 2000 }), /超过大小限制/);
    await assert.rejects(backup.decode('{}', { maxBytes: Infinity }), /无效的备份大小限制/);
    await assert.rejects(backup.decode('{}', { maxBytes: backup.MAX_BYTES + 1 }), /无效的备份大小限制/);
});
test('missing wallpaper resources and inconsistent excluded scope fail before restore', async () => {
    const cases = [];
    const missing = fixture(); delete missing.localStorage[backup.THEMES_KEY]; cases.push(missing);
    const absentImage = fixture(); absentImage.localStorage[backup.THEMES_KEY] = JSON.stringify({ custom_test: { thumbnail: 'data:image/png;base64,YQ==' } }); cases.push(absentImage);
    const blobReference = fixture(); blobReference.localStorage[backup.THEMES_KEY] = JSON.stringify({ custom_test: { dataUrl: 'blob:expired' } }); cases.push(blobReference);
    const wrongActive = fixture(); wrongActive.localStorage[backup.ACTIVE_KEY] = 'custom_missing'; cases.push(wrongActive);
    const wrongTheme = fixture(); wrongTheme.localStorage.Theme = '__bing_daily__'; cases.push(wrongTheme);
    const declaredExcluded = fixture(); declaredExcluded.meta.scope = 'without-wallpapers'; cases.push(declaredExcluded);
    const excludedWithReference = backup.prepare(fixture(), { includeWallpapers: false }); excludedWithReference.localStorage.Theme = 'custom_missing'; cases.push(excludedWithReference);
    for (const input of cases) await assert.rejects(backup.decode(JSON.stringify(input)), /图片|壁纸|主题/);
});
