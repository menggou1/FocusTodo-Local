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
            throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('不是受支持的 FocusTodo v1/v2 数据备份。'):'不是受支持的 FocusTodo v1/v2 数据备份。'));
        }
        const scope = input.meta.scope === undefined ? 'full' : input.meta.scope;
        if (!['full', 'without-wallpapers'].includes(scope)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份范围标记未知，请更新程序或使用受支持的备份。'):'备份范围标记未知，请更新程序或使用受支持的备份。'));
        return scope;
    }
    function themesFrom(settings) {
        if (!(THEMES_KEY in settings)) return {};
        let themes;
        try { themes = JSON.parse(settings[THEMES_KEY]); }
        catch (_) { throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份中的自定义主题设置损坏。'):'备份中的自定义主题设置损坏。')); }
        if (!themes || typeof themes !== 'object' || Array.isArray(themes)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份中的自定义主题设置无效。'):'备份中的自定义主题设置无效。'));
        return themes;
    }
    function image(value) {
        return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,[^\s]+/i.test(value);
    }
    function validateScope(input) {
        const scope = header(input), settings = input.localStorage, themes = themesFrom(settings);
        if (scope === 'without-wallpapers') {
            if (Object.keys(themes).length || settings[ACTIVE_KEY] || settings.Theme !== 'Leaf') {
                throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('不含壁纸的备份必须使用默认 Leaf 主题，且不能引用或携带自定义壁纸。'):'不含壁纸的备份必须使用默认 Leaf 主题，且不能引用或携带自定义壁纸。'));
            }
            return scope;
        }
        Object.keys(themes).forEach(id => {
            const theme = themes[id];
            if (!theme || typeof theme !== 'object' || !image(theme.dataUrl) ||
                (theme.thumbnail !== undefined && !image(theme.thumbnail))) {
                throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份中的主题图片缺失或格式不受支持：'):'备份中的主题图片缺失或格式不受支持：') + id);
            }
        });
        const active = settings[ACTIVE_KEY], selected = settings.Theme;
        if (active && !Object.prototype.hasOwnProperty.call(themes, active)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份的激活主题引用了缺失图片。'):'备份的激活主题引用了缺失图片。'));
        if (selected && (selected.indexOf('custom_') === 0 || selected === '__bing_daily__') && !Object.prototype.hasOwnProperty.call(themes, selected)) {
            throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份的 Theme 设置引用了缺失图片。'):'备份的 Theme 设置引用了缺失图片。'));
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
                if (length > limit) { await reader.cancel(); throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份解码后超过 '):'备份解码后超过 ') + Math.floor(limit / 1000000) + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' MB 大小限制。'):' MB 大小限制。')); }
                chunks.push(result.value);
            }
        } finally { reader.releaseLock(); }
        const result = new Uint8Array(length);
        let offset = 0; chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.byteLength; });
        return result;
    }
    async function encode(snapshot, options) {
        options = options || {};
        if (options.format !== undefined && !['json', 'gzip'].includes(options.format)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('不支持的备份编码格式。'):'不支持的备份编码格式。'));
        const data = prepare(snapshot, options), text = JSON.stringify(data), raw = encoder.encode(text);
        if (raw.byteLength > MAX_BYTES) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份超过 128 MB 大小限制，未生成下载文件。'):'备份超过 128 MB 大小限制，未生成下载文件。'));
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
            if (input.length > limit) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份文件超过大小限制。'):'备份文件超过大小限制。'));
            input = encoder.encode(input);
        } else if (input && typeof input.arrayBuffer === 'function') {
            if (input.size > limit) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份文件超过大小限制。'):'备份文件超过大小限制。'));
            input = await input.arrayBuffer();
        }
        let result;
        if (input instanceof ArrayBuffer) result = new Uint8Array(input);
        else if (ArrayBuffer.isView(input)) result = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        else throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('无法读取备份文件。'):'无法读取备份文件。'));
        if (result.byteLength > limit) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份文件超过大小限制。'):'备份文件超过大小限制。'));
        return result;
    }
    async function decode(input, options) {
        const limit = options && options.maxBytes !== undefined ? options.maxBytes : MAX_BYTES;
        if (!Number.isFinite(limit) || limit < 1 || limit > MAX_BYTES) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('无效的备份大小限制。'):'无效的备份大小限制。'));
        let raw = await inputBytes(input, limit), format = 'json';
        if (raw[0] === 0x1f && raw[1] === 0x8b) {
            if (typeof root.DecompressionStream !== 'function') throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('当前浏览器不支持 Gzip 解压，请使用支持的浏览器，或先解压为 JSON 再导入。'):'当前浏览器不支持 Gzip 解压，请使用支持的浏览器，或先解压为 JSON 再导入。'));
            try { raw = await readBounded(new Blob([raw]).stream().pipeThrough(new root.DecompressionStream('gzip')), limit); }
            catch (error) { throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Gzip 解压失败：'):'Gzip 解压失败：') + error.message); }
            format = 'gzip';
        }
        let text, data;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); data = JSON.parse(text); }
        catch (_) { throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份不是有效的 UTF-8 JSON，或文件已损坏。'):'备份不是有效的 UTF-8 JSON，或文件已损坏。')); }
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
    let backupUIInstalled = false;
    function installUI() {
        if (backupUIInstalled) return;
        backupUIInstalled = true;


        'use strict';

        var activeDataDialog = null;
        function backupNode(tag, className, text) {
            var element = document.createElement(tag);
            if (className) element.className = className;
            if (text !== undefined) element.textContent = text;
            return element;
        }
        function dataDialog(title, id) {
            if (activeDataDialog) { activeDataDialog.card.focus(); return null; }
            var opener = document.activeElement;
            var backdrop = backupNode('div', 'focus-app-backdrop'); backdrop.id = id;
            var card = backupNode('section', 'focus-app-dialog focus-backup-dialog'); card.tabIndex = -1;
            card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
            var heading = backupNode('h2', '', title); heading.id = id + '-title';
            card.setAttribute('aria-labelledby', heading.id); card.appendChild(heading);
            var body = backupNode('div', 'focus-app-dialog-body'), actions = backupNode('div', 'focus-app-actions');
            card.append(body, actions); backdrop.appendChild(card); document.body.appendChild(backdrop);
            var dialog = { card: card, body: body, actions: actions, busy: false, close: close };
            function close() {
                if (dialog.busy) return;
                document.removeEventListener('keydown', keydown, true);
                document.removeEventListener('keyup', keyup, true);
                backdrop.remove(); activeDataDialog = null;
                if (opener && opener.isConnected) opener.focus();
            }
            function keyup(event) { if (card.contains(event.target)) event.stopPropagation(); }
            function keydown(event) {
                if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
                if (!card.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); card.focus(); return; }
                event.stopPropagation();
                if (event.key !== 'Tab') return;
                var nodes = Array.from(card.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]'));
                if (!nodes.length) { event.preventDefault(); card.focus(); return; }
                if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === card)) {
                    event.preventDefault(); nodes[nodes.length - 1].focus();
                } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
                    event.preventDefault(); nodes[0].focus();
                }
            }
            document.addEventListener('keydown', keydown, true); document.addEventListener('keyup', keyup, true);
            activeDataDialog = dialog; card.focus(); return dialog;
        }
        function formatBytes(value) {
            return value >= 1000000 ? (value / 1000000).toFixed(2) + ' MB' : (value / 1000).toFixed(1) + ' KB';
        }
        function showAnalysis(element, snapshot) {
            var analysis = window.FocusLocalBackup.analyze(snapshot);
            element.replaceChildren();
            var table = backupNode('table', 'focus-backup-analysis');
            var caption = backupNode('caption', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('紧凑 JSON 体积分析'):'紧凑 JSON 体积分析')); table.appendChild(caption);
            var rows = [
                [(typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('任务及子任务'):'任务及子任务'), analysis.tasks.count + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 条'):' 条'), analysis.tasks.bytes],
                [(typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('专注记录'):'专注记录'), analysis.focus.count + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 条'):' 条'), analysis.focus.bytes],
                [(typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('其他数据'):'其他数据'), analysis.other.count + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 条记录 / '):' 条记录 / ') + analysis.other.settings + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 项设置'):' 项设置'), analysis.other.bytes],
                [(typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('壁纸图片'):'壁纸图片'), analysis.wallpapers.count + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 个主题 / '):' 个主题 / ') + analysis.wallpapers.resources + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 张原图及缩略图'):' 张原图及缩略图'), analysis.wallpapers.bytes]
            ];
            var tbody = backupNode('tbody');
            rows.forEach(function(row) {
                var tr = backupNode('tr'), th = backupNode('th', '', row[0]); th.scope = 'row';
                tr.append(th, backupNode('td', '', row[1]), backupNode('td', '', formatBytes(row[2]))); tbody.appendChild(tr);
            });
            table.appendChild(tbody); element.appendChild(table);
            element.appendChild(backupNode('p', 'focus-app-meta', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('紧凑 JSON 合计 '):'紧凑 JSON 合计 ') + formatBytes(analysis.totalBytes) + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('。分项按字段序列化估算，图片为 data URL 编码体积，含缩略图；不含容器开销，分项不直接相加。'):'。分项按字段序列化估算，图片为 data URL 编码体积，含缩略图；不含容器开销，分项不直接相加。')));
        }
        async function exportAllData() {
            var dialog = dataDialog((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导出数据备份'):'导出数据备份'), 'focus-backup-dialog');
            if (!dialog) return;
            var codec = window.FocusLocalBackup, snapshot;
            var scopeLabel = backupNode('label', 'focus-backup-option');
            var include = backupNode('input'); include.type = 'checkbox'; include.checked = true;
            scopeLabel.append(include, document.createTextNode((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('包含壁纸图片（完整备份，默认）'):'包含壁纸图片（完整备份，默认）')));
            var fieldset = backupNode('fieldset', 'focus-backup-formats'); fieldset.appendChild(backupNode('legend', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('文件格式'):'文件格式')));
            function formatChoice(value, text, checked) {
                var label = backupNode('label', 'focus-backup-option'), input = backupNode('input');
                input.type = 'radio'; input.name = 'focus-backup-format'; input.value = value; input.checked = checked;
                label.append(input, document.createTextNode(text)); fieldset.appendChild(label); return input;
            }
            var supported = codec.compressionSupported();
            var gzip = formatChoice('gzip', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Gzip 压缩（.json.gz，推荐）'):'Gzip 压缩（.json.gz，推荐）'), supported);
            var plain = formatChoice('json', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('普通紧凑 JSON（.json，兼容旧版）'):'普通紧凑 JSON（.json，兼容旧版）'), !supported);
            gzip.disabled = !supported;
            var scopeHint = backupNode('p', 'focus-app-meta');
            var analysis = backupNode('div'); analysis.setAttribute('aria-live', 'polite');
            var status = backupNode('p', 'focus-app-meta', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('正在读取一致数据快照…'):'正在读取一致数据快照…')); status.setAttribute('role', 'status');
            var error = backupNode('p', 'focus-app-error'); error.setAttribute('role', 'alert');
            dialog.body.append(scopeLabel, scopeHint, fieldset,
                backupNode('p', 'focus-app-meta', supported ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('新版可读取旧 JSON；旧版需先解压 .json.gz，或使用普通 JSON。'):'新版可读取旧 JSON；旧版需先解压 .json.gz，或使用普通 JSON。') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('当前浏览器不支持压缩 API，将导出普通 JSON。'):'当前浏览器不支持压缩 API，将导出普通 JSON。')), analysis, status, error);
            var close = backupNode('button', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('关闭'):'关闭')), generate = backupNode('button', 'focus-app-danger', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('生成并下载'):'生成并下载'));
            close.type = generate.type = 'button'; generate.disabled = true; close.onclick = dialog.close;
            dialog.actions.append(close, generate);
            function refreshAnalysis() {
                scopeHint.textContent = include.checked ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('保留全部任务、历史、设置和壁纸。'):'保留全部任务、历史、设置和壁纸。') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('不含壁纸：任务和专注明细保留；导入后使用默认 Leaf 主题。导入前和删除前自动备份始终包含全部壁纸。'):'不含壁纸：任务和专注明细保留；导入后使用默认 Leaf 主题。导入前和删除前自动备份始终包含全部壁纸。');
                if (snapshot) showAnalysis(analysis, codec.prepare(snapshot, { includeWallpapers: include.checked }));
            }
            include.onchange = refreshAnalysis; refreshAnalysis();
            generate.onclick = async function() {
                if (!snapshot || dialog.busy) return;
                dialog.busy = true; generate.disabled = close.disabled = include.disabled = plain.disabled = gzip.disabled = true;
                error.textContent = ''; status.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('正在生成备份…'):'正在生成备份…');
                // Let the busy state paint before serialization/compression begins.
                await new Promise(function(resolve) { setTimeout(resolve, 0); });
                try {
                    var encoded = await codec.encode(snapshot, { includeWallpapers: include.checked, format: plain.checked ? 'json' : 'gzip' });
                    var result = codec.download(encoded);
                    status.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('已发起'):'已发起') + (encoded.format === 'gzip' ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' Gzip 压缩'):' Gzip 压缩') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('普通 JSON'):'普通 JSON')) + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('下载：'):'下载：') + result.name + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('，实际文件 '):'，实际文件 ') + formatBytes(result.size) + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('。请在浏览器下载列表确认文件已保存。'):'。请在浏览器下载列表确认文件已保存。') + (encoded.fallback ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('压缩 API 不可用，已回退为 JSON。'):'压缩 API 不可用，已回退为 JSON。') : '');
                } catch (failure) { status.textContent = ''; error.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导出失败：'):'导出失败：') + failure.message; }
                finally {
                    dialog.busy = false; generate.disabled = close.disabled = include.disabled = plain.disabled = false;
                    gzip.disabled = !supported;
                }
            };
            try {
                await window.FocusLocalReady;
                snapshot = await window.FocusLocalData.snapshot();
                if (!dialog.card.isConnected) return;
                refreshAnalysis(); status.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据快照已准备，可选择范围和格式后生成文件。'):'数据快照已准备，可选择范围和格式后生成文件。'); generate.disabled = false;
            } catch (failure) { if (dialog.card.isConnected) { status.textContent = ''; error.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('读取备份失败：'):'读取备份失败：') + failure.message; } }
        }
        async function handleFileSelect(file) {
            if (!file) return;
            var dialog = dataDialog((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导入数据备份'):'导入数据备份'), 'focus-import-dialog');
            if (!dialog) return;
            var status = backupNode('p', 'focus-app-meta', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('正在识别、解压和校验文件…'):'正在识别、解压和校验文件…')); status.setAttribute('role', 'status');
            var details = backupNode('div'), error = backupNode('p', 'focus-app-error'); error.setAttribute('role', 'alert');
            dialog.body.append(status, details, error);
            var cancel = backupNode('button', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('取消'):'取消')), confirmImport = backupNode('button', 'focus-app-danger', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('确认覆盖并导入'):'确认覆盖并导入'));
            cancel.type = confirmImport.type = 'button'; confirmImport.disabled = true;
            cancel.onclick = dialog.close; dialog.actions.append(cancel, confirmImport);
            try {
                var decoded = await window.FocusLocalBackup.decode(file);
                await window.FocusLocalReady;
                window.FocusLocalData.validate(decoded.data);
                if (!dialog.card.isConnected) return;
                status.textContent = (decoded.format === 'gzip' ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Gzip 压缩文件'):'Gzip 压缩文件') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('JSON 文件'):'JSON 文件')) + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('，解码后 '):'，解码后 ') + formatBytes(decoded.decodedBytes) + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('。范围：'):'。范围：') + (decoded.scope === 'full' ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('完整备份（含壁纸）'):'完整备份（含壁纸）') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('不含壁纸（恢复后使用默认 Leaf 主题）'):'不含壁纸（恢复后使用默认 Leaf 主题）')) + '。';
                showAnalysis(details, decoded.data);
                details.appendChild(backupNode('p', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('将覆盖当前任务、专注记录和设置。导入前会发起完整安全备份下载，请确认下载文件已保存。计时快照不会自动运行。'):'将覆盖当前任务、专注记录和设置。导入前会发起完整安全备份下载，请确认下载文件已保存。计时快照不会自动运行。')));
                confirmImport.disabled = false;
                confirmImport.onclick = async function() {
                    if (dialog.busy) return;
                    dialog.busy = true; cancel.disabled = confirmImport.disabled = true;
                    status.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('正在生成完整安全备份并恢复数据…'):'正在生成完整安全备份并恢复数据…'); error.textContent = '';
                    try {
                        await window.FocusLocalData.replace(decoded.data);
                        status.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据已提交，页面即将刷新。'):'数据已提交，页面即将刷新。'); location.reload();
                    } catch (failure) {
                        dialog.busy = false; cancel.disabled = confirmImport.disabled = false;
                        status.textContent = ''; error.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导入未完成：'):'导入未完成：') + failure.message + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('。未报告导入成功。'):'。未报告导入成功。');
                    }
                };
                cancel.focus();
            } catch (failure) { if (dialog.card.isConnected) { status.textContent = ''; error.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导入失败：'):'导入失败：') + failure.message + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('。当前数据未被覆盖。'):'。当前数据未被覆盖。'); } }
        }

        // ========== 创建隐藏的文件选择器 ==========
        var fileInput = null;
        function getFileInput() {
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json,.gz,.json.gz,application/json,application/gzip';
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files.length > 0) {
                        handleFileSelect(e.target.files[0]);
                        e.target.value = '';
                    }
                });
                document.body.appendChild(fileInput);
            }
            return fileInput;
        }

        // ========== 注入导出/导入按钮到账号设置页面 ==========
        var buttonsMounted = false;

        function findDeleteDataButton(container) {
            // Look for the red button span that has "删除数据" text
            var redButtons = container.querySelectorAll('[class*="redButton"]');
            for (var i = 0; i < redButtons.length; i++) {
                if (redButtons[i].textContent.indexOf((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('删除数据'):'删除数据')) >= 0 ||
                    redButtons[i].textContent.indexOf((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据'):'数据')) >= 0) {
                    return redButtons[i];
                }
            }
            // Fallback: find any span with redButton class
            if (redButtons.length > 0) {
                return redButtons[redButtons.length - 1];
            }
            return null;
        }

        function createExportButton() {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'focus-account-button';
            btn.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导出数据'):'导出数据');
            btn.addEventListener('keydown', function(e) { e.stopPropagation(); });
            btn.addEventListener('keyup', function(e) { e.stopPropagation(); });
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                exportAllData();
            });
            return btn;
        }

        function createImportButton() {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'focus-account-button';
            btn.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('导入数据'):'导入数据');
            btn.addEventListener('keydown', function(e) { e.stopPropagation(); });
            btn.addEventListener('keyup', function(e) { e.stopPropagation(); });
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var input = getFileInput();
                input.click();
            });
            return btn;
        }

        function injectButtons() {
            if (buttonsMounted) {
                // Check if our buttons are still in the DOM
                var existing = document.getElementById('lexible-export-btn');
                if (existing && existing.isConnected) {
                    return;
                }
                buttonsMounted = false;
            }

            // Search for the account settings area
            // Try multiple selectors to find the right container
            var accountSettingsRoot = document.querySelector('[class*="AccountSettings"]');
            if (!accountSettingsRoot) {
                return;
            }

            var deleteBtn = findDeleteDataButton(accountSettingsRoot);
            if (!deleteBtn || !deleteBtn.parentNode) {
                return;
            }

            var exportBtn = createExportButton();
            exportBtn.id = 'lexible-export-btn';

            var importBtn = createImportButton();
            importBtn.id = 'lexible-import-btn';

            // Insert export button before delete, import button after delete
            deleteBtn.parentNode.insertBefore(exportBtn, deleteBtn);
            deleteBtn.parentNode.insertBefore(importBtn, deleteBtn.nextSibling);

            buttonsMounted = true;
            console.log('[Lexible] Export/Import buttons injected into Account Settings');
        }

        // ========== 使用 MutationObserver 监听 DOM 变化 ==========
        function startObserving() {
            if (!document.body) return;

            var observer = new MutationObserver(function() {
                injectButtons();
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Initial attempt
            injectButtons();
        }

        if (document.body) {
            startObserving();
        } else {
            document.addEventListener('DOMContentLoaded', startObserving);
        }

        // Also retry after a delay (account settings may render after initial load)
        setTimeout(injectButtons, 2000);
        setTimeout(injectButtons, 5000);
        setTimeout(injectButtons, 10000);

        console.log('[Lexible] 数据导出/导入模块已加载');
    }

    return { installUI, MAX_BYTES, THEMES_KEY, ACTIVE_KEY, prepare, validateScope, analyze, encode, decode, filename, download, compressionSupported };
});
