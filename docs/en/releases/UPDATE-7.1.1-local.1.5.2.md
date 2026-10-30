# 7.1.1-local.1.5.2 — List ordering feedback and local compatibility fixes

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-28. Author: Lexible.

## Delivered behavior

- Add visible three-bar drag handles, reorder animation and insertion feedback; dim lists in the unavailable group while dragging.
- Improve background-audio handoff between windows; explain the fallback without Web Locks while retaining previews and completion sounds.
- Save local names and avatars through the data service and report failed writes.

## Technical and verification account

List rows now expose three-line handles, group restrictions, insertion feedback, keyboard focus retention and reduced-motion-aware reorder animation. Real browser checks cover mouse dragging and persisted ordering. Background audio queues an abortable Web Lock for immediate handoff; without that capability it pauses automatic background sound and explains the fallback on demand, while previews and completion sounds remain available. Audio test doubles verify ownership only, not physical playback. Local name/avatar writes now use the data service and maintenance ownership boundary, with failure rollback and no retired cloud request. New checks cover storage failure, retry and maintenance exclusion. Commit conventions apply to future commits without rewriting published history. Candidate tag 1.5.1 is preserved: its original startup/application/maintenance checks and first drag scenario passed, but mixing keyboard ordering and later native drag in one page made Playwright wait indefinitely for Chromium drag interception. The candidate workflows were cancelled before publication; 1.5.2 isolates the drag gestures and bounds the acceptance runner.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/list-drag-1.5.2.png)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/release-1.5.2.json)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.5.2)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml)

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.5.2.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
