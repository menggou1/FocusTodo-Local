"""Read only a fresh, allowlisted production React build."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
LAYOUT = json.loads((ROOT / 'scripts/app-layout.json').read_text(encoding='utf-8'))


def version(config):
    local = config['localVersion']
    return local if int(local.split('.')[0]) >= 2 else config['officialVersion'] + '-local.' + local


def built_files():
    site = ROOT / LAYOUT['siteDirectory']
    info = json.loads((site / 'build-info.json').read_text(encoding='utf-8'))
    current = subprocess.check_output(['node', str(ROOT / 'scripts/app-inputs.cjs')], cwd=ROOT, text=True).strip()
    if info.get('kind') != 'standalone-app' or info.get('sourceDigest') != current:
        raise ValueError('Production build is stale; run npm run build')
    record = json.loads((site / 'runtime-manifest.json').read_text(encoding='utf-8'))
    manifest = record['files']
    checksums = record.get('sha256', {})
    if len(manifest) != len(set(manifest)) or not set(LAYOUT['files']) <= set(manifest):
        raise ValueError('Incomplete production manifest')
    result = {}
    for name in manifest:
        if not isinstance(name, str) or any(not p or p.startswith('.') for p in name.split('/')) or any(c in name for c in '\\:\0') or name.endswith('.map'):
            raise ValueError('Unsafe production asset')
        if name not in LAYOUT['files'] and name.split('/')[0] not in LAYOUT['directories']:
            raise ValueError('Unexpected production asset')
        file = site / name
        if not file.is_file() or file.resolve() != file:
            raise ValueError('Missing or nonregular production asset')
        if name != 'runtime-manifest.json' and hashlib.sha256(file.read_bytes()).hexdigest() != checksums.get(name):
            raise ValueError('Production asset changed after build: ' + name)
        result[name] = file
    return result
