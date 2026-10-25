# 7.1.1-local.1.2.1 — Multi-tab initialization fix

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-22. Author: Lexible.

## Delivered behavior

- Prevent lost focus-record refresh events while another tab is still initializing.
- Include maintenance and historical documents in portable archives and correct their links.
- Keep existing tasks, focus records, settings and the default address.

## Technical and verification account

The timer subscribes to peer refresh before waiting for initialization. Events committed while the initial tick/render is pending queue behind it, preserving every record ID and task progress. Controlled initialization coverage protects the actual race rather than merely observing a callback. Documentation links and portable contents were corrected.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/actions/runs/39721332293)

[Original Chinese report](../UPDATE-7.1.1-local.1.2.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
