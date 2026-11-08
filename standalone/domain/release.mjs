import { invariant, immutable } from '../services/errors.mjs';
export function identifyVersion(value) {
    if (typeof value !== 'string') return null;
    const legacy = /^7\.1\.1-local\.((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(value);
    const independent = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value) && Number(value.split('.')[0]) >= 2;
    if (!legacy && !independent) return null;
    const version = legacy?.[1] || value, parts = version.split('.').map(Number);
    if (!parts.every(Number.isSafeInteger)) return null;
    return Object.freeze({ kind: legacy ? 'legacy-local' : 'independent', version, parts });
}
export function releaseMetadata(config) {
    invariant(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(config.localVersion), 'Invalid release version');
    const version = Number(config.localVersion.split('.')[0]) >= 2 ? config.localVersion : config.officialVersion + '-local.' + config.localVersion;
    invariant(identifyVersion(version), 'Unsupported release metadata');
    invariant(config.updates[0]?.version === version && config.updates[0]?.date === config.date, 'Latest release entry mismatch');
    return immutable({ ...config, version, sourceVersion: config.officialVersion, schemaVersion: 3 });
}
export function createReleaseService({ metadata, storage, data, language }) {
    const key = 'FocusTodo.releaseRead';
    return Object.freeze({
        metadata,
        hasUnread: () => storage.getItem(key) !== metadata.version,
        entries: () => metadata.updates.map(language.update),
        async markRead(version) {
            invariant(metadata.updates.some(entry => entry.version === version), 'Unknown release entry');
            if (version === metadata.version) await data.themeStorageOperation(() => storage.setItem(key, metadata.version));
        },
        identify: identifyVersion,
    });
}
