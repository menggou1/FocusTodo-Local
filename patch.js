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
})();
