const { IDBFactory } = require('fake-indexeddb');
const { randomUUID } = require('node:crypto');

class MemoryStorage {
    values = new Map();
    fault = () => {};
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { this.fault('set', String(key), String(value)); this.values.set(String(key), String(value)); }
    removeItem(key) { this.fault('remove', String(key)); this.values.delete(String(key)); }
}

async function createHarness(options = {}) {
    const [{ createDataService }, { createTimerCore }, { createBackupCodec }, { createThemeJournal },
        { createScopedStorage, dataDatabaseName }, { createTimerService }] = await Promise.all([
        import('../../standalone/services/data.mjs'), import('../../standalone/domain/timer-core.mjs'),
        import('../../standalone/services/backup-codec.mjs'), import('../../standalone/services/theme-journal.mjs'),
        import('../../standalone/services/scoped-storage.mjs'), import('../../standalone/services/timer.mjs'),
    ]);
    const physicalStorage = options.storage || new MemoryStorage();
    const storage = createScopedStorage(physicalStorage), indexedDB = options.indexedDB || new IDBFactory();
    const clock = options.clock || { value: Date.UTC(2026, 10, 8) };
    const now = () => clock.value;
    const core = createTimerCore(), codec = createBackupCodec({ compression: globalThis });
    const themes = createThemeJournal({ now, random: () => 0.5 }).create({
        get: key => storage.getItem(key), set: (key, value) => storage.setItem(key, value), remove: key => storage.removeItem(key),
    });
    const events = [], backups = [];
    let timer;
    const data = createDataService({
        indexedDB, storage, databaseName: dataDatabaseName, now, randomUUID, timerCore: core, backupCodec: codec,
        appVersion: '7.1.1-local.1.9.3', encodeBase64: value => Buffer.from(value).toString('base64'),
        recoverTheme: () => themes.recover(), saveBackup: async backup => { backups.push(structuredClone(backup)); },
        ...options.capabilities,
        emit(type, detail) {
            events.push({ type, detail });
            if (type === 'timer-changed') timer?.refresh().catch(() => {});
            options.onEvent?.(type, detail);
        },
    });
    timer = createTimerService({ data, core, now, randomUUID });
    const dispose = () => { timer.dispose(); data.dispose(); };
    try { await data.initialize(); } catch (error) { dispose(); throw error; }
    return { data, core, codec, themes, timer, storage, physicalStorage, indexedDB, clock, events, backups, dispose };
}

const rows = (data, table) => data.read([table], (tx, done) => {
    const request = tx.objectStore(table).getAll();
    request.onsuccess = () => done(request.result);
});
const seed = (data, table, values) => data.write([table], tx => {
    for (const value of values) tx.objectStore(table).put(value);
});

module.exports = { MemoryStorage, createHarness, rows, seed };
module.exports.createApplication = async options => {
    const harness = await createHarness(options);
    const { createCoreServices } = await import('../../standalone/services/core.mjs');
    const app = await createCoreServices({ indexedDB: harness.indexedDB, storage: harness.physicalStorage,
        now: () => harness.clock.value, randomUUID, random: () => 0.5, encodeBase64: value => Buffer.from(value).toString('base64'),
        decodeBase64: value => Buffer.from(value, 'base64').toString('utf8'), compression: globalThis,
        appVersion: '7.1.1-local.1.9.3', saveBackup: async value => harness.backups.push(clone(value)),
        ...options?.application });
    return { ...harness, app, dispose() { app.dispose(); harness.dispose(); } };
};
function clone(value) { return structuredClone(value); }
