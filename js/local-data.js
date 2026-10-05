/* Durable local database / backup boundary. Lexible, 2026-10-03. */
(function (root) {
    'use strict';
    const DB_NAME = 'PomodoroDB6', DB_VERSION = 3;
    const BASE = ['Project', 'Task', 'Subtask', 'Pomodoro', 'Schedule', 'Group', 'GroupUser', 'Message'];
    const DATA = BASE.concat('TimerSession');
    const ALL = DATA.concat('LocalMeta');
    const keys = { Group: 'groupId', Message: 'messageId' };
    const indexes = {
        Project: ['state', 'sync', 'parentId'], Task: ['projectId', 'deadline', 'reminderDate', 'finishedDate', 'sync'],
        Subtask: ['taskId', 'sync', 'finishedDate'], Pomodoro: ['taskId', 'subtaskId', 'endDate', 'sync'],
        Schedule: ['taskId', 'subtaskId', 'endDate', 'sync'], Group: ['groupLeader', 'createdDate', 'secret', 'membersNum'],
        GroupUser: ['groupId', 'uuid', 'sync', 'name', 'todayPomodoroTime', 'weekPomodoroTime', 'focusEndDate'],
        Message: ['groupId', 'userId', 'state', 'sync', 'creationDate', 'replyUserId', 'replyMessageId', 'parentId', 'username']
    };
    const rawSet = Storage.prototype.setItem.bind(localStorage);
    const rawRemove = Storage.prototype.removeItem.bind(localStorage);
    const nativeTransaction = IDBDatabase.prototype.transaction;
    let dbPromise, tail = Promise.resolve(), maintenance = false;
    // Same preset IDs/types/default visibility as the legacy ProjectManager.
    // Keep navigation rows inside the reset transaction instead of relying on
    // the settings Version flag to rerun a legacy migration after reload.
    function defaultProjects(now = Date.now()) {
        return [
            ['id-task-search', 'PRJ_SEARCH', 7002, 0, -2100],
            ['id-deadline-today', 'PRJ_TODAY', 4000, 0, -2090],
            ['id-deadline-overdue', 'PRJ_DEADLINE_OVERDUE', 4006, 1, -2085, 1],
            ['id-deadline-tomorrow', 'PRJ_TOMORROW', 4001, 0, -2080],
            ['id-deadline-week', 'PRJ_DEADLINE_WEEK', 4007, 1, -2078],
            ['id-deadline-last7days', 'PRJ_DEADLINE_LAST7DAYS', 4004, 1, -2076, 1],
            ['id-priority-high', 'PRJ_PRIORITY_HIGH', 5003, 0, -2074, 1],
            ['id-priority-medium', 'PRJ_PRIORITY_MEDIUM', 5002, 0, -2073, 1],
            ['id-priority-low', 'PRJ_PRIORITY_LOW', 5001, 0, -2072, 1],
            ['id-deadline-upcoming', 'PRJ_UPCOMING', 4002, 1, -2070],
            ['id-task-all', 'PRJ_ALL', 7000, 0, -2065, 1],
            ['id-deadline-someday', 'PRJ_SOMEDAY', 4003, 0, -2060, 1],
            ['id-task-schedule', 'PRJ_SCHEDULE', 7001, 3, -1090],
            ['id-task-history', 'PRJ_HISTORY', 7003, 3, -1080],
            ['id-task-tasks', 'PRJ_TASKS', 7005, 3, -1000]
        ].map(([id, name, type, orderingRule, order, state = 0]) => ({
            id, name, type, orderingRule, order, state, objType: 'PROJECT', creationDate: now,
            color: type === 7005 ? '4670F6' : 'AEBDC3', isDefault: false, parentId: '',
            imageName: '', expanded: true, sync: 1
        }));
    }
    async function ensureSystemProjects(db) {
        await transaction(db, ['Project'], 'readwrite', tx => {
            const store = tx.objectStore('Project'), request = store.getAll();
            request.onsuccess = () => {
                // Preserve custom lists and the user's existing visibility/order.
                const rows = request.result;
                defaultProjects().forEach(row => {
                    if (!rows.some(existing => existing.id === row.id || existing.type === row.type)) store.add(row);
                });
            };
        });
    }
    function notify(text) { root.dispatchEvent(new CustomEvent('focus-local-notice', { detail: text })); }
    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                ALL.forEach(name => {
                    const store = db.objectStoreNames.contains(name) ? request.transaction.objectStore(name) : db.createObjectStore(name, { keyPath: keys[name] || 'id' });
                    (indexes[name] || []).forEach(key => { if (!store.indexNames.contains(key)) store.createIndex(key, key, { unique: false }); });
                });
            };
            request.onsuccess = () => {
                const db = request.result;
                // Legacy managers still use db.transaction directly. Include the maintenance
                // marker in every legacy write so import/reset also excludes those writers.
                db.transaction = function(names, mode, options) {
                    if (mode !== 'readwrite') return nativeTransaction.call(db, names, mode, options);
                    if (maintenance) throw new Error('本地数据维护中，请等待完成后刷新。');
                    const scope = typeof names === 'string' ? [names] : Array.from(names);
                    if (!scope.includes('LocalMeta')) scope.push('LocalMeta');
                    const tx = nativeTransaction.call(db, scope, mode, options);
                    const check = tx.objectStore('LocalMeta').get('maintenance');
                    check.onsuccess = () => { if (check.result) { tx.abort(); notify('数据正在另一标签页维护，写入已取消，请刷新。'); } };
                    return tx;
                };
                db.onversionchange = () => { db.close(); dbPromise = null; maintenance = true; notify('数据库已更新，请刷新本标签页后继续。'); };
                resolve(db);
            };
            request.onerror = () => { dbPromise = null; reject(request.error); };
            request.onblocked = () => notify('数据库升级等待中：请关闭其他旧版本专注清单标签页。数据会保留。');
        });
        return dbPromise;
    }
    function exclusive(fn) {
        const run = () => navigator.locks ? navigator.locks.request('focustodo-local-write', fn) : fn();
        const result = tail.then(run, run);
        tail = result.catch(() => {});
        return result;
    }
    function transaction(db, names, mode, body) {
        return new Promise((resolve, reject) => {
            let tx, result, failure;
            try {
                tx = nativeTransaction.call(db, names, mode);
                tx.oncomplete = () => resolve(result);
                tx.onabort = () => reject(failure || tx.error || new Error('数据库事务已取消。'));
                tx.onerror = () => { failure = tx.error || failure; };
                body(tx, value => { result = value; }, error => { failure = error; tx.abort(); });
            } catch (error) { if (tx) { try { tx.abort(); } catch (_) {} } reject(error); }
        });
    }
    function storageSnapshot() {
        const result = Object.create(null);
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key !== 'setItem' && key !== 'removeItem') result[key] = localStorage.getItem(key);
        }
        return result;
    }
    function applySettings(data) {
        const old = storageSnapshot();
        Object.keys(old).forEach(rawRemove);
        try { Object.keys(data).forEach(key => rawSet(key, data[key])); }
        catch (error) {
            Object.keys(storageSnapshot()).forEach(rawRemove);
            Object.keys(old).forEach(key => rawSet(key, old[key]));
            throw error;
        }
    }
    async function snapshotUnlocked() {
        const db = await open();
        const indexedDBData = await transaction(db, DATA, 'readonly', (tx, done) => {
            const result = {}; let remaining = DATA.length;
            DATA.forEach(name => {
                const request = tx.objectStore(name).getAll();
                request.onsuccess = () => { result[name] = request.result; if (!--remaining) done(result); };
            });
        });
        return {
            meta: { app: 'FocusTodo', exportVersion: 2, exportDate: new Date().toISOString(), dbName: DB_NAME, dbVersion: DB_VERSION, patch: root.FocusRelease.version },
            indexedDB: indexedDBData, localStorage: storageSnapshot()
        };
    }
    function download(data, prefix) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = prefix + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        a.addEventListener('click', event => event.stopPropagation());
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    function validate(input) {
        if (!input || typeof input !== 'object' || !input.meta || input.meta.app !== 'FocusTodo' ||
            ![1, 2].includes(input.meta.exportVersion) || !input.indexedDB || !input.localStorage || Array.isArray(input.localStorage)) {
            throw new Error('不是受支持的 FocusTodo 完整备份。仅设置备份不能覆盖数据库。');
        }
        if (Number(input.meta.dbVersion) > DB_VERSION) throw new Error('备份来自较新的数据库版本，请先更新程序。');
        const data = JSON.parse(JSON.stringify(input));
        BASE.forEach(name => {
            const records = data.indexedDB[name];
            if (!Array.isArray(records)) throw new Error('备份缺少数据表：' + name);
            const seen = new Set(), key = keys[name] || 'id';
            records.forEach(record => {
                if (!record || typeof record[key] !== 'string' || !record[key] || seen.has(record[key])) throw new Error(name + ' 存在无效或重复 ID。');
                seen.add(record[key]);
                if (name === 'Pomodoro' && (!Number.isFinite(record.endDate) || !Number.isFinite(record.interval) ||
                    record.interval <= 0 || record.interval > 28800 || !Number.isFinite(record.pomodoroInterval) || record.pomodoroInterval <= 0 || record.pomodoroInterval > 28800)) {
                    throw new Error('专注记录包含无效时长或日期：' + record[key]);
                }
            });
        });
        Object.keys(data.localStorage).forEach(key => {
            if (['__proto__', 'constructor', 'prototype', 'setItem', 'removeItem'].includes(key) || typeof data.localStorage[key] !== 'string') throw new Error('备份包含无效设置：' + key);
        });
        // Preserve unfinished work without counting time after the backup was taken.
        const sessions = data.indexedDB.TimerSession || [];
        if (!Array.isArray(sessions) || sessions.length > 1) throw new Error('无效计时会话备份。');
        sessions.forEach(s => {
            if (!s || s.id !== 'active' || typeof s.sessionId !== 'string' || !s.sessionId ||
                !['initial', 'work', 'pause', 'rest', 'waitingForRest', 'recovery'].includes(s.state) ||
                !['countup', 'countdown'].includes(s.mode) || !s.config ||
                root.FocusTimerCore.settings(s.config).interval !== s.config.interval || !Array.isArray(s.spans) ||
                !['cursorAt', 'observedAt', 'phaseElapsed', 'totalSeconds', 'recordedSeconds', 'revision', 'sequence', 'blockSequence', 'completed'].every(key => Number.isFinite(s[key]) && s[key] >= 0)) {
                throw new Error('计时会话字段无效。');
            }
            let end = 0;
            s.spans.forEach(span => {
                if (!Number.isFinite(span.start) || !Number.isFinite(span.end) || span.start < end || span.end < span.start) throw new Error('计时会话包含无效专注区间。');
                end = span.end;
            });
            if (s.state === 'work' || s.state === 'rest') {
                const exportAt = Date.parse(data.meta.exportDate);
                if (!Number.isFinite(exportAt) || exportAt < s.cursorAt) throw new Error('计时快照与导出日期不一致。');
                s.pendingRecovery = { from: s.cursorAt, to: exportAt, priorState: s.state, detectedAt: exportAt, source: 'import' };
                s.state = 'recovery';
            } else if (s.state === 'recovery') {
                const p = s.pendingRecovery;
                if (!p || !Number.isFinite(p.from) || !Number.isFinite(p.to) || p.to < p.from || !['work', 'rest'].includes(p.priorState)) throw new Error('无效的待确认区间。');
                p.source = 'import';
            }
        });
        data.indexedDB.TimerSession = sessions;
        data.localStorage.Version = '6.5';
        data.localStorage.ExpiredDate = '0';
        data.localStorage.timingTaskId = '';
        data.localStorage.timingSubtaskId = '';
        for (const key of ['WorkInterval', 'ShortBreakInterval', 'LongBreakInterval']) {
            if (key in data.localStorage && (!Number.isFinite(Number(data.localStorage[key])) || Number(data.localStorage[key]) < 1 || Number(data.localStorage[key]) > 28800)) throw new Error('无效计时设置：' + key);
        }
        return data;
    }
    async function replaceRows(db, dataset, journal) {
        return transaction(db, ALL, 'readwrite', (tx, done) => {
            DATA.forEach(name => {
                const store = tx.objectStore(name); store.clear();
                (dataset.indexedDB[name] || []).forEach(row => store.add(row));
            });
            tx.objectStore('LocalMeta').clear();
            if (journal) tx.objectStore('LocalMeta').put(journal);
            if (maintenance) tx.objectStore('LocalMeta').put({ id: 'maintenance', startedAt: Date.now() });
            done();
        });
    }
    async function finishJournal(db, journal) {
        try { applySettings(journal.target); }
        catch (error) {
            await replaceRows(db, journal.backup, null);
            applySettings(journal.backup.localStorage);
            const failure = new Error('设置恢复失败，数据库与设置已回滚：' + error.message);
            failure.rolledBack = true;
            throw failure;
        }
        await transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').delete('settings-journal'));
    }
    async function recoverJournal() {
        const db = await open();
        const journal = await transaction(db, ['LocalMeta'], 'readonly', (tx, done) => {
            const req = tx.objectStore('LocalMeta').get('settings-journal'); req.onsuccess = () => done(req.result);
        });
        if (journal) {
            try { await finishJournal(db, journal); }
            catch (error) { if (!error.rolledBack) throw error; notify(error.message); }
        }
        await transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').delete('maintenance'));
        await ensureSystemProjects(db);
    }
    async function replace(input, options) {
        const target = validate(input); options = options || {};
        return exclusive(async () => {
            if (maintenance) throw new Error('数据维护正在进行，请稍后重试。');
            maintenance = true;
            root.dispatchEvent(new Event('focus-local-maintenance'));
            broadcast('maintenance');
            let succeeded = false;
            try {
                const db = await open();
                await transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').put({ id: 'maintenance', startedAt: Date.now() }));
                const backup = await snapshotUnlocked();
                if (options.backup !== false) download(backup, 'FocusTodo-pre-import-backup');
                const journal = { id: 'settings-journal', target: target.localStorage, backup };
                await replaceRows(db, target, journal);
                await finishJournal(db, journal);
                succeeded = true;
                broadcast('replaced');
                return backup;
            } finally {
                const db = await open();
                await transaction(db, ['LocalMeta'], 'readwrite', tx => tx.objectStore('LocalMeta').delete('maintenance'));
                maintenance = false;
                root.dispatchEvent(new CustomEvent('focus-local-maintenance-end', { detail: { succeeded } }));
                if (!succeeded) broadcast('maintenance-failed');
            }
        });
    }
    async function reset() {
        const empty = { meta: { app: 'FocusTodo', exportVersion: 2, dbVersion: 3 }, indexedDB: {}, localStorage: {} };
        BASE.forEach(name => { empty.indexedDB[name] = []; });
        empty.indexedDB.Project = defaultProjects();
        ['ServerAccessInfo', 'ServerUrls', 'app_language', 'PK1', 'OverseaServerUrl', 'RegionCode'].forEach(key => {
            const value = localStorage.getItem(key); if (value !== null) empty.localStorage[key] = value;
        });
        empty.localStorage['cookie.ACCT'] = btoa('local@local');
        empty.localStorage['cookie.NAME'] = btoa(unescape(encodeURIComponent('本地用户')));
        empty.localStorage['cookie.PID'] = 'local-' + crypto.randomUUID();
        empty.localStorage['cookie.UID'] = 'local-' + crypto.randomUUID();
        empty.localStorage.Portrait = 'img/header-portrait.png';
        return replace(empty, { backup: true });
    }
    async function timerAction(action, now) {
        return exclusive(async () => {
            if (maintenance) throw new Error('数据维护中，计时操作尚未保存。');
            const db = await open();
            const result = await transaction(db, ['TimerSession', 'Pomodoro', 'LocalMeta'], 'readwrite', (tx, done, fail) => {
                const journal = tx.objectStore('LocalMeta').get('settings-journal');
                journal.onsuccess = () => {
                    if (journal.result) { fail(new Error('存在待恢复的数据导入，请刷新页面。')); return; }
                    const request = tx.objectStore('TimerSession').get('active');
                    request.onsuccess = () => {
                        try {
                            const result = root.FocusTimerCore.reduce(request.result, action, now);
                            result.records.forEach(record => tx.objectStore('Pomodoro').add(record));
                            tx.objectStore('TimerSession').put(result.session); done(result);
                        } catch (error) { fail(error); }
                    };
                };
            });
            broadcast('timer', result.records); return result;
        });
    }
    async function session() {
        const db = await open();
        return transaction(db, ['TimerSession'], 'readonly', (tx, done) => {
            const req = tx.objectStore('TimerSession').get('active'); req.onsuccess = () => done(req.result || null);
        });
    }
    async function putPomodoro(record) {
        return exclusive(async () => {
            if (maintenance) throw new Error('数据维护中，无法保存专注记录。');
            const db = await open();
            return transaction(db, ['Pomodoro'], 'readwrite', (tx, done) => { tx.objectStore('Pomodoro').put(record); done(record); });
        });
    }
    let channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('focustodo-local') : null;
    function broadcast(type, records) { if (channel) channel.postMessage({ type, records: records || [] }); }
    if (channel) channel.onmessage = event => {
        if (event.data.type === 'maintenance') { maintenance = true; root.dispatchEvent(new Event('focus-local-maintenance')); }
        else if (event.data.type === 'maintenance-failed') { maintenance = false; root.dispatchEvent(new CustomEvent('focus-local-maintenance-end', { detail: { succeeded: false } })); }
        else if (event.data.type === 'replaced') { maintenance = true; root.dispatchEvent(new Event('focus-local-maintenance')); notify('数据已在另一个标签页更新，请刷新本页。'); }
        else root.dispatchEvent(new CustomEvent('focus-local-timer-changed', { detail: { records: event.data.records || [] } }));
    };
    root.FocusLocalData = { DB_NAME, DB_VERSION, BASE, DATA, ALL, open, transaction, exclusive, timerAction, session,
        snapshot: () => exclusive(snapshotUnlocked), download, validate, replace, reset, putPomodoro,
        storageSnapshot, applySettings, rawSet, rawRemove, recoverJournal, notify,
        get maintenance() { return maintenance; } };
    root.FocusLocalReady = exclusive(recoverJournal);
    root.FocusLocalReady.catch(error => { notify('本地数据初始化失败：' + error.message); console.error(error); });
})(window);
