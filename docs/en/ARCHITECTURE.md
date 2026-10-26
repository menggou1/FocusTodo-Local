# Architecture

[Documentation](README.md) · [Maintenance](MAINTENANCE.md) · [Open work](BACKLOG.md)

FocusTodo Local combines the preserved 7.1.1 React bundle with explicit local modules. Tasks, focus records, sessions and settings are browser-local. Bing is an allowed external image source. The application does not require an account server; groups, server rankings and the old forest are excluded from the product.

## Startup and module flow

The version generator inlines `startup.css` and `js/local-startup.js` into HTML so the skeleton and real step progress can appear before external assets. Styles load asynchronously; deferred scripts download in parallel and execute in the preserved order. Reveal the workspace when the application and required styles are ready, without waiting for optional images/fonts. Chinese and English reuse the generated catalog; other locales retain the legacy parser with asynchronous requests. Database and theme recovery still precede mounting.

```text
local-i18n-catalog -> local-i18n -> local-release -> local-timer-core
    -> local-data -> local-timer-ui -> local-app-ui -> local-backup
    -> local-theme-storage -> local-settings-ui -> local-network -> patch -> legacy main
```

Feature ownership is explicit: identity/raw-storage policy belongs to data, backup UI to backup, legacy preferences to settings, and theme UI to theme storage/recovery. Network has its own policy module. The bootstrap installs these idempotent APIs in the original order; it contains no feature implementations.

The legacy entry waits for `FocusLocalReady`. This restores import/reset journals, then theme settings, before application data is used. Language selection is resolved synchronously before the legacy translation loader. The legacy formatter is retained; missing messages are supplied by the fallback catalog.

```text
legacy timer callback
  -> local-timer-ui
  -> local-data transaction
  -> pure local-timer-core transition
  -> commit session + focus rows
  -> refresh legacy UI / notify peers
```

Timer transitions keep completed focus events distinct from historical recovery and partial segments. Under-25-second pending work is excluded when abandoned; a short pause preserves spans so resumed active work can qualify. Stop, mode changes and detachment settle valid work and clear session display state. Historical rows remain independent.

## Persistence

The database is `PomodoroDB6` v3. Business stores are Project, Task, Subtask, Pomodoro, Schedule, Group, GroupUser, Message and TimerSession. LocalMeta holds internal maintenance and settings-recovery records, not exported business data. Group-related stores are retained for old backup compatibility, without a group UI or server activity.

Owned maintenance phases use operation and owner IDs. A separate database transaction, `PomodoroDB6-maintenance-lock`, covers the journal and synchronous settings work. Its lifetime proves liveness: close/crash releases it, suspension retains it. Timer and legacy writes check the main database maintenance boundary. Settings rollback decisions persist so startup can retry the correct phase.

Theme changes coordinate three existing localStorage values: theme JSON, active custom ID and Theme. A small recovery journal records metadata and fingerprints, not a second image copy. Recovery matches the current atomic JSON value to its corresponding metadata group. This is single-operation recovery, not a claim of strict cross-process localStorage transactions.

## Backup and restore

The data layer takes a consistent business snapshot. `local-backup.js` produces compact JSON or Gzip and sniffs incoming content. Gzip does not change the business backup version. v1/v2 JSON remains readable. The decoder enforces an expanded-size bound before replacement. Business validation checks tables, IDs, time values, sessions and settings.

Full backups retain image data URLs. Wallpaper omission is explicit in the scope and filename; restore removes unavailable theme references and uses Leaf. Safety backups before import and reset are always complete. Imported running sessions become recovery confirmations, so no post-export offline time starts automatically.

## UI and localization

The local app module renders updates, About and reset confirmation. Release details contain user-facing dates and notes, with no maintenance-report buttons. Dialogs manage focus, Escape and shortcuts. Local CSS follows the legacy light/dark variables.

The local text catalog translates static UI strings and errors. It never rewrites task text, notes or filenames in the DOM. General settings expose only the two fully adapted explicit languages; partial translations remain system-selected. English release metadata and documentation accompany the runtime. General settings also provide explicit notification permission and a test action, with no startup permission prompt.

Classic theme selection hooks the actual legacy event. It clears custom overlays and markers synchronously, including reselecting a classic theme cached by a PureComponent. Bing caches are reused; refresh, download and upload activation obey the latest selection. Settings-window lifetime does not own the download request.

## Serving and network

`scripts/server.cjs` binds loopback, serves GET/HEAD, disables caching and supports one byte range for local audio. It rejects private paths and writes. `scripts/start.cjs` opens the native browser without a shell and supports ports/headless mode. The portable runtime needs Node.js but no npm install.

XHR/fetch compatibility and CSP restrict external runtime traffic to the allowed Bing origins. Repository navigation happens only when the user clicks its link. No browser database is uploaded by packaging or deployment.

## Legacy integration boundary

React 16.14, Redux, Moment, jQuery and styles remain inside the legacy assets. Historical component-tree descriptions are not a source build. The AST scripts maintain known module boundaries and retain the changed bundle. UI navigation, task lists and reports still use the legacy component model; data and timer rules have explicit local boundaries. Current module ownership and release commands are in the maintenance guide; unfinished engineering lives only in the backlog.
