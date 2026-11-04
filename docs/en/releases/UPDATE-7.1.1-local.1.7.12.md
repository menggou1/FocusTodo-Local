# 7.1.1-local.1.7.12 — Timer recovery and local runtime reliability fixes

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-11-04. Author: Lexible.

## Initial problems and delivered behavior

[Actions 41580421068](https://github.com/menggou1/FocusTodo-Local/actions/runs/41580421068) failed calendar acceptance on Linux/macOS Node 24 because the native picker selected the second day of the next month while asserting the fixed date 2026-11-02. Acceptance now derives the expected date from the browser calendar and covers year rollover and a leap-year month without removing scroll, refresh or cancellation assertions.

Timer backups now retain work spans in occurrence order after clock rollback, even when wall-clock ranges overlap. An export dated before the cursor requires confirmation without adding negative time. Declining continuation pauses an interrupted break and retains its elapsed rest through reload, complete backup restoration and peer-tab resumption.

The Node server validates loopback Host values and resolved paths, rejecting external/private link targets. Wallpaper API image addresses require HTTPS and exact Bing hosts without credentials or non-default ports; invalid responses fall through to the next API before image loading. Portable archives include the design manifesto, and contribution-document synchronization adjusts relative documentation links.

Database v3 remains unchanged. Paused breaks use the optional `pausedFrom: 'rest'` field. End that break and export a backup before downgrading to 1.7.11 or earlier. Open work and real-environment verification remain only in Backlog.

## Verification evidence

The original date failure was reproduced locally. Native picker acceptance passed for the current date, December 2026 and January 2028. Isolated real-browser/IndexedDB checks retain 120/150 seconds after clock rollback and preserve paused rest through reload, Gzip restoration and a peer-tab resume without duplicate focus records. Added regressions cover Host, real paths, wallpaper URLs, timer validation and rest transitions while retaining the platform matrix and existing business assertions.

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.7.12.md).

Windows / Node 24.16 / Edge: 71 of 72 Node tests passed with the POSIX-only check skipped. The complete browser suite passed: 18 startup, 64 application and 26 calendar scenarios, plus maintenance, list ordering, audio, profile, forest, achievements and reminders. See [application evidence](https://github.com/menggou1/FocusTodo-Local/blob/1.7.12/docs/acceptance/results.json), [startup evidence](https://github.com/menggou1/FocusTodo-Local/blob/1.7.12/docs/acceptance/startup-results.json) and [calendar evidence](https://github.com/menggou1/FocusTodo-Local/blob/1.7.12/docs/acceptance/calendar-results.json).

Python 3.12.14: all three release-gate tests passed. Both archives passed checksum, extraction under spaces/Unicode, documentation-file-link and dependency-free startup checks. An unrelated tag was rejected. Repeated release generation retained identical file hashes, and `git diff --check` passed.

[Version tag](https://github.com/menggou1/FocusTodo-Local/tree/1.7.12) · [Release and checksums](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.12). Publication requires all six platform combinations for the same main/tag commit and its Pages deployment.

Release commit `307415e3c73b8233d4b6072140c2b70ea699e8fe` passed all six combinations on [main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41809490597) and the [tag/publication workflow](https://github.com/menggou1/FocusTodo-Local/actions/runs/41809550403), with a successful [Pages deployment](https://github.com/menggou1/FocusTodo-Local/actions/runs/41809490603). Live `deployment.json` matches this commit, and isolated browser startup under the actual project subpath passed.

Both actual Release archives and `SHA256SUMS.txt` were downloaded again. Checksum, documentation-file-link, extraction and dependency-free startup checks passed for each published archive.
