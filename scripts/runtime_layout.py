"""Shared allowlist for the checkout and the flat browser runtime."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = json.loads((ROOT / 'scripts/runtime-layout.json').read_text(encoding='utf-8'))
REQUIRED = (
    'index.html', 'patch.js', 'main.css', 'local-controls.css', 'local-ui.css',
    'js/main.js', 'js/local-release.js', 'js/local-data.js', 'js/local-timer-core.js',
    'js/local-timer-ui.js', 'js/local-app-ui.js', 'js/local-backup.js', 'js/local-theme-storage.js',
    'js/local-i18n.js', 'js/local-i18n-catalog.js', 'js/local-settings-ui.js', 'js/local-network.js',
    'js/local-achievements.js', 'js/local-calendar.js', 'release.json', 'LICENSE',
)


def public_path(name, flat=False):
    """Return the allowlisted disk path for a browser path, or None."""
    parts = name.split('/')
    if '\\' in name or ':' in name or any(not p or p.startswith('.') or p.lower() in
                                           ('node_modules', 'scripts', 'tests') for p in parts):
        return None
    source = LAYOUT['files'].get(name)
    if source is None and len(parts) > 1 and parts[0] in LAYOUT['directories']:
        source = '/'.join([LAYOUT['directories'][parts[0]], *parts[1:]])
    return (name if flat else source) if source else None


def runtime_entries(flat=False):
    """Pairs of (disk path, browser path); directory entries include the mount."""
    for entries in LAYOUT.values():
        yield from ((name if flat else source, name) for name, source in entries.items())


def output_path(source, entries):
    for prefix, mount in entries:
        if source == prefix or source.startswith(prefix + '/'):
            name = mount + source[len(prefix):]
            if public_path(name):
                return name
    raise ValueError('Unexpected runtime path: ' + source)


def verify_runtime(names):
    missing = (set(REQUIRED) | set(LAYOUT['files'])) - set(names)
    if missing:
        raise ValueError('Missing runtime assets: ' + ', '.join(sorted(missing)))


def checkout_files():
    entries = list(runtime_entries())
    files = {}
    for source, _ in entries:
        base = ROOT / source
        if not base.exists():
            raise ValueError('Missing runtime path: ' + source)
        for file in (base.rglob('*') if base.is_dir() else [base]):
            if file.resolve() != file or not (file.is_file() or file.is_dir()):
                raise ValueError('Expected a regular runtime path: ' + str(file))
            if file.is_file():
                name = output_path(file.relative_to(ROOT).as_posix(), entries)
                files[name] = file
    verify_runtime(files)
    return files
