# 7.1.1-local.1.6.1 — Schedule and notice refinements

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Chinese report](../UPDATE-7.1.1-local.1.6.1.md)

Released: 2026-10-29. Author: Lexible.

## Changes

- Schedule quick creation shows an inline message and focuses the name field for empty or whitespace-only names. The message clears when a valid name is entered; invalid submissions create no task.
- Bottom notices use theme colors in light and dark modes, fade after six seconds without a close button, and reset their timer when a new notice arrives. Their position avoids the bottom timer controls.
- The validation message is associated with the input for assistive technology; reduced-motion settings disable the fade transition.

## Verification and release

Local checks passed: 60 unit tests (one platform skip), syntax, full browser acceptance, and extracted ZIP and tar.gz startup. All 24 schedule scenarios passed, including light and dark validation, repeated notices, automatic dismissal, and sidebar invariance.

Commit `4389dcd` was merged into main and tagged `1.6.1`. The [tag workflow](https://github.com/menggou1/FocusTodo-Local/actions/runs/40822836444) and [main workflow](https://github.com/menggou1/FocusTodo-Local/actions/runs/40822829700) passed on three systems with Node 22 and 24. Downloaded [release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.6.1) archives matched SHA256SUMS. The [Pages site](https://menggou1.github.io/FocusTodo-Local/) reported the same source commit and passed a live startup check without script errors.

The `1.6.0` tag points to its original commit `c81d2cc`; no Release was created for it. Open work is tracked in the [backlog](BACKLOG.md).
