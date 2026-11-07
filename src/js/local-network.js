/* Local compatibility module extracted from patch.js; initialization stays explicit. */
(function(root){
    "use strict";
    let installed = false;
    root.FocusLocalNetwork = { install(identity) {
        if (installed) return;
        installed = true;
        var _REQUEST_WHITELIST = ['www.bing.com', 'bing.com', 'th.bing.com', 'bing.biturl.top'];
        function _isWhitelisted(input) {
            try {
                var url = new URL(input instanceof Request ? input.url : String(input), location.href);
                return window.FocusSettings && window.FocusSettings.networkEnabled() && url.protocol === 'https:' && _REQUEST_WHITELIST.indexOf(url.hostname) >= 0 && !url.port && !url.username && !url.password;
            } catch (_) { return false; }
        }

        // 拦截 XMLHttpRequest
        var OrigXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            var xhr = new OrigXHR();
            var origOpen = xhr.open;
            var origSetRequestHeader = xhr.setRequestHeader;
            var origAbort = xhr.abort;
            var responseTimer = null, pending = false, async = true;
            var responseKeys = ['readyState', 'status', 'statusText', 'responseText', 'response', 'responseXML', 'responseURL'];
            function clearResponse() { responseKeys.forEach(function(key) { delete xhr[key]; }); }
            function response(status) {
                var text = status ? '{"status":0}' : '', type = xhr.responseType;
                var value = type === 'json' ? (status ? { status: 0 } : null)
                    : type === 'arraybuffer' ? new TextEncoder().encode(text).buffer
                    : type === 'blob' ? new Blob([text], { type: 'application/json' })
                    : type === 'document' ? null : text;
                Object.defineProperties(xhr, {
                    readyState: { value: 4, configurable: true },
                    status: { value: status, configurable: true },
                    statusText: { value: status ? 'OK' : '', configurable: true },
                    responseURL: { value: '', configurable: true },
                    responseXML: { value: null, configurable: true },
                    response: { value: value, configurable: true },
                    responseText: { configurable: true, get: function() {
                        if (type && type !== 'text') throw new DOMException('responseText requires a text responseType', 'InvalidStateError');
                        return text;
                    } }
                });
            }
            function dispatch(names, generation) {
                names.forEach(function(name) {
                    if (xhr._focusRequestGeneration === generation) xhr.dispatchEvent(new Event(name));
                });
            }
            xhr.open = function(method, url) {
                xhr._focusRequestGeneration = (xhr._focusRequestGeneration || 0) + 1;
                clearTimeout(responseTimer); responseTimer = null; pending = false;
                // A reused XHR must not retain the previous synthetic response.
                clearResponse();
                async = arguments[2] !== false;
                xhr._blocked = false;
                xhr._blockedMethod = xhr._blockedUrl = undefined;
                var parsed = new URL(String(url), location.href);
                var isRemote = parsed.origin !== location.origin;
                var isUserApi = parsed.pathname.indexOf('v63/user') >= 0;
                // Remote XHR cannot reject redirects, so external wallpaper
                // traffic uses the controlled fetch path instead.
                if (!isUserApi && !isRemote) {
                    return origOpen.apply(xhr, arguments);
                }
                if (isRemote || isUserApi) {
                    xhr._blocked = true;
                    xhr._blockedMethod = method;
                    xhr._blockedUrl = url;
                    // Keep the placeholder same-origin under CSP. This request
                    // is completed locally and never reaches native send.
                    origOpen.call(xhr, method, location.href);
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
                    if (pending || xhr.readyState !== 1) throw new DOMException('XHR is not open or was already sent', 'InvalidStateError');
                    pending = true;
                    var generation = xhr._focusRequestGeneration;
                    function complete() {
                        if (!pending || xhr._focusRequestGeneration !== generation) return;
                        pending = false; responseTimer = null; response(200);
                        // dispatchEvent reaches both addEventListener and onload
                        // consumers, with native ordering and a real Event value.
                        dispatch(['readystatechange', 'load', 'loadend'], generation);
                    }
                    if (async) responseTimer = setTimeout(complete, 0);
                    else complete();
                    return;
                }
                return origSend.apply(xhr, arguments);
            };
            xhr.abort = function() {
                if (!xhr._blocked) return origAbort.apply(xhr, arguments);
                var wasPending = pending, generation = ++xhr._focusRequestGeneration;
                clearTimeout(responseTimer); responseTimer = null; pending = false;
                clearResponse(); origAbort.call(xhr);
                if (wasPending) {
                    response(0);
                    dispatch(['readystatechange', 'abort', 'loadend'], generation);
                    if (xhr._focusRequestGeneration === generation) clearResponse();
                }
            };
            return xhr;
        };
        window.XMLHttpRequest.prototype = OrigXHR.prototype;
        Object.setPrototypeOf(window.XMLHttpRequest, OrigXHR);

        // 拦截 fetch API
        if (window.fetch) {
            var origFetch = window.fetch;
            window.fetch = function(input, options) {
                var url;
                try { url = new URL(input instanceof Request ? input.url : String(input), location.href); }
                catch (error) { return Promise.reject(error); }
                if (url.origin === location.origin) return origFetch.apply(this, arguments);
                if (_isWhitelisted(url.href)) return origFetch.call(this,input,Object.assign({},options,{redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'}));
                return Promise.reject(new TypeError((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地版已阻止外部请求：'):'本地版已阻止外部请求：') + url.hostname));
            };
        }

    } };
})(window);
