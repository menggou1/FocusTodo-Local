# 7.1.1-local.1.5.3 — System list ordering and username storage fixes

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-28. Author: Lexible.

## Delivered behavior

- Use in-app dragging for system lists without browser text-search gestures, keeping the moved row above other rows.
- Remove custom-list ordering from settings; continue reordering custom lists in the main view.
- Restore the default system list order while preserving hidden states and custom-list data.
- Remove the unused NAME browser cookie and read usernames from local storage.

## Technical and verification account

System list sorting uses pointer events and a raised in-app preview, bypassing both native text dragging and the legacy drag backend. The active row also stays above passive rows during reorder animation. Settings no longer reorders custom lists. Default restoration writes only canonical system order fields in one transaction. Usernames keep the compatible localStorage key while obsolete NAME cookies are cleared. Local verification is deliberately limited to syntax, release consistency and directly affected list/profile scenarios; release CI supplies the existing platform gate.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.5.3.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
