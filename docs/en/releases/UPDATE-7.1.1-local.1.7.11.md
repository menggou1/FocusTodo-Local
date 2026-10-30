# 7.1.1-local.1.7.11 — Windows release environment and maintenance rules

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文](../../releases/UPDATE-7.1.1-local.1.7.11.md)

Date: 2026-10-30 (Asia/Shanghai). Author: Lexible.

## Changes

About links to illustrated Chinese and English guides. Runtime and acceptance servers use pipeline so cancelled downloads close source streams; a real HTTP regression fails before the repair and passes afterward. Browser checks wait for actual startup, select historical entries from metadata and use the actual settings icon. Calendar failures save requests, errors, startup DOM and screenshots in uploaded evidence.

Windows CI expands the ephemeral TCP port pool and records network state before and after the full browser suite. Tests, platforms and assertions remain enabled, without retries. These settings apply to disposable CI runners, not the user's computer.

The formal-release documentation rule applies to all 1.7 versions and future releases; versions through 1.6 retain their historical rules. All historical reports, old entry points and original update entries mistakenly removed in this task are restored from Git. Existing versions are governed by their historical rules. New links point directly into releases directories.

## Failed candidates consolidated here

Local 1.7.7 exposed a hard-coded historical title; 1.7.8 exposed an unused settings CSS selector; 1.7.9 could not overwrite an occupied screenshot, so complete checks use an independent FOCUS_ACCEPTANCE_DIR. They had no tags or Releases.

[1.7.10 main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125344) and [Pages](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125278) passed, but [tag Windows Node 24](https://github.com/menggou1/FocusTodo-Local/actions/runs/41048222252) failed navigating the second maintenance scenario with net::ERR_NO_BUFFER_SPACE. Release publication was blocked. Its immutable tag stays; its report and update entry are consolidated here. Closing leaked streams alone did not eliminate the Windows socket-resource failure.

[Microsoft's port-exhaustion guidance](https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/tcp-ip-port-exhaustion-troubleshooting) describes high connection churn and TIME_WAIT as a possible source. The runner adjustment records its port range and occupancy; it does not claim one root cause for all historical timeouts without evidence.

## Verification and publication

Validation covers generated files, Node, syntax, full isolated browser acceptance, release gates, Pages filtering and extracted ZIP/tar.gz startup. Formal retention requires successful main tests, Pages, all tag tests and Release publication for the same commit. Evidence: [main](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain), [1.7.11 tag](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.11), [Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.11). Open verification stays in [Backlog](../BACKLOG.md).

Product modules match 1.7.10, whose complete local evidence remains under docs/acceptance/release-1.7.10. Version 1.7.11 locally rechecks Node (62 passed, one platform skip), syntax, history/notifications/About, release gates and both portable formats. The new Windows runner configuration is exercised by the full main/tag matrices, never on the daily-use computer.

## Consolidated failed 1.7 candidates

### 7.1.1-local.1.7.4 — User guide and documentation organization

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文报告](../../releases/UPDATE-7.1.1-local.1.7.11.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- About links to the Chinese or English user guide beside the repository link.
- The illustrated guide covers tasks, timer, reports, settings, calendar, forest and backups for the local edition, using isolated test data.
- Historical reports are organized under `docs/releases/` and `docs/en/releases/`, with links at old paths. Home pages, navigation, metadata, generator and package contents are synchronized.

## Verification and release

Local release generation and syntax checks passed; Node tests passed 60 with one platform skip. Filtered browser checks passed for Chinese and English About links. Relative document paths and heading anchors were checked, and three release-gate tests passed. Both archives passed extracted-document links and startup checks in a temporary path with spaces and Chinese characters; a mismatched tag was rejected. GitHub Actions supplies the full cross-platform tests, Pages and release gate. Historical reports retain their original facts and evidence; Maintenance describes current procedures.

The [1.7.4 main run](https://github.com/menggou1/FocusTodo-Local/actions/runs/41016504396) timed out waiting for the startup status on Windows Node 24; the other five matrix jobs and Pages succeeded. The page state was not captured, so the cause is unknown. No 1.7.4 tag or Release was created. Version 1.7.5 adds diagnostics.

### 7.1.1-local.1.7.5 — Guide, documentation and acceptance diagnostics

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文报告](../../releases/UPDATE-7.1.1-local.1.7.11.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Continue the illustrated bilingual guide, About link, README cleanup and historical report organization from the [1.7.4 candidate](UPDATE-7.1.1-local.1.7.11.md).
- Capture bounded page state, requests, failures, page errors and a screenshot on startup acceptance failure without retries or longer assertion waits.

## Verification and release

The 1.7.4 main Windows Node 24 startup assertion timed out waiting for the status element; five other jobs and Pages succeeded. The cause is unknown because page state was not captured, and no 1.7.4 tag was created. New diagnostics preserve evidence if it happens again; see this version's GitHub Actions for cross-platform test and release results.

Local generation and syntax checks passed, as did 60 Node tests (one platform skip), 17 startup scenarios and the filtered Chinese/English About checks. A deliberately injected failure verified that state, requests and a screenshot are captured before the held requests are released.

The [1.7.5 main run](https://github.com/menggou1/FocusTodo-Local/actions/runs/41017501174) failed a different Windows startup scenario: `/js/local-app-ui.js` failed with `net::ERR_NO_BUFFER_SPACE` and a dependent module was unavailable. Five other jobs and Pages succeeded. This does not establish the cause of the 1.7.4 timeout. No 1.7.5 tag or Release was created.

### 7.1.1-local.1.7.6 — Guide, documentation and startup verification

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文报告](../../releases/UPDATE-7.1.1-local.1.7.11.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Continue the illustrated guide, About link and document organization from the [1.7.4 candidate](UPDATE-7.1.1-local.1.7.11.md).
- Startup acceptance still uses the real same-origin server and blocks external requests, but no longer intercepts every same-origin request. Explicit fault-injection routes and parallel-resource assertions remain.
- Check that failure of `local-app-ui.js` exposes retry, successfully reloads and retains local settings. Capture evidence before releasing held optional resources.

## Background and verification

The [1.7.5 candidate](UPDATE-7.1.1-local.1.7.11.md) recorded `net::ERR_NO_BUFFER_SPACE` on a critical Windows script request. This does not establish the 1.7.4 cause; the exhaustion source remains in [Backlog](../BACKLOG.md). Neither candidate was tagged or released. See GitHub Actions for cross-platform verification and release results.

Local release generation, syntax and metadata checks passed, along with 18 isolated browser startup scenarios including a simulated critical-module failure and user retry.
