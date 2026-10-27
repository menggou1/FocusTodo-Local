/* Local compatibility module extracted from patch.js; initialization stays explicit. */
(function(root){
    "use strict";
    let installed = false;
    root.FocusLocalNetwork = { install(identity) {
        if (installed) return;
        installed = true;
        var _origSetItem = identity.set, utf8Base64Encode = identity.encode;
        var _REQUEST_WHITELIST = ['www.bing.com', 'bing.com', 'bing.biturl.top'];
        function _isWhitelisted(input) {
            try {
                var url = new URL(input instanceof Request ? input.url : String(input), location.href);
                return url.protocol === 'https:' && _REQUEST_WHITELIST.indexOf(url.hostname) >= 0 && !url.username && !url.password;
            } catch (_) { return false; }
        }

        // 拦截 XMLHttpRequest
        var OrigXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            var xhr = new OrigXHR();
            var origOpen = xhr.open;
            var origSetRequestHeader = xhr.setRequestHeader;
            xhr.open = function(method, url) {
                xhr._focusRequestGeneration = (xhr._focusRequestGeneration || 0) + 1;
                // A reused XHR must not retain the previous request's blocked state.
                if (xhr._blocked) {
                    delete xhr.readyState; delete xhr.status; delete xhr.responseText;
                }
                xhr._blocked = false;
                xhr._blockedMethod = xhr._blockedUrl = undefined;
                var parsed = new URL(String(url), location.href);
                var isRemote = parsed.origin !== location.origin;
                var isUserApi = parsed.pathname.indexOf('v63/user') >= 0;
                // The legacy user API remains local; ordinary same-origin assets and Bing pass through.
                if (!isUserApi && (!isRemote || _isWhitelisted(parsed.href))) {
                    return origOpen.apply(xhr, arguments);
                }
                if (isRemote || isUserApi) {
                    xhr._blocked = true;
                    xhr._blockedMethod = method;
                    xhr._blockedUrl = url;
                    origOpen.call(xhr, method, 'data:text/plain,');
                    return;
                }
                return origOpen.apply(xhr, arguments);
            };
            // 静默处理 setRequestHeader —— blocked 状态下不抛异常
            xhr.setRequestHeader = function(header, value) {
                if (xhr._blocked) {
                    return;
                }
                return origSetRequestHeader.apply(xhr, arguments);
            };
            var origSend = xhr.send;
            xhr.send = function(data) {
                if (xhr._blocked) {
                    // 构建响应数据
                    var _xhrResponse = { status: 0 };

                    // 检查是否是修改用户名的请求
                    if (xhr._blockedUrl && xhr._blockedUrl.indexOf('v63/user') >= 0 && data) {
                        try {
                            var _xhrDataStr = typeof data === 'string' ? data : '';
                            // 解析 form data 中的 username 参数
                            var _pairs = _xhrDataStr.split('&');
                            for (var _pi = 0; _pi < _pairs.length; _pi++) {
                                var _kv = _pairs[_pi].split('=');
                                if (_kv[0] === 'username' && _kv[1]) {
                                    var _rawName = decodeURIComponent(_kv[1].replace(/\+/g, ' '));
                                    if (_rawName) {

                                        var _encodeFn = (window.Base64 && window.Base64.encode)
                                            ? function(s) { return window.Base64.encode(s); }
                                            : utf8Base64Encode;
                                        var _encoded = _encodeFn(_rawName);
                                        // 写入 localStorage
                                        try { _origSetItem('cookie.NAME', _encoded); } catch (e) {}
                                        _xhrResponse.name = _encoded;

                                    }
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[Lexible XHR] Error parsing username:', e);
                        }
                    }

                    var _xhrRespStr = JSON.stringify(_xhrResponse);
                    var generation = xhr._focusRequestGeneration;
                    setTimeout(function() {
                        if (xhr._focusRequestGeneration !== generation) return;
                        Object.defineProperty(xhr, 'readyState', { value: 4, writable: true, configurable: true });
                        Object.defineProperty(xhr, 'status', { value: 200, writable: true, configurable: true });
                        Object.defineProperty(xhr, 'responseText', { value: _xhrRespStr, writable: true, configurable: true });
                        if (xhr.onload) xhr.onload();
                        if (xhr._focusRequestGeneration === generation && xhr.onreadystatechange) xhr.onreadystatechange();
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
            window.fetch = function(input, options) {
                var url;
                try { url = new URL(input instanceof Request ? input.url : String(input), location.href); }
                catch (error) { return Promise.reject(error); }
                if (url.origin === location.origin || _isWhitelisted(url.href)) return origFetch.apply(this, arguments);
                return Promise.reject(new TypeError((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地版已阻止外部请求：'):'本地版已阻止外部请求：') + url.hostname));
            };
        }

    } };
})(window);
