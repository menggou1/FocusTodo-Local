# Maintenance and release guide

[English documentation](README.md) · [Architecture](ARCHITECTURE.md) · [Backlog](BACKLOG.md)

Current worktree: `7.1.1-local.1.9.0`, author Lexible. Version 1.6.0 has a tag but no Release. This guide describes the current workflow. Release reports retain historical evidence; open engineering, verification and proposal status live only in the backlog. [Milestone plans](plan/README.md) record goals and dependencies without a second progress list.

The 1.9 browser suite covers opt-in networking, the shared bottom toast, release badges, wallpaper redirects/timeouts/day changes/cancellation, theme ownership and native mini windows. After `npx playwright install firefox webkit`, run `npm run test:compat` for Firefox/WebKit startup, tasks, timer recovery, themes and backup imports without BroadcastChannel, Web Locks or compression APIs. Linux Node 24 CI also runs this suite. Automated WebKit checks do not establish full real Safari acceptance.

Design-theory documents are for entertainment only and are not development rules. Unless the user explicitly requests it, models must not read, consult or modify those documents. Development follows user requirements, code evidence and this maintenance guide.

## Start development

Check `git status --short`, the current branch and `git remote -v`. Preserve unrelated work. Test imports and resets with generated data in an isolated browser context and an ephemeral port, not the daily database.

Run `npm ci` to install locked development dependencies. Node.js 22+ is required; CI covers 22 and 24. Running the packaged app does not require npm dependencies. Start with `node scripts/start.cjs`, `npm start`, `sh start.sh`, or the Windows launcher. The default origin is `http://127.0.0.1:5500/index.html`. Browser data is scoped to the browser, hostname and port. There is no React source build or hot reload; refresh after editing static files.

## Source boundaries

The Node and Python servers accept only `127.0.0.1` or `localhost` Host values with valid optional ports. Custom domains are unsupported. Both disable caching and send `nosniff`. Node real-path checks reject links outside the runtime root or into hidden/private tooling paths. The Python fallback rejects symlinks and uses the same runtime allowlist, but does not support Node's audio range requests.

Acorn, Playwright and fake-indexeddb are development dependencies only. The new data-service regression tests use isolated in-memory IndexedDB transactions to verify imports and conflict rejection. They do not replace real-browser acceptance.

Paused breaks use the optional session field `pausedFrom: 'rest'`, retained by backups without changing database v3. End that break and export a backup before downgrading to 1.7.11 or earlier, which does not understand this field. Work spans retain occurrence order after a clock rollback even when wall-clock ranges overlap. Imports dated before the saved cursor require confirmation without counting a negative interval.

| File | Responsibility |
|---|---|
| `src/startup.css` / `src/js/local-startup.js` | First-screen sources inlined into HTML by `build:release`; independent of external styles/fonts. Progress follows real resource completion and app mounting. Reveal after required styles/data recovery, without waiting for optional images/fonts |
| `js/local-timer-core.js` | Pure timer transitions, historical spans and completion events; no DOM or database access |
| `js/local-data.js` | `PomodoroDB6` v3, transaction persistence, import/reset journals and complete snapshots |
| `js/local-timer-ui.js` | Legacy timer adapter, recovery confirmation, subscriptions, audio and completion notifications |
| `js/local-app-ui.js` | Task reminders, independent task/release reads, About and five-second reset confirmation |
| `js/local-achievements.js` | Original forest collection animations, reduced motion, local achievements, original ranking drawer and refresh scheduling |
| `js/local-backup.js` | Compact JSON/Gzip, content sniffing, scope, size analysis and bounded decoding |
| `js/local-theme-storage.js` | Recoverable theme JSON/active/theme writes without copying image data into the journal |
| `js/local-i18n.js` | Language preference, system resolution, local text and legacy fallback |
| `public/i18n/local-en.json` | English translations for local UI and errors |
| `src/js/local-i18n-catalog.js` | Generated complete fallback catalog; do not edit directly |
| `js/local-settings-ui.js` | General language controls and explicit notification permission/test controls |
| `src/local-controls.css` | Shared control atoms across the application: existing button, switch, tomato icon, date-picker and menu visuals; feature layout remains in its owning module |
| `release.json` | Human-edited version, author, dates and Chinese/English release notes |
| `src/patch.js` | Ordered, idempotent installation of identity, network, backup UI, settings and themes through their owning feature services |
| `src/js/local-network.js` | Same-origin/Bing policy and reachable legacy account XHR behavior; preserve real profile edits |
| `js/local-calendar.js` | Local calendar selection/layout/lifecycle; data and timer commands use the existing services |
| `src/js/main.js` | Modified legacy bundle; it cannot be discarded and fully rebuilt from an upstream bundle |

Change legacy integration through the checked AST scripts, then retain both script and bundle changes:

```bash
node scripts/revise-timer-integration.cjs
node scripts/revise-app-integration.cjs
node scripts/revise-controls-integration.cjs
node scripts/revise-pomodoro-rendering.cjs
node scripts/revise-project-management.cjs
node scripts/revise-local-profile.cjs
node scripts/revise-calendar-integration.cjs
```

The shared bundle editor checks the known 1,484-module structure, unique boundaries, overlapping edits and final syntax. Inspect a failed boundary instead of bypassing it. Historical `upgrade-*.cjs` scripts are not a complete rebuild pipeline.

`scripts/localize-local-modules.cjs` migrated static local messages to the translation service; it does not translate task names, notes or uploaded filenames. Add new local English messages to `public/i18n/local-en.json`. Release titles and items also require `titleEn` and `itemsEn`. `npm run build:release` regenerates the catalog, release module, package versions, title and cache tags. Keep Chinese and English current documents aligned; the English historical reports may summarize the original technical history.


Module ownership follows features. Reuse the existing data, backup, settings and theme APIs before adding another compatibility file; reducing line count alone does not complete a refactor.

### Style ownership and reuse

| Source | Responsibility |
|---|---|
| `src/main.css` | Legacy feature layout, typography, themes and vendor foundations across sidebar, tasks, timers, calendar, statistics and other application areas |
| `src/local-controls.css` | Shared buttons, icon buttons, settings rows, menus, date pickers/popovers, tomato icons and text truncation; legacy class aliases share declarations while preserving specificity and required exceptions |
| `src/local-ui.css` | Local feature layout and interaction states; common button borders, backgrounds, colors and cursors belong to controls |
| `FocusSettings.selectStyles()` / `switchProps()` | Shared selects for Pomodoro, Appearance and language; shared switch parameters for Pomodoro and General settings. Read current theme colors when used |
| `src/startup.css` | Independent inlined first screen, without application-control or external-font dependencies |
| `src/purchase.css` / `src/resetpassword.css` | Original standalone-page layout; no local application theme variables, retaining existing isolation of legacy account networking |

Reuse an existing atom or compatibility alias before adding a control; retain feature layout in its owning module. Run `revise-controls-integration.cjs` after `revise-app-integration.cjs` and verify idempotence. A new root runtime stylesheet must be included in HTML, portable archives and the Pages allowlist.

## Data rules

Keep timer records and session cursors in one database transaction. A valid partial focus segment has at least 25 seconds; short pauses retain pending spans. Recovery confirmation does not automatically count time after a backup was taken. Reset restores the local user and 15 system navigation lists.

Maintenance ownership uses a separate `PomodoroDB6-maintenance-lock` transaction and owned `LocalMeta` phases. A suspended owner retains its lock; another tab waits until it resumes or closes. Settings recovery runs before the app starts. Theme recovery follows import recovery, and internal theme journals are excluded from backups and discarded from incoming backups. This does not provide strict cross-tab serialization for ordinary theme editing; see the single backlog entry.

Images remain data URLs in localStorage. Backup compression is lossless, but large image restoration remains subject to browser storage quota. Encoded and decoded backups are bounded to 128 MB. Automatic pre-import/reset backups always include wallpapers. Starting a download cannot confirm permanent disk storage.

## Language and local scope

General settings offer Follow system, Simplified Chinese and English. Other existing translations are selected only by Follow system. System language resolution tries an available language/base, then English. Missing legacy strings use the complete English catalog and a readable fallback rather than exposing keys. Changing a language reloads the page without moving browser data. The language preference is included in backups and retained by reset.

Groups and online rankings remain disabled. The original forest UI uses local sunlight and one-time achievements. Legacy group-related backup tables remain for compatibility.

## Focused verification

New browser and benchmark evidence goes to `dist/acceptance/`. Set `FOCUS_ACCEPTANCE_DIR` to redirect browser evidence. `docs/acceptance/` preserves historical evidence and is not overwritten by current runs.

Use checks appropriate to the change. Do not repeat expensive performance or manual-environment runs merely to re-confirm unrelated code.

```bash
npm run build:release
npm run check
npm test
npm run test:browser
git diff --check
```

The browser runner starts an isolated loopback server, uses fresh contexts and blocks outside network requests except explicit scenarios. Set `FOCUS_TEST_FILTER` for a targeted run; filtered evidence does not replace a complete CI result. CI installs Playwright Chromium with `FOCUS_TEST_BUNDLED_BROWSER=1`. Locally the runner can use Edge/Chrome or `FOCUS_TEST_BROWSER`.

Python 3.12+ builds portable archives and checks extracted execution and documentation links:

```bash
python scripts/package-release.py
python tests/release/package-smoke.py
```

`npm run benchmark:backup` runs the optional generated 1/10/50 MB benchmark. Its sampled JS heap and fixture responsiveness are not process peak memory or full UI throughput. Do not include private backups, credentials or images in test evidence.

## Version and release

Keep historical reports and public evidence as records of their time. New reports describe the problem, final behavior, validation and relevant failures; unfinished work belongs only in Backlog.

`main` is the default stable branch; PR review is recommended, not mandatory. Any development branch can publish portable packages via a version tag without merging or deploying Pages. Feature-branch test releases default to Pre-release. A fully accepted release branch may explicitly publish a stable Release.

An unpublished candidate can be fixed and revalidated, including moving its tag after confirming no public Release or concurrent publication exists. Do not silently replace a published Pre-release: use a new version for fixes, or explicitly promote it after verifying its assets match the accepted build. Never overwrite a published stable Release or its assets; publish fixes as a new version. Preserve historical failures and necessary evidence.

The 1.x series, including this 1.9.0 release, uses `7.1.1-local.<major>.<minor>.<patch>`; annotated Git tags use only the local version. **Starting with 2.0.0, both application version and tag use the independent three-part version `2.0.0`, followed by major, feature and patch increments. Keep 7.1.1 only as provenance metadata, outside the application version.** This version rule is decided. The database version and legacy settings marker `Version=6.5` remain separate.

**Version 1.9.0 retains the old format:** current generators and metadata remain applicable. During 2.0.0 development, update generation, display, old/new version recognition, release history, packaging and deployment gates together. Verify old backups, notification reads, cache and data continuity. Renaming must not reset databases, preferences or records, or rewrite historical versions, tags or Releases. The [2.0.0 plan](plan/2.0.0.md) defines the implementation order; status stays in Backlog.

Add the newest Chinese/English user-facing update and report to `release.json`, retaining history. Keep report links in repository documents, not application dialogs. `npm run build:release` resolves the configured GitHub remote, with `origin` as the fresh-clone fallback, and regenerates metadata. Check the repository URL.

Develop and validate on a branch; use a PR when review is useful. Update release metadata and bilingual reports for application releases. Push an annotated tag equal to `localVersion` from the intended commit. Tag pushes run full CI and create a Pre-release; avoid `[skip ci]` on release commits. After full acceptance of a release branch, run `gh workflow run ci.yml --ref <version-tag> -f release_channel=stable` to run full CI again and create a stable Release or explicitly promote the matching Pre-release. The operator's stable selection confirms acceptance; branch names do not prove acceptance. Check Actions, assets and release evidence. Verify Pages separately when deploying main.

Branch pushes, main PRs, version tags and manual runs use `.github/workflows/ci.yml`. Preflight checks generated files, syntax, Pages filtering and release tests, then builds the archives. Documentation-only PRs may use a reduced matrix; all other runs, including tags, run Windows/macOS/Linux × Node 22/24 tests. All three Node 24 jobs smoke-test the same archives and run Chromium acceptance. Publication requires the tag run's preflight and complete matrix, matching versions and verified assets; it does not require main ancestry or Pages. Pages deploys only from main after full tests and refuses superseded commits. Browser evidence is retained for seven days; preserve required release evidence in the report. Archives exclude npm dependencies, tests, evidence, Git state and credentials.

## Documentation layout

The user guides are `docs/GUIDE.md` and `docs/en/GUIDE.md`; shared screenshots live in `docs/guide-images/` and ship in portable archives. Chinese and English release reports are in `docs/releases/` and `docs/en/releases/`. Old redirect pages are removed; links point directly to archived reports. When moving documents, update relative links, release metadata, generators and package contents, and check paths and anchors. Existing English reports are preserved by the generator.

Engineering version plans live in `docs/plan/`, mirrored in `docs/en/plan/`, and record scope, priority, implementation order and acceptance criteria. Backlog alone tracks task status. Engineering documents and entertainment design-theory documents stay separate without cross-links; theory documents do not generate contributing guides or development requirements. Entertainment theory is excluded from portable runtime packages; all documentation stays out of the Pages runtime artifact.

## GitHub Pages

The site is [FocusTodo Local](https://menggou1.github.io/FocusTodo-Local/). `main` keeps the complete project. Repository Settings → Pages → Source must be **GitHub Actions**. `.github/workflows/ci.yml` deploys main after its full test matrix succeeds and supports manual runs on main. The `gh-pages` branch is no longer maintained or required.

Official `configure-pages`, `upload-pages-artifact` and `deploy-pages` actions publish through the `github-pages` environment. Build has `contents: read` and `pages: read`; deployment has `pages: write` and `id-token: write`. No personal token is required. Deployments run serially without cancelling an active deployment.

The shared whitelist `scripts/runtime-layout.json` maps committed `src/` and `public/` files to their original browser paths. The Pages artifact adds `.nojekyll` and `deployment.json`, excluding tooling, tests and docs. The workflow uploads `dist/pages`. Portable archives add launchers and release documentation to the same runtime files.

Build a local preview with Python 3.12+ into a new directory:

```bash
python scripts/deploy-pages.py --output dist/pages-preview
```

The preview builds committed `HEAD` by default; use `--ref` to preview another commit. To redeploy, run **Test, deploy and release** on main in Actions. The build script no longer accepts `--push` or `--remote` and does not write a deployment branch. This migration keeps the application version, historical tags and Releases unchanged. It does not upload local browser databases. Verify the successful workflow, live manifest and actual startup under the project path. The online origin has separate storage from local loopback; moving data requires backup/import.

## Provenance

`upstream/7.1.1` preserves original commit `fe15a1d9201c6298f1c28c16dcb0b58c481f9999` and its original history. Keep the author and LICENSE. Main keeps the local product; the official Pages workflow publishes a filtered artifact. The repository left the fork network in October 2026; the upstream archive remains independent of that relationship. Do not modify or merge the archive into current development.

## Startup feedback and performance sampling

After editing `src/startup.css` or `src/js/local-startup.js`, run `npm run build:release` to regenerate the inlined first screen. `node tests/browser/startup-acceptance.cjs` runs the startup and font cases; the full `npm run test:browser` includes them. For an optional cold-start comparison, run `node tests/performance/startup-performance.cjs <verified baseline commit>`. It uses isolated data and the project subpath, 150 ms synthetic latency and 200 KiB/s download throughput, aborting optional images/fonts equally. The JSON evidence is not a live Pages speed guarantee or a CI timing threshold.

List management component integration is maintained by `node scripts/revise-project-management.cjs`.

## Commit messages

Use Conventional Commits for future commits: `type(optional-scope): short description`. Use `fix:` for repairs, `feat:` for new features, and `docs:`, `refactor:`, `test:` or `chore:` for their respective changes. Preserve published history.

## Full-application style refactoring and visual acceptance

Declare the refactoring scope, reference and intended visual changes before editing. **The 1.8.2 refactor covers all styles**, including sidebar, settings, timer, calendar, forest and other pages; there are no excluded target regions. Selectors, ownership and reuse may change while visuals and interactions remain stable by default. Explicit changes such as the language menu and collect-all action have their own acceptance criteria. Refactoring CSS organization does not require changing typography or layout.

Measure a known pre-change revision with the same locale, theme, viewport, zoom and isolated data. Screenshot pixels are not CSS pixels. Keep independent computed-style evidence and deliberately injected regression checks covering geometry, clipping, popovers, keyboard input and control states. The existing sidebar fixture `tests/fixtures/sidebar-typography-cfd6449.json` remains visual regression evidence, not a freeze on CSS files or selector ownership. Future visual baseline changes need clear requirements and independent evidence; local feature changes should constrain their effects. Correct regressions locally while preserving useful changes. Passing test counts do not replace visual acceptance.

Candidate tags 1.7.0, 1.7.1 and 1.7.2 are preserved; their unfinished updates are consolidated in the 1.7.3 report, with no separate formal report or Release. Current publication rules are described in Version and release above. Existing expanded English historical reports are retained. Task reminders use persistent task/date read identities independently of release reads; forest collection respects reduced motion.

