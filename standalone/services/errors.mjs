export class ServiceError extends Error {
    constructor(code, message, cause) {
        super(message, { cause }); this.name = 'ServiceError'; this.code = code;
        this.recoverable = !['unsupported-version', 'incompatible-client', 'disposed'].includes(code);
    }
}
export function invariant(condition, message, code = 'validation') {
    if (!condition) throw new ServiceError(code, message);
}
export function immutable(value) {
    const result = structuredClone(value);
    const freeze = item => {
        if (item && typeof item === 'object' && !Object.isFrozen(item)) { Object.values(item).forEach(freeze); Object.freeze(item); }
        return item;
    };
    return freeze(result);
}
export function sameValue(left, right) {
    if (Object.is(left, right)) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}
export function snapshotSource(initial, onError = () => {}) {
    let value = immutable(initial), disposed = false;
    const listeners = new Set();
    return {
        getSnapshot: () => value,
        subscribe(listener) { invariant(!disposed, 'Service disposed', 'disposed'); listeners.add(listener); return () => listeners.delete(listener); },
        publish(next) {
            if (disposed || sameValue(value, next)) return;
            value = immutable(next);
            for (const listener of listeners) { try { listener(); } catch (error) { try { onError(error); } catch (_) { /* Observer. */ } } }
        },
        dispose() { disposed = true; listeners.clear(); },
    };
}
