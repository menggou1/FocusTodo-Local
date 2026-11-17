# Development and release maintenance

[Home](../../README_en.md) · [Architecture](ARCHITECTURE.md) · [Testing](TESTING.md) · [中文](../MAINTENANCE.md)

## Environment and entry points

FocusTodo 2.0.0 is the React / TypeScript / Vite standalone application. Development requires Node.js 22.12+, npm and Python 3.12+. Install locked dependencies with npm ci. Portable archives need no npm install; the Python fallback uses only the standard library.

| Command | Purpose |
|---|---|
| `npm run build:release` | Synchronize metadata, package/lock versions, translations and English changelog |
| `npm run build` | Typecheck and build dist/app/site; private maps go to dist/app/debug |
| `npm start -- --no-browser --port 5512` | Verify production; the daily launcher defaults to 5500 |
| `npm run dev` | Isolated Vite development preview on 5511 |
| `npm run build:standalone` | Build the same app with isolated storage into dist/standalone/site |
| `npm run start:standalone -- --port 5512` | Serve the isolated build, refusing 5500 |
| `npm run package:standalone` | Package isolated artifacts for cross-platform tests |
| `python scripts/package-release.py` | Produce ZIP/tar.gz after checking source freshness and resource hashes |
| `python scripts/deploy-pages.py --ref HEAD --output dist/pages-preview` | Generate Pages from committed sources and a matching build; output must not exist |

The browser entry is standalone/app/main.tsx; the local launcher is scripts/start.cjs. Production, portable archives and Pages share the React manifest. Legacy src bundles, login/purchase pages and revise/upgrade tools are removed. Historical code is never a production build input.

## Workspace and data

Reuse the regular dev checkout. Inspect git worktree list, branch and status. Preserve existing changes; never force-switch, modify another worktree or force-push. Use Conventional Commits; release preparation may use `chore(release): prepare 2.0.0`. Do not rewrite published history.

Tests must never access stable port 5500, daily profiles, real databases or private backups. Use ephemeral loopback ports, fresh browser contexts and generated data. Isolated builds verify server attestation and storage isolation. Production alone uses same-origin PomodoroDB6 v3 and existing keys. Back up and close old windows before upgrading.

Historical tests read the existing archive/1.9.4 checkout or FOCUS_LEGACY_ROOT. tests/helpers/legacy-runtime.cjs verifies the fixed commit and unchanged runtime sources. CI checks out that immutable revision only in test jobs. Build, packaging and Pages do not read it.

## Source and generated files

Components use ApplicationServices. Preserve expected-value conflict checks and batch transactions; retain drafts on failure. Incompatible schema/protocol or incomplete recovery stops writes without resetting data. Shared controls and dialogs belong to their common owner.

Update Chinese and English strings together. public/i18n owns translations; build:release generates standalone/shared/catalog.json. Keep only imported resources and translation/license sources in public. Audit imports, globs, CSS and the manifest before removing assets. Vite uses relative resource URLs. Entertainment design literature is outside development rules and must not be read, edited or distributed. Do not commit personal data, credentials or debug output.

## Versioning

release.json owns version, author, date, repository and updates. build:release synchronizes app-version.json and package/lock metadata. About reads the same source. Dates use Asia/Shanghai YYYY-MM-DD and change when an unpublished version is updated on another day. App/tags use independent three-part versions; 7.1.1 is provenance. Schema v3, backup exportVersion 2 and legacy Version='6.5' remain independent.

Never move, recreate or reuse a pushed tag, including failed, cancelled or unpublished candidates. Increment the patch component for the next candidate. Untagged preparation may keep its version. Preserve history, archives, copyright and licenses; never overwrite public assets.

## Validation and publishing

Generate metadata and build both variants, then run all [test commands](TESTING.md), including units, service contracts, browsers, production upgrade/backup, archive startup and Python fallback. Commit build inputs before the committed-source Pages check. Commit valid generated output and run git diff --check. Never remove necessary tests, weaken assertions, shrink data or relax visual thresholds to pass CI.

main is the stable default and sole Pages source. Branch pushes run Windows/macOS/Linux × Node 22/24. Node 24 verifies the same portable archives and Chromium; Linux also runs Firefox/WebKit. Preflight verifies generated files, builds, Pages allowlists and release gates. Archived regressions complement independent React startup, business, recovery, UI and production-entry tests.

Validate locally, commit/push dev and wait for every applicable job for that exact SHA. Review [Backlog](../BACKLOG.md). PRs are recommended, not required; use the actual target branch. Create a new matching tag only under an explicit release instruction. Tag pushes default to a stable Release. Explicit dispatch supports prerelease and verified promotion to stable; stable assets cannot be overwritten.

After successful main checks, Pages publishes only the production manifest plus .nojekyll and deployment.json. It excludes source, scripts, tests, docs, maps, databases and CNAME. Deployment verifies the current main SHA to reject stale deployment. Pages generation on dev does not deploy. Verify live deployment, downloads, checksums and delivered startup after publication.

## Provenance and documents

Lexible maintains the local app, based on [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1. Upstream commit fe15a1d9201c6298f1c28c16dcb0b58c481f9999 remains on upstream/7.1.1. archive/1.9.4 preserves the last 1.x local version and never deploys Pages. Preserve MIT and copyright, with complete React/ReactDOM/scheduler/Noto notices in distributions.

Current documents live in docs and docs/en; reports use releases. Historical reports retain historical facts. Only docs/BACKLOG.md maintains unfinished engineering, human acceptance and post-release checks. Update links, metadata and package manifests when moving documents.
