"""Validate the synthetic prototype archive before extracting it for smoke tests."""
import hashlib
from pathlib import Path, PurePosixPath
import sys
import tarfile
import zipfile

archive = Path(sys.argv[1])
target = Path(sys.argv[2])
stem = 'FocusTodo-standalone-prototype'
checksums = dict(line.split('  ', 1)[::-1] for line in
                 (archive.parent / 'prototype-SHA256SUMS.txt').read_text(encoding='utf-8').splitlines())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == checksums[archive.name]


def validate(names):
    for name in names:
        parts = PurePosixPath(name).parts
        assert parts and parts[0] == stem and '..' not in parts, name
        assert '\\' not in name and not name.startswith('/'), name
        assert not any(part.startswith('.') or part in ('node_modules', 'tests', 'acceptance', 'debug')
                       for part in parts), name
        assert not name.endswith('.map'), name


if archive.suffix == '.zip':
    with zipfile.ZipFile(archive) as package:
        validate(package.namelist())
        assert all(info.external_attr >> 16 & 0o170000 != 0o120000 for info in package.infolist())
        package.extractall(target)
else:
    with tarfile.open(archive) as package:
        validate(package.getnames())
        assert all(member.isfile() or member.isdir() for member in package.getmembers())
        package.extractall(target, filter='data')

site = target / stem
for name in ('site/index.html', 'start.cjs', 'scripts/standalone-server.cjs', 'README.txt'):
    assert (site / name).is_file(), name
print(site)
