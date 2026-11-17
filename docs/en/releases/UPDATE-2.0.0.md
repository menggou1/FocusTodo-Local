# FocusTodo 2.0.0

Updated 2026-11-16. Author: Lexible. [中文](../../releases/UPDATE-2.0.0.md) · [Testing](../TESTING.md)

## Architecture and compatibility

The app builds from complete React/TypeScript sources. Production entry, portable archives and Pages share a manifest; legacy runtime remains only for compatibility/UI-oracle tests. Production retains PomodoroDB6 v3 and old keys; preview retains its independent namespace. Explicit services preserve IDs, unknown compatible fields, JSON/Gzip backups, timer recovery and maintenance journals. App version 2.0.0 remains separate from source 7.1.1, schema and backup versions.

## Functional fixes

- Commit final timeline dimensions/axes/row spacing before bottom-up record reveal; remove placeholder-tree replacement and post-draw height changes.
- Restore completed record/task card backgrounds and neutral done icons, preserving date groups, spacing and interactions.
- Show the original stopwatch for running associated tasks, restoring appropriate icons on pause/stop/completion.
- Subscribe the forest header entry to the persisted feature switch.

## Dialog audit

| Class | Resulting behavior |
|---|---|
| Timer stop | Shared ConfirmDialog, original localized title/message/Stop button, adaptive 290–360px width, themed mask and motion. |
| Task/project delete and project hide | Shared warning geometry, typography, button order/spacing and light/dark mask. |
| Repeating task delete | Current/all/cancel actions retain vertical layout and spacing. |
| Inspector task/subtask delete | Shared confirmation shell; subtask dimensions, wording and cancel match the oracle. The existing Keep focus history option adds an intentional extra row to whole-task deletion; preserving and clearing history are both verified. |
| Project/folder/tag editors | 312px shell, name/colors/check artwork, folder contents, nested creation, cancel/save and top-layer focus. |
| Manual records | Original task/date/duration fields and popovers; remove the doubled Escape/close transition. |
| Schedule quick creation/details | Preserve outside-cancel, validation, fields/autosave and intentional legacy bug fixes. |
| Settings and export/import/reset | Six pages, scrolling and real services retained; safety backup uses application confirmation and cancel preserves data. |
| Wallpaper deletion | Shared application confirmation replaces native confirm. |
| Mode/noise/widget selectors | Check dimensions, drafts, cancel/confirm, volume, selection, scroll and motion. |
| Interrupted-time recovery | Preserve corrected segment review/exclusion with shared form shell. |
| Updates/notifications/profile/context menus | Check lifecycle, layering, scrolling, keyboard/focus and bilingual themes; latest-only read semantics retained. |
| Date/priority/tag/pomodoro/task pickers | Shared portal controls, wheels, submenu flips, selection and dismissal retained. |
| System file/permission/PiP | Verify invocation/fallback; browser/system styling is platform-owned. |

## Metadata and documentation

Version sources and About use 2.0.0 and 2026-11-16. README drops additional usage restrictions while retaining MIT, upstream/copyright and full third-party notices. Contracts/baseline/evidence move into Architecture/Testing; guides, maintenance, plans and bilingual release reports are updated and the temporary docs/2.0.0 tree is removed.

Actual release/live deployment and real-system evidence boundaries are maintained only in [Backlog](../../BACKLOG.md). Automation does not imply human visual acceptance.

## Local verification

Types, production/isolated builds, syntax and 76 Markdown file/anchor checks passed. Legacy units: 92 passed and one original POSIX-only case skipped on Windows; service contracts: 64 passed. Three-engine browser suites: 42 startup, 60 workspace, 33 domain and 31 service cases, plus both isolated archives. The complete legacy browser chain passed, including 66 core scenarios.

Final UI: 8 matrix cases, 64 settings measurements/8 behaviors, 52 overlay groups, 4 report, 4 settings-drag, 4 calendar-overlay and 8 timer/forest cases passed, with bilingual light/dark window/scroll motion checks. Production same-origin synthetic upgrade retained IDs/settings, downloaded a real backup, supported project subpaths and enforced the runtime allowlist. ZIP/tar.gz, Python fallback and 6 release gates passed, including rejection of corrupted built output.

Calendar start-time assertions now use the browser's Shanghai timezone; theme assertions wait for applied images and cross-tab saves use keyboard focus changes while retaining result/conflict checks. The original empty-task artwork/layout is restored.

Four additional inspector cases cover both languages and themes: subtask dialog geometry, cancel, parent flags after deleting the final child, and preserving or clearing focus history all passed.

[Structured local results](../../acceptance/2.0.0-final/verification.json). Exact-commit CI is linked from the PR. Actual Release/live verification is outside these local results.
