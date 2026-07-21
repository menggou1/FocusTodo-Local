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
                'Lexible · 2026/7/21',
                '<div style="margin-top:4px;color:#666;">本地学习版，请勿用于商业用途</div>',
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

    // 定期确保关键数据存在且有效
    setInterval(function() {
        if (localStorage.getItem('ExpiredDate') !== '0') {
            _origSetItem('ExpiredDate', '0');
        }
        // 检查 cookies 是否存在
        for (var ck in localCookies) {
            if (localCookies.hasOwnProperty(ck) && !localStorage.getItem(ck)) {
                _origSetItem(ck, localCookies[ck]);
            }
        }
        // 修复乱码：验证 NAME 和 ACCT 能否正确解码，不能则恢复默认
        try {
            var nameVal = localStorage.getItem('cookie.NAME');
            if (nameVal) {
                var decoded = decodeURIComponent(atob(nameVal).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                // 解码后应该是可读的中文/英文，如果全是乱码字符则修复
                if (!decoded || decoded.length === 0 || /^[\x00-\x1f\x7f-\x9f]+$/.test(decoded)) {
                    _origSetItem('cookie.NAME', utf8Base64Encode(localName));
                }
            }
        } catch (e) {
            // atob 失败（非 Base64）→ 修复
            _origSetItem('cookie.NAME', utf8Base64Encode(localName));
        }
        try {
            var acctVal = localStorage.getItem('cookie.ACCT');
            if (acctVal) {
                var acctDecoded = decodeURIComponent(atob(acctVal).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                if (!acctDecoded || acctDecoded.length === 0 || acctDecoded.indexOf('@') < 0) {
                    _origSetItem('cookie.ACCT', utf8Base64Encode(localAccount));
                }
            }
        } catch (e) {
            _origSetItem('cookie.ACCT', utf8Base64Encode(localAccount));
        }
    }, 1000);

    // ========== 4. 完全阻断所有网络请求（确保纯本地运行）==========
    // 域名白名单：白名单内的域名不受拦截（用于获取Bing壁纸等外部资源）
    var _REQUEST_WHITELIST = ['www.bing.com', 'bing.com', 'bing.biturl.top'];
    function _isWhitelisted(u) {
        if (!u) return false;
        for (var _wl = 0; _wl < _REQUEST_WHITELIST.length; _wl++) {
            if (u.indexOf(_REQUEST_WHITELIST[_wl]) >= 0) return true;
        }
        return false;
    }

    // 拦截 XMLHttpRequest
    var OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        var xhr = new OrigXHR();
        var origOpen = xhr.open;
        var origSetRequestHeader = xhr.setRequestHeader;
        xhr.open = function(method, url) {
            // 拦截所有远程 URL 以及包含 v63/user 的相对路径
            var isRemote = url && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0);
            var isUserApi = url && url.indexOf('v63/user') >= 0;
            // 白名单放行：Bing API / 图片请求不受拦截
            if (isRemote && _isWhitelisted(url)) {
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
                                    console.log('[Lexible XHR] Username change:', _rawName);
                                    var _encodeFn = (window.Base64 && window.Base64.encode)
                                        ? function(s) { return window.Base64.encode(s); }
                                        : utf8Base64Encode;
                                    var _encoded = _encodeFn(_rawName);
                                    // 写入 localStorage
                                    try { _origSetItem('cookie.NAME', _encoded); } catch (e) {}
                                    _xhrResponse.name = _encoded;
                                    console.log('[Lexible XHR] Saved to cookie.NAME');
                                }
                                break;
                            }
                        }
                    } catch (e) {
                        console.warn('[Lexible XHR] Error parsing username:', e);
                    }
                }

                var _xhrRespStr = JSON.stringify(_xhrResponse);
                setTimeout(function() {
                    Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
                    Object.defineProperty(xhr, 'status', { value: 200, writable: true });
                    Object.defineProperty(xhr, 'responseText', { value: _xhrRespStr, writable: true });
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
                // 白名单放行：Bing API / 图片请求不受拦截
                if (_isWhitelisted(url)) {
                    return origFetch.apply(this, arguments);
                }
                // 阻止远程 fetch，返回模拟成功响应
                return Promise.resolve(new Response('{"status":0}', {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            return origFetch.apply(this, arguments);
        };
    }

    // ========== 5. 拦截 jQuery.ajax + 删除数据用户名校验 + 重置为默认状态 ==========
    var _checkJQuery = setInterval(function() {
        if (window.jQuery && window.jQuery.ajax) {
            clearInterval(_checkJQuery);
            var _origAjax = window.jQuery.ajax;

            // ===== 彻底重置为默认状态 =====
            // 策略：先保存 app 初始化必需的 key，清空全部，再写入默认值并恢复必需 key
            function _resetToDefaults() {
                console.log('[Lexible] Full reset to defaults...');

                // 1. 保存 app 初始化必需的关键 key（缺了会白屏）
                var _criticalKeys = [
                    'ServerAccessInfo', 'ServerUrls', 'Version', 'app_language',
                    'PK1', 'OverseaServerUrl', 'RegionCode', 'LstRlsVer',
                    'UpdAltCnt', 'UpdAltDate'
                ];
                var _saved = {};
                for (var ci = 0; ci < _criticalKeys.length; ci++) {
                    var v = localStorage.getItem(_criticalKeys[ci]);
                    if (v !== null && v !== undefined) {
                        _saved[_criticalKeys[ci]] = v;
                    }
                }

                // 2. 清空所有 localStorage（绕过 Section 3 保护）
                var _allKeys = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k) _allKeys.push(k);
                }
                for (var ri = 0; ri < _allKeys.length; ri++) {
                    try { _origRemoveItem(_allKeys[ri]); } catch (e) {}
                }
                console.log('[Lexible] Cleared ' + _allKeys.length + ' localStorage keys');

                // 3. 写入默认身份数据
                var _defaults = {
                    'cookie.ACCT': utf8Base64Encode('local@local'),
                    'cookie.NAME': utf8Base64Encode('本地用户'),
                    'cookie.PID': 'local-' + Math.random().toString(36).substr(2, 9),
                    'cookie.UID': 'local-' + Math.random().toString(36).substr(2, 9),
                    'cookie.JSESSIONID': Math.random().toString(36).substr(2, 16),
                    'ExpiredDate': '0',
                    'Portrait': 'img/header-portrait.png'
                };
                for (var dk in _defaults) {
                    if (_defaults.hasOwnProperty(dk)) {
                        try { _origSetItem(dk, _defaults[dk]); } catch (e) {}
                    }
                }

                // 4. 恢复 app 初始化必需的 key
                for (var sk in _saved) {
                    if (_saved.hasOwnProperty(sk)) {
                        try { _origSetItem(sk, _saved[sk]); } catch (e) {}
                    }
                }

                // 5. 清除 IndexedDB 所有数据
                try {
                    var _openReq = window.indexedDB.open('PomodoroDB6', 2);
                    _openReq.onsuccess = function() {
                        var _db = _openReq.result;
                        var _stores = [];
                        try {
                            for (var _s = 0; _s < _db.objectStoreNames.length; _s++) {
                                _stores.push(_db.objectStoreNames[_s]);
                            }
                        } catch (e) {
                            _stores = ['Project', 'Task', 'Subtask', 'Pomodoro', 'Schedule', 'Group', 'GroupUser', 'Message'];
                        }
                        if (_stores.length > 0) {
                            var _tx = _db.transaction(_stores, 'readwrite');
                            _stores.forEach(function(name) {
                                try { _tx.objectStore(name).clear(); } catch (e) {}
                            });
                            _tx.oncomplete = function() {
                                _db.close();
                                console.log('[Lexible] IndexedDB all stores cleared');
                            };
                            _tx.onerror = function() {
                                _db.close();
                                console.log('[Lexible] IndexedDB clear tx error');
                            };
                        } else {
                            _db.close();
                        }
                    };
                    _openReq.onerror = function() {
                        console.log('[Lexible] IndexedDB open failed during reset');
                    };
                } catch (e) {
                    console.log('[Lexible] IndexedDB clear error:', e.message);
                }

                console.log('[Lexible] Reset complete. Defaults: ' + Object.keys(_defaults).length + ' keys. Critical: ' + Object.keys(_saved).length + ' keys preserved.');
            }

            window.jQuery.ajax = function(options) {
                var url = typeof options === 'string' ? options : (options && options.url);

                // 匹配所有需要拦截的 URL：
                // - http:// 或 https:// 开头的远程 URL
                // - 包含 v63/user 的调用（可能是相对路径，如 serverUrl 为空时）
                var isRemote = url && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0);
                var isUserEndpoint = url && url.indexOf('v63/user') >= 0;

                if (isRemote || isUserEndpoint) {
                    console.log('[Lexible] Intercepted AJAX:', url);

                    // 构建响应数据（默认成功）
                    var _responseData = { status: 0 };

                    // === 处理 v63/user 端点的各种操作 ===
                    if (isUserEndpoint) {
                        var data = (typeof options === 'object') ? options.data : null;
                        if (data) {
                            var isReset = false;
                            var isCancellation = false;
                            var newUsername = null;

                            if (typeof data === 'string') {
                                var pairs = data.split('&');
                                for (var pi = 0; pi < pairs.length; pi++) {
                                    var kv = pairs[pi].split('=');
                                    if (kv[0] === 'reset') isReset = true;
                                    if (kv[0] === 'cancellation') isCancellation = true;
                                    if (kv[0] === 'username') newUsername = decodeURIComponent(kv[1] || '');
                                }
                            } else if (typeof data === 'object' && data !== null) {
                                isReset = 'reset' in data;
                                isCancellation = 'cancellation' in data;
                                if ('username' in data && data.username) {
                                    newUsername = data.username;
                                }
                            }

                            // === 修改用户名：保存到本地 ===
                            if (newUsername !== null && newUsername.length > 0) {
                                console.log('[Lexible] Username change detected:', newUsername);
                                // 优先使用应用内置的 Base64 编码（完美兼容），回退到 utf8Base64Encode
                                var encodeFn = (window.Base64 && window.Base64.encode)
                                    ? function(s) { return window.Base64.encode(s); }
                                    : utf8Base64Encode;
                                var encodedName = encodeFn(newUsername);
                                // 1) 直接写入 localStorage（绕过 Section 3 保护）
                                try { _origSetItem('cookie.NAME', encodedName); } catch (e) {}
                                // 2) 同时放入响应，让 setCookie 也写一次（同一个值，幂等）
                                _responseData.name = encodedName;
                                console.log('[Lexible] Username saved. Encoded:', encodedName);
                            }

                            // === 删除数据/注销账号：直接重置 ===
                            if (isReset || isCancellation) {
                                console.log('[Lexible] Delete/cancel detected. Resetting to defaults...');
                                _resetToDefaults();
                            }
                        }
                    }

                    // 阻止远程请求，返回本地处理结果
                    var _responseStr = JSON.stringify(_responseData);
                    var success = (typeof options === 'object') ? (options.success || options.done) : null;
                    if (success) {
                        setTimeout(function() {
                            success(_responseStr);
                        }, 0);
                    }
                    return {
                        done: function(cb) { setTimeout(function() { cb(_responseStr); }, 0); return this; },
                        fail: function() { return this; },
                        always: function(cb) { setTimeout(cb, 0); return this; }
                    };
                }
                return _origAjax.apply(this, arguments);
            };
            console.log('[Lexible] jQuery.ajax interception + delete-to-defaults installed');
        }
    }, 50); // 加快检查频率
    setTimeout(function() { clearInterval(_checkJQuery); }, 5000);

    console.log('[Lexible] FocusTodo 完全本地版已激活 (2026/7/9)');
    console.log('[Lexible] 所有网络请求已阻断，数据仅存储在本地浏览器。');
    // ("FocusTodo 完全本地版已激活" / "所有网络请求已阻断，数据仅存储在本地浏览器。")

    // ========== 6. 数据导出/导入功能 ==========
    (function() {
        'use strict';

        var DB_NAME = 'PomodoroDB6';
        var DB_VERSION = 2;
        var STORES = ['Project', 'Task', 'Subtask', 'Pomodoro', 'Schedule', 'Group', 'GroupUser', 'Message'];
        var EXPORT_VERSION = 1;

        // localStorage keys that should always be exported
        var LOCAL_STORAGE_KEYS = [
            // Settings / Preferences
            'ExpiredDate', 'Theme', 'Version', 'LstRlsVer', 'UpdAltCnt',
            'WorkInterval', 'ShortBreakInterval', 'LongBreakInterval', 'LongBreakPomodoros',
            'AutoWork', 'AutoBreak', 'TskCmpSnd', 'NewTskOnTop', 'BanBreak',
            'WorkAlarm', 'BreakAlarm', 'BgMusic', 'DefaultDeadline',
            'Countdown', 'DarkMode', 'ShowFinishedTasksInToday',
            'RtnVol', 'WNVol', 'ProjectRegionWidth',
            // Feature toggles
            'Forest', 'Group', 'RnkLst',
            // Widgets
            'WidgetExpanded', 'Widgets', 'AllWidgets',
            // Timer state
            'timingTaskId', 'timingSubtaskId',
            // Group
            'SelectedGroupId', 'GroupIntervalIncrement',
            // User profile
            'Portrait', 'Receipt',
            // Purchase / Subscription
            'Price', 'PriceUSD', 'PriceInfo', 'HasRated', 'ShowRateDialog',
            'InstallationDate', 'UpdAltDate', 'UploadExpiredDate',
            // Ranking / Forest
            'PrevRank30', 'PrevRankAll', 'PrevRankForest', 'Sunlight',
            'LastSyncFocusTimeAll', 'LastSyncSunlight',
            // Rewards
            'LaunchReward', 'DailyTaskReward', 'PomodoroReward', 'TaskReward',
            // Config / Sync
            'ConfigTimestamp', 'AvatarTimestamp', 'ServerTimestamp', 'SyncTimestamp',
            'ServerAccessInfo', 'ServerUrls', 'PK1', 'OverseaServerUrl', 'RegionCode',
            'UpdateV64Data', 'UpdateTasksData',
            // Goals
            'Goals',
            // Reminder
            'LastReminderDate',
            // Cookies (user credentials)
            'cookie.ACCT', 'cookie.NAME', 'cookie.PID', 'cookie.UID', 'cookie.JSESSIONID'
        ];

        // ========== 辅助：读取整个 IndexedDB store ==========
        function readAllFromStore(db, storeName) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, 'readonly');
                    var store = tx.objectStore(storeName);
                    var request = store.getAll();
                    request.onsuccess = function() {
                        resolve(request.result || []);
                    };
                    request.onerror = function() {
                        console.warn('[Lexible] Failed to read store: ' + storeName, request.error);
                        resolve([]);
                    };
                } catch (e) {
                    console.warn('[Lexible] Cannot read store: ' + storeName, e);
                    resolve([]);
                }
            });
        }

        // ========== 辅助：写入所有数据到 IndexedDB store ==========
        function writeAllToStore(db, storeName, records) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, 'readwrite');
                    var store = tx.objectStore(storeName);
                    // Clear existing records first
                    var clearReq = store.clear();
                    clearReq.onsuccess = function() {
                        var count = 0;
                        if (!records || records.length === 0) {
                            resolve();
                            return;
                        }
                        records.forEach(function(record) {
                            store.add(record);
                            count++;
                        });
                        tx.oncomplete = function() {
                            resolve();
                        };
                        tx.onerror = function() {
                            console.warn('[Lexible] Transaction error on store: ' + storeName, tx.error);
                            resolve();
                        };
                    };
                    clearReq.onerror = function() {
                        console.warn('[Lexible] Clear error on store: ' + storeName, clearReq.error);
                        resolve();
                    };
                } catch (e) {
                    console.warn('[Lexible] Cannot write to store: ' + storeName, e);
                    resolve();
                }
            });
        }

        // ========== 导出全部数据 ==========
        function exportAllData() {
            console.log('[Lexible] Starting data export...');

            var openReq = window.indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onsuccess = function() {
                var db = openReq.result;
                var promises = STORES.map(function(storeName) {
                    return readAllFromStore(db, storeName).then(function(records) {
                        return { name: storeName, records: records };
                    });
                });

                Promise.all(promises).then(function(storeDataArray) {
                    // Build the indexedDB data object
                    var indexedDBData = {};
                    storeDataArray.forEach(function(item) {
                        indexedDBData[item.name] = item.records;
                    });

                    // Build localStorage snapshot
                    var localStorageData = {};
                    LOCAL_STORAGE_KEYS.forEach(function(key) {
                        var val = localStorage.getItem(key);
                        if (val !== null && val !== undefined) {
                            localStorageData[key] = val;
                        }
                    });

                    // Also capture any extra localStorage keys that might be dynamically added
                    for (var i = 0; i < localStorage.length; i++) {
                        var k = localStorage.key(i);
                        if (k && !(k in localStorageData)) {
                            // Include cookie.* keys and any app-specific keys
                            if (k.indexOf('cookie.') === 0 ||
                                k.indexOf('lexible-') === 0 ||
                                k.indexOf('Pomodoro') === 0 ||
                                k.indexOf('Focus') === 0) {
                                localStorageData[k] = localStorage.getItem(k);
                            }
                        }
                    }

                    // Build the export object
                    var exportData = {
                        meta: {
                            app: 'FocusTodo',
                            exportVersion: EXPORT_VERSION,
                            exportDate: new Date().toISOString(),
                            dbName: DB_NAME,
                            dbVersion: DB_VERSION
                        },
                        indexedDB: indexedDBData,
                        localStorage: localStorageData
                    };

                    // Convert to JSON and trigger download
                    var jsonStr = JSON.stringify(exportData, null, 2);
                    var blob = new Blob([jsonStr], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);

                    var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    var filename = 'FocusTodo-backup-' + timestamp + '.json';

                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    db.close();
                    console.log('[Lexible] Data export completed: ' + filename);
                    alert('数据导出成功！\n文件名: ' + filename + '\n\n请妥善保存此文件，可用于数据恢复。');
                }).catch(function(err) {
                    console.error('[Lexible] Export failed:', err);
                    db.close();
                    alert('数据导出失败: ' + (err.message || err));
                });
            };

            openReq.onerror = function() {
                console.error('[Lexible] Failed to open database for export');
                alert('数据导出失败：无法打开数据库');
            };

            openReq.onblocked = function() {
                console.warn('[Lexible] Database open blocked during export');
                alert('数据导出失败：数据库被占用，请关闭其他标签页后重试');
            };
        }

        // ========== 导入全部数据 ==========
        function importAllData(jsonStr) {
            var data;
            try {
                data = JSON.parse(jsonStr);
            } catch (e) {
                alert('文件格式错误，无法解析备份文件。');
                return;
            }

            // Validate export structure
            if (!data.meta || !data.indexedDB || !data.localStorage) {
                alert('备份文件格式不正确，缺少必要的数据。');
                return;
            }

            if (!confirm(
                '确认导入数据？\n\n' +
                '导入后当前所有数据将被覆盖，此操作不可撤销。\n\n' +
                '导出日期: ' + (data.meta.exportDate || '未知') + '\n' +
                '包含 ' + Object.keys(data.indexedDB).length + ' 个数据库表\n' +
                '包含 ' + Object.keys(data.localStorage).length + ' 个设置项\n\n' +
                '⚠️ 即将自动下载当前数据的备份文件，请保存好。\n' +
                '导入后页面将自动刷新。'
            )) {
                return;
            }

            // Auto-backup: save localStorage snapshot before importing
            console.log('[Lexible] Creating auto-backup before import...');
            try {
                // Quick snapshot of current localStorage
                var currentLS = {};
                for (var _i = 0; _i < localStorage.length; _i++) {
                    var _k = localStorage.key(_i);
                    if (_k) currentLS[_k] = localStorage.getItem(_k);
                }

                var backupBlob = new Blob([JSON.stringify({
                    meta: {
                        app: 'FocusTodo',
                        exportVersion: EXPORT_VERSION,
                        exportDate: new Date().toISOString(),
                        dbName: DB_NAME,
                        dbVersion: DB_VERSION,
                        note: '导入前自动备份(仅localStorage)-如需完整备份请先用导出功能'
                    },
                    localStorage: currentLS
                }, null, 2)], { type: 'application/json' });

                var backupUrl = URL.createObjectURL(backupBlob);
                var backupTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                var backupA = document.createElement('a');
                backupA.href = backupUrl;
                backupA.download = 'FocusTodo-pre-import-backup-' + backupTs + '.json';
                document.body.appendChild(backupA);
                backupA.click();
                document.body.removeChild(backupA);
                URL.revokeObjectURL(backupUrl);
                console.log('[Lexible] Auto-backup localStorage snapshot saved');
            } catch (e) {
                console.warn('[Lexible] Auto-backup failed, proceeding anyway:', e);
            }

            console.log('[Lexible] Starting data import...');

            // Step 1: Restore localStorage first (before DB might be deleted)
            var lsData = data.localStorage;

            // Use _origSetItem to bypass the protection layer
            var setItemFn = (typeof _origSetItem !== 'undefined') ? _origSetItem : localStorage.setItem.bind(localStorage);

            // Clear existing localStorage keys (except runtime ones we want to keep)
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k !== 'ExpiredDate') {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(function(key) {
                try {
                    if (typeof _origRemoveItem !== 'undefined') {
                        _origRemoveItem(key);
                    } else {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    console.warn('[Lexible] Failed to remove key: ' + key, e);
                }
            });

            // Restore all localStorage values from backup
            for (var key in lsData) {
                if (lsData.hasOwnProperty(key)) {
                    try {
                        setItemFn(key, lsData[key]);
                    } catch (e) {
                        console.warn('[Lexible] Failed to restore key: ' + key, e);
                    }
                }
            }

            // Step 2: Open a second connection and clear + restore all stores
            // We DON'T delete the database because the app already has an open connection.
            // IndexedDB supports multiple concurrent connections.
            var openReq = window.indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onsuccess = function() {
                var db = openReq.result;
                var indexedDBData = data.indexedDB;

                // Build array of write promises (clear + add for each store)
                var writePromises = [];
                for (var storeName in indexedDBData) {
                    if (indexedDBData.hasOwnProperty(storeName) && db.objectStoreNames.contains(storeName)) {
                        writePromises.push(
                            writeAllToStore(db, storeName, indexedDBData[storeName])
                        );
                    }
                }

                Promise.all(writePromises).then(function() {
                    db.close();
                    console.log('[Lexible] Data import completed successfully');
                    alert('数据导入成功！页面即将刷新...');
                    location.reload();
                }).catch(function(err) {
                    db.close();
                    console.error('[Lexible] Import write failed:', err);
                    alert('数据导入失败(写入阶段): ' + (err.message || err));
                });
            };

            openReq.onerror = function() {
                console.error('[Lexible] Failed to open database for import');
                alert('数据导入失败：无法打开数据库');
            };

            openReq.onblocked = function() {
                console.warn('[Lexible] Database open blocked during import');
                // blocked on version change only happens when db version mismatch
                // Since we use same version as the app, this shouldn't trigger
                alert('数据导入失败：数据库被占用。请刷新页面后立即导入（在应用加载完之前操作）。');
            };
        }

        // ========== 处理文件选择 ==========
        function handleFileSelect(file) {
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                importAllData(e.target.result);
            };
            reader.onerror = function() {
                alert('读取文件失败，请重试。');
            };
            reader.readAsText(file);
        }

        // ========== 创建隐藏的文件选择器 ==========
        var fileInput = null;
        function getFileInput() {
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json';
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
                if (redButtons[i].textContent.indexOf('删除数据') >= 0 ||
                    redButtons[i].textContent.indexOf('数据') >= 0) {
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
            var btn = document.createElement('span');
            btn.textContent = '导出数据';
            btn.style.cssText = [
                'color:#4a90d9;',
                'cursor:pointer;',
                'margin-left:12px;',
                'font-size:14px;',
                'text-decoration:none;',
                'user-select:none;'
            ].join('');
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                exportAllData();
            });
            btn.addEventListener('mouseenter', function() {
                btn.style.textDecoration = 'underline';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.textDecoration = 'none';
            });
            return btn;
        }

        function createImportButton() {
            var btn = document.createElement('span');
            btn.textContent = '导入数据';
            btn.style.cssText = [
                'color:#4a90d9;',
                'cursor:pointer;',
                'margin-left:12px;',
                'font-size:14px;',
                'text-decoration:none;',
                'user-select:none;'
            ].join('');
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var input = getFileInput();
                input.click();
            });
            btn.addEventListener('mouseenter', function() {
                btn.style.textDecoration = 'underline';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.textDecoration = 'none';
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
    })();

    // ========== 7. 删除确认弹窗 - 注入提示 ==========
    (function() {
        'use strict';

        function injectWarning(modalRoot) {
            var allPwd = modalRoot.querySelectorAll('input[type="password"]');
            for (var i = 0; i < allPwd.length; i++) {
                var inp = allPwd[i];
                var container = inp.closest('[class*="modal"]') ||
                                inp.closest('[class*="dialog"]') ||
                                modalRoot;
                if (!container) continue;

                // 只处理单个密码框的弹窗（删除确认）
                if (container.querySelectorAll('input[type="password"]').length !== 1) continue;
                if (container._lexibleWarned) continue;
                container._lexibleWarned = true;

                // 注入警告提示
                var warnId = 'lexible-delete-warning';
                if (!container.querySelector('#' + warnId)) {
                    var warn = document.createElement('div');
                    warn.id = warnId;
                    warn.style.cssText = 'color:#e74c3c;font-size:13px;margin-top:8px;text-align:center;font-weight:500;';
                    warn.textContent = '⚠ 此操作将删除所有数据并重置为默认状态';
                    var parent = inp.parentNode;
                    if (parent) {
                        parent.insertBefore(warn, inp.nextSibling);
                    }
                }
            }
        }

        (function poll() {
            var start = Date.now();
            var timer = setInterval(function() {
                var mr = document.getElementById('modal-root');
                if (mr) injectWarning(mr);
                if (Date.now() - start > 30000) clearInterval(timer);
            }, 300);

            var moStart = Date.now();
            var moTimer = setInterval(function() {
                var mr = document.getElementById('modal-root');
                if (mr) {
                    clearInterval(moTimer);
                    new MutationObserver(function() {
                        injectWarning(mr);
                    }).observe(mr, { childList: true, subtree: true });
                }
                if (Date.now() - moStart > 10000) clearInterval(moTimer);
            }, 200);
        })();

        console.log('[Lexible] 删除确认提示模块已加载');
    })();

    // ========== 9. 隐藏"功能开关"设置项 ==========
    (function() {
        var CSS_HIDE = [
            '.GeneralSettings-categoryTitle-2aRNH { display: none !important; }',
            '.GeneralSettings-separator-3dQ3a { display: none !important; }',
            // 备选：如果类名变化，也隐藏包含这些类名的元素
            '[class*="GeneralSettings-categoryTitle"] { display: none !important; }',
            '[class*="GeneralSettings-separator"] { display: none !important; }'
        ].join('\n');

        function injectStyle() {
            var style = document.createElement('style');
            style.id = 'lexible-hide-general';
            style.textContent = CSS_HIDE;
            document.head.appendChild(style);
        }

        function init() {
            injectStyle();
            // 额外用 JS 确保隐藏（应对动态渲染）
            var el = document.querySelector('.GeneralSettings-categoryTitle-2aRNH');
            if (el) el.style.display = 'none';
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        // MutationObserver 动态处理
        var observer = new MutationObserver(function() {
            var el = document.querySelector('.GeneralSettings-categoryTitle-2aRNH');
            if (el && el.style.display !== 'none') {
                el.style.display = 'none';
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    })();

    // ========== 8. 禁用评分弹窗（"喜欢专注清单吗"）==========
    // main.js 中 showRateDialog() 检查 isSupportRating && shouldShowRateDialog
    // 注：7 和 9 已存在，这里编号 8 以保持与之前一致
    (function() {
        // 直接写 localStorage，确保弹窗条件不满足
        var _setItem = typeof _origSetItem !== 'undefined' ? _origSetItem : localStorage.setItem;
        _setItem('HasRated', 'true');
        _setItem('ShowRateDialog', 'false');

        // 定期检查并维持值，防止应用内代码修改
        setInterval(function() {
            if (localStorage.getItem('HasRated') !== 'true') {
                (_origSetItem || localStorage.setItem)('HasRated', 'true');
            }
            if (localStorage.getItem('ShowRateDialog') !== 'false') {
                (_origSetItem || localStorage.setItem)('ShowRateDialog', 'false');
            }
        }, 500);

        // 挂载到 DOM 后，找到 showRateDialog 方法，直接覆盖 isSupportRating
        // 这样即使 React 组件重新创建，也不会弹出评分
        function patchRateDialog() {
            // 遍历 React 内部状态，找到 Timer 组件并禁用其 isSupportRating
            var root = document.getElementById('root');
            if (!root) return false;

            // 查找所有 React 组件实例中可能包含 showRateDialog 的对象
            // 方法：遍历 window 上 ReactDOM 管理的 fiber 树
            try {
                var rootFiber = root._reactRootContainer?._internalRoot?.current;
                if (rootFiber) {
                    traverseFiber(rootFiber);
                }
            } catch(e) {
                // 不抛出错误
            }
            return true;
        }

        function traverseFiber(fiber) {
            if (!fiber) return;
            // 检查是否有 shared 对象包含 isSupportRating
            var shared = fiber.stateNode?.shared;
            if (shared && typeof shared.isSupportRating !== 'undefined') {
                shared.isSupportRating = false;
            }
            // 递归子节点和兄弟节点
            traverseFiber(fiber.child);
            traverseFiber(fiber.sibling);
        }

        // 另一种方法：直接劫持 Object.defineProperty 来拦截 isSupportRating
        // 但更稳妥的方式是直接覆盖 showRateDialog 方法
        // 这里使用 MutationObserver 确保在 React 渲染后执行
        if (document.body) {
            var _obs = new MutationObserver(function() {
                // 反复清除 localStorage 值
                (_origSetItem || localStorage.setItem)('HasRated', 'true');
                (_origSetItem || localStorage.setItem)('ShowRateDialog', 'false');
                // 尝试 fiber 遍历
                try {
                    var _f = document.getElementById('root');
                    if (_f) {
                        var _root = _f._reactRootContainer?._internalRoot?.current;
                        if (_root) {
                            (function walk(n) {
                                if (!n) return;
                                var s = n.stateNode?.shared;
                                if (s && typeof s.isSupportRating !== 'undefined') s.isSupportRating = false;
                                walk(n.child);
                                walk(n.sibling);
                            })(_root);
                        }
                    }
                } catch(e) {}
            });
            _obs.observe(document.body, { childList: true, subtree: true });
        }

        console.log('[Lexible] 评分弹窗已永久禁用 (HasRated=true, ShowRateDialog=false)');
    })();

    // ========== 10. 自定义主题管理器（Bing每日壁纸 + 本地上传）==========
    (function() {
        'use strict';

        // ---- 常量 ----
        var STORAGE_KEY = 'lexible-custom-themes';
        var ACTIVE_KEY = 'lexible-active-custom-theme';
        var BING_ID = '__bing_daily__';
        var CUSTOM_PREFIX = 'custom_';
        var BING_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12小时

        // ---- 工具函数 ----
        function _safeSet(k, v) {
            try {
                (typeof _origSetItem !== 'undefined' ? _origSetItem : localStorage.setItem.bind(localStorage))(k, v);
            } catch(e) { console.warn('[Lexible Theme] setItem failed:', k, e.message); }
        }
        function _safeRemove(k) {
            try {
                (typeof _origRemoveItem !== 'undefined' ? _origRemoveItem : localStorage.removeItem.bind(localStorage))(k);
            } catch(e) {}
        }

        function getCustomThemes() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
            catch(e) { return {}; }
        }

        function saveCustomThemes(data) {
            try { _safeSet(STORAGE_KEY, JSON.stringify(data)); }
            catch(e) { alert('保存主题失败：存储空间不足。请删除一些自定义主题后重试。'); }
        }

        function getActiveId() {
            return localStorage.getItem(ACTIVE_KEY) || null;
        }

        function setActiveId(id) {
            if (id) { _safeSet(ACTIVE_KEY, id); }
            else { _safeRemove(ACTIVE_KEY); }
        }

        function genId() {
            return CUSTOM_PREFIX + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        }

        // 查找所有计时器背景元素
        function findBgiElements() {
            var els = [];
            var bgi = document.querySelector('[class*="Timer-bgi"]');
            if (bgi) els.push(bgi);
            document.querySelectorAll('[class*="Fullscreen"] [class*="bgi"], [class*="Float"] [class*="bgi"]').forEach(function(el) {
                els.push(el);
            });
            return els;
        }

        // 应用自定义背景
        function applyCustomBackground(dataUrl) {
            if (!dataUrl) return;
            findBgiElements().forEach(function(el) {
                el.style.backgroundImage = 'url(' + dataUrl + ')';
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            });
        }

        // 清除自定义背景（使用 removeProperty 而非设空串，避免覆盖 React 的 inline style）
        function clearCustomBackground() {
            findBgiElements().forEach(function(el) {
                el.style.removeProperty('background-image');
                el.style.removeProperty('background-size');
                el.style.removeProperty('background-position');
            });
        }

        // ---- 防重入标志（防止 refreshThemeUI 修改 DOM 后触发自身）----
        var _isRefreshing = false;

        // ---- 背景守护 + Theme 变化检测 ----
        var _bgWatcherId = null;
        var _lastObservedTheme = null;
        function startBackgroundWatcher() {
            if (_bgWatcherId) return;
            _lastObservedTheme = localStorage.getItem('Theme');
            _bgWatcherId = setInterval(function() {
                // 检测 Theme 是否被 React UI 修改（用户点击了内置主题按钮）
                var currentTheme = localStorage.getItem('Theme');
                if (currentTheme !== _lastObservedTheme) {
                    _lastObservedTheme = currentTheme;
                    var activeId = getActiveId();
                    if (activeId && currentTheme && !getCustomThemes()[currentTheme]) {
                        // 用户通过 React UI 选择了内置主题 → 清除自定义状态
                        // 注意：不调 clearCustomBackground()！React 已经设置了正确的背景
                        // clearCustomBackground 会 setProperty('') 覆盖 React 的 inline style
                        setActiveId(null);
                        refreshThemeUI();
                        return;
                    }
                }

                var activeId = getActiveId();
                if (!activeId) return;
                var themes = getCustomThemes();
                var theme = themes[activeId];
                if (!theme || !theme.dataUrl) return;

                findBgiElements().forEach(function(el) {
                    var cur = el.style.backgroundImage || '';
                    if (cur.indexOf(theme.dataUrl) < 0) {
                        el.style.backgroundImage = 'url(' + theme.dataUrl + ')';
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                    }
                });
            }, 1000);
        }

        // ---- 图片下载与压缩 ----
        function downloadImageAsDataUrl(imageUrl) {
            return new Promise(function(resolve, reject) {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                var timer = setTimeout(function() { reject(new Error('图片加载超时')); }, 20000);
                img.onload = function() {
                    clearTimeout(timer);
                    try {
                        var MAX_W = 1920, MAX_H = 1080;
                        var w = img.naturalWidth, h = img.naturalHeight;
                        if (w > MAX_W || h > MAX_H) {
                            var ratio = Math.min(MAX_W / w, MAX_H / h);
                            w = Math.round(w * ratio);
                            h = Math.round(h * ratio);
                        }
                        var canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    } catch(e) { reject(new Error('Canvas处理失败: ' + e.message)); }
                };
                img.onerror = function() {
                    clearTimeout(timer);
                    reject(new Error('图片加载失败，可能存在跨域限制'));
                };
                img.src = imageUrl;
            });
        }

        // 创建缩略图 240×160
        function createThumbnail(dataUrl) {
            return new Promise(function(resolve) {
                var img = new Image();
                img.onload = function() {
                    var c = document.createElement('canvas');
                    c.width = 240; c.height = 160;
                    c.getContext('2d').drawImage(img, 0, 0, 240, 160);
                    resolve(c.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = function() { resolve(dataUrl); };
                img.src = dataUrl;
            });
        }

        // ---- Bing 每日壁纸获取（多API容错）----
        function fetchBingWallpaper() {
            return new Promise(function(resolve, reject) {
                var apis = [
                    'https://bing.biturl.top/?format=json&index=0&mkt=zh-CN',
                    'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN'
                ];
                function tryApi(idx) {
                    if (idx >= apis.length) { reject(new Error('所有API端点均不可用')); return; }
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', apis[idx], true);
                    xhr.timeout = 10000;
                    xhr.onload = function() {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            var imageUrl = null, copyright = '';
                            if (data && data.url) {
                                imageUrl = data.url;
                                copyright = data.copyright || '';
                            } else if (data && data.images && data.images.length > 0) {
                                var urlbase = data.images[0].urlbase || '';
                                imageUrl = 'https://www.bing.com' + urlbase + '_UHD.jpg';
                                copyright = data.images[0].copyright || '';
                            }
                            if (imageUrl) {
                                if (imageUrl.indexOf('_UHD') < 0) {
                                    imageUrl = imageUrl.replace(/_1920x1080\.jpg/g, '_UHD.jpg');
                                }
                                resolve({ url: imageUrl, copyright: copyright });
                            } else { tryApi(idx + 1); }
                        } catch(e) { tryApi(idx + 1); }
                    };
                    xhr.onerror = function() { tryApi(idx + 1); };
                    xhr.ontimeout = function() { tryApi(idx + 1); };
                    xhr.send();
                }
                tryApi(0);
            });
        }

        // ---- 用户手动点击获取Bing壁纸 ----
        var _bingLoading = false;
        function fetchAndApplyBing(labelEl) {
            if (_bingLoading) return;
            _bingLoading = true;
            if (labelEl) labelEl.textContent = '下载中...';

            fetchBingWallpaper().then(function(result) {
                return downloadImageAsDataUrl(result.url).then(function(dataUrl) {
                    return createThumbnail(dataUrl).then(function(thumb) {
                        return { dataUrl: dataUrl, thumbnail: thumb, copyright: result.copyright };
                    });
                });
            }).then(function(data) {
                var themes = getCustomThemes();
                themes[BING_ID] = {
                    name: 'Bing每日壁纸', dataUrl: data.dataUrl,
                    thumbnail: data.thumbnail, type: 'bing',
                    updatedAt: Date.now(), copyright: data.copyright || ''
                };
                saveCustomThemes(themes);
                setActiveId(BING_ID);
                _safeSet('Theme', BING_ID);
                applyCustomBackground(data.dataUrl);
                refreshThemeUI();
                console.log('[Lexible] Bing wallpaper applied');
            }).catch(function(err) {
                console.warn('[Lexible] Bing fetch failed:', err.message || err);
                alert('获取 Bing 每日壁纸失败。\n\n' + ((err && err.message) || '网络错误，请检查网络连接后重试。'));
            }).finally(function() {
                _bingLoading = false;
                if (labelEl) labelEl.textContent = 'Bing 每日';
            });
        }

        // ---- Bing 过期自动刷新（12小时）----
        function checkBingExpiry() {
            var activeId = getActiveId();
            if (activeId !== BING_ID) return;
            var themes = getCustomThemes();
            var bing = themes[BING_ID];
            if (!bing) return;
            if (Date.now() - (bing.updatedAt || 0) < BING_EXPIRY_MS) return;

            console.log('[Lexible] Bing wallpaper expired, auto-refreshing...');
            fetchBingWallpaper().then(function(result) {
                return downloadImageAsDataUrl(result.url).then(function(dataUrl) {
                    return createThumbnail(dataUrl).then(function(thumb) {
                        return { dataUrl: dataUrl, thumbnail: thumb, copyright: result.copyright };
                    });
                });
            }).then(function(data) {
                var themes = getCustomThemes();
                themes[BING_ID] = {
                    name: 'Bing每日壁纸', dataUrl: data.dataUrl,
                    thumbnail: data.thumbnail, type: 'bing',
                    updatedAt: Date.now(), copyright: data.copyright || ''
                };
                saveCustomThemes(themes);
                applyCustomBackground(data.dataUrl);
                console.log('[Lexible] Bing wallpaper auto-refreshed');
            }).catch(function(err) {
                console.warn('[Lexible] Bing auto-refresh failed:', err.message || err);
            });
        }

        // ---- 选择自定义主题 ----
        function selectCustomTheme(id) {
            var themes = getCustomThemes();
            if (!themes[id]) return;
            setActiveId(id);
            _safeSet('Theme', id);
            applyCustomBackground(themes[id].dataUrl);
            refreshThemeUI();
        }

        // ---- 删除自定义主题 ----
        function deleteCustomTheme(id) {
            if (!confirm('确定要删除此自定义主题吗？')) return;
            var themes = getCustomThemes();
            delete themes[id];
            saveCustomThemes(themes);
            if (getActiveId() === id) {
                setActiveId(null);
                _safeSet('Theme', 'Leaf');
                clearCustomBackground();
            }
            refreshThemeUI();
        }

        // ---- 动态查找现有 CSS 类名（避免硬编码 hash） ----
        var _cachedClasses = null;
        function getThemeClasses(table) {
            if (_cachedClasses) return _cachedClasses;
            // 从传入的 table 或全局查找第一个主题 td
            var firstTd = table ? table.querySelector('td') : document.querySelector('[class*="AppearanceSettings"] td');
            if (!firstTd) return {};
            var img = firstTd.querySelector('img');
            if (!img) return {};
            _cachedClasses = {
                tdClass: firstTd.className.split(' ').filter(function(c) { return c.indexOf('theme-') >= 0 || c.indexOf('theme') >= 0; })[0] || '',
                imgClass: img.className.split(' ').filter(function(c) { return c.indexOf('themeImg') >= 0; })[0] || '',
                wrapperClass: (firstTd.querySelector('div') || {}).className ? (firstTd.querySelector('div').className.split(' ').filter(function(c) { return c.indexOf('wrapper') >= 0 || c.indexOf('imgWrapper') >= 0; })[0] || '') : ''
            };
            return _cachedClasses;
        }

        function clearClassCache() { _cachedClasses = null; }

        // 通过"主题"标题 div 定位主题按钮 table（比 CSS 类名搜索更可靠）
        function findThemeTable() {
            var titleDivs = document.querySelectorAll('div[class*="AppearanceSettings-title"][class*="theme"]');
            for (var i = 0; i < titleDivs.length; i++) {
                var text = (titleDivs[i].textContent || '').trim();
                if (text === '主题' || text === 'Theme') {
                    var tbl = titleDivs[i].nextElementSibling;
                    while (tbl && tbl.tagName !== 'TABLE') {
                        tbl = tbl.nextElementSibling;
                    }
                    return tbl || null;
                }
            }
            return null;
        }

        // ---- 创建主题按钮 ----
        function createThemeButton(id, name, thumbnailUrl, isSelected, isCustom) {
            var cls = getThemeClasses();
            var td = document.createElement('td');
            if (cls.tdClass) td.className = cls.tdClass;
            td.setAttribute('data-theme-id', id);
            td.style.cssText = 'position:relative;padding-bottom:12px;padding-right:8px;';

            var wrapper = document.createElement('div');
            if (cls.wrapperClass) wrapper.className = cls.wrapperClass;
            wrapper.style.cssText = 'display:inline-block;padding:4px;border:1px solid ' +
                (isSelected ? 'var(--theme-red, #e74c3c)' : 'transparent') + ';border-radius:10px;';

            var img = document.createElement('img');
            if (cls.imgClass) img.className = cls.imgClass;
            img.style.cssText = 'width:240px;height:160px;border-radius:8px;object-fit:cover;';
            img.src = thumbnailUrl || 'img/setting-theme.png';

            wrapper.appendChild(img);
            td.appendChild(wrapper);

            if (isSelected) {
                var chk = document.createElement('img');
                chk.style.cssText = 'position:absolute;bottom:36px;right:36px;width:20px;height:20px;';
                chk.src = 'img/theme-selected.png';
                td.appendChild(chk);
            }

            if (isCustom) {
                var label = document.createElement('div');
                label.style.cssText = 'position:absolute;bottom:14px;left:4px;background:rgba(0,0,0,0.6);color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;pointer-events:none;z-index:5;';
                label.textContent = (name && name.length > 10) ? name.substring(0, 8) + '...' : (name || '自定义');
                td.appendChild(label);

                var delBtn = document.createElement('span');
                delBtn.textContent = '×';
                delBtn.title = '删除此主题';
                delBtn.style.cssText = 'position:absolute;top:2px;right:10px;width:22px;height:22px;line-height:20px;text-align:center;background:rgba(0,0,0,0.5);color:#fff;border-radius:50%;cursor:pointer;font-size:16px;font-weight:bold;z-index:10;user-select:none;';
                delBtn.addEventListener('click', function(e) { e.stopPropagation(); e.preventDefault(); deleteCustomTheme(id); });
                td.appendChild(delBtn);
            }

            td.addEventListener('click', function() { selectCustomTheme(id); });
            return td;
        }

        // ---- 刷新主题按钮 UI ----
        var _refreshTimer = null;
        var _initialInjectionDone = false;
        function refreshThemeUI() {
            if (_refreshTimer) { clearTimeout(_refreshTimer); }
            if (!_initialInjectionDone) {
                // 首次注入立即执行，不等待 debounce
                doRefreshUI();
                return;
            }
            _refreshTimer = setTimeout(doRefreshUI, 0);
        }

        function doRefreshUI() {
            if (_isRefreshing) return;
            _isRefreshing = true;
            try {

            // 通过"主题"标题 div 找到 table（不依赖 themeImg 元素是否存在）
            var table = findThemeTable();
            if (!table) return;
            var tbody = table.querySelector('tbody') || table;

            clearClassCache();
            var cls = getThemeClasses(table);
            if (!cls.imgClass) return;

            // 清除之前注入的行
            tbody.querySelectorAll('[data-lexible-theme-row]').forEach(function(el) { el.remove(); });

            var themes = getCustomThemes();
            var activeId = getActiveId();

            // 管理内置主题的选中标记：自定义主题激活时，通过 CSS 规则强制清除粉框
            // 使用 stylesheet 而非 inline style，因为 React 重渲染时可能替换 DOM 节点
            var styleEl = document.getElementById('lexible-theme-override');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'lexible-theme-override';
                document.head.appendChild(styleEl);
            }
            if (activeId) {
                styleEl.textContent = '[class*="AppearanceSettings-theme"] [class*="imgWrapper"] { border-color: transparent !important; }';
            } else {
                styleEl.textContent = '';
            }
            // 隐藏/恢复勾选标记（inline display 没问题，React 不常替换这个）
            var builtinRows = tbody.querySelectorAll('tr:not([data-lexible-theme-row])');
            builtinRows.forEach(function(row) {
                var marks = row.querySelectorAll('[class*="chkImg"]');
                marks.forEach(function(m) { m.style.display = activeId ? 'none' : ''; });
            });

            // ---- 第一行：Bing + 上传 ----
            var actionRow = document.createElement('tr');
            actionRow.setAttribute('data-lexible-theme-row', 'actions');

            // Bing 按钮
            var bingData = themes[BING_ID];
            var isBingActive = activeId === BING_ID;
            var bingTd = document.createElement('td');
            if (cls.tdClass) bingTd.className = cls.tdClass;
            bingTd.style.cssText = 'position:relative;padding-bottom:12px;padding-right:8px;';

            var bingWrapper = document.createElement('div');
            if (cls.wrapperClass) bingWrapper.className = cls.wrapperClass;
            bingWrapper.style.cssText = 'display:inline-block;padding:4px;border:1px solid ' +
                (isBingActive ? 'var(--theme-red, #e74c3c)' : 'transparent') + ';border-radius:10px;';

            var bingImg = document.createElement('img');
            if (cls.imgClass) bingImg.className = cls.imgClass;
            bingImg.style.cssText = 'width:240px;height:160px;border-radius:8px;object-fit:cover;';
            bingImg.src = (bingData && bingData.thumbnail) ? bingData.thumbnail : 'img/setting-theme.png';
            bingWrapper.appendChild(bingImg);
            bingTd.appendChild(bingWrapper);

            var bingLabel = document.createElement('div');
            bingLabel.style.cssText = 'position:absolute;bottom:14px;left:4px;background:rgba(0,0,0,0.6);color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;pointer-events:none;z-index:5;';
            bingLabel.textContent = 'Bing 每日';
            bingTd.appendChild(bingLabel);

            if (isBingActive) {
                var bingChk = document.createElement('img');
                bingChk.style.cssText = 'position:absolute;bottom:36px;right:36px;width:20px;height:20px;';
                bingChk.src = 'img/theme-selected.png';
                bingTd.appendChild(bingChk);
            }

            bingTd.addEventListener('click', function() { fetchAndApplyBing(bingLabel); });
            actionRow.appendChild(bingTd);

            // 上传按钮
            var uploadTd = document.createElement('td');
            if (cls.tdClass) uploadTd.className = cls.tdClass;
            uploadTd.style.cssText = 'position:relative;padding-bottom:12px;padding-right:8px;cursor:pointer;';

            var uploadWrapper = document.createElement('div');
            if (cls.wrapperClass) uploadWrapper.className = cls.wrapperClass;
            uploadWrapper.style.cssText = 'display:inline-block;padding:4px;border:1px solid transparent;border-radius:10px;';

            var placeholder = document.createElement('div');
            placeholder.style.cssText = 'width:240px;height:160px;border-radius:8px;background:var(--bg-hover, #f5f5f5);display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--border, #ccc);box-sizing:border-box;';
            var ico = document.createElement('span');
            ico.textContent = '📁';
            ico.style.cssText = 'font-size:36px;line-height:1;margin-bottom:6px;';
            placeholder.appendChild(ico);
            var txt = document.createElement('span');
            txt.textContent = '本地上传';
            txt.style.cssText = 'color:var(--text-title, #666);font-size:14px;';
            placeholder.appendChild(txt);
            uploadWrapper.appendChild(placeholder);
            uploadTd.appendChild(uploadWrapper);

            // 隐藏的文件选择器
            var fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            uploadTd.addEventListener('click', function() { fileInput.click(); });
            fileInput.addEventListener('change', function(e) {
                if (!e.target.files || e.target.files.length === 0) return;
                var file = e.target.files[0];
                if (file.size > 10 * 1024 * 1024) {
                    alert('图片文件过大，请选择小于 10MB 的图片。');
                    e.target.value = '';
                    return;
                }
                var reader = new FileReader();
                reader.onload = function(evt) {
                    var rawDataUrl = evt.target.result;
                    createThumbnail(rawDataUrl).then(function(thumb) {
                        // 对原图进行压缩（最大 1920x1080）
                        return downloadImageAsDataUrl(rawDataUrl).then(function(compressed) {
                            return { dataUrl: compressed, thumbnail: thumb };
                        }).catch(function() {
                            return { dataUrl: rawDataUrl, thumbnail: thumb };
                        });
                    }).then(function(result) {
                        var id = genId();
                        var themes = getCustomThemes();
                        themes[id] = {
                            name: file.name, dataUrl: result.dataUrl,
                            thumbnail: result.thumbnail, type: 'custom',
                            createdAt: Date.now(), originalName: file.name
                        };
                        saveCustomThemes(themes);
                        setActiveId(id);
                        _safeSet('Theme', id);
                        applyCustomBackground(result.dataUrl);
                        refreshThemeUI();
                    });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            });

            actionRow.appendChild(uploadTd);
            tbody.appendChild(actionRow);
            _initialInjectionDone = true;  // 首次注入成功，后续走 debounce

            // ---- 自定义主题行 ----
            var customIds = Object.keys(themes).filter(function(k) { return k !== BING_ID; });
            if (customIds.length > 0) {
                customIds.sort(function(a, b) { return (themes[a].createdAt || 0) - (themes[b].createdAt || 0); });
                for (var row = 0; row < customIds.length; row += 2) {
                    var tr = document.createElement('tr');
                    tr.setAttribute('data-lexible-theme-row', 'custom');
                    for (var col = 0; col < 2; col++) {
                        var cid = customIds[row + col];
                        if (cid) {
                            var t = themes[cid];
                            tr.appendChild(createThemeButton(cid, t.originalName || t.name, t.thumbnail, activeId === cid, true));
                        } else {
                            var empty = document.createElement('td');
                            if (cls.tdClass) empty.className = cls.tdClass;
                            empty.style.cssText = 'position:relative;padding-bottom:12px;padding-right:8px;';
                            tr.appendChild(empty);
                        }
                    }
                    tbody.appendChild(tr);
                }
            }
            } finally { _isRefreshing = false; }
        }

        // ---- 启动 ----
        function start() {
            if (!document.body) return;
            startBackgroundWatcher();

            // 延迟多次注入（设置页面可能延迟渲染，覆盖冷启动场景）
            [800, 2000, 4000, 8000].forEach(function(d) { setTimeout(refreshThemeUI, d); });

            // 阶段1：MutationObserver — childList + attributes 双重检测
            // 一旦注入成功立即断开，不会造成反馈循环
            var _initObserver = new MutationObserver(function(mutations) {
                // 快速检查：是否有 mutations 来自设置面板区域
                if (findThemeTable()) {
                    console.log('[Lexible] Observer 检测到主题表，开始注入');
                    refreshThemeUI();
                    _initObserver.disconnect();
                    _slowDownPolling();
                }
            });
            _initObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

            // 阶段2：快速轮询（并行于 observer，捕获 tab 切换等 observer 遗漏的场景）
            var _fastPollId = setInterval(function() {
                if (_isRefreshing) return;
                if (findThemeTable()) {
                    refreshThemeUI();
                }
            }, 500);

            // 首次注入成功后关闭快速轮询，降级为低频轮询
            var _pollingStarted = false;
            function _slowDownPolling() {
                if (_pollingStarted) return;
                _pollingStarted = true;
                clearInterval(_fastPollId);
                setInterval(function() {
                    if (_isRefreshing) return;
                    if (findThemeTable()) {
                        refreshThemeUI();
                    }
                }, 3000);
            }

            // 30秒兜底：超时后断开 observer + 降级轮询
            setTimeout(function() {
                try { _initObserver.disconnect(); } catch(e) {}
                _slowDownPolling();
            }, 30000);

            // Bing 过期检测（每5分钟 + 首次8秒后）
            setInterval(checkBingExpiry, 5 * 60 * 1000);
            setTimeout(checkBingExpiry, 8000);

            // 启动时如果有活跃自定义主题，恢复背景
            setTimeout(function() {
                var activeId = getActiveId();
                if (activeId) {
                    var themes = getCustomThemes();
                    if (themes[activeId] && themes[activeId].dataUrl) {
                        applyCustomBackground(themes[activeId].dataUrl);
                    }
                }
            }, 2000);

            console.log('[Lexible] 自定义主题模块已加载 (Bing每日壁纸 + 本地上传)');
        }

        if (document.body) { start(); }
        else { document.addEventListener('DOMContentLoaded', start); }
    })();

    // ========== 11. 调试工具：手动修改用户名 ==========
    // 在控制台输入 testSetUsername("新名字") 测试
    window.testSetUsername = function(newName) {
        console.log('[Lexible Test] Input:', newName);
        // 使用应用内置编码
        var encoded = (window.Base64 && window.Base64.encode)
            ? window.Base64.encode(newName)
            : utf8Base64Encode(newName);
        console.log('[Lexible Test] Encoded:', encoded);
        // 写入
        try { _origSetItem('cookie.NAME', encoded); } catch (e) {}
        // 验证
        var stored = localStorage.getItem('cookie.NAME');
        console.log('[Lexible Test] Stored in cookie.NAME:', stored);
        // 解码验证
        if (window.Base64 && window.Base64.decode) {
            console.log('[Lexible Test] App decode result:', window.Base64.decode(stored));
        }
        console.log('[Lexible Test] 已写入，请切换页面再回来查看效果');
    };
})();
