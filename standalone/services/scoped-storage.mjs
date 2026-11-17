/** Logical legacy keys for backup compatibility; physical keys stay isolated. */
export const dataDatabaseName = 'FocusTodoStandalone.PomodoroDB6';
export const dataStoragePrefix = 'FocusTodoStandalone.data.';

export function createScopedStorage(storage, prefix = dataStoragePrefix) {
    const keys = () => {
        const result = [];
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (key?.startsWith(prefix)) result.push(key.slice(prefix.length));
        }
        return result;
    };
    return Object.freeze({
        get length() { return keys().length; },
        key: index => keys()[index] ?? null,
        getItem: key => storage.getItem(prefix + String(key)),
        setItem: (key, value) => storage.setItem(prefix + String(key), String(value)),
        removeItem: key => storage.removeItem(prefix + String(key)),
    });
}
