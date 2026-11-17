# Development and release maintenance

[Home](../../README_en.md) · [Architecture](ARCHITECTURE.md) · [Testing](TESTING.md) · [中文](../MAINTENANCE.md)

## Environment and commands

Development requires Node.js 22.12+ and locked `npm ci`; packaging requires Python 3.12+. Portable runtime needs no npm dependencies. The standard-library Python fallback supports Python 3.7+.

| Command | Purpose |
|---|---|
| `npm run dev` | Isolated Vite/HMR preview on 5511; fresh browser context only |
| `npm run build:release` | Generate package/lock/app versions, compatibility metadata and bilingual history from release.json |
| `npm run build` | Typecheck and build production React into dist/app/site; private maps in dist/app/debug |
| `npm start -- --no-browser --port 5512` | Run the built production app; default port is 5500 |
| `npm run build:standalone` | Build isolated test app into dist/standalone/site |
| `npm run start:standalone -- --port 5512` | Serve isolated build; 5500 is excluded |
| `npm run package:standalone` | Isolated CI archives |
| `python scripts/package-release.py` | Package fresh production output and distribution docs |
| `python scripts/deploy-pages.py --output dist/pages-preview` | Verify committed inputs against the production build; output must not exist |

`standalone/app/main.tsx` mounts App. Features, domain rules and explicit services live under standalone/. Legacy src/ is retained for compatibility tests and the 1.9.x UI oracle; it is excluded from production archives and Pages. revise-*.cjs are legacy tools; upgrade-*.cjs are historical one-time scripts, not 2.0 build steps.

Close all old app windows before upgrading to avoid mixed-client writes. Production uses PomodoroDB6 v3 and legacy keys. Preview uses namespaced data and loopback attestation. Do not disable preview guards, use the stable 5500 service for tests, or access real profiles/private backups. Use fresh contexts and generated data. Keep temporary files in identifiable task directories, remove only this task's files, and never change system permissions for cleanup.

## Development rules

Reuse the regular checkout and long-lived dev branch; current preparation explicitly uses refactor/standalone-app. Check Git status first, preserve existing work and do not force push. Use Conventional Commits: fix, feat, docs, refactor, test or chore. Release preparation may use `chore(release): prepare 2.0.0`.

Compare 1.9.3/1.9.4 using identical data/language/theme/viewport/scale, actual DOM/styles, screenshots, interactions and animation. Preserve intentional legacy bug fixes. Repair shared controls and dialogs at their owner. Components receive ApplicationServices, never direct transactions/legacy globals. Preserve expected-field checks, atomic batches, draft retention and fail-closed recovery. New messages require Chinese and English.

## Versions and dates

release.json is the editable source for version, author, date, repository and updates. build:release synchronizes app-version.json, package and lock metadata. From 2.0.0, application and tags use independent three-part versions; 7.1.1 is provenance. Schema v3, backup exportVersion 2 and legacy Version='6.5' remain separate. Preserve historical reports, copyright and MIT texts.

The date retains its local release/update-day meaning (YYYY-MM-DD). Maintain it during development as well; current 2.0.0 update is 2026-11-16. Update it if preparation changes on a later day. About uses the same metadata. Fixing the currently unpublished 2.0.0 does not require another version.

After publication, never move/delete/recreate/reuse a pushed tag, including failed, cancelled or unpublished candidates. Fixes need a fresh incremented patch tag. Never silently replace published assets. FocusTodo.releaseRead changes only when the latest entry is opened, not when viewing history.

## Validation

Run build:release, check, build, build:standalone, npm test, standalone Node tests, test:standalone, test:browser, test:release-app, Python release/page gates, package-release/package-smoke and git diff --check. Exact scope and UI suites are in [Testing](TESTING.md). Documentation-only changes need link/anchor checks; package manifest changes also need extracted-package checks. Preserve effective assertions and pixel thresholds. Commit generated files, never private data or debug output.

## CI and release boundaries

main is the stable default and sole Pages deployment source. Branch pushes run CI. Preparation runs local checks, commits/pushes, waits for the exact commit's applicable Actions jobs, then opens the authorized PR. Current PR targets dev from refactor/standalone-app; stop after creation without merging, tags or Release.

Preflight verifies generated files, syntax/types, production/isolated builds, release gates and archives. Windows/macOS/Linux × Node 22/24 run unit/contracts; Node 24 checks the same portable ZIP/tar.gz and Chromium. Linux also runs Firefox/WebKit capability and isolated business checks. Production browser tests exercise same-origin synthetic legacy upgrade, relative project base, version/date and downloaded backups. WebKit is not real Safari acceptance.

Only after explicit release acceptance, push an unused tag equal to localVersion. Successful tag CI creates a Pre-release. An accepted stable release may use `gh workflow run ci.yml --ref <Tag> -f release_channel=stable`. Gate checks preserve version/checksum/artifact consistency and candidate history.

Successful main CI builds Pages from committed matching production inputs, publishing manifest assets plus .nojekyll/deployment.json. Exclude legacy src, scripts, tests, private maps, docs, databases and CNAME. Deployment rechecks main to avoid stale overwrite. Actual live deployment, downloadable release assets and release-only checks remain future verification until release occurs.

## Provenance

Lexible maintains the local app from [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1. Original commit fe15a1d9201c6298f1c28c16dcb0b58c481f9999 and complete history remain on upstream/7.1.1 with upstream author/LICENSE. That branch is archived and never deployed. THIRD-PARTY-NOTICES.txt and complete third-party licenses ship with builds. Entertainment design literature is outside development rules and runtime distribution.

## Documentation

Current Chinese/English docs live in docs and docs/en; reports use releases/. Contracts moved into Architecture, baseline/verification evidence into Testing; the temporary docs/2.0.0 tree is retired. Historical reports retain historical facts. Only [docs/BACKLOG.md](../BACKLOG.md) maintains unfinished work and acceptance status. Update package manifests and links when moving documentation.
