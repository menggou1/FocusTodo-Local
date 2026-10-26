/* Small recovery journal for the legacy theme settings. It never copies images. */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FocusThemeStorage = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const JOURNAL_KEY = 'FocusTodo.themeJournal';
    const KEYS = Object.freeze({ themes: 'lexible-custom-themes', active: 'lexible-active-custom-theme', theme: 'Theme' });
    const fields = Object.keys(KEYS);
    let sequence = 0;

    // This content fingerprint identifies the existing atomic JSON value during
    // recovery. It is not an authenticity or security check.
    function fingerprint(value) {
        if (value === null) return 'null';
        let a = 2166136261, b = 0x9e3779b9, c = 0x85ebca6b, d = 0xc2b2ae35;
        for (let i = 0; i < value.length; i++) {
            const n = value.charCodeAt(i);
            a = Math.imul(a ^ n, 16777619);
            b = Math.imul(b ^ n, 0x85ebca6b);
            c = Math.imul(c ^ n, 0xc2b2ae35);
            d = Math.imul(d ^ n, 0x27d4eb2d);
        }
        return value.length + ':' + [a, b, c, d].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
    }
    function describe(state) {
        return { fingerprint: fingerprint(state.themes), active: state.active, theme: state.theme };
    }
    function validDescription(value) {
        return value && typeof value.fingerprint === 'string' &&
            ['active', 'theme'].every(name => value[name] === null || typeof value[name] === 'string');
    }
    function recoveryFailure(message, cause) {
        const error = new Error(message + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('；主题恢复日志已保留，请刷新后重试。'):'；主题恢复日志已保留，请刷新后重试。'));
        error.recoveryRequired = true; error.cause = cause; return error;
    }
    function create(ops) {
        if (!ops || !['get', 'set', 'remove'].every(name => typeof ops[name] === 'function')) throw new Error('Invalid theme storage operations.');
        const read = () => Object.fromEntries(fields.map(name => [name, ops.get(KEYS[name])]));
        const put = (name, value) => value === null ? ops.remove(KEYS[name]) : ops.set(KEYS[name], value);
        function parseJournal(raw) {
            let log;
            try { log = JSON.parse(raw); } catch (error) { throw recoveryFailure((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题恢复日志损坏'):'主题恢复日志损坏'), error); }
            if (!log || log.version !== 1 || typeof log.id !== 'string' || !['apply', 'rollback'].includes(log.phase) ||
                !validDescription(log.before) || !validDescription(log.target)) throw recoveryFailure((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题恢复日志格式不受支持'):'主题恢复日志格式不受支持'));
            return log;
        }
        function assertOwned(log) {
            const raw = ops.get(JOURNAL_KEY);
            if (!raw || parseJournal(raw).id !== log.id) throw recoveryFailure((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题恢复日志归属已变化'):'主题恢复日志归属已变化'));
        }
        function write(log, values, names) {
            names.forEach(name => {
                assertOwned(log);
                if (ops.get(KEYS[name]) !== values[name]) put(name, values[name]);
            });
        }
        function finish(log) { assertOwned(log); ops.remove(JOURNAL_KEY); }
        function recover() {
            const raw = ops.get(JOURNAL_KEY);
            if (raw === null) return false;
            const log = parseJournal(raw), current = describe(read());
            const oldJSON = current.fingerprint === log.before.fingerprint;
            const newJSON = current.fingerprint === log.target.fingerprint;
            if (!oldJSON && !newJSON) throw recoveryFailure((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题图片设置与恢复日志不匹配'):'主题图片设置与恢复日志不匹配'));
            // A theme JSON write is atomic. Its current contents decide which
            // metadata pair is available, even after an interrupted rollback.
            const target = oldJSON && newJSON ? (log.phase === 'rollback' ? log.before : log.target)
                : newJSON ? log.target : log.before;
            try { write(log, target, ['active', 'theme']); finish(log); }
            catch (error) { if (error.recoveryRequired) throw error; throw recoveryFailure((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题设置恢复未完成'):'主题设置恢复未完成'), error); }
            return true;
        }
        function commit(changes) {
            if (ops.assertWritable) ops.assertWritable();
            recover();
            if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Invalid theme settings change.');
            const before = read(), target = { ...before };
            Object.keys(changes).forEach(name => {
                if (!fields.includes(name) || changes[name] !== null && typeof changes[name] !== 'string') throw new Error('Invalid theme setting: ' + name);
                target[name] = changes[name];
            });
            if (fields.every(name => target[name] === before[name])) return target;
            const log = { version: 1, id: Date.now().toString(36) + '-' + (++sequence) + '-' + Math.random().toString(36).slice(2),
                phase: 'apply', before: describe(before), target: describe(target) };
            // Preparing this small log can fail without changing any theme key.
            try { ops.set(JOURNAL_KEY, JSON.stringify(log)); }
            catch (error) {
                const failure = new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题设置未保存：'):'主题设置未保存：') + error.message); failure.rolledBack = true; failure.cause = error; throw failure;
            }
            try {
                write(log, target, fields); finish(log); return target;
            } catch (error) {
                try {
                    assertOwned(log);
                    log.phase = 'rollback';
                    // Metadata-only changes need the decision persisted because
                    // the old and new theme JSON fingerprints are identical.
                    try { ops.set(JOURNAL_KEY, JSON.stringify(log)); } catch (_) { /* Still attempt the in-memory rollback. */ }
                    write(log, before, fields); finish(log);
                } catch (rollbackError) { throw recoveryFailure((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题保存与回滚未完成：'):'主题保存与回滚未完成：') + error.message, rollbackError); }
                const failure = new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题设置保存失败，已恢复原设置：'):'主题设置保存失败，已恢复原设置：') + error.message);
                failure.rolledBack = true; failure.cause = error; throw failure;
            }
        }
        return { read, commit, recover };
    }
    let themeUIInstalled = false;
    function installUI(identity) {
        if (themeUIInstalled) return;
        themeUIInstalled = true;
        var _origSetItem = identity.set, _origRemoveItem = identity.remove;

        'use strict';

        // ---- 常量 ----
        var STORAGE_KEY = 'lexible-custom-themes';
        var ACTIVE_KEY = 'lexible-active-custom-theme';
        var BING_ID = '__bing_daily__';
        var CUSTOM_PREFIX = 'custom_';
        var BING_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12小时
        var selectionRevision = 0;
        var themeDataRevision = 0;
        var themeStore = window.FocusThemeStorage.create({
            get: function(key) { return localStorage.getItem(key); },
            set: _origSetItem, remove: _origRemoveItem,
            assertWritable: function() {
                if (window.FocusLocalData.maintenance) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地数据维护中，请完成后刷新再修改主题。'):'本地数据维护中，请完成后刷新再修改主题。'));
            }
        });
        window.FocusThemeStore = themeStore;
        window.FocusLocalReady = Promise.resolve(window.FocusLocalReady).then(function() { themeStore.recover(); });
        window.FocusLocalReady.catch(function(error) { window.FocusLocal.notice((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题设置恢复未完成，请刷新重试：'):'主题设置恢复未完成，请刷新重试：') + error.message); });
        window.addEventListener('focus-local-maintenance', function() { selectionRevision++; themeDataRevision++; });

        function writeThemeState(update) {
            try {
                if (localStorage.getItem(window.FocusThemeStorage.JOURNAL_KEY)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('存在待恢复的主题设置，请刷新后重试。'):'存在待恢复的主题设置，请刷新后重试。'));
                return themeStore.commit(update);
            }
            catch (error) {
                var failure = new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('主题保存失败，请检查存储空间或刷新后重试：'):'主题保存失败，请检查存储空间或刷新后重试：') + error.message);
                failure.recoveryRequired = error.recoveryRequired;
                throw failure;
            }
        }

        // ---- 工具函数 ----
        function getCustomThemes() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
            catch(e) { return {}; }
        }

        function customThemesJSON(data) {
            var json = JSON.stringify(data);
            if (json.length > 2 * 1024 * 1024 && json.length >= (localStorage.getItem(STORAGE_KEY) || '').length) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('自定义主题总量已达到限制，请删除部分图片后重试。'):'自定义主题总量已达到限制，请删除部分图片后重试。'));
            return json;
        }
        function saveCustomThemes(data) {
            writeThemeState({ themes: customThemesJSON(data) });
        }

        function getActiveId() {
            return localStorage.getItem(ACTIVE_KEY) || null;
        }

        function setActiveId(id) {
            writeThemeState({ active: id || null });
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
            var restore = expectedThemeId === undefined || expectedThemeId === _savedClassicThemeId;
            findBgiElements().forEach(function(el) {
                if (restore && _savedClassicBg) {
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

        function selectClassic(id) {
            try { writeThemeState({ active: null, theme: id }); }
            catch (error) { window.FocusLocal.notice(error.message); return false; }
            selectionRevision++;
            var wasCustom = _savedClassicBg || findBgiElements().some(function(el) { return el.style.backgroundImage.indexOf('data:image/') >= 0; });
            if (wasCustom) clearCustomBackground(id);
            _lastObservedTheme = id;
            doRefreshUI();
            return true;
        }
        window.FocusThemes = { selectClassic: selectClassic, refresh: refreshThemeUI };

        // ---- 防重入标志（防止 refreshThemeUI 修改 DOM 后触发自身）----
        var _isRefreshing = false;

        // ---- 背景守护 + Theme 变化检测 ----
        var _bgWatcherId = null;
        var _lastObservedTheme = null;
        function startBackgroundWatcher() {
            if (_bgWatcherId) return;
            _lastObservedTheme = localStorage.getItem('Theme');
            _bgWatcherId = setInterval(function() {
                if (window.FocusLocalData.maintenance || localStorage.getItem(window.FocusThemeStorage.JOURNAL_KEY)) return;
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
                var timer = setTimeout(function() { reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('图片加载超时'):'图片加载超时'))); }, 20000);
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
                    } catch(e) { reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Canvas处理失败: '):'Canvas处理失败: ') + e.message)); }
                };
                img.onerror = function() {
                    clearTimeout(timer);
                    reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('图片加载失败，可能存在跨域限制'):'图片加载失败，可能存在跨域限制')));
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
                    if (idx >= apis.length) { reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('所有API端点均不可用'):'所有API端点均不可用'))); return; }
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
                                imageUrl = 'https://www.bing.com' + urlbase + '_1920x1080.jpg';
                                copyright = data.images[0].copyright || '';
                            }
                            if (imageUrl) {
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
        var _bingRequest = null;
        function loadBingWallpaper() {
            if (_bingRequest) return _bingRequest;
            _bingLoading = true;
            var dataRevision = themeDataRevision;
            refreshThemeUI();
            _bingRequest = fetchBingWallpaper().then(function(result) {
                return downloadImageAsDataUrl(result.url).then(function(dataUrl) {
                    return createThumbnail(dataUrl).then(function(thumb) {
                        return { dataUrl: dataUrl, thumbnail: thumb, copyright: result.copyright };
                    });
                });
            }).then(function(data) {
                if (dataRevision !== themeDataRevision) return null;
                var themes = getCustomThemes();
                themes[BING_ID] = {
                    name: (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Bing每日壁纸'):'Bing每日壁纸'), dataUrl: data.dataUrl,
                    thumbnail: data.thumbnail, type: 'bing',
                    updatedAt: Date.now(), copyright: data.copyright || ''
                };
                saveCustomThemes(themes);
                return data;
            }).finally(function() {
                _bingLoading = false;
                _bingRequest = null;
                refreshThemeUI();
            });
            return _bingRequest;
        }

        function activateCustomTheme(id, theme, themes) {
            var prevTheme = localStorage.getItem('Theme');
            var update = { active: id, theme: id };
            if (themes) update.themes = customThemesJSON(themes);
            writeThemeState(update);
            _lastObservedTheme = id;
            applyCustomBackground(theme.dataUrl, prevTheme);
            refreshThemeUI();
        }

        function fetchAndApplyBing() {
            var revision = ++selectionRevision;
            var cached = getCustomThemes()[BING_ID];
            if (cached && cached.dataUrl) {
                activateCustomTheme(BING_ID, cached);
                if (Date.now() - (cached.updatedAt || 0) < BING_EXPIRY_MS) return;
            }
            loadBingWallpaper().then(function(data) {
                if (data && revision === selectionRevision) activateCustomTheme(BING_ID, data);
            }).catch(function(err) {
                console.warn('[Lexible] Bing fetch failed:', err.message || err);
                if (revision === selectionRevision && !(cached && cached.dataUrl)) alert((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('获取 Bing 每日壁纸失败。\n\n'):'获取 Bing 每日壁纸失败。\n\n') + ((err && err.message) || (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('网络错误，请检查网络连接后重试。'):'网络错误，请检查网络连接后重试。')));
            });
        }

        // ---- Bing 过期自动刷新（12小时）----
        function checkBingExpiry() {
            if (window.FocusLocalData.maintenance) return;
            var activeId = getActiveId();
            if (activeId !== BING_ID) return;
            var themes = getCustomThemes();
            var bing = themes[BING_ID];
            if (!bing) return;
            if (Date.now() - (bing.updatedAt || 0) < BING_EXPIRY_MS) return;

            console.log('[Lexible] Bing wallpaper expired, auto-refreshing...');
            var revision = selectionRevision;
            loadBingWallpaper().then(function(data) {
                if (data && revision === selectionRevision && getActiveId() === BING_ID) {
                    applyCustomBackground(data.dataUrl);
                }
            }).catch(function(err) {
                console.warn('[Lexible] Bing auto-refresh failed:', err.message || err);
            });
        }

        // ---- 选择自定义主题 ----
        function selectCustomTheme(id) {
            var themes = getCustomThemes();
            if (!themes[id]) return;
            selectionRevision++;
            activateCustomTheme(id, themes[id]);
        }

        // ---- 删除自定义主题 ----
        function deleteCustomTheme(id) {
            if (!confirm((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('确定要删除此自定义主题吗？'):'确定要删除此自定义主题吗？'))) return;
            var themes = getCustomThemes();
            delete themes[id];
            if (getActiveId() === id) {
                writeThemeState({ themes: customThemesJSON(themes), active: null, theme: 'Leaf' });
                selectionRevision++;
                var table = findThemeTable();
                var leaf = table && table.querySelector('img[src="img/timer-bg-leaf-shortcut.jpg"]');
                // Use the legacy selection event as well as storage, so its
                // cached classic theme and timer background also return to Leaf.
                if (leaf) leaf.click();
                else {
                    writeThemeState({ active: null, theme: 'Leaf' });
                    clearCustomBackground('Leaf');
                }
            } else saveCustomThemes(themes);
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
            var title = settingsRoot.querySelector('[class*="AppearanceSettings-title"][class*="AppearanceSettings-theme"]');
            var table = title && title.nextElementSibling;
            while (table && table.tagName !== 'TABLE') table = table.nextElementSibling;
            return table || null;
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
                label.textContent = (name && name.length > 10) ? name.substring(0, 8) + '...' : (name || (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('自定义'):'自定义'));
                td.appendChild(label);

                var delBtn = document.createElement('span');
                delBtn.textContent = '×';
                delBtn.title = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('删除此主题'):'删除此主题');
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
                    alert((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('图片文件过大，请选择小于 10MB 的图片。'):'图片文件过大，请选择小于 10MB 的图片。'));
                    e.target.value = '';
                    return;
                }
                var revision = ++selectionRevision;
                var reader = new FileReader();
                reader.onload = function(evt) {
                    var rawDataUrl = evt.target.result;
                    createThumbnail(rawDataUrl).then(function(thumb) {
                        // 对原图进行压缩（最大 1920x1080）
                        return downloadImageAsDataUrl(rawDataUrl).then(function(compressed) {
                            return { dataUrl: compressed, thumbnail: thumb };
                        }).catch(function() {
                            throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('图片压缩失败，未保存原始大图。请更换图片。'):'图片压缩失败，未保存原始大图。请更换图片。'));
                        });
                    }).then(function(result) {
                        var id = genId();
                        var themes = getCustomThemes();
                        themes[id] = {
                            name: file.name, dataUrl: result.dataUrl,
                            thumbnail: result.thumbnail, type: 'custom',
                            createdAt: Date.now(), originalName: file.name
                        };
                        if (revision === selectionRevision) activateCustomTheme(id, result, themes);
                        else saveCustomThemes(themes);
                        refreshThemeUI();
                    }).catch(function(err) {
                        console.error('[Lexible] Upload failed:', err);
                        alert((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('上传失败: '):'上传失败: ') + (err.message || (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('未知错误'):'未知错误')));
                    });
                };
                reader.onerror = function() {
                    alert((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('文件读取失败，请重试。'):'文件读取失败，请重试。'));
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
            if (localStorage.getItem(window.FocusThemeStorage.JOURNAL_KEY)) return;
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
            bingTd.setAttribute('data-theme-id', BING_ID);
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
            bingLabel.textContent = _bingLoading ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('下载中...'):'下载中...') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Bing 每日'):'Bing 每日');
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
            txt.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地上传'):'本地上传');
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

        window.FocusLocalReady.then(function() {
            if (document.body) start();
            else document.addEventListener('DOMContentLoaded', start);
        }).catch(function() {});
    }

    return { installUI, JOURNAL_KEY, KEYS, create };
});
