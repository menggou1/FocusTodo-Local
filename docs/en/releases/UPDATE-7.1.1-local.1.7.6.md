# 7.1.1-local.1.7.6 — Guide, documentation and startup verification

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文报告](../../releases/UPDATE-7.1.1-local.1.7.6.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Continue the illustrated guide, About link and document organization from the [1.7.4 candidate](UPDATE-7.1.1-local.1.7.4.md).
- Startup acceptance still uses the real same-origin server and blocks external requests, but no longer intercepts every same-origin request. Explicit fault-injection routes and parallel-resource assertions remain.
- Check that failure of `local-app-ui.js` exposes retry, successfully reloads and retains local settings. Capture evidence before releasing held optional resources.

## Background and verification

The [1.7.5 candidate](UPDATE-7.1.1-local.1.7.5.md) recorded `net::ERR_NO_BUFFER_SPACE` on a critical Windows script request. This does not establish the 1.7.4 cause; the exhaustion source remains in [Backlog](../BACKLOG.md). Neither candidate was tagged or released. See GitHub Actions for cross-platform verification and release results.

Local release generation, syntax and metadata checks passed, along with 18 isolated browser startup scenarios including a simulated critical-module failure and user retry.
