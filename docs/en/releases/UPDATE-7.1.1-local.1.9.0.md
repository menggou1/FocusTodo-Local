# 7.1.1-local.1.9.0 — External networking, reliable wallpapers and a mini timer

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-11-07. Author: Lexible.

## Delivered behavior

- Add an external networking (experimental) switch, off by default, using the same bottom toast as interrupted-time recovery when selecting Bing daily while disabled.
- Reject wallpaper redirects, refresh across days, cancel requests and restore saved images offline.
- Protect theme changes with the existing maintenance transaction lock and detect cross-tab conflicts, retaining backup compatibility.
- Open a mini timer on supported browsers using the existing timer commands, with an in-page fallback.
- Mark unread release updates with the shared badge and keep the Restore default order button visually stable.

## Technical and verification account

Metadata and image fetches reject redirects and omit credentials/referrers. Exact HTTPS Bing image hosts are required; downloaded images render as local Blob/data URLs, while CSP rejects direct remote images. Disabling networking aborts pending requests; failures preserve saved images. Cache freshness checks both twelve hours and the local date.

Theme writes and startup recovery share the existing IndexedDB maintenance transaction lock, including the no-Web-Locks fallback. Compare the three previous theme values before committing and reject stale changes. Image downloads do not hold this lock.

The native mini window uses the existing timer adapter and tick, with no second database or session. Its start/pause/stop controls reflect current state. Closing, maintenance or the main page exiting releases the window and references. Missing APIs or denied requests use the existing in-page floating timer. See the [Chrome API lifecycle](https://developer.chrome.com/docs/web-platform/document-picture-in-picture).

Keep PomodoroDB6 v3 and all previous theme/session/history formats. The optional `FocusTodo.externalNetwork` preference defaults to false and is included in existing full backups. Before reverting to 1.8.x, export a backup: older builds ignore this switch and follow their previous Bing request policy.

General settings reuse the existing scrolling component. Disable the unused cloud broker subscription, which otherwise throws synchronously under Firefox CSP and prevents startup. Synthetic XHR uses a same-origin placeholder that is never sent.

## Evidence

Windows / Node 24: 92 unit tests passed, one POSIX-only test skipped; syntax, generation and whitespace checks passed. The full isolated Edge suite passed startup, 66 application scenarios, maintenance, calendar and all specialized controls/data suites. Nine 1.9 scenarios cover opt-in networking, the existing bottom toast, release reads, metadata/image redirects, cancellation, day changes, no-Web-Locks ownership, timeout/offline fallback, cancellation of queued cached selections on opt-out or a newer choice, and native mini-window commands/lifecycle. The mini view also passed 340×280 button bounds, rest-phase and peer-state checks.

A real isolated Bing retrieval returned HTTP 200 for metadata and image and saved/activated the wallpaper. Failure, redirect and day-change tests use controlled requests/clocks. Python 3.12 checks passed extracted ZIP/tar.gz startup without npm/Git in Unicode/space paths, Python fallback, invalid-tag rejection and package documentation links. JSON/screenshots go to `dist/acceptance/` and CI evidence artifacts.

Four isolated Firefox/WebKit × Chinese/English cases passed startup, task persistence, start/pause/stop, reload recovery, theme saves and backup imports with Document PiP, BroadcastChannel, Web Locks and compression APIs forcibly removed. No CSP violations occurred. These engine checks do not establish full real Safari acceptance.

[Release and archives](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.9.0) · [Tag workflows](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.9.0) · [Pages](https://menggou1.github.io/FocusTodo-Local/).

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.9.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
