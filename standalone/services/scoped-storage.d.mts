export const dataDatabaseName: 'FocusTodoStandalone.PomodoroDB6';
export const dataStoragePrefix: 'FocusTodoStandalone.data.';
export function createScopedStorage(storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>, prefix?: string):
    Readonly<Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>>;
