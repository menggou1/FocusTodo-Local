/* Durable local database / backup boundary. Lexible, 2026-10-03. */
(function (root) {
    'use strict';
    const DB_NAME = 'PomodoroDB6', DB_VERSION = 3;
    const LOCK_DB_NAME = DB_NAME + '-maintenance-lock';
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
    let dbPromise, lockPromise, tail = Promise.resolve(), maintenance = false;
    let localOperation = null, remoteOperation = null, invalidated = false, initializing = true;
    const ownerId = crypto.randomUUID();
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
                    if (maintenance) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地数据维护中，请等待完成后刷新。'):'本地数据维护中，请等待完成后刷新。'));
                    const scope = typeof names === 'string' ? [names] : Array.from(names);
                    if (!scope.includes('LocalMeta')) scope.push('LocalMeta');
                    const tx = nativeTransaction.call(db, scope, mode, options);
                    const meta = tx.objectStore('LocalMeta');
                    ['maintenance', 'settings-journal'].forEach(id => {
                        const check = meta.get(id);
                        check.onsuccess = () => { if (check.result) { try { tx.abort(); } catch (_) {} notify((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据正在另一标签页维护，写入已取消，请刷新。'):'数据正在另一标签页维护，写入已取消，请刷新。')); } };
                    });
                    return tx;
                };
                db.onversionchange = () => { db.close(); dbPromise = null; maintenance = true; notify((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据库已更新，请刷新本标签页后继续。'):'数据库已更新，请刷新本标签页后继续。')); };
                resolve(db);
            };
            request.onerror = () => { dbPromise = null; reject(request.error); };
            request.onblocked = () => notify((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据库升级等待中：请关闭其他旧版本专注清单标签页。数据会保留。'):'数据库升级等待中：请关闭其他旧版本专注清单标签页。数据会保留。'));
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
                tx.onabort = () => reject(failure || tx.error || new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据库事务已取消。'):'数据库事务已取消。')));
                tx.onerror = () => { failure = tx.error || failure; };
                body(tx, value => { result = value; }, error => { failure = error; tx.abort(); });
            } catch (error) { if (tx) { try { tx.abort(); } catch (_) {} } reject(error); }
        });
    }
    // A live readwrite transaction is the fallback ownership primitive. It is in
    // a separate database so its lifetime can cover the main database journal
    // and synchronous localStorage updates. Closing/crashing the owner releases
    // it automatically; a suspended owner keeps it. No heartbeat timeout can
    // authorize stealing an active operation.
    function openMaintenanceLock() {
        if (!lockPromise) lockPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(LOCK_DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore('ownership');
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => { db.close(); lockPromise = null; };
                resolve(db);
            };
            request.onerror = () => { lockPromise = null; reject(request.error); };
        });
        return lockPromise;
    }
    async function maintenanceLock(body) {
        const db = await openMaintenanceLock();
        return new Promise((resolve, reject) => {
            const tx = nativeTransaction.call(db, ['ownership'], 'readwrite');
            let active = true, started = false, released = false, result, failure;
            const lease = { assert() { if (!active) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据维护事务锁已失效，请刷新后恢复。'):'数据维护事务锁已失效，请刷新后恢复。')); } };
            tx.onabort = () => { active = false; reject(tx.error || new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据维护事务锁已取消。'):'数据维护事务锁已取消。'))); };
            tx.onerror = () => {};
            tx.oncomplete = () => {
                active = false;
                if (!released) reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据维护事务锁意外结束，请刷新后恢复。'):'数据维护事务锁意外结束，请刷新后恢复。')));
                else if (failure) reject(failure);
                else resolve(result);
            };
            function hold() {
                const request = tx.objectStore('ownership').get('active');
                request.onsuccess = () => {
                    if (!released) hold();
                    if (!started) {
                        started = true;
                        Promise.resolve().then(() => body(lease)).then(value => { result = value; released = true; }, error => { failure = error; released = true; });
                    }
                };
            }
            hold();
        });
    }
    function sameOperation(marker, operation) {
        return marker && marker.operationId === operation.operationId && marker.ownerId === operation.ownerId;
    }
    function ownedTransaction(db, operation, names, body) {
        operation.lease.assert();
        const scope = Array.from(new Set(names.concat('LocalMeta')));
        return transaction(db, scope, 'readwrite', (tx, done, fail) => {
            const request = tx.objectStore('LocalMeta').get('maintenance');
            request.onsuccess = () => {
                try {
                    operation.lease.assert();
                    if (!sameOperation(request.result, operation)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据维护归属已变化，请刷新后恢复。'):'数据维护归属已变化，请刷新后恢复。'));
                    body(tx, done, fail, request.result);
                } catch (error) { fail(error); }
            };
        });
    }
    function journalOwned(journal, operation) {
        if (!sameOperation(journal, operation)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据恢复日志与维护归属不一致，请保留当前数据库。'):'数据恢复日志与维护归属不一致，请保留当前数据库。'));
    }
    function storageSnapshot() {
        const result = Object.create(null);
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key !== 'setItem' && key !== 'removeItem' && key !== 'FocusTodo.themeJournal') result[key] = localStorage.getItem(key);
        }
        return result;
    }
    function applySettings(data) {
        const old = storageSnapshot();
        try {
            rawRemove('FocusTodo.themeJournal');
            Object.keys(old).forEach(rawRemove);
            Object.keys(data).forEach(key => rawSet(key, data[key]));
        } catch (error) {
            try {
                Object.keys(storageSnapshot()).forEach(rawRemove);
                Object.keys(old).forEach(key => rawSet(key, old[key]));
            } catch (rollbackError) {
                throw new Error(error.message + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('；设置回滚待重试：'):'；设置回滚待重试：') + rollbackError.message);
            }
            throw error;
        }
    }
    async function snapshotUnlocked(operation) {
        if (root.FocusThemeStore) root.FocusThemeStore.recover();
        const db = await open();
        const indexedDBData = await transaction(db, DATA.concat('LocalMeta'), 'readonly', (tx, done, fail) => {
            const result = {}; let remaining = DATA.length;
            ['maintenance', 'settings-journal'].forEach(id => {
                const check = tx.objectStore('LocalMeta').get(id);
                check.onsuccess = () => { if (check.result && (!operation || !sameOperation(check.result, operation))) fail(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('存在进行中或待恢复的数据维护，请等待或刷新。'):'存在进行中或待恢复的数据维护，请等待或刷新。'))); };
            });
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
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = prefix + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        a.addEventListener('click', event => event.stopPropagation());
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    function validate(input) {
        if (!input || typeof input !== 'object' || !input.meta || input.meta.app !== 'FocusTodo' ||
            ![1, 2].includes(input.meta.exportVersion) || !input.indexedDB || !input.localStorage || Array.isArray(input.localStorage)) {
            throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('不是受支持的 FocusTodo 完整备份。仅设置备份不能覆盖数据库。'):'不是受支持的 FocusTodo 完整备份。仅设置备份不能覆盖数据库。'));
        }
        if (input.meta.scope !== undefined && !['full', 'without-wallpapers'].includes(input.meta.scope)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份范围标记不受支持。'):'备份范围标记不受支持。'));
        if (root.FocusLocalBackup) root.FocusLocalBackup.validateScope(input);
        if (Number(input.meta.dbVersion) > DB_VERSION) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份来自较新的数据库版本，请先更新程序。'):'备份来自较新的数据库版本，请先更新程序。'));
        const data = JSON.parse(JSON.stringify(input));
        delete data.localStorage['FocusTodo.themeJournal'];
        BASE.forEach(name => {
            const records = data.indexedDB[name];
            if (!Array.isArray(records)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份缺少数据表：'):'备份缺少数据表：') + name);
            const seen = new Set(), key = keys[name] || 'id';
            records.forEach(record => {
                if (!record || typeof record[key] !== 'string' || !record[key] || seen.has(record[key])) throw new Error(name + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 存在无效或重复 ID。'):' 存在无效或重复 ID。'));
                seen.add(record[key]);
                if (name === 'Pomodoro' && (!Number.isFinite(record.endDate) || !Number.isFinite(record.interval) ||
                    record.interval <= 0 || record.interval > 28800 || !Number.isFinite(record.pomodoroInterval) || record.pomodoroInterval <= 0 || record.pomodoroInterval > 28800)) {
                    throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('专注记录包含无效时长或日期：'):'专注记录包含无效时长或日期：') + record[key]);
                }
            });
        });
        Object.keys(data.localStorage).forEach(key => {
            if (['__proto__', 'constructor', 'prototype', 'setItem', 'removeItem'].includes(key) || typeof data.localStorage[key] !== 'string') throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('备份包含无效设置：'):'备份包含无效设置：') + key);
        });
        // Preserve unfinished work without counting time after the backup was taken.
        const sessions = data.indexedDB.TimerSession || [];
        if (!Array.isArray(sessions) || sessions.length > 1) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('无效计时会话备份。'):'无效计时会话备份。'));
        sessions.forEach(s => {
            if (!s || s.id !== 'active' || typeof s.sessionId !== 'string' || !s.sessionId ||
                !['initial', 'work', 'pause', 'rest', 'waitingForRest', 'recovery'].includes(s.state) ||
                !['countup', 'countdown'].includes(s.mode) || !s.config ||
                root.FocusTimerCore.settings(s.config).interval !== s.config.interval || !Array.isArray(s.spans) ||
                !['cursorAt', 'observedAt', 'phaseElapsed', 'totalSeconds', 'recordedSeconds', 'revision', 'sequence', 'blockSequence', 'completed'].every(key => Number.isFinite(s[key]) && s[key] >= 0)) {
                throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('计时会话字段无效。'):'计时会话字段无效。'));
            }
            let end = 0;
            s.spans.forEach(span => {
                if (!Number.isFinite(span.start) || !Number.isFinite(span.end) || span.start < end || span.end < span.start) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('计时会话包含无效专注区间。'):'计时会话包含无效专注区间。'));
                end = span.end;
            });
            if (s.state === 'work' || s.state === 'rest') {
                const exportAt = Date.parse(data.meta.exportDate);
                if (!Number.isFinite(exportAt) || exportAt < s.cursorAt) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('计时快照与导出日期不一致。'):'计时快照与导出日期不一致。'));
                s.pendingRecovery = { from: s.cursorAt, to: exportAt, priorState: s.state, detectedAt: exportAt, source: 'import' };
                s.state = 'recovery';
            } else if (s.state === 'recovery') {
                const p = s.pendingRecovery;
                if (!p || !Number.isFinite(p.from) || !Number.isFinite(p.to) || p.to < p.from || !['work', 'rest'].includes(p.priorState)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('无效的待确认区间。'):'无效的待确认区间。'));
                p.source = 'import';
            }
        });
        data.indexedDB.TimerSession = sessions;
        data.localStorage.Version = '6.5';
        data.localStorage.ExpiredDate = '0';
        data.localStorage.timingTaskId = '';
        data.localStorage.timingSubtaskId = '';
        for (const key of ['WorkInterval', 'ShortBreakInterval', 'LongBreakInterval']) {
            if (key in data.localStorage && (!Number.isFinite(Number(data.localStorage[key])) || Number(data.localStorage[key]) < 1 || Number(data.localStorage[key]) > 28800)) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('无效计时设置：'):'无效计时设置：') + key);
        }
        return data;
    }
    async function replaceRows(db, dataset, journal, operation, phase) {
        journalOwned(journal, operation);
        return ownedTransaction(db, operation, ALL, (tx, done, fail, marker) => {
            DATA.forEach(name => {
                const store = tx.objectStore(name); store.clear();
                (dataset.indexedDB[name] || []).forEach(row => store.add(row));
            });
            // Do not clear unrelated metadata or overwrite another operation's log.
            const meta = tx.objectStore('LocalMeta'), request = meta.get('settings-journal');
            request.onsuccess = () => {
                try {
                    if (request.result) journalOwned(request.result, operation);
                    meta.put({ ...journal, phase });
                    meta.put({ ...marker, phase });
                    done();
                } catch (error) { fail(error); }
            };
        });
    }
    async function clearOperation(db, operation, allowJournal) {
        return ownedTransaction(db, operation, ['LocalMeta'], (tx, done, fail) => {
            const meta = tx.objectStore('LocalMeta'), request = meta.get('settings-journal');
            request.onsuccess = () => {
                try {
                    if (request.result) {
                        journalOwned(request.result, operation);
                        if (!allowJournal) { done(false); return; }
                        meta.delete('settings-journal');
                    }
                    meta.delete('maintenance'); done(true);
                } catch (error) { fail(error); }
            };
        });
    }
    async function finishJournal(db, journal, operation) {
        journalOwned(journal, operation);
        operation.lease.assert();
        if (journal.phase === 'rollback') {
            applySettings(journal.backup.localStorage);
            await clearOperation(db, operation, true);
            return;
        }
        try { applySettings(journal.target); }
        catch (error) {
            // Persist the rollback decision with the original rows. A crash or a
            // second settings failure must resume rollback, never replay target.
            await replaceRows(db, journal.backup, journal, operation, 'rollback');
            operation.lease.assert();
            try { applySettings(journal.backup.localStorage); }
            catch (rollbackError) { throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('设置恢复与回滚未完成，请刷新重试；恢复日志已保留：'):'设置恢复与回滚未完成，请刷新重试；恢复日志已保留：') + rollbackError.message); }
            await clearOperation(db, operation, true);
            const failure = new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('设置恢复失败，数据库与设置已回滚：'):'设置恢复失败，数据库与设置已回滚：') + error.message);
            failure.rolledBack = true;
            throw failure;
        }
        await clearOperation(db, operation, true);
    }
    async function recoverLocked(db, lease) {
        // Reaching this transaction proves that the previous lock transaction
        // ended. A marker here is orphaned, even if its timestamp is recent.
        const recovered = await transaction(db, ['LocalMeta'], 'readwrite', (tx, done, fail) => {
            const meta = tx.objectStore('LocalMeta'), markerRequest = meta.get('maintenance'), journalRequest = meta.get('settings-journal');
            let remaining = 2;
            function inspect() {
                if (--remaining) return;
                try {
                    lease.assert();
                    const marker = markerRequest.result, journal = journalRequest.result;
                    if (!marker && !journal) { done(null); return; }
                    if (!journal) { meta.delete('maintenance'); done(null); return; }
                    if (journal.operationId && (!marker || !sameOperation(marker, journal))) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据恢复日志归属冲突，请保留当前数据库。'):'数据恢复日志归属冲突，请保留当前数据库。'));
                    const operation = { operationId: journal.operationId || crypto.randomUUID(), ownerId, lease };
                    const phase = journal.phase === 'rollback' ? 'rollback' : 'settings';
                    const adopted = { ...journal, operationId: operation.operationId, ownerId, phase };
                    meta.put({ id: 'maintenance', operationId: operation.operationId, ownerId, phase, startedAt: marker && marker.startedAt || Date.now(), recoveredAt: Date.now() });
                    meta.put(adopted);
                    done({ operation, journal: adopted });
                } catch (error) { fail(error); }
            }
            markerRequest.onsuccess = journalRequest.onsuccess = inspect;
        });
        if (recovered) {
            try { await finishJournal(db, recovered.journal, recovered.operation); }
            catch (error) { if (!error.rolledBack) throw error; notify(error.message); }
        }
    }
    async function recoverJournal() {
        return maintenanceLock(async lease => {
            const db = await open();
            await recoverLocked(db, lease);
            await ensureSystemProjects(db);
            maintenance = false; remoteOperation = null; invalidated = false; initializing = false;
        });
    }
    async function replace(input, options) {
        const target = validate(input); options = options || {};
        return exclusive(() => maintenanceLock(async lease => {
            if (localOperation || invalidated) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本页数据已变化，请刷新后重试。'):'本页数据已变化，请刷新后重试。'));
            const db = await open();
            await recoverLocked(db, lease);
            const operation = { operationId: crypto.randomUUID(), ownerId, lease };
            await transaction(db, ['LocalMeta'], 'readwrite', (tx, done, fail) => {
                const meta = tx.objectStore('LocalMeta'), request = meta.getAll();
                request.onsuccess = () => {
                    if (request.result.some(row => ['maintenance', 'settings-journal'].includes(row.id))) { fail(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('存在待恢复的数据维护，请刷新。'):'存在待恢复的数据维护，请刷新。'))); return; }
                    meta.put({ id: 'maintenance', operationId: operation.operationId, ownerId, phase: 'snapshot', startedAt: Date.now() });
                };
            });
            localOperation = operation; maintenance = true;
            root.dispatchEvent(new Event('focus-local-maintenance'));
            broadcast('maintenance', null, operation);
            let succeeded = false, settled = false;
            try {
                const backup = await snapshotUnlocked(operation);
                if (options.backup !== false) await download(backup, 'FocusTodo-pre-import-backup');
                const journal = { id: 'settings-journal', operationId: operation.operationId, ownerId, phase: 'settings', target: target.localStorage, backup };
                await replaceRows(db, target, journal, operation, 'settings');
                await finishJournal(db, journal, operation);
                succeeded = settled = true;
                broadcast('replaced', null, operation);
                return backup;
            } catch (error) {
                if (error.rolledBack) settled = true;
                throw error;
            } finally {
                // Only clear our own marker when no recovery log exists. If
                // settings/rollback failed the durable journal remains blocked
                // until a new owner acquires the transaction lock and recovers.
                if (!settled) settled = await clearOperation(db, operation, false);
                localOperation = null;
                maintenance = !settled || invalidated || !!remoteOperation;
                root.dispatchEvent(new CustomEvent('focus-local-maintenance-end', { detail: { succeeded, recoveryRequired: !settled } }));
                if (!succeeded && settled) broadcast('maintenance-failed', null, operation);
            }
        }));
    }
    async function reset() {
        const empty = { meta: { app: 'FocusTodo', exportVersion: 2, dbVersion: 3 }, indexedDB: {}, localStorage: {} };
        BASE.forEach(name => { empty.indexedDB[name] = []; });
        empty.indexedDB.Project = defaultProjects();
        ['ServerAccessInfo', 'ServerUrls', 'app_language', 'FocusTodo.language', 'PK1', 'OverseaServerUrl', 'RegionCode'].forEach(key => {
            const value = localStorage.getItem(key); if (value !== null) empty.localStorage[key] = value;
        });
        empty.localStorage['cookie.ACCT'] = btoa('local@local');
        empty.localStorage['cookie.NAME'] = btoa(unescape(encodeURIComponent((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地用户'):'本地用户'))));
        empty.localStorage['cookie.PID'] = 'local-' + crypto.randomUUID();
        empty.localStorage['cookie.UID'] = 'local-' + crypto.randomUUID();
        empty.localStorage.Portrait = 'img/header-portrait.png';
        return replace(empty, { backup: true });
    }
    async function timerAction(action, now) {
        return exclusive(async () => {
            if (maintenance) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据维护中，计时操作尚未保存。'):'数据维护中，计时操作尚未保存。'));
            const db = await open();
            const result = await transaction(db, ['TimerSession', 'Pomodoro', 'LocalMeta'], 'readwrite', (tx, done, fail) => {
                const marker = tx.objectStore('LocalMeta').get('maintenance');
                const journal = tx.objectStore('LocalMeta').get('settings-journal');
                journal.onsuccess = () => {
                    if (marker.result || journal.result) { fail(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('存在进行中或待恢复的数据导入，请刷新页面。'):'存在进行中或待恢复的数据导入，请刷新页面。'))); return; }
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
            if (maintenance) throw new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据维护中，无法保存专注记录。'):'数据维护中，无法保存专注记录。'));
            const db = await open();
            await transaction(db, ['Pomodoro', 'LocalMeta'], 'readwrite', (tx, done, fail) => {
                const marker = tx.objectStore('LocalMeta').get('maintenance'), journal = tx.objectStore('LocalMeta').get('settings-journal');
                journal.onsuccess = () => {
                    if (marker.result || journal.result) { fail(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('存在进行中或待恢复的数据导入，请刷新页面。'):'存在进行中或待恢复的数据导入，请刷新页面。'))); return; }
                    tx.objectStore('Pomodoro').put(record); done(record);
                };
            });
            calendarChanged();
            return record;
        });
    }
    function calendarChanged() {
        root.dispatchEvent(new Event('focus-local-calendar-changed'));
        broadcast('calendar');
    }
    // Calendar task creation shares one transaction with every planned block.
    // Readers and import/reset see either the complete result or no change.
    async function calendarWrite(stores, body) {
        return exclusive(async () => {
            if (maintenance || invalidated) throw new Error(root.FocusI18n.text('本地数据维护中，请等待完成后刷新。'));
            const db = await open();
            const result = await transaction(db, [...new Set([...stores, 'LocalMeta'])], 'readwrite', (tx, done, fail) => {
                let waiting = 2;
                for (const id of ['maintenance', 'settings-journal']) {
                    const request = tx.objectStore('LocalMeta').get(id);
                    request.onsuccess = () => {
                        if (request.result) fail(new Error(root.FocusI18n.text('存在进行中或待恢复的数据维护，请等待或刷新。')));
                        else if (!--waiting) { try { body(tx, done, fail); } catch (error) { fail(error); } }
                    };
                }
            });
            calendarChanged();
            return result;
        });
    }
    function createCalendarTask(input) {
        const name = String(input.name || '').trim(), count = Number(input.count), interval = Number(input.interval);
        const start = Number(input.startTime), pause = Number(input.shortBreak || 0);
        if (!name || name.length > 1000 || !Number.isInteger(count) || count < 0 || count > 1000 ||
            !Number.isInteger(interval) || interval < 60 || interval > 28800 || !Number.isFinite(start) ||
            !Number.isFinite(new Date(start).getTime()) || !Number.isFinite(pause) || pause < 0 || pause > 10800) {
            return Promise.reject(new Error(root.FocusI18n.text('请填写有效的任务、时间和预计番茄数。')));
        }
        return calendarWrite(['Project', 'Task', 'Schedule'], (tx, done, fail) => {
            const request = tx.objectStore('Project').get(input.projectId);
            request.onsuccess = () => {
                const project = request.result;
                if (!project || project.state === -1 || ![1000, 7005].includes(project.type)) {
                    fail(new Error(root.FocusI18n.text('清单已变化，请重试。'))); return;
                }
                const tasks = tx.objectStore('Task').getAll();
                tasks.onsuccess = () => {
                    try {
                        const now = Date.now(), orders = tasks.result.filter(row => row.projectId === project.id && row.state !== -1).map(row => Number(row.order) || 0);
                        const deadline = new Date(start); deadline.setHours(23, 59, 59, 999);
                        const task = { id: crypto.randomUUID(), objType: 'TASK', creationDate: now, name, state: 0,
                            estimatePomoNum: count, actualPomoNum: 0, pomodoroInterval: interval, projectId: project.id,
                            deadline: deadline.getTime(), isFinished: false, finishedDate: 0, reminderDate: 0,
                            rCycle: 0, rFirstDeadline: 0, rUnit: '', rValue: '', rId: '', rStartDate: 0, rEndDate: 0,
                            reminders: '', remark: '', order: input.addToTop ? orders.reduce((a, b) => Math.min(a, b), 0) - 10000 : orders.reduce((a, b) => Math.max(a, b), 0) + 10000,
                            hasSubtask: false, isExpanded: false, priority: 0, tags: '', sync: 0 };
                        const schedules = Array.from({ length: Math.max(1, Math.min(5, count)) }, (_, index) => ({
                            id: crypto.randomUUID(), objType: 'SCHEDULE', creationDate: now, state: 0,
                            taskId: task.id, subtaskId: '', projectId: project.id, interval, isAllDay: false, sync: 0,
                            endDate: start + (index * (interval + pause) + interval) * 1000
                        }));
                        tx.objectStore('Task').add(task);
                        schedules.forEach(row => tx.objectStore('Schedule').add(row));
                        done({ task, schedules });
                    } catch (error) { fail(error); }
                };
            };
        });
    }
    function putSchedule(record) {
        if (!record || typeof record.id !== 'string' || !Number.isFinite(record.endDate) ||
            !Number.isFinite(record.interval) || record.interval < 60) return Promise.reject(new Error('Invalid schedule'));
        return calendarWrite(['Schedule'], (tx, done) => { tx.objectStore('Schedule').put(record); done(record); });
    }
    let channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('focustodo-local') : null;
    function broadcast(type, records, operation) { if (channel) channel.postMessage({ type, records: records || [], operationId: operation && operation.operationId }); }
    if (channel) channel.onmessage = event => {
        const message = event.data;
        if (message.type === 'maintenance') {
            remoteOperation = message.operationId || 'legacy'; maintenance = true;
            root.dispatchEvent(new Event('focus-local-maintenance'));
        } else if (message.type === 'maintenance-failed') {
            if (remoteOperation && remoteOperation !== (message.operationId || 'legacy')) return;
            remoteOperation = null; maintenance = !!localOperation || invalidated;
            if (!maintenance) root.dispatchEvent(new CustomEvent('focus-local-maintenance-end', { detail: { succeeded: false } }));
        } else if (message.type === 'replaced') {
            remoteOperation = null; maintenance = true; invalidated = !initializing;
            root.dispatchEvent(new Event('focus-local-maintenance')); notify((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('数据已在另一个标签页更新，请刷新本页。'):'数据已在另一个标签页更新，请刷新本页。'));
        } else if (message.type === 'calendar') root.dispatchEvent(new Event('focus-local-calendar-changed'));
        else root.dispatchEvent(new CustomEvent('focus-local-timer-changed', { detail: { records: message.records || [] } }));
    };
    // Profile edits share the import/reset ownership boundary, then commit one
    // atomic localStorage value. A failed write never publishes a new profile.
    async function saveProfile(field, value) {
        const text = message => root.FocusI18n ? root.FocusI18n.text(message) : message;
        let key, stored;
        if (field === 'name') {
            if (typeof value !== 'string' || !value.trim() || value.trim().length > 50) return Promise.reject(new Error(text('用户名必须为 1 至 50 个字符。')));
            key = 'cookie.NAME'; stored = installIdentity().encode(value.trim());
        } else if (field === 'avatar') {
            if (typeof value !== 'string' || value.length > 512 * 1024 || !/^data:image\/(?:png|jpeg|gif);base64,[A-Za-z0-9+/]+=*$/.test(value)) return Promise.reject(new Error(text('头像图片无效，请重新选择。')));
            key = 'Portrait'; stored = value;
        } else return Promise.reject(new Error('Unknown local profile field'));
        return exclusive(() => maintenanceLock(async lease => {
            if (maintenance || invalidated) throw new Error(text('本地数据维护中，请等待完成后刷新。'));
            const db = await open();
            await transaction(db, ['LocalMeta'], 'readonly', (tx, done, fail) => {
                let remaining = 2;
                for (const id of ['maintenance', 'settings-journal']) {
                    const request = tx.objectStore('LocalMeta').get(id);
                    request.onsuccess = () => {
                        if (request.result) fail(new Error(text('存在进行中或待恢复的数据维护，请等待或刷新。')));
                        else if (!--remaining) done();
                    };
                }
            });
            lease.assert();
            rawSet(key, stored);
            if (field === 'name') clearLegacyNameCookie();
            return stored;
        }));
    }
    let localIdentity = null;
    function clearLegacyNameCookie() {
        if (!document.cookie.split(';').some(part => part.trim().startsWith('NAME='))) return;
        const paths = new Set(['/', location.pathname]);
        const parts = location.pathname.split('/');
        for (let index = 1; index < parts.length; index++) {
            const prefix = parts.slice(0, index).join('/') || '/';
            paths.add(prefix); paths.add(prefix.endsWith('/') ? prefix : prefix + '/');
        }
        for (const path of paths) {
            document.cookie = 'NAME=; Max-Age=0; path=' + path;
            document.cookie = 'NAME=; Max-Age=0; path=' + path + '; domain=' + location.hostname;
        }
    }
    function installIdentity() {
        if (localIdentity) return localIdentity;

        localStorage.setItem('ExpiredDate', '0');

        // ========== 2. 设置本地用户登录凭证 ==========
        // 注意：应用使用 Base64.decode() 读取 ACCT 和 NAME
        // 所以需要存入 Base64 编码后的值
        var localAccount = 'local@local';
        var localName = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('\u672c\u5730\u7528\u6237'):'\u672c\u5730\u7528\u6237'); // "本地用户"

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
        clearLegacyNameCookie();

        // ========== 3. 保护关键数据不被清除 ==========
        var _origSetItem = rawSet;
        var _origRemoveItem = rawRemove;

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
            return localIdentity = Object.freeze({ set: _origSetItem, remove: _origRemoveItem, encode: utf8Base64Encode });
    }

    root.FocusLocalData = { installIdentity, defaultProjects, clearLegacyNameCookie, DB_NAME, DB_VERSION, BASE, DATA, ALL, open, transaction, exclusive, timerAction, session,
        snapshot: () => exclusive(() => maintenanceLock(() => snapshotUnlocked())), download, validate, replace, reset, putPomodoro,
        storageSnapshot, applySettings, rawSet, rawRemove, recoverJournal, notify, saveProfile, createCalendarTask, putSchedule,
        get maintenance() { return maintenance; } };
    root.FocusLocalReady = exclusive(recoverJournal);
    root.FocusLocalReady.catch(error => { notify((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地数据初始化失败：'):'本地数据初始化失败：') + error.message); console.error(error); });
})(window);
