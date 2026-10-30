# 7.1.1-local.1.7.11 — Windows release environment and maintenance rules

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文](../../releases/UPDATE-7.1.1-local.1.7.11.md)

Date: 2026-10-30 (Asia/Shanghai). Author: Lexible.

## Changes

About links to illustrated Chinese and English guides. Runtime and acceptance servers use pipeline so cancelled downloads close source streams; a real HTTP regression fails before the repair and passes afterward. Browser checks wait for actual startup, select historical entries from metadata and use the actual settings icon. Calendar failures save requests, errors, startup DOM and screenshots in uploaded evidence.

Windows CI expands the ephemeral TCP port pool and records network state before and after the full browser suite. Tests, platforms and assertions remain enabled, without retries. These settings apply to disposable CI runners, not the user's computer.

The new formal-release documentation rule applies prospectively. All historical reports, old entry points and original update entries mistakenly removed in this task are restored from Git. Existing versions are governed by their historical rules. New links point directly into releases directories.

## Failed candidates consolidated here

Local 1.7.7 exposed a hard-coded historical title; 1.7.8 exposed an unused settings CSS selector; 1.7.9 could not overwrite an occupied screenshot, so complete checks use an independent FOCUS_ACCEPTANCE_DIR. They had no tags or Releases.

[1.7.10 main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125344) and [Pages](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125278) passed, but [tag Windows Node 24](https://github.com/menggou1/FocusTodo-Local/actions/runs/41048222252) failed navigating the second maintenance scenario with net::ERR_NO_BUFFER_SPACE. Release publication was blocked. Its immutable tag stays; its report and update entry are consolidated here. Closing leaked streams alone did not eliminate the Windows socket-resource failure.

[Microsoft's port-exhaustion guidance](https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/tcp-ip-port-exhaustion-troubleshooting) describes high connection churn and TIME_WAIT as a possible source. The runner adjustment records its port range and occupancy; it does not claim one root cause for all historical timeouts without evidence.

## Verification and publication

Validation covers generated files, Node, syntax, full isolated browser acceptance, release gates, Pages filtering and extracted ZIP/tar.gz startup. Formal retention requires successful main tests, Pages, all tag tests and Release publication for the same commit. Evidence: [main](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain), [1.7.11 tag](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.11), [Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.11). Open verification stays in [Backlog](../BACKLOG.md).

Product modules match 1.7.10, whose complete local evidence remains under docs/acceptance/release-1.7.10. Version 1.7.11 locally rechecks Node (62 passed, one platform skip), syntax, history/notifications/About, release gates and both portable formats. The new Windows runner configuration is exercised by the full main/tag matrices, never on the daily-use computer.
