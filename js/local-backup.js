/* Compact, bounded backup encoding. Business validation remains in local-data. */
(function (root, factory) {
    'use strict';
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FocusLocalBackup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const MAX_BYTES = 128 * 1000 * 1000;
    const THEMES_KEY = 'lexible-custom-themes', ACTIVE_KEY = 'lexible-active-custom-theme';
    const encoder = new TextEncoder();
    const bytes = text => encoder.encode(text).byteLength;
    const jsonBytes = value => bytes(JSON.stringify(value));
    const clone = value => JSON.parse(JSON.stringify(value));

    function header(input) {
        if (!input || typeof input !== 'object' || !input.meta || input.meta.app !== 'FocusTodo' ||
            ![1, 2].includes(input.meta.exportVersion) || !input.indexedDB || typeof input.indexedDB !== 'object' || Array.isArray(input.indexedDB) ||
            !input.localStorage || typeof input.localStorage !== 'object' || Array.isArray(input.localStorage)) {
            throw new Error('不是受支持的 FocusTodo v1/v2 数据备份。');
        }
        const scope = input.meta.scope === undefined ? 'full' : input.meta.scope;
        if (!['full', 'without-wallpapers'].includes(scope)) throw new Error('备份范围标记未知，请更新程序或使用受支持的备份。');
        return scope;
    }
    function themesFrom(settings) {
        if (!(THEMES_KEY in settings)) return {};
        let themes;
        try { themes = JSON.parse(settings[THEMES_KEY]); }
        catch (_) { throw new Error('备份中的自定义主题设置损坏。'); }
        if (!themes || typeof themes !== 'object' || Array.isArray(themes)) throw new Error('备份中的自定义主题设置无效。');
        return themes;
    }
    function image(value) {
        return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,[^\s]+/i.test(value);
    }
    function validateScope(input) {
        const scope = header(input), settings = input.localStorage, themes = themesFrom(settings);
        if (scope === 'without-wallpapers') {
            if (Object.keys(themes).length || settings[ACTIVE_KEY] || settings.Theme !== 'Leaf') {
                throw new Error('不含壁纸的备份必须使用默认 Leaf 主题，且不能引用或携带自定义壁纸。');
            }
            return scope;
        }
        Object.keys(themes).forEach(id => {
            const theme = themes[id];
            if (!theme || typeof theme !== 'object' || !image(theme.dataUrl) ||
                (theme.thumbnail !== undefined && !image(theme.thumbnail))) {
                throw new Error('备份中的主题图片缺失或格式不受支持：' + id);
            }
        });
        const active = settings[ACTIVE_KEY], selected = settings.Theme;
        if (active && !Object.prototype.hasOwnProperty.call(themes, active)) throw new Error('备份的激活主题引用了缺失图片。');
        if (selected && (selected.indexOf('custom_') === 0 || selected === '__bing_daily__') && !Object.prototype.hasOwnProperty.call(themes, selected)) {
            throw new Error('备份的 Theme 设置引用了缺失图片。');
        }
        return scope;
    }
    function prepare(snapshot, options) {
        header(snapshot);
        const data = clone(snapshot);
        data.meta.scope = options && options.includeWallpapers === false ? 'without-wallpapers' : 'full';
        if (data.meta.scope === 'without-wallpapers') {
            delete data.localStorage[THEMES_KEY];
            delete data.localStorage[ACTIVE_KEY];
            data.localStorage.Theme = 'Leaf';
        }
        validateScope(data);
        return data;
    }
    function analyze(input) {
        header(input);
        const tables = {}, counts = {}, settings = input.localStorage, themes = themesFrom(settings);
        Object.keys(input.indexedDB).forEach(name => {
            tables[name] = jsonBytes(input.indexedDB[name]);
            counts[name] = Array.isArray(input.indexedDB[name]) ? input.indexedDB[name].length : 0;
        });
        let imageBytes = 0, imageCount = 0;
        Object.values(themes).forEach(theme => {
            if (!theme || typeof theme !== 'object') return;
            ['dataUrl', 'thumbnail'].forEach(key => {
                if (typeof theme[key] === 'string') { imageBytes += jsonBytes(theme[key]); imageCount++; }
            });
        });
        const otherDB = {}, otherSettings = { ...settings };
        Object.keys(input.indexedDB).forEach(name => { if (!['Task', 'Subtask', 'Pomodoro'].includes(name)) otherDB[name] = input.indexedDB[name]; });
        delete otherSettings[THEMES_KEY];
        return {
            totalBytes: jsonBytes(input), tables, counts,
            tasks: { count: (counts.Task || 0) + (counts.Subtask || 0), bytes: (tables.Task || 0) + (tables.Subtask || 0) },
            focus: { count: counts.Pomodoro || 0, bytes: tables.Pomodoro || 0 },
            other: { count: Object.keys(otherDB).reduce((sum, name) => sum + counts[name], 0), settings: Object.keys(otherSettings).length,
                bytes: jsonBytes({ meta: input.meta, indexedDB: otherDB, localStorage: otherSettings }) },
            wallpapers: { count: Object.keys(themes).length, resources: imageCount, bytes: imageBytes,
                settingsBytes: THEMES_KEY in settings ? jsonBytes(settings[THEMES_KEY]) : 0 }
        };
    }
    function compressionSupported() { return typeof root.CompressionStream === 'function'; }
    async function readBounded(stream, limit) {
        const reader = stream.getReader(), chunks = [];
        let length = 0;
        try {
            while (true) {
                const result = await reader.read();
                if (result.done) break;
                length += result.value.byteLength;
                if (length > limit) { await reader.cancel(); throw new Error('备份解码后超过 ' + Math.floor(limit / 1000000) + ' MB 大小限制。'); }
                chunks.push(result.value);
            }
        } finally { reader.releaseLock(); }
        const result = new Uint8Array(length);
        let offset = 0; chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.byteLength; });
        return result;
    }
    async function encode(snapshot, options) {
        options = options || {};
        if (options.format !== undefined && !['json', 'gzip'].includes(options.format)) throw new Error('不支持的备份编码格式。');
        const data = prepare(snapshot, options), text = JSON.stringify(data), raw = encoder.encode(text);
        if (raw.byteLength > MAX_BYTES) throw new Error('备份超过 128 MB 大小限制，未生成下载文件。');
        let output = raw, format = 'json', fallback = false;
        if (options.format !== 'json') {
            if (compressionSupported()) {
                output = await readBounded(new Blob([raw]).stream().pipeThrough(new root.CompressionStream('gzip')), MAX_BYTES);
                format = 'gzip';
            } else fallback = true;
        }
        return { data, bytes: output, rawBytes: raw.byteLength, size: output.byteLength, format, fallback,
            extension: format === 'gzip' ? '.json.gz' : '.json', scope: data.meta.scope,
            mime: format === 'gzip' ? 'application/gzip' : 'application/json' };
    }
    async function inputBytes(input, limit) {
        if (typeof input === 'string') {
            // A character precheck avoids allocating bytes for grossly oversized strings.
            if (input.length > limit) throw new Error('备份文件超过大小限制。');
            input = encoder.encode(input);
        } else if (input && typeof input.arrayBuffer === 'function') {
            if (input.size > limit) throw new Error('备份文件超过大小限制。');
            input = await input.arrayBuffer();
        }
        let result;
        if (input instanceof ArrayBuffer) result = new Uint8Array(input);
        else if (ArrayBuffer.isView(input)) result = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        else throw new Error('无法读取备份文件。');
        if (result.byteLength > limit) throw new Error('备份文件超过大小限制。');
        return result;
    }
    async function decode(input, options) {
        const limit = options && options.maxBytes !== undefined ? options.maxBytes : MAX_BYTES;
        if (!Number.isFinite(limit) || limit < 1 || limit > MAX_BYTES) throw new Error('无效的备份大小限制。');
        let raw = await inputBytes(input, limit), format = 'json';
        if (raw[0] === 0x1f && raw[1] === 0x8b) {
            if (typeof root.DecompressionStream !== 'function') throw new Error('当前浏览器不支持 Gzip 解压，请使用支持的浏览器，或先解压为 JSON 再导入。');
            try { raw = await readBounded(new Blob([raw]).stream().pipeThrough(new root.DecompressionStream('gzip')), limit); }
            catch (error) { throw new Error('Gzip 解压失败：' + error.message); }
            format = 'gzip';
        }
        let text, data;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); data = JSON.parse(text); }
        catch (_) { throw new Error('备份不是有效的 UTF-8 JSON，或文件已损坏。'); }
        const scope = validateScope(data);
        return { data, format, scope, decodedBytes: raw.byteLength };
    }
    function filename(encoded, prefix, now) {
        return (prefix || 'FocusTodo-backup') + (encoded.scope === 'without-wallpapers' ? '-without-wallpapers' : '-full') +
            '-' + (now || new Date()).toISOString().replace(/[:.]/g, '-') + encoded.extension;
    }
    function download(encoded, prefix) {
        const blob = new Blob([encoded.bytes], { type: encoded.mime }), url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename(encoded, prefix);
        a.addEventListener('click', event => event.stopPropagation());
        document.body.appendChild(a);
        try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
        return { name: a.download, size: blob.size };
    }
    return { MAX_BYTES, THEMES_KEY, ACTIVE_KEY, prepare, validateScope, analyze, encode, decode, filename, download, compressionSupported };
});
