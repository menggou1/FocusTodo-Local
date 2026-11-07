/* Isolated IndexedDB transactions; no browser profile or user data is used. */
const fs = require('node:fs'), vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { IDBFactory, IDBDatabase } = require('fake-indexeddb');
async function localData() {
    class Storage {
        constructor() { this.values = new Map(); }
        get length() { return this.values.size; }
        key(index) { return [...this.values.keys()][index] ?? null; }
        getItem(key) { return this.values.get(String(key)) ?? null; }
        setItem(key, value) { this.values.set(String(key), String(value)); }
        removeItem(key) { this.values.delete(String(key)); }
    }
    const storage = new Storage(), window = new EventTarget();
    Object.assign(window, { FocusTimerCore: require('../../src/js/local-timer-core.js'),
        FocusLocalBackup: require('../../src/js/local-backup.js'),
        FocusRelease: { version: 'audit-test' }, FocusI18n: { text: value => value } });
    vm.runInNewContext(fs.readFileSync(require.resolve('../../src/js/local-data.js'), 'utf8'), {
        window, Storage, IDBDatabase, localStorage: storage, navigator: {}, crypto: webcrypto,
        indexedDB: new IDBFactory(), Event, CustomEvent, Blob, URL
    });
    await window.FocusLocalReady;
    return { data: window.FocusLocalData, storage, window };
}
module.exports = { localData };
