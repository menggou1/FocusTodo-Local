import { ServiceError } from './errors.mjs';
import { preferenceDefinitions } from './preferences.mjs';
/* Data algorithms migrated from local-data.js at 139d0f9.
 * Explicit capabilities only: no globals, legacy identity hooks, or DB monkey patches.
 * Candidate storage stays namespaced. Backup metadata retains the legacy format.
 */
export function createDataService({ indexedDB, storage: localStorage, timerCore, backupCodec,
    databaseName, allowLegacyData = false, now: clockNow, randomUUID, appVersion, encodeBase64, translate = value => value, locks = null, channel = null,
    emit: onEvent = () => {}, saveBackup, recoverTheme, fault = () => {} }) {
    if (!(databaseName?.startsWith('FocusTodoStandalone.') || allowLegacyData === true && databaseName === 'PomodoroDB6') || !indexedDB || !localStorage ||
        !timerCore || !backupCodec || ![clockNow, randomUUID, encodeBase64].every(value => typeof value === 'function')) {
        throw new Error('Explicit isolated data-service capabilities are required.');
    }
    const DB_NAME = 'PomodoroDB6', DB_VERSION = 3;
    const LOCK_DB_NAME = databaseName + '-maintenance-lock';
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
    const rawSet = localStorage.setItem.bind(localStorage);
    const rawRemove = localStorage.removeItem.bind(localStorage);
    const nativeTransaction = function (...args) { return this.transaction(...args); };
    let dbPromise, lockPromise, tail = Promise.resolve(), maintenance = false;
    let localOperation = null, remoteOperation = null, invalidated = false, initializing = true, disposed = false;
    const connections = new Set();
    const transactions = new Set();
    // Notification failures cannot turn a committed write into a failed command.
    const emit = (...args) => { try { onEvent(...args); } catch (_) { /* Observer only. */ } };
    const ownerId = randomUUID();
    // Same preset IDs/types/default visibility as the legacy ProjectManager.
    // Keep navigation rows inside the reset transaction instead of relying on
    // the settings Version flag to rerun a legacy migration after reload.
    function defaultProjects(now = clockNow()) {
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
    function notify(message) { emit('notice', message); }
    function open() {
        if (disposed || invalidated) return Promise.reject(new Error('Service closed or invalidated; create a new service after checking compatibility.'));
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, DB_VERSION);
            request.onupgradeneeded = () => {
                if (disposed || invalidated) { request.transaction.abort(); return; }
                const db = request.result;
                ALL.forEach(name => {
                    const store = db.objectStoreNames.contains(name) ? request.transaction.objectStore(name) : db.createObjectStore(name, { keyPath: keys[name] || 'id' });
                    (indexes[name] || []).forEach(key => { if (!store.indexNames.contains(key)) store.createIndex(key, key, { unique: false }); });
                });
            };
            request.onsuccess = () => {
                const db = request.result;
                if (disposed) { db.close(); reject(new Error('Service closed')); return; }
                try {
                    if (ALL.some(name => !db.objectStoreNames.contains(name))) throw new ServiceError('incompatible-client', 'Database stores do not match schema v3');
                    const tx = nativeTransaction.call(db, ALL, 'readonly');
                    for (const name of ALL) {
                        const store = tx.objectStore(name);
                        if (store.keyPath !== (keys[name] || 'id') || (indexes[name] || []).some(key => !store.indexNames.contains(key) || store.index(key).keyPath !== key || store.index(key).unique)) {
                            throw new ServiceError('incompatible-client', 'Database keys/indexes do not match schema v3');
                        }
                    }
                } catch (error) { db.close(); reject(error); return; }
                connections.add(db);
                db.onversionchange = () => { db.close(); dbPromise = null; maintenance = true; invalidated = true; emit('versionchange'); notify(translate('数据库已更新，请刷新本标签页后继续。')); };
                resolve(db);
            };
            request.onerror = () => { dbPromise = null; reject(request.error); };
            request.onblocked = () => {
                // Do not hang startup behind an older connection. The pending
                // request is aborted if it later reaches onupgradeneeded.
                invalidated = true; maintenance = true; emit('blocked');
                reject(new Error(translate('数据库升级等待中：请关闭其他旧版本专注清单标签页。数据会保留。')));
            };
        });
        return dbPromise;
    }
    function exclusive(fn) {
        if (disposed || invalidated) return Promise.reject(new Error('Service closed or invalidated'));
        const run = () => { if (disposed || invalidated) throw new Error('Service closed or invalidated'); return locks ? locks.request(databaseName + ':write', fn) : fn(); };
        const result = tail.then(run, run);
        tail = result.catch(() => {});
        return result;
    }
    function transaction(db, names, mode, body) {
        return new Promise((resolve, reject) => {
            let tx, result, failure;
            try {
                const scope = mode === 'readwrite' ? [...new Set([...(typeof names === 'string' ? [names] : names), 'LocalMeta'])] : names;
                tx = nativeTransaction.call(db, scope, mode);
                transactions.add(tx);
                tx.oncomplete = () => { transactions.delete(tx); if(mode==='readwrite'&&(typeof names==='string'?names==='Task':names.includes('Task')))tasksChanged();resolve(result); };
                tx.onabort = () => { transactions.delete(tx); reject(failure || tx.error || new Error(translate('数据库事务已取消。'))); };
                tx.onerror = () => { failure = tx.error || failure; };
                fault('transaction-start', { stores: names, mode, transaction: tx });
                const fail = error => { failure = error; tx.abort(); };
                const run = () => { try { body(tx, value => { result = value; }, fail); } catch (error) { fail(error); } };
                if (tx.objectStoreNames.contains('LocalMeta')) {
                    const request = tx.objectStore('LocalMeta').get('client-protocol');
                    request.onsuccess = () => {
                        if (request.result && (request.result.protocol !== 1 || request.result.family !== 'FocusTodoStandalone')) {
                            fail(new ServiceError('incompatible-client', 'Incompatible client protocol; keep this database and use a compatible client.')); return;
                        }
                        run();
                    };
                } else run();
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
            request.onupgradeneeded = () => {
                if (disposed || invalidated) { request.transaction.abort(); return; }
                request.result.createObjectStore('ownership');
            };
            request.onsuccess = () => {
                const db = request.result;
                if (disposed) { db.close(); reject(new Error('Service closed')); return; }
                connections.add(db);
                db.onversionchange = () => { db.close(); lockPromise = null; invalidated = true; maintenance = true; emit('versionchange'); };
                resolve(db);
            };
            request.onerror = () => { lockPromise = null; reject(request.error); };
            request.onblocked = () => { invalidated = true; maintenance = true; emit('blocked'); reject(new Error('Maintenance lock database is blocked')); };
        });
        return lockPromise;
    }
    async function maintenanceLock(body) {
        if (disposed || invalidated) throw new Error('Service closed or invalidated');
        const db = await openMaintenanceLock();
        return new Promise((resolve, reject) => {
            const tx = nativeTransaction.call(db, ['ownership'], 'readwrite');
            transactions.add(tx);
            let active = true, started = false, released = false, result, failure;
            const lease = { assert() { if (!active || disposed || invalidated) throw new Error(translate('数据维护事务锁已失效，请刷新后恢复。')); } };
            tx.onabort = () => { transactions.delete(tx); active = false; reject(tx.error || new Error(translate('数据维护事务锁已取消。'))); };
            tx.onerror = () => {};
            tx.oncomplete = () => {
                transactions.delete(tx);
                active = false;
                if (!released) reject(new Error(translate('数据维护事务锁意外结束，请刷新后恢复。')));
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
    function themeStorageOperation(body) {
        return exclusive(()=>maintenanceLock(async lease=>{
            if(maintenance || invalidated)throw new Error(translate('本地数据维护中，请等待完成后刷新。'));
            const db=await open();
            await transaction(db,['LocalMeta'],'readonly',(tx,done,fail)=>{
                const query=tx.objectStore('LocalMeta').getAll();
                query.onsuccess=()=>query.result.some(row=>['maintenance','settings-journal'].includes(row.id))
                    ?fail(new Error(translate('存在待恢复的数据维护，请刷新。'))):done();
            });
            lease.assert();return body();
        }));
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
                    if (!sameOperation(request.result, operation)) throw new Error(translate('数据维护归属已变化，请刷新后恢复。'));
                    body(tx, done, fail, request.result);
                } catch (error) { fail(error); }
            };
        });
    }
    function journalOwned(journal, operation) {
        if (!sameOperation(journal, operation)) throw new Error(translate('数据恢复日志与维护归属不一致，请保留当前数据库。'));
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
        fault('settings-apply');
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
                throw new Error(error.message + translate('；设置回滚待重试：') + rollbackError.message);
            }
            throw error;
        }
    }
    async function snapshotUnlocked(operation) {
        if (recoverTheme) recoverTheme();
        const db = await open();
        const indexedDBData = await transaction(db, DATA.concat('LocalMeta'), 'readonly', (tx, done, fail) => {
            const result = {}; let remaining = DATA.length;
            ['maintenance', 'settings-journal'].forEach(id => {
                const check = tx.objectStore('LocalMeta').get(id);
                check.onsuccess = () => { if (check.result && (!operation || !sameOperation(check.result, operation))) fail(new Error(translate('存在进行中或待恢复的数据维护，请等待或刷新。'))); };
            });
            DATA.forEach(name => {
                const request = tx.objectStore(name).getAll();
                request.onsuccess = () => { result[name] = request.result; if (!--remaining) done(result); };
            });
        });
        return {
            meta: { app: 'FocusTodo', exportVersion: 2, exportDate: new Date(clockNow()).toISOString(), dbName: DB_NAME, dbVersion: DB_VERSION, patch: appVersion },
            indexedDB: indexedDBData, localStorage: storageSnapshot()
        };
    }
    function portableSettings(settings) {
        const [networkKey] = preferenceDefinitions.externalNetwork;
        const { [networkKey]: _localConsent, ...portable } = settings;
        return portable;
    }
    async function download(snapshot, prefix) {
        if (!saveBackup) throw new Error('A pre-import backup sink is required.');
        await saveBackup({ ...snapshot, localStorage: portableSettings(snapshot.localStorage) }, prefix);
    }
    // Finite numbers outside the Date range still crash date formatting and
    // create unusable index ranges after an import.
    const validDate = value => Number.isFinite(value) && Math.abs(value) <= 8.64e15;
    function validate(input) {
        if (!input || typeof input !== 'object' || !input.meta || input.meta.app !== 'FocusTodo' ||
            ![1, 2].includes(input.meta.exportVersion) || !input.indexedDB || !input.localStorage || Array.isArray(input.localStorage)) {
            throw new Error(translate('不是受支持的 FocusTodo 完整备份。仅设置备份不能覆盖数据库。'));
        }
        if (input.meta.scope !== undefined && !['full', 'without-wallpapers'].includes(input.meta.scope)) throw new Error(translate('备份范围标记不受支持。'));
        if (backupCodec) backupCodec.validateScope(input);
        if (Number(input.meta.dbVersion) > DB_VERSION) throw new Error(translate('备份来自较新的数据库版本，请先更新程序。'));
        const data = JSON.parse(JSON.stringify(input));
        delete data.localStorage['FocusTodo.themeJournal'];
        BASE.forEach(name => {
            const records = data.indexedDB[name];
            if (!Array.isArray(records)) throw new Error(translate('备份缺少数据表：') + name);
            const seen = new Set(), key = keys[name] || 'id';
            records.forEach(record => {
                if (!record || Array.isArray(record) || typeof record[key] !== 'string' || !record[key] || seen.has(record[key])) throw new Error(name + translate(' 存在无效或重复 ID。'));
                seen.add(record[key]);
                if (name === 'Pomodoro' && (!validDate(record.endDate) || !validDate(record.endDate - record.interval * 1000) || !Number.isFinite(record.interval) ||
                    record.interval <= 0 || record.interval > 28800 || !Number.isFinite(record.pomodoroInterval) || record.pomodoroInterval <= 0 || record.pomodoroInterval > 28800)) {
                    throw new Error(translate('专注记录包含无效时长或日期：') + record[key]);
                }
            });
        });
        Object.keys(data.localStorage).forEach(key => {
            if (['__proto__', 'constructor', 'prototype', 'setItem', 'removeItem'].includes(key) || typeof data.localStorage[key] !== 'string') throw new Error(translate('备份包含无效设置：') + key);
        });
        // Preserve unfinished work without counting time after the backup was taken.
        const sessions = data.indexedDB.TimerSession === undefined ? [] : data.indexedDB.TimerSession;
        if (!Array.isArray(sessions) || sessions.length > 1) throw new Error(translate('无效计时会话备份。'));
        sessions.forEach(s => {
            if (!s || s.id !== 'active' || typeof s.sessionId !== 'string' || !s.sessionId ||
                !['initial', 'work', 'pause', 'rest', 'waitingForRest', 'recovery'].includes(s.state) ||
                !['countup', 'countdown'].includes(s.mode) || typeof s.taskId !== 'string' || typeof s.subtaskId !== 'string' || !s.config || Array.isArray(s.config) ||
                // Imported sessions bypass create(), so every setting must
                // already have the types and bounds used by the timer core.
                Object.entries(timerCore.settings(s.config)).some(([key, value]) => s.config[key] !== value) || !Array.isArray(s.spans) ||
                !['cursorAt', 'observedAt', 'phaseElapsed', 'totalSeconds', 'recordedSeconds'].every(key => Number.isFinite(s[key]) && s[key] >= 0) ||
                !['cursorAt', 'observedAt'].every(key => validDate(s[key])) ||
                !['revision', 'sequence', 'blockSequence', 'completed'].every(key => Number.isSafeInteger(s[key]) && s[key] >= 0 && s[key] < Number.MAX_SAFE_INTEGER)) {
                throw new Error(translate('计时会话字段无效。'));
            }
            // Spans are stored in the order worked, not necessarily in wall-clock
            // order: after a clock rollback two legitimate spans can overlap.
            s.spans.forEach(span => {
                if (!span || !validDate(span.start) || !validDate(span.end) || span.start < 0 || span.end <= span.start) throw new Error(translate('计时会话包含无效专注区间。'));
            });
            const pending = timerCore.pendingSeconds(s);
            if (Math.abs(s.totalSeconds - s.recordedSeconds - pending) > 0.01) throw new Error(translate('计时会话字段无效。'));
            // The next record ID must be beyond every already committed row.
            // Otherwise the first restored timer write aborts on a duplicate ID.
            const prefix = s.sessionId + ':';
            data.indexedDB.Pomodoro.forEach(record => {
                const suffix = record.id.startsWith(prefix) ? record.id.slice(prefix.length) : '';
                if (/^[1-9]\d*$/.test(suffix) && Number(suffix) > s.sequence) throw new Error(translate('计时会话字段无效。'));
            });
            if (s.pausedFrom !== undefined && (s.state !== 'pause' || s.pausedFrom !== 'rest')) throw new Error(translate('计时会话字段无效。'));
            if (s.state === 'work' || s.state === 'rest') {
                const exportAt = Date.parse(data.meta.exportDate);
                if (!Number.isFinite(exportAt)) throw new Error(translate('计时快照与导出日期不一致。'));
                // The system clock can move back before the next timer tick.
                // Require confirmation but never count the backwards interval.
                s.pendingRecovery = { from: s.cursorAt, to: Math.max(s.cursorAt, exportAt), priorState: s.state,
                    detectedAt: exportAt, clockChanged: exportAt < s.cursorAt, source: 'import' };
                s.state = 'recovery';
            } else if (s.state === 'recovery') {
                const p = s.pendingRecovery;
                if (!p || !validDate(p.from) || !validDate(p.to) || !validDate(p.detectedAt) || p.from !== s.cursorAt || p.to < p.from ||
                    (p.clockChanged !== undefined && typeof p.clockChanged !== 'boolean') || !['work', 'rest'].includes(p.priorState)) throw new Error(translate('无效的待确认区间。'));
                p.source = 'import';
            }
        });
        data.indexedDB.TimerSession = sessions;
        data.localStorage.Version = '6.5';
        data.localStorage.ExpiredDate = '0';
        data.localStorage.timingTaskId = '';
        data.localStorage.timingSubtaskId = '';
        for (const key of ['WorkInterval', 'ShortBreakInterval', 'LongBreakInterval']) {
            if (key in data.localStorage && (!Number.isFinite(Number(data.localStorage[key])) || Number(data.localStorage[key]) < 1 || Number(data.localStorage[key]) > 28800)) throw new Error(translate('无效计时设置：') + key);
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
                    fault('replacement-rows', { transaction: tx, phase });
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
        // Older interrupted imports may still have consent in their journal.
        try { applySettings(portableSettings(journal.target)); }
        catch (error) {
            // Persist the rollback decision with the original rows. A crash or a
            // second settings failure must resume rollback, never replay target.
            await replaceRows(db, journal.backup, journal, operation, 'rollback');
            operation.lease.assert();
            try { applySettings(journal.backup.localStorage); }
            catch (rollbackError) { throw new Error(translate('设置恢复与回滚未完成，请刷新重试；恢复日志已保留：') + rollbackError.message); }
            await clearOperation(db, operation, true);
            const failure = new Error(translate('设置恢复失败，数据库与设置已回滚：') + error.message);
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
                    if (journal.operationId && (!marker || !sameOperation(marker, journal))) throw new Error(translate('数据恢复日志归属冲突，请保留当前数据库。'));
                    const operation = { operationId: journal.operationId || randomUUID(), ownerId, lease };
                    const phase = journal.phase === 'rollback' ? 'rollback' : 'settings';
                    const adopted = { ...journal, operationId: operation.operationId, ownerId, phase };
                    meta.put({ id: 'maintenance', operationId: operation.operationId, ownerId, phase, startedAt: marker && marker.startedAt || clockNow(), recoveredAt: clockNow() });
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
            await transaction(db, ['LocalMeta'], 'readwrite', tx => {
                tx.objectStore('LocalMeta').put({ id: 'client-protocol', protocol: 1, family: 'FocusTodoStandalone', appVersion, schemaVersion: 3 });
            });
            lease.assert();
            maintenance = false; remoteOperation = null; invalidated = false; initializing = false;
        });
    }
    async function replace(input, options) {
        const target = validate(input); options = options || {};
        return exclusive(() => maintenanceLock(async lease => {
            if (localOperation || invalidated) throw new Error(translate('本页数据已变化，请刷新后重试。'));
            const db = await open();
            await recoverLocked(db, lease);
            const operation = { operationId: randomUUID(), ownerId, lease };
            await transaction(db, ['LocalMeta'], 'readwrite', (tx, done, fail) => {
                const meta = tx.objectStore('LocalMeta'), request = meta.getAll();
                request.onsuccess = () => {
                    if (request.result.some(row => ['maintenance', 'settings-journal'].includes(row.id))) { fail(new Error(translate('存在待恢复的数据维护，请刷新。'))); return; }
                    meta.put({ id: 'maintenance', operationId: operation.operationId, ownerId, phase: 'snapshot', startedAt: clockNow() });
                };
            });
            localOperation = operation; maintenance = true;
            emit('maintenance');
            broadcast('maintenance', null, operation);
            let succeeded = false, settled = false;
            try {
                fault('maintenance-marker');
                const backup = await snapshotUnlocked(operation);
                fault('pre-import-snapshot');
                if (options.backup !== false) await download(backup, 'FocusTodo-pre-import-backup');
                const journal = { id: 'settings-journal', operationId: operation.operationId, ownerId, phase: 'settings', target: target.localStorage, backup };
                await replaceRows(db, target, journal, operation, 'settings');
                fault('replacement-committed');
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
                emit('maintenance-end', { succeeded, recoveryRequired: !settled });
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
        empty.localStorage['cookie.ACCT'] = encodeBase64('local@local');
        empty.localStorage['cookie.NAME'] = encodeBase64(translate('本地用户'));
        empty.localStorage['cookie.PID'] = 'local-' + randomUUID();
        empty.localStorage['cookie.UID'] = 'local-' + randomUUID();
        empty.localStorage.Portrait = 'img/header-portrait.png';
        return replace(empty, { backup: true });
    }
    async function timerAction(action, now) {
        return exclusive(async () => {
            if (maintenance) throw new Error(translate('数据维护中，计时操作尚未保存。'));
            const db = await open();
            const result = await transaction(db, ['TimerSession', 'Pomodoro', 'Task', 'Subtask', 'LocalMeta'], 'readwrite', (tx, done, fail) => {
                const marker = tx.objectStore('LocalMeta').get('maintenance');
                const journal = tx.objectStore('LocalMeta').get('settings-journal');
                journal.onsuccess = () => {
                    if (marker.result || journal.result) { fail(new Error(translate('存在进行中或待恢复的数据导入，请刷新页面。'))); return; }
                    const request = tx.objectStore('TimerSession').get('active');
                    request.onsuccess = () => {
                        const commit = () => { try {
                            const result = timerCore.reduce(request.result, action, now);
                            result.records.forEach(record => tx.objectStore('Pomodoro').add(record));
                            tx.objectStore('TimerSession').put(result.session);
                            fault('timer-commit', { transaction: tx, result }); done(result);
                        } catch (error) { fail(error); } };
                        if (['start','switchTask'].includes(action.type) && action.taskId) {
                            const task = tx.objectStore('Task').get(action.taskId);
                            task.onsuccess = () => {
                                if (!task.result || task.result.state !== 0 || task.result.isFinished) { fail(new ServiceError('conflict', 'Task no longer available')); return; }
                                if (!action.subtaskId) { commit(); return; }
                                const subtask = tx.objectStore('Subtask').get(action.subtaskId);
                                subtask.onsuccess = () => {
                                    if (!subtask.result || subtask.result.taskId !== action.taskId || subtask.result.state !== 0 || subtask.result.isFinished) fail(new ServiceError('conflict', 'Subtask no longer available'));
                                    else commit();
                                };
                            };
                        } else commit();
                    };
                };
            });
            broadcast('timer', result.records); if(result.records.length) emit('achievements-input'); return result;
        });
    }
    async function session() {
        return read(['TimerSession'], (tx, done) => {
            const req = tx.objectStore('TimerSession').get('active'); req.onsuccess = () => done(req.result || null);
        });
    }
    async function putPomodoro(record) {
        return exclusive(async () => {
            if (maintenance) throw new Error(translate('数据维护中，无法保存专注记录。'));
            const db = await open();
            await transaction(db, ['Pomodoro', 'LocalMeta'], 'readwrite', (tx, done, fail) => {
                const marker = tx.objectStore('LocalMeta').get('maintenance'), journal = tx.objectStore('LocalMeta').get('settings-journal');
                journal.onsuccess = () => {
                    if (marker.result || journal.result) { fail(new Error(translate('存在进行中或待恢复的数据导入，请刷新页面。'))); return; }
                    tx.objectStore('Pomodoro').put(record); done(record);
                };
            });
            calendarChanged();
            return record;
        });
    }
    function calendarChanged() {
        emit('calendar-changed');
        broadcast('calendar');
    }
    // Calendar task creation shares one transaction with every planned block.
    // Readers and import/reset see either the complete result or no change.
    async function calendarWrite(stores, body) {
        return exclusive(async () => {
            if (maintenance || invalidated) throw new Error(translate('本地数据维护中，请等待完成后刷新。'));
            const db = await open();
            const result = await transaction(db, [...new Set([...stores, 'LocalMeta'])], 'readwrite', (tx, done, fail) => {
                let waiting = 2;
                for (const id of ['maintenance', 'settings-journal']) {
                    const request = tx.objectStore('LocalMeta').get(id);
                    request.onsuccess = () => {
                        if (request.result) fail(new Error(translate('存在进行中或待恢复的数据维护，请等待或刷新。')));
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
            return Promise.reject(new Error(translate('请填写有效的任务、时间和预计番茄数。')));
        }
        return calendarWrite(['Project', 'Task', 'Schedule'], (tx, done, fail) => {
            const request = tx.objectStore('Project').get(input.projectId);
            request.onsuccess = () => {
                const project = request.result;
                if (!project || project.state === -1 || ![1000, 7005].includes(project.type)) {
                    fail(new Error(translate('清单已变化，请重试。'))); return;
                }
                const tasks = tx.objectStore('Task').getAll();
                tasks.onsuccess = () => {
                    try {
                        const now = clockNow(), orders = tasks.result.filter(row => row.projectId === project.id && row.state !== -1).map(row => Number(row.order) || 0);
                        const deadline = new Date(start); deadline.setHours(23, 59, 59, 999);
                        const task = { id: randomUUID(), objType: 'TASK', creationDate: now, name, state: 0,
                            estimatePomoNum: count, actualPomoNum: 0, pomodoroInterval: interval, projectId: project.id,
                            deadline: deadline.getTime(), isFinished: false, finishedDate: 0, reminderDate: 0,
                            rCycle: 0, rFirstDeadline: 0, rUnit: '', rValue: '', rId: '', rStartDate: 0, rEndDate: 0,
                            reminders: '', remark: '', order: input.addToTop ? orders.reduce((a, b) => Math.min(a, b), 0) - 10000 : orders.reduce((a, b) => Math.max(a, b), 0) + 10000,
                            hasSubtask: false, isExpanded: false, priority: 0, tags: '', sync: 0 };
                        const schedules = Array.from({ length: Math.max(1, Math.min(5, count)) }, (_, index) => ({
                            id: randomUUID(), objType: 'SCHEDULE', creationDate: now, state: 0,
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
    function putSchedule(record, expected) {
        if (!record || typeof record.id !== 'string' || !record.id || !validDate(record.endDate) ||
            !Number.isFinite(record.interval) || record.interval < 60 || !validDate(record.endDate - record.interval * 1000) ||
            (expected && expected.id !== record.id)) return Promise.reject(new Error('Invalid schedule'));
        return calendarWrite(['Schedule'], (tx, done, fail) => {
            const store = tx.objectStore('Schedule'), request = store.get(record.id);
            request.onsuccess = () => {
                const current = request.result;
                // Compare inside the same write transaction as the update. A
                // stale drag/delete must not undo another tab's committed edit.
                const changed = expected && (!current || ['endDate', 'interval', 'state', 'taskId', 'subtaskId', 'projectId', 'isAllDay'].some(key => current[key] !== expected[key]));
                if (changed || current && current.state === -1 && record.state !== -1) {
                    fail(new Error(translate('数据已在另一个标签页更新，请刷新本页。'))); return;
                }
                store.put(record); done(record);
            };
        });
    }

    function broadcast(type, records, operation) {
        if (!channel || disposed) return;
        try { channel.postMessage({ type, records: records || [], operationId: operation && operation.operationId }); }
        catch (_) { emit('coordination-unavailable'); }
    }
    function tasksChanged(){emit('tasks-changed');broadcast('tasks')}
    if (channel) channel.onmessage = event => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'maintenance') {
            remoteOperation = message.operationId || 'legacy'; maintenance = true;
            emit('maintenance');
        } else if (message.type === 'maintenance-failed') {
            if (remoteOperation && remoteOperation !== (message.operationId || 'legacy')) return;
            remoteOperation = null; maintenance = !!localOperation || invalidated;
            if (!maintenance) emit('maintenance-end', { succeeded: false });
        } else if (message.type === 'replaced') {
            remoteOperation = null; maintenance = true; invalidated = !initializing;
            if (invalidated) emit('invalidated');
            emit('maintenance'); notify(translate('数据已在另一个标签页更新，请刷新本页。'));
        } else if (message.type === 'calendar') emit('calendar-changed');
        else if (message.type === 'achievements') emit('achievements-changed');
        else if (message.type === 'tasks') emit('tasks-changed');
        else if (message.type === 'settings') emit('settings-changed');
        else emit('timer-changed', { records: message.records || [] });
    };
    let ready;
    const initialize = () => ready ||= exclusive(recoverJournal);
    const initialized = fn => async (...args) => { await initialize(); return fn(...args); };
    const read = async (stores, body) => {
        const db = await open();
        const scope = [...new Set([...stores, 'LocalMeta'])];
        return transaction(db, scope, 'readonly', (tx, done, fail) => {
            // Recovery diagnostics may inspect LocalMeta. Business readers
            // cannot observe replacement rows paired with the old settings.
            if (stores.every(name => name === 'LocalMeta')) { body(tx, done, fail); return; }
            const request = tx.objectStore('LocalMeta').getAll();
            request.onsuccess = () => {
                if (request.result.some(row => ['maintenance', 'settings-journal'].includes(row.id))) {
                    fail(new Error(translate('存在进行中或待恢复的数据维护，请等待或刷新。'))); return;
                }
                try { body(tx, done, fail); } catch (error) { fail(error); }
            };
        });
    };
    return Object.freeze({ DB_NAME, DB_VERSION, BASE: Object.freeze(BASE), DATA: Object.freeze(DATA), ALL: Object.freeze(ALL),
        initialize, defaultProjects, validate,
        changed(type) { emit(type + '-changed'); broadcast(type); },
        // Only domain services receive this repository capability. All writes
        // include the maintenance/journal check in their committing transaction.
        read: initialized(read), write: initialized(calendarWrite),
        timerAction: initialized(timerAction), session: initialized(session),
        replace: initialized(replace), reset: initialized(reset), putPomodoro: initialized(putPomodoro),
        createCalendarTask: initialized(createCalendarTask), putSchedule: initialized(putSchedule),
        themeStorageOperation: initialized(themeStorageOperation),
        snapshot: initialized(() => exclusive(() => maintenanceLock(() => snapshotUnlocked()))),
        get maintenance() { return maintenance || invalidated || disposed; },
        dispose() {
            disposed = true; maintenance = true;
            if (channel) { channel.onmessage = null; channel.close(); }
            for (const tx of transactions) { try { tx.abort(); } catch (_) { /* Already committed. */ } }
            for (const db of connections) db.close();
            connections.clear();
        }
    });
}
