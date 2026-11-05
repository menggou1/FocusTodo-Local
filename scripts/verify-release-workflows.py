"""Validate the tag version and the complete, checksummed portable release assets."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def verify(tag, directory, reference=None):
    config = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))
    version = config['localVersion']
    full = config['officialVersion'] + '-local.' + version
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    if tag != version or package['version'] != full or config['updates'][0]['version'] != full:
        raise ValueError('Tag and release versions do not match')
    stem = 'FocusTodo-' + version
    expected = {stem + '.zip', stem + '.tar.gz'}
    lines = (directory / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines()
    checksums = {}
    for line in lines:
        digest, name = line.split('  ', 1)
        if name in checksums:
            raise ValueError('Duplicate checksum entry')
        checksums[name] = digest
    if set(checksums) != expected:
        raise ValueError('Release archive list is incomplete')
    for name in expected:
        if hashlib.sha256((directory / name).read_bytes()).hexdigest() != checksums[name]:
            raise ValueError('Archive checksum mismatch: ' + name)
    if reference is not None:
        # Archive timestamps can differ across builds; compare all extracted bytes instead.
        def contents(folder):
            with zipfile.ZipFile(folder / (stem + '.zip')) as archive:
                zipped = {n: archive.read(n) for n in archive.namelist()}
            with tarfile.open(folder / (stem + '.tar.gz')) as archive:
                members = archive.getmembers()
                if any(not m.isfile() for m in members):
                    raise ValueError('Unexpected archive entry')
                tarred = {m.name: archive.extractfile(m).read() for m in members}
            if zipped != tarred or len(zipped) != len(members):
                raise ValueError('Archive contents disagree')
            return zipped
        if contents(directory) != contents(reference):
            raise ValueError('Published archives differ from tested archives')
    print('Verified version and portable assets:', tag)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tag')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--reference', type=Path)
    args = parser.parse_args()
    verify(args.tag, args.directory, args.reference)
