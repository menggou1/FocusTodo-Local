// ================================================================
// FocusTodo 完全本地版
// 修改者：Lexible
// 修改日期：2026/7/9
// 说明：已移除所有登录和服务器同步功能，所有数据完全存储于本地浏览器。
//       请勿用于商业用途，仅供个人使用。
// ================================================================
(function() {
    'use strict';

    // ========== 0. 版本声明 Banner ==========
    function injectVersionBanner() {
        var style = document.createElement('style');
        style.textContent = [
            '#lexible-version-banner {',
            '  position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;',
            '  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);',
            '  color: #e0e0e0; text-align: center; padding: 6px 12px;',
            '  font-size: 12px; font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif;',
            '  letter-spacing: 0.5px; border-top: 1px solid rgba(255,255,255,0.1);',
            '  display: flex; justify-content: center; align-items: center; gap: 16px;',
            '  flex-wrap: wrap;',
            '}',
            '#lexible-version-banner .ver-tag {',
            '  background: rgba(255,255,255,0.12); padding: 2px 10px; border-radius: 10px;',
            '  font-weight: bold; color: #64ffda;',
            '}',
            '#lexible-version-banner .ver-author {',
            '  color: #bb86fc; font-weight: bold;',
            '}',
            '#lexible-version-banner .ver-date {',
            '  color: #ffb74d;',
            '}',
            '#lexible-version-banner .ver-desc {',
            '  color: #9e9e9e; font-size: 11px;',
            '}'
        ].join('\n');
        document.head.appendChild(style);

        var banner = document.createElement('div');
        banner.id = 'lexible-version-banner';
        banner.innerHTML = [
            '<span class="ver-tag">🏠 完全本地版</span>',
            '<span>修改者：<span class="ver-author">Lexible</span></span>',
            '<span>日期：<span class="ver-date">2026/7/9</span></span>',
            '<span class="ver-desc">所有数据仅存储在本地浏览器 · 无服务器通信</span>'
        ].join('');
        document.body.appendChild(banner);
    }

    if (document.body) {
        injectVersionBanner();
    } else {
        document.addEventListener('DOMContentLoaded', injectVersionBanner);
    }

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
