# FocusTodo 2.0.2

[Changelog](../CHANGELOG.md) · [Chinese report](../../releases/UPDATE-2.0.2.md)

Date: 2026-11-17 (Asia/Shanghai). Resumed from remote dev adcd3a216ac084f3893eb9c1a6bb3b8c6383e0b9. The abandoned 2.0.1 candidate is not reused.

This release retains the 15 settings, avatar, theme, volume and cancellation fixes documented in the [2.0.1 candidate report](UPDATE-2.0.1.md). The Simplified Chinese title reads the canonical version metadata.

CI #137 sampled a repeating-task deletion dialog before its newly requested Noto Sans SC bold face finished loading. The 10px vertical difference disappeared by the failure screenshot. A startup font promise and a fixed 300ms animation wait do not cover font weights requested by a later dialog. Geometry sampling now flushes layout, waits for the current font set and reads the final boxes. A controlled test holds the actual bold-font response, requires sampling to stay pending, and then compares the loaded dialog to immutable 1.9.4. The previous sampler fails this regression. Product styles, animation, all eight visual scenarios and the 1px tolerance remain intact.

Development runs the full six-job matrix. Release/main/tag runs may reuse successful exact-commit evidence and the original tested archive batch, with digest, expiry, chronology, newer-failure and fresh-content checks plus an independent gate. The formal tag points to the checked main commit; downloaded archives and Pages provenance are verified before release-branch cleanup. All tests use temporary origins, synthetic data and disposable profiles. Execution status and remaining real-system/manual boundaries live only in [Backlog](../BACKLOG.md).

Local validation passed: type checking, production/isolated builds, 82-document link checks, 89 units (one existing platform skip), 66 standalone contracts, 9 CI policy and 6 release-gate tests, the positive/negative cold-font regression, eight final visual scenarios and four inspector dialogs. Both portable archives passed checksum/extraction/startup checks, including Unicode paths, no npm/Git and Python fallback. Cloud and publication outcomes are provided by the exact-commit Actions and Release records.
