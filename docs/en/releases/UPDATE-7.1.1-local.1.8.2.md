# 7.1.1-local.1.8.2 — Live forest badge, collect all and shared controls

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-11-05. Author: Lexible.

## Delivered behavior

- Refresh the forest badge as sunlight matures, expires or changes, without opening the forest.
- Collect available sunlight with a hand button sharing the achievement and guide button style.
- Reuse button, switch, pomodoro, date and dropdown styles, matching the language menu to other settings.
- Adopt independent application versions starting with 2.0.0 and provide a practical implementation plan.

## Technical and verification account

The forest header reads the same unclaimed reward records as the forest independently of its window. Maturity and expiry timers, local data events, visibility changes and peer-tab updates keep its badge current. Collect all uses the existing durable reward service and includes mature rewards beyond the 100 visible-item limit; failed writes retain successful claims and allow retry.

The style audit covers every application stylesheet, including sidebar, tasks, timers, settings and standalone pages. Shared controls are extracted by responsibility while preserving existing layout and interaction, with the language menu using the same React dropdown as the other settings. Startup and standalone-page layout retain their own loading and scope boundaries.

Independent three-part application versions are adopted starting with 2.0.0, retaining 7.1.1 only as provenance. This release still uses `7.1.1-local.1.8.2` and tag `1.8.2`, with database v3 unchanged. The engineering plan defines implementation order, compatibility and acceptance conditions.

Timer snapshot imports now reject invalid break durations, cycle lengths and automation flags before writing data. The local server returns HTTP 400 for NUL paths and keeps serving normal requests. The English schedule labels the current day Today.

The previous 1.8.0 candidate never produced a Release: its Ubuntu test compared the intrinsic dropdown label width against Windows glyph measurements. The check now verifies that the text fits without clipping and retains comparisons for control geometry, typography and color. The tag gate reuses successful tests and Pages deployment for the same main commit.

The startup test compares inline content after normalizing Windows checkout line endings. Actual differences in the embedded styles or script still fail the check.
The import rollback test waits for the forest to save the daily login reward before comparing all settings, so a background startup write cannot be mistaken for a rollback failure.

## Evidence

- Windows / Node.js 24: 77 of 78 unit tests passed; one POSIX-only case was skipped. Runtime syntax checks passed.
- Local Edge passed 18 startup, 64 application, 8 maintenance and 30 calendar cases, plus list ordering, audio, profile, forest, achievement, reminder and shared control suites. Calendar checks covered the current and next day in both languages and themes. Rejected imports left IndexedDB data, settings and maintenance state unchanged.
- All three release gate tests passed. Both ZIP and tar.gz launched after extraction into paths with spaces and Unicode without npm or Git. A mismatched version tag was rejected.

[Chinese report](../../releases/UPDATE-7.1.1-local.1.8.2.md).
