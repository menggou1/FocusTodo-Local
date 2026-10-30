# 7.1.1-local.1.7.2 — Local Focus forest, achievements and task reminders

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Restore the original Focus forest, sunlight collection and detailed guide, with local storage.
- Earn bronze, silver and gold local achievements with immediate sunlight rewards.
- Remove the daily collection limit and fix sunlight collection and position refresh.
- Fix the browser tab icon and make the achievements entry a prominent circular button.
- Animate sunlight along the original flight path, retry failed collections and respect reduced motion.
- Show task reminders before release history and clear read or completed reminder badges while retaining release notifications.

## Technical and verification account

The original forest switch, tree and sunlight interface use local reward storage; sunlight collection has no daily cap. Nine offline achievements use the original ranking drawer and bundled bronze, silver and gold trophies. Each one-time achievement and its sunlight credit are stored together and included in full backups. The implementation retains the existing database schema and excludes online groups and rankings. Browser acceptance exercises collection, concurrent awards and repeated restoration. The original flight completes before removing sunlight and triggers the original tree pulse, with failure cancellation, stable positions and reduced motion. Task reminders appear before release history, persist reads per task/date and clear badges after completion across tabs. Candidate tags 1.7.0 and 1.7.1 are retained without separate formal reports or Releases. The 1.7.1 macOS/Linux failure (0 !== 9) came from automatic synchronization committing nine awards before the test retry; deterministic scheduler-first acceptance checks an unchanged failed ledger, exactly nine total awards and 1860g, then zero on repetition. Release publication now requires successful main tests and Pages for the exact tag commit.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/actions/runs/41007043213)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/achievement-retry.json)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/forest-flight.png)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/task-reminders.png)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.2)
- [Public evidence 6](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain)
- [Public evidence 7](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.2)
- [Public evidence 8](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml)
- [Public evidence 9](https://menggou1.github.io/FocusTodo-Local/)

[Original Chinese report](../UPDATE-7.1.1-local.1.7.2.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
