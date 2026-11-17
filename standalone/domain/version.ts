/** Product, origin, DB schema and backup versions have independent meanings. */
export interface VersionMetadata {
  readonly appVersion: string;
  readonly sourceVersion: string;
  readonly schemaVersion: 3;
}
export function versionMetadata(localVersion: string, officialVersion: string): VersionMetadata {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(localVersion)) {
    throw new Error('Invalid application version');
  }
  const major = Number(localVersion.split('.')[0]);
  return Object.freeze({
    appVersion: major >= 2 ? localVersion : `${officialVersion}-local.${localVersion}`,
    sourceVersion: officialVersion,
    schemaVersion: 3,
  });
}
