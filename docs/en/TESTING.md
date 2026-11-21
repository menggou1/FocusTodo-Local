# Testing and verification

[Maintenance](MAINTENANCE.md) · [Architecture](ARCHITECTURE.md) · [中文](../TESTING.md)

## Environment and isolation

Use locked Playwright, fresh browser contexts and generated data with Asia/Shanghai timezone. Comparisons use identical locale, theme, viewport, DPR, scale and animation preferences. Never connect to stable port 5500, daily profiles, real databases or private backups.

Install engines with `npx playwright install chromium firefox webkit`; Linux CI adds --with-deps. Tests normally use ephemeral loopback ports. FOCUS_ACCEPTANCE_DIR selects evidence output. FOCUS_STANDALONE_ENGINES selects chromium,firefox,webkit; complete verification covers all three. FOCUS_TEST_FILTER is for diagnosis only and cannot establish a complete pass.

## Production gates

First run npm ci, npm run build:release, npm run check, npm run build, npm run build:standalone and npm run package:standalone.

| Coverage | Command |
|---|---|
| Units, validation, production HTTP and release metadata | `npm test` |
| Service contracts, timer differential, concurrency, rollback, compatibility and backups | `node --test tests/standalone/*.test.cjs` |
| Three-engine React startup, workspace, domain pages, real storage and isolated archives | `npm run test:standalone` |
| Production same-origin 1.9.4 upgrade, IDs/settings, backups, project base and allowlist | `npm run test:release-app` |
| Complete historical browser regression against the separate archive | `npm run test:browser` |
| Historical Firefox/WebKit capability fallback baseline | `npm run test:compat` |
| Bilingual light/dark UI, shared dialogs and first-frame animation | `node tests/standalone/final-ui-parity.cjs` |
| Inspector deletion, subtask flags and history preservation/removal | `node tests/standalone/inspector-dialog-parity.cjs` |
| Version/checksum/tamper rejection and workflow gates | `python tests/release/release-gate-test.py` |
| Production ZIP/tar.gz and Python fallback | `python scripts/package-release.py`, `python tests/release/package-smoke.py` |
| Byte-for-byte Pages comparison with committed sources | `python tests/release/pages-build-test.py` after committing build inputs |

CI covers Windows/macOS/Linux × Node 22/24. Node 24 runs Chromium and the same portable archives; Linux also runs Firefox/WebKit. React suites cover startup failure/retry, lifecycle and namespace protection, tasks, schedules, timers, reports, forest, settings, download/import and maintenance. WebKit does not certify real Safari. Preserve assertions and diagnostics on failure; do not hide failures with skips, retries or weaker requirements.

## Historical oracle and UI comparison

The read-only tests/helpers/legacy-runtime.cjs uses archive/1.9.4 at b0ee5e26c133ea273e1634fa52b8a107e1649a69, or an explicit FOCUS_LEGACY_ROOT. CI checks out that fixed revision only in test jobs. No old implementation is copied into dev production sources or included in builds, archives or Pages. Historical units and differential tests preserve JSON/Gzip, timer, calendar, preference and unknown-field contracts; they do not establish that React itself works.

Paired tests start independent ephemeral servers for the archive and isolated React application. FOCUS_RESTORE_SHARED=1 is only for manually prepared 5513/5511 comparison servers; verify their ownership first. FOCUS_RESTORE_NEW_PORT selects an isolated preview, never the daily stable service.

Specialist scripts remain under tests/standalone: reports-parity, r2-r3-overlays-parity, visual-settings, r4-r5-settings-drag-parity, visual-timer-forest, calendar-overlay-equivalence and window-scroll-equivalence. They compare real DOM, computed styles, screenshots, interactions and animation while preserving intentional legacy bug fixes. Obsolete one-time bundle audit tools are removed; their historical evidence remains in Git and docs/acceptance.

## Evidence and limits

A history longer than 70 days tests final CSS/bitmap/DPR dimensions, axes and bottom-up reveal on every visible frame. Font/resize updates must not compress rows. Dialog checks cover timer stop, ordinary/repeating tasks, subtasks, projects/folders/tags, records, schedules, settings, backup/reset/safety confirmation, themes, widgets, recovery, updates and pickers. Verify cancel/confirm, focus return, layering and animation, retaining injected negative controls.

Forest reward tests fix the clock before startup and move to a deterministic next-day instant after task completion. Exact assertions for 41g collection, 61g balance and idempotence remain unchanged, avoiding engine clock-install millisecond boundaries.

Current-commit results belong in the release report. Historical evidence keeps its sampling date and does not certify the current SHA. Automation does not establish human visual acceptance, long-term user-data upgrade, Safari, physical audio/notifications, saved downloads or real Bing boundaries. Only [Backlog](../BACKLOG.md) maintains unfinished work and release checks.

`node tests/standalone/settings-regression.cjs` validates current settings, avatars, theme loading, dropdowns, audio feedback and file-selection outcomes with synthetic data on random isolated ports. `node tests/standalone/settings-legacy-reference.cjs` checks only the required historical controls and VolumeTip resource against immutable 1.9.4.

Set `FOCUS_TEST_BUNDLED_BROWSER=1` to use bundled Chromium without a daily browser profile. Browsers with Web Audio use the WAV bytes embedded in the application. Native playback checks confirm decoding, byte equality, silence until the gesture ends and the absence of a separate HTTP request. Media-only ports such as Windows WebKit use the packaged URL and verify the same WAV bytes and native playback.

`python tests/release/ci-validation-test.py` checks exact-commit provenance, all six matrix jobs, artifact expiry/digest/test chronology, newer failures, unsafe skips, and compressed and extracted size limits. The release-gate tests cover version identity, lightweight and annotated tags, the matching remote release branch SHA, first publication, explicit promotion, artifact verification, and Pages provenance. Release-origin failure cases use mocked Git responses.

Security regressions verify the production CSP hashes for startup scripts and handlers. The three-engine startup suite exercises the isolated build and asset failure handling. Node and Python tests cover anti-framing headers and the loopback request boundary. Backup contracts cover legacy JSON/Gzip imports, exports, automatic safety copies, journal recovery, and rollback. Successful imports retain cached wallpaper and users can enable Bing network access again in Settings.

`node tests/standalone/ui-font-readiness.cjs` holds the actual bundled bold-font response, requires geometry sampling to remain pending, then compares the loaded dialog with the immutable oracle. Final UI keeps its original 1px tolerance and all eight locale/theme/width combinations.
