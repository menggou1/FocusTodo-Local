"""Validate the tag version and the complete, checksummed portable release assets."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def release_version(tag):
    config = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))
    if not re.fullmatch(r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)', tag) or tag != config['localVersion']:
        raise ValueError('Tag and release versions do not match')
    return config


def verify_release_head(tag):
    release_version(tag)
    ref = 'refs/heads/release/' + tag
    tag_ref = 'refs/tags/' + tag
    peeled_tag = tag_ref + '^{}'
    head = subprocess.check_output(['git', 'rev-parse', '--verify', 'HEAD^{commit}'], cwd=ROOT, text=True).strip()
    remote = subprocess.check_output(['git', 'ls-remote', 'origin', ref, tag_ref, peeled_tag],
                                     cwd=ROOT, text=True, timeout=60)
    refs = {}
    for line in remote.splitlines():
        sha, name = line.split('\t', 1)
        refs[name] = sha
    if tag_ref not in refs or refs.get(peeled_tag, refs[tag_ref]) != head:
        raise ValueError('The remote tag must still point to the checked-out release commit')
    if refs.get(ref) != head:
        raise ValueError(f'First publication requires {ref} on origin to point to {head}')
    print(f'First publication source verified: {ref} at {head}')


def verify(tag, directory, reference=None):
    config = release_version(tag)
    version = config['localVersion']
    full = version if int(version.split('.')[0]) >= 2 else config['officialVersion'] + '-local.' + version
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    if package['version'] != full or config['updates'][0]['version'] != full:
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
    parser.add_argument('directory', nargs='?', type=Path)
    parser.add_argument('--reference', type=Path)
    parser.add_argument('--check-release-head', action='store_true')
    args = parser.parse_args()
    if args.check_release_head:
        if args.directory is not None or args.reference is not None:
            parser.error('--check-release-head checks the remote branch independently of the archives')
        verify_release_head(args.tag)
    else:
        if args.directory is None:
            parser.error('directory is required for archive verification')
        verify(args.tag, args.directory, args.reference)
