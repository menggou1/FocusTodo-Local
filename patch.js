// ================================================================
// FocusTodo 完全本地版
// 修改者：Lexible
// 修改日期：2026/7/9
// 说明：已移除所有登录和服务器同步功能，所有数据完全存储于本地浏览器。
//       请勿用于商业用途，仅供个人使用。
// ================================================================
(function() {
    'use strict';

    // ========== 0. 关于页版本信息（插入到版本行下面） ==========
    (function() {
        var infoRowId = 'lexible-about-info-row';

        function findVersionRow(modalRoot) {
            var rows = modalRoot.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
                if (text.indexOf('版本') >= 0 || text.indexOf('Version') >= 0) {
                    return row;
                }
            }
            return null;
        }

        function findAboutRoot() {
            return document.querySelector('[class*="AboutSettings-root"]') ||
                document.querySelector('[class*="Settings-content"]') ||
                document.querySelector('[class*="Settings-root"]');
        }

        function mountAboutInfo() {
            // 如果行已存在且还在 DOM 中，不做任何操作，避免闪烁
            var existing = document.getElementById(infoRowId);
            if (existing && existing.isConnected) {
                return true;
            }

            var aboutRoot = findAboutRoot();
            if (!aboutRoot) {
                return false;
            }

            var versionRow = findVersionRow(aboutRoot);
            if (!versionRow || !versionRow.parentNode) {
                return false;
            }

            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }

            var infoRow = document.createElement('tr');
            infoRow.id = infoRowId;
            infoRow.innerHTML = [
                '<td class="' + 'setting-title' + '">修改者</td>',
                '<td class="' + 'setting-value' + '" style="line-height:1.6;">',
                'Lexible · 2026/7/9',
                '<div style="margin-top:4px;color:#666;">完全本地版，所有数据仅保存在本地浏览器</div>',
                '</td>'
            ].join('');

            versionRow.parentNode.insertBefore(infoRow, versionRow.nextSibling);
            return true;
        }

        function start() {
            if (!document.body) {
                return;
            }

            // 用 MutationObserver 替换轮询，只在 DOM 变化时尝试插入，不会闪烁
            var observer = new MutationObserver(function() {
                mountAboutInfo();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            mountAboutInfo();
        }

        if (document.body) {
            start();
        } else {
            document.addEventListener('DOMContentLoaded', start);
        }
    })();

    // ========== 1. 设置永久高级版（ExpiredDate=0 表示永不过期）==========

    // ========== 字体统一：body 层面使用思源黑体，子元素自然继承 ==========
    (function() {
        // 注入 CSS：仅设置 body/#root 字体，!important 抵御 JS 内联样式覆盖
        var fontStyle = document.createElement('style');
        fontStyle.id = 'lexible-font-unify';
        fontStyle.textContent = [
            '/* 全局中文字体 - 仅 body 层面，子元素自然继承，DINCond 元素不受影响 */',
            'html, body, #root, #modal-root {',
            '  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif !important;',
            '}'
        ].join('\n');
        document.head.appendChild(fontStyle);

        // MutationObserver：main.js 会动态设置 body.style.fontFamily，
        // 但 !important CSS 优先级高于内联样式，所以这个只是双保险
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    var current = document.body.style.fontFamily;
                    if (current && current.indexOf('"Noto Sans SC"') > 0) {
                        document.body.style.fontFamily = '"Noto Sans SC", ' +
                            current.replace(/"Noto Sans SC",?\s*/g, '');
                    }
                }
            });
        });

        function startObserve() {
            if (document.body) {
                observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
            }
        }

        if (document.body) {
            startObserve();
        } else {
            document.addEventListener('DOMContentLoaded', startObserve);
        }
    })();
    localStorage.setItem('ExpiredDate', '0');

    // ========== 2. 设置本地用户登录凭证 ==========
    // 注意：应用使用 Base64.decode() 读取 ACCT 和 NAME
    // 所以需要存入 Base64 编码后的值
    var localAccount = 'local@local';
    var localName = '\u672c\u5730\u7528\u6237'; // "本地用户"

    // UTF-8 Base64 编码辅助函数
    function utf8Base64Encode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function(match, p1) { return String.fromCharCode('0x' + p1); }
        ));
    }

    var localCookies = {
        'cookie.ACCT': utf8Base64Encode(localAccount),
        'cookie.NAME': utf8Base64Encode(localName),
        'cookie.PID': 'local-' + Math.random().toString(36).substr(2, 9),
        'cookie.UID': 'local-' + Math.random().toString(36).substr(2, 9),
        'cookie.JSESSIONID': Math.random().toString(36).substr(2, 16)
    };

    // 仅在 cookie 不存在时设置，避免覆盖已有数据
    for (var ck in localCookies) {
        if (localCookies.hasOwnProperty(ck) && !localStorage.getItem(ck)) {
            localStorage.setItem(ck, localCookies[ck]);
        }
    }

    // ========== 3. 保护关键数据不被清除 ==========
    var _origSetItem = localStorage.setItem.bind(localStorage);
    var _origRemoveItem = localStorage.removeItem.bind(localStorage);
    var protectedKeys = ['ExpiredDate'].concat(Object.keys(localCookies));

    localStorage.setItem = function(key, value) {
        // 阻止将 ExpiredDate 设为空
        if (key === 'ExpiredDate' && (value === null || value === '' || value === undefined)) {
            return;
        }
        // 阻止清空登录 cookies
        if (key.indexOf('cookie.') === 0 && (value === null || value === '' || value === undefined)) {
            return;
        }
        _origSetItem(key, value);
    };

    localStorage.removeItem = function(key) {
        // 阻止删除 ExpiredDate
        if (key === 'ExpiredDate') return;
        // 阻止删除登录 cookies
        if (key.indexOf('cookie.') === 0) return;
        _origRemoveItem(key);
    };

    // 定期确保关键数据存在
    setInterval(function() {
        if (localStorage.getItem('ExpiredDate') !== '0') {
            _origSetItem('ExpiredDate', '0');
        }
        for (var ck in localCookies) {
            if (localCookies.hasOwnProperty(ck) && !localStorage.getItem(ck)) {
                _origSetItem(ck, localCookies[ck]);
            }
        }
    }, 1000);

    // ========== 4. 完全阻断所有网络请求（确保纯本地运行）==========
    // 拦截 XMLHttpRequest
    var OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        var xhr = new OrigXHR();
        var origOpen = xhr.open;
        xhr.open = function(method, url) {
            // 仅允许加载本地资源（相对路径）
            if (url && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0)) {
                // 阻止所有远程请求，静默返回成功
                var blockedUrl = url;
                xhr._blocked = true;
                // 不调用原始 open，避免实际网络请求
                return;
            }
            return origOpen.apply(xhr, arguments);
        };
        var origSend = xhr.send;
        xhr.send = function(data) {
            if (xhr._blocked) {
                // 模拟异步成功响应
                setTimeout(function() {
                    Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
                    Object.defineProperty(xhr, 'status', { value: 200, writable: true });
                    Object.defineProperty(xhr, 'responseText', { value: '{"status":0}', writable: true });
                    if (xhr.onload) xhr.onload();
                    if (xhr.onreadystatechange) xhr.onreadystatechange();
                }, 0);
                return;
            }
            return origSend.apply(xhr, arguments);
        };
        return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;

    // 拦截 fetch API
    if (window.fetch) {
        var origFetch = window.fetch;
        window.fetch = function(url, options) {
            if (typeof url === 'string' && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0)) {
                // 阻止远程 fetch，返回模拟成功响应
                return Promise.resolve(new Response('{"status":0}', {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            return origFetch.apply(this, arguments);
        };
    }

    // ========== 5. 拦截 jQuery.ajax（应用使用 jQuery 发送请求）==========
    // 在 jQuery 加载后进行拦截
    var _checkJQuery = setInterval(function() {
        if (window.jQuery && window.jQuery.ajax) {
            clearInterval(_checkJQuery);
            var _origAjax = window.jQuery.ajax;
            window.jQuery.ajax = function(options) {
                var url = typeof options === 'string' ? options : (options && options.url);
                if (url && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0)) {
                    // 阻止远程请求
                    var success = (typeof options === 'object') ? (options.success || options.done) : null;
                    if (success) {
                        setTimeout(function() {
                            success('{"status":0}');
                        }, 0);
                    }
                    // 返回一个 mock jqXHR
                    return {
                        done: function(cb) { setTimeout(function() { cb('{"status":0}'); }, 0); return this; },
                        fail: function() { return this; },
                        always: function(cb) { setTimeout(cb, 0); return this; }
                    };
                }
                return _origAjax.apply(this, arguments);
            };
        }
    }, 100);
    // 最多检查 50 次（5 秒）
    setTimeout(function() { clearInterval(_checkJQuery); }, 5000);

    console.log('[Lexible] FocusTodo 完全本地版已激活 (2026/7/9)');
    console.log('[Lexible] 所有网络请求已阻断，数据仅存储在本地浏览器。');
})();
