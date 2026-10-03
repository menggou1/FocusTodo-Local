// ================================================================
// FocusTodo 完全本地版
// 修改者：Lexible
// 版本与更新内容：release.json（由 local-release.js 加载）
// 说明：已移除所有登录和服务器同步功能，所有数据完全存储于本地浏览器。
//       请勿用于商业用途，仅供个人使用。
// ================================================================
(function() {
    'use strict';

    // About and release notices are rendered by local-app-ui.js at explicit React boundaries.

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

    var _nativeSetItem = Storage.prototype.setItem;
    var _nativeRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function(key, value) {
        if (this !== localStorage) return _nativeSetItem.call(this, key, value);
        key = String(key);
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

    Storage.prototype.removeItem = function(key) {
        if (this !== localStorage) return _nativeRemoveItem.call(this, key);
        key = String(key);
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
        window.fetch = function(input, options) {
            var url;
            try { url = new URL(input instanceof Request ? input.url : String(input), location.href); }
            catch (error) { return Promise.reject(error); }
            if (url.origin === location.origin || _isWhitelisted(url.href)) return origFetch.apply(this, arguments);
            return Promise.reject(new TypeError('本地版已阻止外部请求：' + url.hostname));
        };
    }

    // ========== 5. 旧 jQuery.ajax 端点兼容（主删除入口直接调用本地服务）==========
    var _checkJQuery = setInterval(function() {
        if (window.jQuery && window.jQuery.ajax) {
            clearInterval(_checkJQuery);
            var _origAjax = window.jQuery.ajax;

            // ===== 彻底重置为默认状态 =====
            // 策略：先保存 app 初始化必需的 key，清空全部，再写入默认值并恢复必需 key
            function _resetToDefaults() { return window.FocusLocalData.reset(); }

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
                    var _operation = Promise.resolve();

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
                                _operation = _resetToDefaults();
                            }
                        }
                    }

                    var deferred = window.jQuery.Deferred();
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
                return _origAjax.apply(this, arguments);
            };
            console.log('[Lexible] jQuery.ajax interception + delete-to-defaults installed');
        }
    }, 50); // 加快检查频率
    setTimeout(function() { clearInterval(_checkJQuery); }, 5000);

    console.log('[Lexible] Local release:', window.FocusRelease.version);
    console.log('[Lexible] 本地数据服务已加载；外部资源按精确白名单限制。');
    // ("FocusTodo 完全本地版已激活" / "所有网络请求已阻断，数据仅存储在本地浏览器。")

    // ========== 6. 数据导出/导入功能 ==========
    (function() {
        'use strict';

        var DB_NAME = 'PomodoroDB6';
        var DB_VERSION = 3;
        var STORES = window.FocusLocalData.DATA;
        var EXPORT_VERSION = 2;

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

        async function exportAllData() {
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
                if (!confirm('导入将覆盖当前任务、专注记录和设置。\n导入前会生成完整备份；请确认保存下载文件。\n计时快照不会自动运行。是否继续？')) return;
                await window.FocusLocalData.replace(input);
                alert('数据导入成功，所有数据已提交。页面即将刷新。');
                location.reload();
            } catch (error) { alert('导入失败：' + error.message + '\n未报告导入成功。'); }
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

    // Local data deletion uses FocusAppUI.confirmReset; no password-dialog polling.

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

    // Use the existing preference gate; no React-internal traversal or polling.
    _origSetItem('HasRated', 'true');
    _origSetItem('ShowRateDialog', 'false');

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
            try { _origSetItem(k, v); }
            catch (error) { throw new Error('保存失败，存储空间可能不足；请删除部分自定义主题后重试。' + error.message); }
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
            var json = JSON.stringify(data);
            if (json.length > 2 * 1024 * 1024 && json.length >= (localStorage.getItem(STORAGE_KEY) || '').length) throw new Error('自定义主题总量已达到限制，请删除部分图片后重试。');
            _safeSet(STORAGE_KEY, json);
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

        // 保存经典主题背景及对应主题ID（模块级变量，不受 React 替换 DOM 影响）
        var _savedClassicBg = null;
        var _savedClassicThemeId = null;

        // 应用自定义背景（保存当前经典背景以便切回同一主题时恢复）
        function applyCustomBackground(dataUrl, classicThemeId) {
            if (!dataUrl) return;
            var els = findBgiElements();
            // 首次覆盖经典主题前，保存其 inline 背景及主题 ID
            // classicThemeId 必须由调用方在修改 Theme 之前读取传入
            if (els.length > 0 && !_savedClassicBg) {
                var cur = els[0].style.backgroundImage || '';
                if (cur && cur.indexOf('data:image/') < 0) {
                    _savedClassicBg = cur;
                    _savedClassicThemeId = classicThemeId || localStorage.getItem('Theme');
                }
            }
            els.forEach(function(el) {
                el.style.backgroundImage = 'url(' + dataUrl + ')';
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            });
        }

        // 清除自定义背景，恢复之前保存的经典主题背景（仅当目标主题匹配时）
        function clearCustomBackground(expectedThemeId) {
            // 仅当切回的是保存时的同一经典主题才需要恢复
            //（不同主题时 React 已自行重渲染，不应覆盖）
            if (expectedThemeId !== undefined && expectedThemeId !== _savedClassicThemeId) {
                _savedClassicBg = null;
                _savedClassicThemeId = null;
                return;
            }
            findBgiElements().forEach(function(el) {
                if (_savedClassicBg) {
                    el.style.backgroundImage = _savedClassicBg;
                } else {
                    el.style.removeProperty('background-image');
                }
                el.style.removeProperty('background-size');
                el.style.removeProperty('background-position');
            });
            _savedClassicBg = null;
            _savedClassicThemeId = null;
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
                        // 必须清除自定义背景！否则切回同一经典主题时 React 跳过渲染，
                        // 导致自定义背景的 inline style 残留覆盖
                        setActiveId(null);
                        clearCustomBackground(currentTheme);
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
                var _prevBing = localStorage.getItem('Theme');
                _safeSet('Theme', BING_ID);
                applyCustomBackground(data.dataUrl, _prevBing);
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
            var prevTheme = localStorage.getItem('Theme');
            setActiveId(id);
            _safeSet('Theme', id);
            applyCustomBackground(themes[id].dataUrl, prevTheme);
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
            // 先找到 AppearanceSettings 的根容器
            var settingsRoot = document.querySelector('[class*="AppearanceSettings-root"]');
            if (!settingsRoot) return null;

            // 在容器内查找包含"主题"/"Theme"字样的标题 div
            var titleDivs = settingsRoot.querySelectorAll('[class*="AppearanceSettings-title"]');
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

        // ---- 轮询管理（必须定义在 refreshThemeUI 之前，因为 doRefreshUI 也会调用）----
        var _fastPollId = null;
        var _pollingStarted = false;
        function _slowDownPolling() {
            if (_pollingStarted) return;
            _pollingStarted = true;
            if (_fastPollId) clearInterval(_fastPollId);
            setInterval(function() {
                if (_isRefreshing) return;
                // 检查已注入的元素是否仍在 DOM 中（React 切换 tab/页面时会清除）
                var existingAction = document.querySelector('[data-lexible-theme-row="actions"]');
                if (existingAction && existingAction.isConnected) {
                    return; // 元素还在，无需重建
                }
                // 元素被移除了（切换页面/tab），需要重新注入
                if (findThemeTable()) {
                    refreshThemeUI();
                }
            }, 3000);
        }

        // ---- 刷新主题按钮 UI ----
        var _refreshTimer = null;
        var _initialInjectionDone = false;
        var _lastInjectedAt = 0;
        function refreshThemeUI() {
            if (_refreshTimer) { clearTimeout(_refreshTimer); }
            if (!_initialInjectionDone) {
                // 首次注入立即执行，不等待 debounce
                doRefreshUI();
                return;
            }
            _refreshTimer = setTimeout(doRefreshUI, 0);
        }

        // ---- 管理隐藏的 file input（避免累积）----
        var _currentFileInput = null;
        function getOrCreateFileInput() {
            // 如果已有且仍在 DOM 中，直接复用
            if (_currentFileInput && _currentFileInput.isConnected) {
                return _currentFileInput;
            }
            // 清理所有旧的 lexible file inputs
            document.querySelectorAll('input[data-lexible-upload]').forEach(function(el) { el.remove(); });
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.setAttribute('data-lexible-upload', '1');

            // 只绑定一次 change 事件
            input.addEventListener('change', function(e) {
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
                            throw new Error('图片压缩失败，未保存原始大图。请更换图片。');
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
                        var _prevUp = localStorage.getItem('Theme');
                        _safeSet('Theme', id);
                        applyCustomBackground(result.dataUrl, _prevUp);
                        refreshThemeUI();
                    }).catch(function(err) {
                        console.error('[Lexible] Upload failed:', err);
                        alert('上传失败: ' + (err.message || '未知错误'));
                    });
                };
                reader.onerror = function() {
                    alert('文件读取失败，请重试。');
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            });

            document.body.appendChild(input);
            _currentFileInput = input;
            return input;
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

            // 给 table 加自定义 class，作为 CSS 规则的可靠锚点
            table.classList.add('lexible-theme-table');

            // 管理内置主题的选中标记：自定义主题激活时，CSS 规则清除粉框（仅影响内置行）
            var styleEl = document.getElementById('lexible-theme-override');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'lexible-theme-override';
                document.head.appendChild(styleEl);
            }
            if (activeId) {
                // tr 无 data-lexible-theme-row → 内置行；有该属性 → 自定义行（排除）
                styleEl.textContent = '.lexible-theme-table tr:not([data-lexible-theme-row]) [class*="imgWrapper"] { border-color: transparent !important; }';
            } else {
                styleEl.textContent = '';
            }
            // 隐藏/恢复勾选标记
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
            bingTd.style.cssText = 'position:relative;padding-bottom:12px;padding-right:8px;cursor:pointer;';

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

            // 复用隐藏文件选择器，避免每次重建时在 body 中累积
            var fileInput = getOrCreateFileInput();
            uploadTd.addEventListener('click', function() { fileInput.click(); });

            actionRow.appendChild(uploadTd);
            tbody.appendChild(actionRow);
            _initialInjectionDone = true;  // 首次注入成功，后续走 debounce
            _lastInjectedAt = Date.now();
            _slowDownPolling();  // 立刻停掉快速轮询，避免后续定时器重复触发

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

            // ===== 改进: 精确的 DOM 信号监听 =====

            // 阶段1：观察 document.body（设置面板可能通过 Portal 渲染到 modal-root）
            var _lastAppearanceRoot = null; // 追踪根元素引用，避免重复触发
            var _initObserver = new MutationObserver(function() {
                // 检查 AppearanceSettings-root 是否被替换/新增（tab 切换时 React 重建 DOM）
                var currentRoot = document.querySelector('[class*="AppearanceSettings-root"]');
                if (currentRoot !== _lastAppearanceRoot) {
                    _lastAppearanceRoot = currentRoot;
                    if (currentRoot) {
                        // 使用 requestAnimationFrame 确保 React 渲染完成
                        requestAnimationFrame(function() {
                            if (findThemeTable()) {
                                console.log('[Lexible] Observer 检测到外观设置面板，注入自定义主题按钮');
                                refreshThemeUI();
                            }
                        });
                    }
                }
            });
            _initObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

            // 阶段2：检测 Overlay 弹出（设置面板打开时）
            var overlayObserver = new MutationObserver(function() {
                if (document.querySelector('[class*="Overlay-root"]')) {
                    setTimeout(function() {
                        if (_initialInjectionDone) return; // 已注入，跳过
                        if (findThemeTable()) {
                            refreshThemeUI();
                        }
                    }, 200);
                }
            });
            overlayObserver.observe(document.body, { childList: true, subtree: false });

            // 阶段3：加速的定时兜底（首次更快）
            [100, 500, 1500, 4000].forEach(function(d) {
                setTimeout(function() {
                    if (_initialInjectionDone) return; // 已注入，跳过
                    if (findThemeTable()) {
                        refreshThemeUI();
                        if (!_pollingStarted) _slowDownPolling();
                    }
                }, d);
            });

            // 阶段4：快速轮询（300ms，作为 observer 的兜底）
            _fastPollId = setInterval(function() {
                if (_isRefreshing) return;
                if (_initialInjectionDone) return; // 已注入，等 _slowDownPolling 清理
                if (findThemeTable()) {
                    refreshThemeUI();
                }
            }, 300);

            // 30秒兜底：超时后断开非关键 observer + 降级轮询
            setTimeout(function() {
                try { overlayObserver.disconnect(); } catch(e) {}
                // 不断开 _initObserver：切换设置页面后再回到"外观"时仍需重新注入
                _slowDownPolling();
            }, 30000);

            // Bing 过期检测（每5分钟 + 首次8秒后）
            setInterval(checkBingExpiry, 5 * 60 * 1000);
            setTimeout(checkBingExpiry, 8000);

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
