# 7.1.1-local.1.8.0 — Live forest badge, collect all and shared controls

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-11-04. Author: Lexible.

## Delivered behavior

- Refresh the forest badge as sunlight matures, expires or changes, without opening the forest.
- Collect available sunlight with a hand button sharing the achievement and guide button style.
- Reuse button, switch, pomodoro, date and dropdown styles, matching the language menu to other settings.
- Adopt independent application versions starting with 2.0.0 and provide a practical implementation plan.

## Technical and verification account

The forest header reads the same unclaimed reward records as the forest independently of its window. Maturity and expiry timers, local data events, visibility changes and peer-tab updates keep its badge current. Collect all uses the existing durable reward service and includes mature rewards beyond the 100 visible-item limit; failed writes retain successful claims and allow retry.

The style audit covers every application stylesheet, including sidebar, tasks, timers, settings and standalone pages. Shared controls are extracted by responsibility while preserving existing layout and interaction, with the language menu using the same React dropdown as the other settings. Startup and standalone-page layout retain their own loading and scope boundaries.

Independent three-part application versions are adopted starting with 2.0.0, retaining 7.1.1 only as provenance. This release still uses `7.1.1-local.1.8.0` and tag `1.8.0`, with database v3 unchanged. The engineering plan defines implementation order, compatibility and acceptance conditions.

## Evidence

Windows / Node 24.16 / Edge: 71 of 72 Node tests passed with one POSIX-only skip; syntax checks passed. All browser suites passed: 18 startup, 64 application, 7 maintenance, 3 list-ordering, 5 audio, 5 profile and 26 calendar cases, plus forest, achievements and reminders.

Forest acceptance covers closed-window updates, maturity/expiry, query recovery, collecting beyond 100 visible items, immature/expired exclusion, repeated clicks, partial failures, concurrent tabs, real peer data changes and reduced motion. Fixtures use normal task structures and wait for actual header/control readiness.

Shared controls passed Chinese/English, light/dark and 1024/1280px checks against independent pre-refactor 9d39be5 computed styles, including a deliberate regression counterexample, real language selection, switches, keyboard dismissal, matching forest buttons and wrapping notices. The shared layer consolidates 60 truncation aliases, 39 control rules and six pomodoro icon geometries. Repeated AST integration retained the same bundle hash.

Python 3.12.14 passed all three release-gate checks and both ZIP/tar.gz checksum, extraction, Unicode/space-path, documentation-link and dependency-free startup checks. Invalid tags were rejected. Documentation isolation, 349 local file links and whitespace checks passed.

Publication requires successful same-commit main/tag Windows, macOS and Linux × Node 22/24 checks and Pages deployment. At the user's request, tracking stops after main and tag 1.8.0 are pushed; Actions handles deployment/publication, and this report does not claim unobserved online success.

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.8.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
