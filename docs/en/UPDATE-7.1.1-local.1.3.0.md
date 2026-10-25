# 7.1.1-local.1.3.0 — Compressed backups and multi-tab recovery

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-24. Author: Lexible.

## Delivered behavior

- Create lossless Gzip backups, retain plain JSON exports and import older JSON backups.
- Review record counts and sizes before export, with an explicit option to omit wallpapers.
- Protect concurrent imports, resets and interrupted recovery; automatic safety backups remain complete.

## Technical and verification account

Business backups remain v1/v2 JSON with optional scope and an outer lossless Gzip layer. Content sniffing ignores filename extensions, and invalid/unknown/oversize input is rejected before replacement. Wallpaper omission retains detailed business rows and restores Leaf; automatic safety backups stay complete. Imported active sessions require confirmation instead of counting post-export offline time. Owned IndexedDB maintenance transactions prevent competing imports/resets and recover orphaned settings journals. The database remains v3. Local Node checks passed 47 with one platform skip; 47 app-browser and seven maintenance scenarios passed. An initial macOS test compared an empty timer snapshot with a newly initialized idle session; main stabilized the snapshot and the unpublished tag run was retried without replacing the tag.

## Generated-data measurements

Windows 11, Edge 155, i5-11260H, 16 GB RAM, Node 24.16. One run per profile/size. All values below are actual historical measurements, not performance guarantees.

| Profile | Source bytes | Gzip bytes | Snapshot ms | Encode ms | Decode ms | Validate ms | Restore ms | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| task-history | 998512 | 82531 | 39.3 | 24 | 5.3 | 2.7 | 213.6 | restored, fidelity checked |
| task-history | 9984230 | 798741 | 309.6 | 223.9 | 44.1 | 52.8 | 2503.9 | restored, fidelity checked |
| task-history | 49916619 | 3957494 | 1353.5 | 1045.9 | 219.8 | 299.1 | 14672.5 | restored, fidelity checked |
| image-heavy | 1006899 | 726350 | 5.6 | 41.6 | 13.7 | 4.8 | 52.2 | restored, fidelity checked |
| image-heavy | 10043079 | 7521579 | not seeded | 346.8 | 119.9 | 34.7 | 247.3 | quota refusal, rollback checked |
| image-heavy | 50183279 | 37705986 | not seeded | 2183.7 | 398.9 | 124.5 | 973.9 | quota refusal, rollback checked |

The 50 MB task/history sample restored in about 14.7 seconds, with a 3.24-second observed main-thread gap and about 611 MB sampled JS heap. The 50 MB image failure sample observed about 1,040 MB JS heap. These exclude native/Blob/process memory and can miss blocked allocation peaks. Image-heavy 10/50 MB cases could not be seeded into localStorage; their encoding measurements came from generated objects, not successful database exports.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/results.json)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/backup-performance.json)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/actions/runs/40103625482)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.3.0)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/actions/runs/40104023345)
- [Public evidence 6](https://menggou1.github.io/FocusTodo-Local/deployment.json)

[Original Chinese report](../UPDATE-7.1.1-local.1.3.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
