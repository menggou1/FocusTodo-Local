# 7.1.1-local.1.7.11 — Guides, release stability and maintenance rules

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文](../../releases/UPDATE-7.1.1-local.1.7.11.md)

Date: 2026-10-30. Author: Lexible.

## Initial problems

About lacked complete illustrated bilingual guides. Windows acceptance encountered startup timeouts and socket-resource errors. Cancelled image/font downloads could leave source streams open, and some failure evidence was outside uploaded artifacts.

## Final changes

- About opens Chinese and English guides covering tasks, focus, reports, settings, calendar, forest and backups. Portable archives include guides and isolated-data screenshots.
- Runtime and acceptance servers use Node pipeline to close source streams on cancelled downloads, protected by a real HTTP regression.
- Acceptance waits for actual startup, selects history entries from metadata and targets the real settings control. Failed requests, page errors, startup state and screenshots are uploaded.
- Disposable Windows CI runners expand the ephemeral TCP pool and record connection diagnostics. The complete platform matrix and assertions remain enabled; daily-use computers are unchanged.
- Formal retention rules cover the entire 1.7 series and future releases. Independent reports require every required workflow and Release publication to succeed. Useful failed-candidate content is consolidated without an attempt-by-attempt narrative. Versions through 1.6 retain their original rules.
- Successful 1.7.3 and 1.7.11 reports remain, with consistent history and archive links.

## Final validation and publication

Commit edc8ebb passed [all main checks](https://github.com/menggou1/FocusTodo-Local/actions/runs/41049658124), [Pages deployment](https://github.com/menggou1/FocusTodo-Local/actions/runs/41049658084), and [tag checks and publication](https://github.com/menggou1/FocusTodo-Local/actions/runs/41050570153).

The [1.7.11 Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.11) provides ZIP, tar.gz and SHA256SUMS.txt. Downloaded asset digests, extracted startup and document links passed verification. The live version, source commit and actual page startup were checked. Outstanding environment verification stays in [Backlog](../BACKLOG.md).
