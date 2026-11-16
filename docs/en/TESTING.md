# Testing and verification

[Maintenance](MAINTENANCE.md) · [Architecture](ARCHITECTURE.md) · [中文](../TESTING.md)

## Isolation and evidence

Use locked Playwright, fresh browser contexts, generated data and identical locale/theme/viewport/DPR/scale. The UI oracle is 1.9.3 (f102da8919e810006b6611aabcef5f0159057d61)/1.9.4. Preview comparison uses legacy5513 and isolated React5511. Never connect to stable5500 or daily profiles. Tests normally choose random loopback ports; FOCUS_RESTORE_SHARED=1 explicitly selects the preview pair. Verify process ownership first. FOCUS_RESTORE_NEW_PORT selects a built isolated server; FOCUS_ACCEPTANCE_DIR selects evidence output.

Use DOM/computed styles, screenshots, frame samples, pointer/keyboard interactions, database readback and injected failures. Counts/screenshots alone do not establish UI acceptance. When a dedicated Playwright MCP is unavailable, the same locked runtime may be called through the MCP Node tool or repository scripts.

## Suites

- `npm run build`, `npm run build:standalone`: types and production/isolated output.
- `npm test`, `npm run check`: legacy compatibility units and syntax.
- `node --test tests/standalone/*.test.cjs`: pure-core differential, transaction/rollback/concurrency, version and backup contracts.
- `npm run test:standalone`: isolated startup, workspace, domains, services and extracted candidates.
- `npm run test:release-app`: synthetic same-origin legacy upgrade, relative base, metadata and a real downloaded backup.
- `npm run test:browser`: complete legacy compatibility browser suites.
- `final-ui-parity.cjs`, `reports-parity.cjs`, `r2-r3-overlays-parity.cjs`, `r4-r5-settings-drag-parity.cjs`, `visual-settings.cjs`, `visual-timer-forest.cjs`, `calendar-overlay-equivalence.cjs`, `window-scroll-equivalence.cjs` under tests/standalone cover final UI, dialogs, selectors, settings, schedule/timer/forest and motion.
- Python tests/release/release-gate-test.py and pages-build-test.py cover release/deployment gates; package-release.py and package-smoke.py verify both portable archives and fallback startup.

CI covers three OSes × Node22/24, Chromium and Linux Firefox/WebKit. Do not remove effective assertions, skip failures or loosen pixel thresholds. Filters must be disclosed and old results cannot stand in for a current full audit.

## Dialog and first-frame methodology

A history longer than70days exposes the former330px initial canvas height mismatch. Every visible frame must have final CSS/bitmap/DPR dimensions and axes, followed by bottom-up record reveal. Fonts/resize must repaint without compressing rows. Keep negative controls for size/layer/motion regressions.

Inventory: ordinary/repeating task deletion, timer stop, project hide/delete, project/folder/tag creation/editing and nested editors, manual records, schedule quick creation/details, settings, export/import/reset and safety-backup confirmation, wallpaper deletion, timer mode, white noise, widgets, interrupted-time recovery, updates/notifications and date/priority/tag/pomodoro/task popovers. Compare dimensions, fonts, button order, masks, theme, stacking, scroll, confirm/cancel, focus return and motion. File pickers, permission prompts and native PiP belong to the browser/system: verify invocation/fallback, not custom styling.

## Preserved historical baseline

The temporary docs/2.0.0 contract moved into Architecture. Reusable baseline facts are retained here; original rounds remain in Git history and docs/acceptance. Historical results do not imply current-commit or human acceptance.

The2026-11-07 Windows/Node24.16/npm11.16 baseline measured legacy bundle2231533bytes and CSS421259bytes uncompressed. Audit tools remain under tests/performance/audit-*.cjs. Ten authorized historical backups were compared in isolated memory; never publish private samples or equate them with in-place daily-profile acceptance. CI uses generated data.

Previous checks covered three-engine protocol/schema rejection, transaction faults, theme journals, backup roundtrips and same-schema version naming. They do not establish arbitrary downgrade support. Historical UI work covered timer/forest/settings/workspace/calendar/reports, measured fonts/controls, original artwork, scroll and pointer/keyboard behavior. Shared achievement scrolling is an accepted intentional improvement.

The2026-11-15 historical settings round recorded60units,60workspace cases and31service browser cases across engines; Bing was simulated. Earlier motion samples contained long frames, and Vite development versus legacy production is not a controlled performance-equivalence claim. Known New York fall-back calendar-axis/history-offset issues are maintained under V03 in Backlog.

See root MIT/third-party notices and complete bundled React/ReactDOM/scheduler/Noto licenses. Legacy static dependency detection is historical evidence, not the new runtime dependency list. Current results and class-by-class audit are in the [2.0.0 report](releases/UPDATE-2.0.0.md); only [Backlog](../BACKLOG.md) maintains unfinished status. Actual release attachments/live deployment are verified after release.
