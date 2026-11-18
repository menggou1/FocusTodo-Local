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

## Authorization for AI-created pull requests

- AI agents must not create Pull Requests on their own by default.
- Each PR creation requires explicit user authorization for that specific operation. General authorization to develop, commit, push or release does not authorize PR creation; previous authorization does not automatically apply to another PR.
- Before creation, inspect the source branch, target branch, commit relationship and actual differences to confirm that changes need integration.
- If the branches have no differences requiring integration, do not create a PR or manufacture meaningless commits.
- PR creation must not be treated as a mandatory development or release step. A documented release process does not authorize an AI agent to create a PR.

### Administrative mistake: PR #3 (2026-11-17)

[PR #3](https://github.com/menggou1/FocusTodo-Local/pull/3) was mistakenly created and merged by an AI execution agent when no PR was needed. The agent should first have checked branch relationships and whether a PR was actually necessary instead of mechanically following a release process. The PR is already merged; GitHub does not support deleting an individual merged PR or reclaiming its number. Keep this record to describe the mistake accurately without reverting the merge or rewriting history. The release-process documentation changes included in the PR remain valid. No future Pull Request may be created without the repository owner's explicit authorization for that specific operation.

## Source and generated files

Components use ApplicationServices. Preserve expected-value conflict checks and batch transactions; retain drafts on failure. Incompatible schema/protocol or incomplete recovery stops writes without resetting data. Shared controls and dialogs belong to their common owner.

Update Chinese and English strings together. public/i18n owns translations; build:release generates standalone/shared/catalog.json. Keep only imported resources and translation/license sources in public. Audit imports, globs, CSS and the manifest before removing assets. Vite uses relative resource URLs. Entertainment design literature is outside development rules and must not be read, edited or distributed. Do not commit personal data, credentials or debug output.

## Versioning

release.json owns version, author, date, repository and updates. build:release synchronizes app-version.json and package/lock metadata. About reads the same source. Dates use Asia/Shanghai YYYY-MM-DD and change when an unpublished version is updated on another day. App/tags use independent three-part versions; 7.1.1 is provenance. Schema v3, backup exportVersion 2 and legacy Version='6.5' remain independent.

Keep every pushed tag permanently, including tags for failed, cancelled or unpublished candidates. Never move, delete, recreate or reuse a pushed tag. Preserve the historical record, archives, copyright and licenses. Never overwrite public assets.

### Failed release candidates

This policy takes effect when preparing 2.0.3 and applies to 2.0.3 and later versions.

- Once the owner explicitly abandons a failed candidate, retire its version number permanently and increment the patch component for subsequent fixes. Preserve any pushed tag under the rule above. If a tag was never created, do not create it retroactively. An untagged candidate may keep its version during preparation as long as it has not been explicitly abandoned.
- Give abandoned candidates no separate entry in the app's official update list (the `updates` array in `release.json`). Carry their valid changes and corresponding update notes into the next stable release so the same changes appear on a single update card. Preserve necessary failure records, verification evidence and references to historical reports.
- [1.4.2 → 1.4.3](releases/UPDATE-7.1.1-local.1.4.3.md) and [1.5.1 → 1.5.2](releases/UPDATE-7.1.1-local.1.5.2.md) both retained the original failed candidate tag, carried the valid changes into the next stable release and documented the failure and verification evidence in that release's report.
- The owner explicitly abandoned [2.0.1](releases/UPDATE-2.0.1.md). No tag or GitHub Release was created. [2.0.2](releases/UPDATE-2.0.2.md) inherited its valid changes. When preparing 2.0.3, remove the 2.0.1 entry from `release.json.updates` and consolidate its valid changes under 2.0.2 in both the Chinese and English changelogs. Retain the 2.0.1 candidate reports and verification evidence. Check that the relevant links in both changelogs and historical reports still resolve. Keep the published 2.0.2 content intact.

## Validation and publishing

Generate metadata and build both variants, then run all [test commands](TESTING.md), including units, service contracts, browsers, production upgrade/backup, archive startup and Python fallback. Commit build inputs before the committed-source Pages check. Commit valid generated output and run git diff --check. Never remove necessary tests, weaken assertions, shrink data or relax visual thresholds to pass CI.

main is the stable default and sole Pages source. Development pushes run Windows/macOS/Linux × Node 22/24. Release/main/tag runs may reuse exact-commit dev evidence under the policy below. Node 24 verifies the same portable archives and Chromium; Linux also runs Firefox/WebKit. Preflight verifies generated files, builds, Pages allowlists and release gates. Archived regressions complement independent React startup, business, recovery, UI and production-entry tests.

## Branches and formal release process

| Ref | Responsibility |
|---|---|
| `main` | Stable default branch and sole Pages deployment source |
| `dev` | Daily development and integration |
| `release/x.x.x` | Release freeze created from dev; version fixes, release documentation, metadata and necessary release repairs only, without new features |
| `x.x.x` tag | Immutable release commit identifier, exactly matching localVersion without a v prefix |
| GitHub Release | Release notes, portable ZIP/tar.gz archives and SHA256SUMS.txt |

1. Inspect worktrees, remote branches, tags, Releases and CI; confirm the version is unpublished. Reuse dev for daily work; perform releases in an independent worktree without switching, changing or cleaning other worktrees or the daily stable environment.
2. Create release/x.x.x from dev. For 2.0.0 only, create release/2.0.0 from main because main was already synchronized with dev.
3. Complete metadata, documentation, tests, defect fixes and release acceptance on the release branch. Maintain dates according to actual update/publication events and synchronize final information before publication; an untagged version may receive normal date updates. Keep unfinished acceptance and evidence limits only in Backlog; automation does not establish human acceptance.
4. Validate locally, commit and push the release branch, then wait for every applicable CI job on that exact SHA to finish successfully. Review the Backlog release checklist without weakening gates.
5. Inspect the source and target branches and actual differences, then integrate release changes that need merging into main. A PR is not mandatory; an AI agent may create one only with explicit user authorization for that specific creation. If there are no differences requiring integration, do not create a PR or manufacture meaningless commits. Fast-forward integration is allowed; do not require meaningless merge commits. Verify all applicable checks on the final main release commit.
6. Create and push the exact version tag (for example 2.0.0) on that final main commit. Use existing GitHub Actions: tag pushes publish Stable/Latest after tests succeed. Explicit tag dispatch supports release_channel=prerelease; stable dispatch may promote a verified prerelease only after matching its published assets, without replacement or bypassing gates.
7. Download final assets, verify SHA-256, version/author/date and build provenance, and test archive/Python fallback startup in temporary directories on ephemeral loopback ports with generated data. Verify main Pages source SHA, project subpaths and live version. Announce success only after both the formal Release and deployment verification finish.
8. Synchronize release fixes back to dev while preserving other worktrees and uncommitted changes. Remote branches may fast-forward without modifying an open local worktree. The release branch may be deleted after completion; retain tags, Releases and complete history.

Never force-push or rewrite history to remove differences. After a failure, check whether the candidate was explicitly abandoned and check its tag status, then follow the [failed release candidate policy](#failed-release-candidates). Code, documentation or metadata fixes for a candidate with a pushed tag or for a stable release require a new patch version. For infrastructure-only failures, rerun the original gates at the same immutable commit only if the candidate has not been abandoned and the rerun will leave published assets intact.

After successful main checks, Pages publishes only the production manifest plus .nojekyll and deployment.json. It excludes source, scripts, tests, docs, maps, databases and CNAME. Deployment verifies the current main SHA to reject stale deployment. Pages generation on dev does not deploy. Verify live deployment, downloads, checksums and delivered startup after publication.

## Provenance and documents

Lexible maintains the local app, based on [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1. Upstream commit fe15a1d9201c6298f1c28c16dcb0b58c481f9999 remains on upstream/7.1.1. archive/1.9.4 preserves the last 1.x local version and never deploys Pages. Preserve MIT and copyright, with complete React/ReactDOM/scheduler/Noto notices in distributions.

Current documents live in docs and docs/en; reports use releases. Historical reports retain historical facts. Only docs/BACKLOG.md maintains unfinished engineering, human acceptance and post-release checks. Update links, metadata and package manifests when moving documents.

Successful `release/2.0.x` branches are temporary: after Release, Pages and downloaded-package verification, delete their remote refs and audit older release branches. First ensure all valid commits remain reachable. Preserve immutable tags, Releases and complete effective history.

## Exact-commit CI reuse

dev always runs the full matrix. Release/main/tag reuse requires successful jobs for all six matrix combinations in the same repository/workflow at the exact SHA, with an unexpired, checksummed archive batch created before all three Node 24 archive-testing jobs. Newer failed, cancelled or timed-out runs invalidate older success. Preflight still validates generated files, builds, metadata, Pages provenance and release gates. It restores the original tested archives only after checking the Actions artifact digest, portable checksums and byte-for-byte contents against a fresh build, then smoke-tests extraction/startup. Missing or unverifiable evidence falls back to full tests. An independent validation job rechecks evidence; failures, cancellation and unverified skips block deployment/publication. Sources appear in the Actions Step Summary. Existing main-only Pages, immutable-tag and cleanup rules remain.
