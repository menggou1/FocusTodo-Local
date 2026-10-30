# 7.1.1-local.1.7.3 — Local Focus forest, achievements and task reminders

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Restore the original Focus forest, sunlight collection and detailed guide, with local storage.
- Earn bronze, silver and gold local achievements with immediate sunlight rewards.
- Remove the daily collection limit and fix sunlight collection and position refresh.
- Fix the browser tab icon and make the achievements entry a prominent circular button.
- Animate sunlight along the original flight path, retry failed collections and respect reduced motion.
- Show task reminders before release history and clear read or completed reminder badges while retaining release notifications.
- Request optional browser storage persistence in the background without blocking startup.

## Technical and verification account

The original forest switch, tree and sunlight interface use local reward storage; sunlight collection has no daily cap. Nine offline achievements use the original ranking drawer and bundled bronze, silver and gold trophies. Each one-time achievement and its sunlight credit are stored together and included in full backups. The implementation retains the existing database schema and excludes online groups and rankings. Browser acceptance exercises collection, concurrent awards and repeated restoration. The original flight completes before removing sunlight and triggers the original tree pulse, with failure cancellation, stable positions and reduced motion. Task reminders appear before release history, persist reads per task/date and clear badges after completion across tabs. Candidate tags 1.7.0, 1.7.1 and 1.7.2 are retained without separate formal reports or Releases. The 1.7.1 macOS/Linux failure (0 !== 9) came from automatic synchronization committing nine awards before the test retry; deterministic scheduler-first acceptance checks an unchanged failed ledger, exactly nine total awards and 1860g, then zero on repetition. Release publication now requires successful main tests and Pages for the exact tag commit. Candidate 1.7.2 passed all tag tests, but its main Windows list scenario timed out before mounting; the gate correctly prevented publication. The original test did not capture enough state to identify the exact API in that run. A controlled counterexample proves that optional storage persistence promises can hold an already recovered database behind an empty root. Persistence now runs once in the background; three cases cover pending persisted/persist requests and rejection. List failures retain startup errors, failed requests and screenshots, without extending waits or automatic retries.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/actions/runs/41007043213)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/actions/runs/41011300166)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/startup-persistence-counterexample.json)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/achievement-retry.json)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/forest-flight.png)
- [Public evidence 6](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/task-reminders.png)
- [Public evidence 7](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.3)
- [Public evidence 8](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain)
- [Public evidence 9](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.3)
- [Public evidence 10](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml)
- [Public evidence 11](https://menggou1.github.io/FocusTodo-Local/)

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.7.3.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
