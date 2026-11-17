# 2.0.1 — Settings, theme and avatar reliability fixes

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-11-17. Author: Lexible.

## Delivered behavior

- Share default avatars and invalid-image fallbacks; use the standard update dialog with an OK button.
- Fix settings and theme feedback, dropdown toggling and selected marks, and preload theme images.
- Restore ringtone option previews and volume feedback, improve slider precision and share custom scrollbars.
- Use the current version in the Simplified Chinese title and preserve settings when uploads or imports are cancelled.

## Technical and verification account

The avatar component validates stored images and falls back after decoding errors. File-input cancel events are ignored by parent dialog cancel handlers; cancelled imports are not successful operations. Theme selection reuses decoded images and ignores stale requests without taking the global busy lock. Sliders retain fractional pointer positions and save at interaction end; VolumeTip.wav uses the original 100ms trailing feedback with one active sample. Ringtone lists share the existing selected check and custom scrollbar. Simplified Chinese titles read canonical version metadata. Historical references are limited to requirements 6, 7, 8, 9, 10, 11 and 13; the immutable 1.9.4 UI and identical VolumeTip.wav resource are verified by settings-legacy-reference.cjs. Current behavior is exercised by settings-regression.cjs and deterministic audio tests.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../../releases/UPDATE-2.0.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.

Local checks passed: 89 unit tests (one existing platform skip), 65 standalone contracts, six release-gate tests, production and isolated builds, generated files, three-engine React business checks, historical browser checks, Firefox/WebKit capability fallbacks, and production upgrade/backup/restore. Eight final UI combinations, four inspector-dialog combinations, the legacy settings reference, both portable archives and the Python fallback passed. Committed-source Pages and remote release results are verified separately.
