# Maintenance and release guide

[English documentation](README.md) · [Architecture](ARCHITECTURE.md) · [Backlog](BACKLOG.md)

Current application: `7.1.1-local.1.4.0`, author Lexible. This guide describes the current workflow. Release reports retain historical evidence; open engineering, verification and proposals live only in the backlog.

## Start development

Check `git status --short`, the current branch and `git remote -v`. Preserve unrelated work. Test imports and resets with generated data in an isolated browser context and an ephemeral port, not the daily database.

Run `npm ci` to install locked development dependencies. Node.js 22+ is required; CI covers 22 and 24. Running the packaged app does not require npm dependencies. Start with `node scripts/start.cjs`, `npm start`, `sh start.sh`, or the Windows launcher. The default origin is `http://127.0.0.1:5500/index.html`. Browser data is scoped to the browser, hostname and port. There is no React source build or hot reload; refresh after editing static files.

## Source boundaries

| File | Responsibility |
|---|---|
| `js/local-timer-core.js` | Pure timer transitions, historical spans and completion events; no DOM or database access |
| `js/local-data.js` | `PomodoroDB6` v3, transaction persistence, import/reset journals and complete snapshots |
| `js/local-timer-ui.js` | Legacy timer adapter, recovery confirmation, subscriptions, audio and completion notifications |
| `js/local-app-ui.js` | Updates, About and five-second reset confirmation |
| `js/local-backup.js` | Compact JSON/Gzip, content sniffing, scope, size analysis and bounded decoding |
| `js/local-theme-storage.js` | Recoverable theme JSON/active/theme writes without copying image data into the journal |
| `js/local-i18n.js` | Language preference, system resolution, local text and legacy fallback |
| `i18n/local-en.json` | English translations for local UI and errors |
| `js/local-i18n-catalog.js` | Generated complete fallback catalog; do not edit directly |
| `js/local-settings-ui.js` | General language controls and explicit notification permission/test controls |
| `release.json` | Human-edited version, author, dates and Chinese/English release notes |
| `patch.js` | Local compatibility, network restrictions, backup controls and themes |
| `js/main.js` | Modified legacy bundle; it cannot be discarded and fully rebuilt from an upstream bundle |

Change legacy integration through the checked AST scripts, then retain both script and bundle changes:

```bash
node scripts/revise-timer-integration.cjs
node scripts/revise-app-integration.cjs
node scripts/revise-pomodoro-rendering.cjs
```

The shared bundle editor checks the known 1,484-module structure, unique boundaries, overlapping edits and final syntax. Inspect a failed boundary instead of bypassing it. Historical `upgrade-*.cjs` scripts are not a complete rebuild pipeline.

`scripts/localize-local-modules.cjs` migrated static local messages to the translation service; it does not translate task names, notes or uploaded filenames. Add new local English messages to `i18n/local-en.json`. Release titles and items also require `titleEn` and `itemsEn`. `npm run build:release` regenerates the catalog, release module, package versions, title and cache tags. Keep Chinese and English current documents aligned; the English historical reports may summarize the original technical history.

## Data rules

Keep timer records and session cursors in one database transaction. A valid partial focus segment has at least 25 seconds; short pauses retain pending spans. Recovery confirmation does not automatically count time after a backup was taken. Reset restores the local user and 15 system navigation lists.

Maintenance ownership uses a separate `PomodoroDB6-maintenance-lock` transaction and owned `LocalMeta` phases. A suspended owner retains its lock; another tab waits until it resumes or closes. Settings recovery runs before the app starts. Theme recovery follows import recovery, and internal theme journals are excluded from backups and discarded from incoming backups. This does not provide strict cross-tab serialization for ordinary theme editing; see the single backlog entry.

Images remain data URLs in localStorage. Backup compression is lossless, but large image restoration remains subject to browser storage quota. Encoded and decoded backups are bounded to 128 MB. Automatic pre-import/reset backups always include wallpapers. Starting a download cannot confirm permanent disk storage.

## Language and local scope

General settings offer Follow system, Simplified Chinese and English. Other existing translations are selected only by Follow system. System language resolution tries an available language/base, then English. Missing legacy strings use the complete English catalog and a readable fallback rather than exposing keys. Changing a language reloads the page without moving browser data. The language preference is included in backups and retained by reset.

Groups, online rankings and the old server-backed forest are disabled, including old imported enable flags. Legacy group-related backup tables remain for compatibility. The personal-growth proposal is described in the backlog; no new forest entry is implied by the legacy bundle containing its code.

## Focused verification

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
python tests/package-smoke.py
```

`npm run benchmark:backup` runs the optional generated 1/10/50 MB benchmark. Its sampled JS heap and fixture responsiveness are not process peak memory or full UI throughput. Do not include private backups, credentials or images in test evidence.

## Version and release

The official base remains 7.1.1. Full version: `7.1.1-local.<major>.<minor>.<patch>`; the annotated Git tag uses only the local version, for example `1.4.0`. The database version and legacy settings marker `Version=6.5` are separate and must not be renamed to match the product version.

Add the newest Chinese/English user-facing update and report to `release.json`, retaining history. Keep report links in repository documents, not application dialogs. `npm run build:release` resolves the configured GitHub remote, with `origin` as the fresh-clone fallback, and regenerates metadata. Check the repository URL.

Work branches stay local. Merge the verified work into the clean primary main worktree, then push main; do not push a work branch merely to trigger CI. Fetch and resolve divergence without force-pushing. Create a new annotated tag from the merged main commit; do not overwrite an old tag.

The workflow tests Windows/macOS/Linux × Node 22/24. Node 24 also runs browser and extracted-package checks. A version tag publishes ZIP, tar.gz and SHA256SUMS only after all tests, version matching and main ancestry pass. Archives contain runtime assets and Chinese/English documentation, excluding npm dependencies, tests, evidence, Git state and credentials. Failed candidate evidence belongs in the release report; deleting a failed Actions record does not fix its cause.

## GitHub Pages

The site is [FocusTodo Local](https://menggou1.github.io/FocusTodo-Local/). Main is source; `gh-pages` is the long-lived static deployment branch and is never merged back into main. Pages uses that branch root. Publish only committed main or an ancestor:

```bash
python scripts/deploy-pages.py --push
```

The script uses a temporary index, preserves deployment history, excludes development documents and the old CNAME, and writes `deployment.json` with the source commit and version. It does not upload local browser databases. Verify the Pages workflow, live manifest and actual application startup under the project path. The online origin has separate storage from local loopback, so moving data requires backup/import.

## Provenance

`upstream/7.1.1` preserves original commit `fe15a1d9201c6298f1c28c16dcb0b58c481f9999` and its original history. Keep the author and LICENSE. Main and gh-pages are local-product branches. The repository left the fork network in October 2026; the upstream archive remains independent of that relationship. Do not modify or merge the archive into current development.
