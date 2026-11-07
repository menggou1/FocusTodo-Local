# 7.1.1-local.1.8.3 — Audit fixes and reminder layout improvements

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-11-07. Author: Lexible.

## Delivered behavior

- Validate timer backups before replacing existing records.
- Detect cross-tab schedule conflicts and prevent stale edits from restoring deleted plans.
- Fix cancelled network requests, large reminder and reward collections, break recovery display and the Python server.
- Prevent sunlight from flashing back after collection animations while preserving retries.
- Improve reminder date padding, line spacing and long-title wrapping.

## Technical and verification account

Applied the six-category audit patch against 56df8eb after verifying its checksums. Timer imports validate dates, safe counters, pending spans and historical sequence IDs before maintenance starts. Schedule updates compare their original snapshot inside the write transaction; local gestures and six legacy editing paths forward that snapshot. XHR responses cancel pending delivery when reopened or aborted, preserve event ordering and support typed responses. Large reminder/reward collections avoid unbounded argument expansion. Interrupted breaks retain their rest duration in recovery. The Python fallback validates Host and disables cached responses.

Successful sunlight nodes are hidden before cancelling the forwards-filled animation, covering the asynchronous query and React removal gap. Failed rewards remain retryable. Reminder rows use 16px horizontal padding, separate secondary dates and wrapping titles; styles remain scoped to the reminder list.

## Evidence

- Windows / Node 24: 92 unit tests passed, one POSIX-only test skipped; syntax checks passed.
- Isolated Edge: frame sampling during normal-motion bulk collection with a 220ms delayed refresh found no flashback. Reduced motion, failure/retry and concurrent reward deduplication passed.
- Reminder geometry covers Chinese and English dark mode, horizontal date padding, wrapped titles and vertical spacing. Injected negative date padding is rejected by the geometry guard.
- Full Edge acceptance passed: 18 startup, 66 app, eight maintenance and 31 calendar cases, plus list ordering, audio, profile, forest, achievements, reminders and four language/theme controls groups. Real-browser XHR abort/reopen/JSON events, rejected corrupt imports and cross-tab stale schedule edits passed; interrupted breaks and legacy backup compatibility remain covered. V09 was removed from both backlogs after completion.
- Repeated calendar AST integration produced identical bundle hashes; release generation and diff checks passed.
- Python 3.12 portable checks passed for extracted ZIP/tar.gz without npm/Git in Unicode/space-containing paths, Python fallback startup and mismatched-tag refusal.
- [Release and portable downloads](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.8.3).

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.8.3.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
