const fs = require('node:fs');
let s = fs.readFileSync('patch.js', 'utf8');
function between(start, end, replacement) {
    const a = s.indexOf(start), b = s.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('Missing patch boundary: ' + start);
    s = s.slice(0, a) + replacement + s.slice(b);
}
s = s.replace('修改日期：2026/7/9', '修改日期：2026/10/03 · 7.1.1-patch.1');
s = s.replace('Lexible · 2026/7/21', 'Lexible · 2026-10-03');
s = s.replace("'<div style=\"margin-top:4px;color:#666;\">本地学习版，请勿用于商业用途</div>',", `'<div>本地学习版 · 系统 7.1.1 · 修补 patch.1</div>',
                '<details class="lexible-release-notes"><summary>更新内容 · 2026-10-03 · 7.1.1-patch.1</summary>',
                '<ul><li>修复后台恢复漏记番茄，按实际时间分段补记。</li>',
                '<li>保存计时会话；长时间中断后确认是否计入。</li>',
                '<li>防止重复写入，修复暂停、跨日和任务切换计时。</li>',
                '<li>完整备份与原子导入，失败回滚，避免启动误删数据。</li>',
                '<li>修复主题保存失败提示，收紧外部请求范围。</li></ul>',
                '<a href="docs/UPDATE-7.1.1-patch.1.md" target="_blank" rel="noopener">查看详细更新与验收报告（Markdown）</a></details>',`);
between('    function _isWhitelisted(u) {', '    // 拦截 XMLHttpRequest', `    function _isWhitelisted(input) {
        try {
            var url = new URL(input instanceof Request ? input.url : String(input), location.href);
            return url.protocol === 'https:' && _REQUEST_WHITELIST.indexOf(url.hostname) >= 0 && !url.username && !url.password;
        } catch (_) { return false; }
    }

`);
between('        window.fetch = function(url, options) {', '    // ========== 5.', `        window.fetch = function(input, options) {
            var url;
            try { url = new URL(input instanceof Request ? input.url : String(input), location.href); }
            catch (error) { return Promise.reject(error); }
            if (url.origin === location.origin || _isWhitelisted(url.href)) return origFetch.apply(this, arguments);
            return Promise.reject(new TypeError('本地版已阻止外部请求：' + url.hostname));
        };
    }

`);
between('            function _resetToDefaults() {', '            window.jQuery.ajax = function(options)', `            function _resetToDefaults() { return window.FocusLocalData.reset(); }

`);
s = s.replace('var _responseData = { status: 0 };', 'var _responseData = { status: 0 };\n                    var _operation = Promise.resolve();');
s = s.replace('_resetToDefaults();', '_operation = _resetToDefaults();');
between('                    // 阻止远程请求，返回本地处理结果', '                return _origAjax.apply(this, arguments);', `                    var deferred = window.jQuery.Deferred();
                    _operation.then(function() {
                        var response = JSON.stringify(_responseData);
                        if (options.success) options.success(response);
                        deferred.resolve(response);
                    }).catch(function(error) {
                        window.FocusLocal.notice('操作失败，未报告成功：' + error.message);
                        if (options.error) options.error({ statusText: error.message }, 'error', error);
                        deferred.reject(error);
                    });
                    return deferred.promise();
                }
`);
s = s.replace('var DB_VERSION = 2;', 'var DB_VERSION = 3;');
s = s.replace("var STORES = ['Project', 'Task', 'Subtask', 'Pomodoro', 'Schedule', 'Group', 'GroupUser', 'Message'];", 'var STORES = window.FocusLocalData.DATA;');
s = s.replace('var EXPORT_VERSION = 1;', 'var EXPORT_VERSION = 2;');
between('        // ========== 辅助：读取整个 IndexedDB store', '        // ========== 处理文件选择', `        async function exportAllData() {
            try {
                var snapshot = await window.FocusLocalData.snapshot();
                window.FocusLocalData.download(snapshot, 'FocusTodo-backup');
                alert('完整备份已生成，请确认浏览器已保存下载文件。');
            } catch (error) { alert('导出失败：' + error.message); }
        }
        async function importAllData(jsonStr) {
            try {
                var input = JSON.parse(jsonStr);
                window.FocusLocalData.validate(input);
                if (!confirm('导入将覆盖当前任务、专注记录和设置。\\n导入前会生成完整备份；请确认保存下载文件。\\n计时快照不会自动运行。是否继续？')) return;
                await window.FocusLocalData.replace(input);
                alert('数据导入成功，所有数据已提交。页面即将刷新。');
                location.reload();
            } catch (error) { alert('导入失败：' + error.message + '\\n未报告导入成功。'); }
        }

`);
between('    // ========== 8. 禁用评分弹窗', '    // ========== 10. 自定义主题管理器', `    // Use the existing preference gate; no React-internal traversal or polling.
    _origSetItem('HasRated', 'true');
    _origSetItem('ShowRateDialog', 'false');

`);
between('        function _safeSet(k, v) {', '        function _safeRemove(k)', `        function _safeSet(k, v) {
            try { _origSetItem(k, v); }
            catch (error) { throw new Error('保存失败，存储空间可能不足；请删除部分自定义主题后重试。' + error.message); }
        }
`);
between('        function saveCustomThemes(data) {', '        function getActiveId()', `        function saveCustomThemes(data) {
            var json = JSON.stringify(data);
            if (json.length > 2 * 1024 * 1024) throw new Error('自定义主题总量已达到限制，请删除部分图片后重试。');
            _safeSet(STORAGE_KEY, json);
        }

`);
s = s.replace('return { dataUrl: rawDataUrl, thumbnail: thumb };', "throw new Error('图片压缩失败，未保存原始大图。请更换图片。');");
s = s.replace('localStorage.setItem = function(key, value) {', "var _nativeSetItem = Storage.prototype.setItem;\n    var _nativeRemoveItem = Storage.prototype.removeItem;\n    Storage.prototype.setItem = function(key, value) {\n        if (this !== localStorage) return _nativeSetItem.call(this, key, value);\n        key = String(key);");
s = s.replace('localStorage.removeItem = function(key) {', "Storage.prototype.removeItem = function(key) {\n        if (this !== localStorage) return _nativeRemoveItem.call(this, key);\n        key = String(key);");
require('acorn').parse(s, { ecmaVersion: 'latest' });
fs.writeFileSync('patch.js', s);
console.log('Updated data management, network boundary, theme errors and release notes.');
