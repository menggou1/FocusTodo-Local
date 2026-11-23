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
| `./scripts/preview-standalone.ps1 -Open` | Isolated Windows HMR preview at `http://127.0.0.1:5511/` in a temporary Edge session |
| `./scripts/preview-standalone.ps1 -Static -Port 5512 -Open` | Build and serve an isolated static preview when HMR is unavailable |
| `npm run build:standalone` | Build the same app with isolated storage into dist/standalone/site |
| `npm run start:standalone -- --port 5512` | Serve the isolated build, refusing 5500 |
| `npm run package:standalone` | Package isolated artifacts for cross-platform tests |
| `python scripts/package-release.py` | Produce ZIP/tar.gz after checking source freshness and resource hashes |
| `python scripts/deploy-pages.py --ref HEAD --output dist/pages-preview` | Generate Pages from committed sources and a matching build; output must not exist |

The browser entry is standalone/app/main.tsx; the local launcher is scripts/start.cjs. Production, portable archives and Pages share the React manifest. Legacy src bundles, login/purchase pages and revise/upgrade tools are removed. Historical code is never a production build input.

In an interactive HMR preview, type a key and press Enter: `h` shows help, `f` reloads connected preview tabs, `r` restarts the server, `o` opens the default browser, and `q` quits. Static mode does not provide HMR shortcuts.

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

### Release themes and version numbers

Starting with 2.1.5, each release has one main theme and may include a few necessary, low-risk related fixes. Ship closely related work together based on behavior and risk. Schedule large unrelated changes to settings, the calendar, animation, reports, or data structures in separate batches. High-risk security fixes may ship separately and take priority. Individual commits and minor adjustments do not trigger releases.

- PATCH fixes existing functionality, restores consistent interactions, or improves stability.
- MINOR adds backward-compatible functionality or a significant capability.
- MAJOR introduces an explicit incompatible change.

Choose the version increment based on compatibility and functional impact. Lines changed, time spent, and CI run counts do not determine it.

### Failed release candidates

This policy takes effect when preparing 2.1.0 and applies to 2.1.0 and later versions.

- Once the owner explicitly abandons a failed candidate, retire its version number permanently and increment the patch component for subsequent fixes. Preserve any pushed tag under the rule above. If a tag was never created, do not create it retroactively. An untagged candidate may keep its version during preparation as long as it has not been explicitly abandoned.
- Give abandoned candidates no separate entry in the app's official update list (the `updates` array in `release.json`). Carry their valid changes and corresponding update notes into the next stable release so the same changes appear on a single update card. Preserve necessary failure records, verification evidence and references to historical reports.
- [1.4.2 → 1.4.3](releases/UPDATE-7.1.1-local.1.4.3.md) and [1.5.1 → 1.5.2](releases/UPDATE-7.1.1-local.1.5.2.md) both retained the original failed candidate tag, carried the valid changes into the next stable release and documented the failure and verification evidence in that release's report.
- The owner explicitly abandoned [2.0.1](releases/UPDATE-2.0.1.md). No tag or GitHub Release was created. [2.0.2](releases/UPDATE-2.0.2.md) inherited its valid changes. When preparing 2.1.0, remove the 2.0.1 entry from `release.json.updates` and consolidate its valid changes under 2.0.2 in both the Chinese and English changelogs. Retain the 2.0.1 candidate reports and verification evidence. Check that the relevant links in both changelogs and historical reports still resolve. Keep the published 2.0.2 content intact.

## Validation and publishing

Generate metadata and build both variants, then run all [test commands](TESTING.md), including units, service contracts, browsers, production upgrade/backup, archive startup and Python fallback. Commit build inputs before the committed-source Pages check. Commit valid generated output and run git diff --check. Never remove necessary tests, weaken assertions, shrink data or relax visual thresholds to pass CI.

main is the stable default and sole Pages source. Ordinary development pushes run Windows/macOS/Linux × Node 22/24. Release workflow refs may reuse original exact-commit evidence under the policy below. Node 24 verifies the same portable archives and Chromium; Linux also runs Firefox/WebKit. Preflight verifies generated files, builds, Pages allowlists and release gates. Archived regressions complement independent React startup, business, recovery, UI and production-entry tests.

Direct Actions references use full commit SHAs from official repositories. The Playwright image uses an OCI digest for the lockfile version. Verify these references against their official sources when updating dependencies. Checkout steps leave Git credentials unpersisted.

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
4. Inspect source and target branches and their actual differences. Before tagging, ensure main can fast-forward to the release commit. Integrate any main-only commits on the release branch before verifying the final SHA. Validate locally, commit and push the release branch, wait for every applicable CI job on that SHA to succeed, and review the Backlog checklist.
5. Create and push the tag matching `release.json.localVersion` on the verified remote release/x.x.x HEAD. Immediately before first publication, the workflow requires the remote tag's resolved commit, the checked-out commit, and remote release/x.x.x HEAD to match exactly. dev, feature branches and release branches for other versions cannot establish first-publication provenance.
6. A tag push publishes Stable and sets it as Latest after the gates pass. Explicit tag dispatch with `release_channel=prerelease` publishes a prerelease without marking it Latest. Explicit stable dispatch can promote an existing non-draft prerelease after the current gates pass and its published assets match the verified assets. Promotion preserves the original assets and works after the release branch has been cleaned up.
7. After the Release is created, fast-forward main to the exact tagged commit and synchronize that commit to dev. Inspect branches and actual differences and protect other worktrees and uncommitted changes. If main advanced during publication and can no longer fast-forward, preserve the tag and Pages gates and report the conflict. Use PRs only for changes that need integration. An AI agent requires explicit authorization for each PR.
8. Download the published assets and verify SHA-256, version, author, date and build provenance. Test portable and Python fallback startup in temporary directories with generated data and ephemeral loopback ports. Verify the main Pages source SHA, project subpaths and live version. Announce publication after verifying both the Release and Pages. Once synchronization and verification are complete, confirm all valid commits remain reachable and delete remote release/x.x.x under the existing authorization rules. Audit older release branches under the same conditions. Save CI results, the first-publication source from the workflow summary, and asset verification. Use that evidence and the immutable tag to verify historical versions.

Never force-push or rewrite history to remove differences. After a failure, check whether the candidate was explicitly abandoned and check its tag status, then follow the [failed release candidate policy](#failed-release-candidates). Code, documentation or metadata fixes for a candidate with a pushed tag or for a stable release require a new patch version. For infrastructure-only failures, rerun the original gates at the same immutable commit only if the candidate has not been abandoned and the rerun will leave published assets intact.

After successful main checks, Pages publishes only the production manifest plus .nojekyll and deployment.json. It excludes source, scripts, tests, docs, maps, databases and CNAME. Deployment verifies the current main SHA to reject stale deployment. Pages generation on dev does not deploy. Verify live deployment, downloads, checksums and delivered startup after publication.

Main preflight and the Pages deployment job both check remote version tags. Every version tag on the deployment commit must match localVersion, and a tag with that name must resolve to the same commit. An untagged release commit must advance beyond all occupied version tags. The Pages build verifies that the production build metadata and browser title match the committed version.

## Provenance and documents

Lexible maintains the local app, based on [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1. Upstream commit fe15a1d9201c6298f1c28c16dcb0b58c481f9999 remains on upstream/7.1.1. archive/1.9.4 preserves the last 1.x local version and never deploys Pages. Preserve MIT and copyright, with complete React/ReactDOM/scheduler/Noto notices in distributions.

Current documents live in docs and docs/en; reports use releases. Historical reports retain historical facts. Only docs/BACKLOG.md maintains unfinished engineering, human acceptance and post-release checks. Update links, metadata and package manifests when moving documents.

At the start of development, record the theme, scope, and acceptance criteria in the [current development batch](../NEXT-UPDATE.md). During release preparation, summarize the batch’s accepted changes in bilingual version reports and restore the empty template. Keep unfinished work in [Backlog](../BACKLOG.md) and preserve published reports and release history.

## Exact-commit CI reuse

| Current ref | Original evidence sources in priority order |
|---|---|
| Matching release branch | dev when the remote release branch HEAD matches the current SHA. |
| Version tag | The matching release branch first, then original dev evidence, when the remote tag and matching release branch HEAD both resolve to the current SHA. |
| main | The published Stable tag at this SHA, then the matching release branch if it still points to this SHA, then dev. |
| Synchronized dev | The Stable tag or matching release branch at this SHA, after verifying the remote tag and the published Stable Release. |

A source must be a completed successful run from the same repository and CI workflow at the exact SHA. Verify its ref against the commit version and current remote identity. The independent Verify CI evidence job and all six Windows/macOS/Linux × Node 22/24 jobs must have actually succeeded. Require the Node 24 archive and browser acceptance steps, including Firefox and WebKit on Linux. The Actions artifact must be unexpired, have a valid SHA-256 digest, and have existed before all three Node 24 archive jobs. Order candidates by eligible source and recency. Newer failed, cancelled, or timed-out runs invalidate older success. A tag with a different version is an exception only when the separate tag version step explicitly fails. [Abandoned 2.1.1 candidate](releases/UPDATE-2.1.1.md)

A run that skipped its matrix only consumes evidence. Each reuse resolves directly to the run that executed all six matrix jobs and its original artifact. Unfinished runs and reuse pointers supply no original test evidence and cannot create a dependency cycle.

Preflight still validates generated files, builds, metadata, Pages provenance and release gates. It restores the original tested archives only after checking the Actions artifact digest, portable checksums and byte-for-byte contents against a fresh build, then smoke-tests extraction/startup. Missing or unverifiable evidence falls back to full tests. An independent validation job rechecks evidence. Failures, cancellation and unverified skips block deployment and publication. Preflight and the independent gate record the original ref, SHA, run number, artifact ID and SHA-256 in the Actions Step Summary.
