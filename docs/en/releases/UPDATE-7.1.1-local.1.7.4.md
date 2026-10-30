# 7.1.1-local.1.7.4 — User guide and documentation organization

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文报告](../../releases/UPDATE-7.1.1-local.1.7.4.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- About links to the Chinese or English user guide beside the repository link.
- The illustrated guide covers tasks, timer, reports, settings, calendar, forest and backups for the local edition, using isolated test data.
- Historical reports are organized under `docs/releases/` and `docs/en/releases/`, with links at old paths. Home pages, navigation, metadata, generator and package contents are synchronized.

## Verification and release

Local release generation and syntax checks passed; Node tests passed 60 with one platform skip. Filtered browser checks passed for Chinese and English About links. Relative document paths and heading anchors were checked, and three release-gate tests passed. Both archives passed extracted-document links and startup checks in a temporary path with spaces and Chinese characters; a mismatched tag was rejected. GitHub Actions supplies the full cross-platform tests, Pages and release gate. Historical reports retain their original facts and evidence; Maintenance describes current procedures.
