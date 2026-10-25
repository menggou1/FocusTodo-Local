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
    return { JOURNAL_KEY, KEYS, create };
});
