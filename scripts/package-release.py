"""Build portable runtime archives using only the Python standard library."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def build(output, tag=None):
    config = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))
    version = config['localVersion']
    full_version = config['officialVersion'] + '-local.' + version
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Invalid release version')
    if tag is not None and tag != version:
        raise ValueError(f'Tag {tag!r} must match localVersion {version!r}')
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    if package['version'] != full_version or config['updates'][0]['version'] != full_version:
        raise ValueError('Run npm run build:release before packaging')
    # Explicit runtime allowlist: no credentials, dependencies, screenshots or Git state.
    files = [ROOT / name for name in (
        'index.html', 'patch.js', 'main.css', 'local-ui.css', 'purchase.html',
        'purchase.css', 'reset-password.html', 'resetpassword.css', 'favicon.ico',
        '8fzlr-o0m4w-001.ico', 'package.json', 'release.json', 'LICENSE',
        'README.md', 'README_en.md', 'CHANGELOG.md', 'start.ps1', 'start.sh',
        '启动.bat', 'scripts/server.cjs', 'scripts/start.cjs',
    )]
    for directory in ('js', 'audio', 'font', 'i18n', 'img'):
        files.extend(p for p in (ROOT / directory).rglob('*') if p.is_file())
    files.extend(ROOT / update['report'] for update in config['updates'])
    # Include linked historical Markdown too; omit acceptance data/screenshots.
    files.extend((ROOT / 'docs').rglob('*.md'))
    files.extend(p for p in (ROOT / 'docs' / 'guide-images').rglob('*') if p.is_file())
    files.append(ROOT / 'ARCHITECTURE.md')
    files = sorted(set(files))
    output.mkdir(parents=True, exist_ok=True)
    stem = 'FocusTodo-' + version
    archives = [output / (stem + '.zip'), output / (stem + '.tar.gz')]
    with zipfile.ZipFile(archives[0], 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            name = stem + '/' + file.relative_to(ROOT).as_posix()
            entry = zipfile.ZipInfo.from_file(file, name)
            entry.create_system = 3
            entry.external_attr = (0o100755 if file.name == 'start.sh' else 0o100644) << 16
            archive.writestr(entry, file.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
    with tarfile.open(archives[1], 'w:gz', format=tarfile.PAX_FORMAT) as archive:
        for file in files:
            info = archive.gettarinfo(str(file), stem + '/' + file.relative_to(ROOT).as_posix())
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            info.mode = 0o755 if file.name == 'start.sh' else 0o644
            with file.open('rb') as content:
                archive.addfile(info, content)
    checksums = ''.join(hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name + '\n' for file in archives)
    (output / 'SHA256SUMS.txt').write_text(checksums, encoding='utf-8')
    latest = config['updates'][0]
    notes = '\n'.join('- ' + item for item in latest['items']) + '\n\n' + '\n'.join('- ' + item for item in latest.get('itemsEn', []))
    (output / 'release-notes.md').write_text(
        f'# FocusTodo {full_version}\n\n{notes}\n\n'
        'Windows / macOS / Linux: download and extract either archive. Node.js 22+ is required; '
        'no npm install is needed to run. Start with `node scripts/start.cjs`, '
        '`sh start.sh` on macOS/Linux, or `启动.bat` on Windows.\n\n'
        'Default address: http://127.0.0.1:5500/index.html. Keep the same browser, hostname and port '
        'to reuse existing browser data. Export a backup before upgrading. '
        'Checksums are in SHA256SUMS.txt.\n', encoding='utf-8')
    for archive in archives:
        print(archive)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--tag', help='Require the exact local version tag before publishing')
    args = parser.parse_args()
    build(args.output, args.tag)
