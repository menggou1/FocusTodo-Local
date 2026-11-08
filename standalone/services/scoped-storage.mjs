/** Logical legacy keys for backup compatibility; physical keys stay isolated. */
export const dataDatabaseName = 'FocusTodoStandalone.PomodoroDB6';
export const dataStoragePrefix = 'FocusTodoStandalone.data.';

export function createScopedStorage(storage) {
    const keys = () => {
        const result = [];
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (key?.startsWith(dataStoragePrefix)) result.push(key.slice(dataStoragePrefix.length));
        }
        return result;
    };
    return Object.freeze({
        get length() { return keys().length; },
        key: index => keys()[index] ?? null,
        getItem: key => storage.getItem(dataStoragePrefix + String(key)),
        setItem: (key, value) => storage.setItem(dataStoragePrefix + String(key), String(value)),
        removeItem: key => storage.removeItem(dataStoragePrefix + String(key)),
    });
}
