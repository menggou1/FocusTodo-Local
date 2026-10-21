"""Check both delivered archives, then run the extracted app without npm or Git."""
import hashlib
import json
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DIST = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist'
version = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))['localVersion']
stem = 'FocusTodo-' + version
checksums = dict(line.split('  ', 1)[::-1] for line in (DIST / 'SHA256SUMS.txt').read_text().splitlines())

for suffix in ('.zip', '.tar.gz'):
    archive = DIST / (stem + suffix)
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == checksums[archive.name]
    with tempfile.TemporaryDirectory(prefix='FocusTodo package ') as temporary:
        target = Path(temporary) / 'path with spaces 本地版'
        target.mkdir()
        if suffix == '.zip':
            with zipfile.ZipFile(archive) as package:
                names = package.namelist()
                assert package.getinfo(stem + '/start.sh').external_attr >> 16 & 0o111
                package.extractall(target)
        else:
            with tarfile.open(archive) as package:
                names = package.getnames()
                assert package.getmember(stem + '/start.sh').mode & 0o111
                package.extractall(target, filter='data')
        for name in names:
            parts = Path(name).parts
            assert parts[0] == stem and '..' not in parts
            assert not any(p.startswith('.') or p in ('node_modules', 'tests', 'acceptance') for p in parts)
        site = target / stem
        assert not (site / '.git').exists() and not (site / 'node_modules').exists()
        assert b'\r' not in (site / 'start.sh').read_bytes()
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            port = reservation.getsockname()[1]
        node = shutil.which('node')
        assert node, 'Node.js is required for the runtime smoke test'
        process = subprocess.Popen([node, str(site / 'scripts/start.cjs'), '--no-browser', '--port', str(port)],
                                   cwd=temporary, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 10
            while True:
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1) as response:
                        assert response.status == 200 and b'local-release.js' in response.read()
                    break
                except (OSError, TimeoutError):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError('Extracted server did not start')
                    time.sleep(0.1)
            for resource in ('js/main.js', 'js/local-release.js', 'img/github.svg', 'audio/alm_AlarmBeep.mp3'):
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/{resource}', timeout=3) as response:
                    assert response.status == 200 and len(response.read()) > 0
            if sys.platform != 'win32':
                result = subprocess.run(['sh', str(site / 'start.sh'), '--help'], cwd=temporary, capture_output=True, timeout=5)
                assert result.returncode == 0, result.stderr
            print('PASS extracted ' + suffix + ' with spaces and Unicode, without npm or Git')
        finally:
            process.terminate()
            process.communicate(timeout=5)

# An unrelated tag must fail before producing a publishable package.
with tempfile.TemporaryDirectory() as temporary:
    result = subprocess.run([sys.executable, str(ROOT / 'scripts/package-release.py'), '--output', temporary,
                             '--tag', '0.0.0'], capture_output=True)
    assert result.returncode != 0 and not list(Path(temporary).iterdir())
print('PASS mismatched release tag rejected')
