"""Build filtered static assets for the official GitHub Pages workflow."""
import argparse
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

from app_runtime import ROOT
from app_runtime import built_files, version as app_version

os.environ.setdefault('GIT_TERMINAL_PROMPT', '0')
os.environ.setdefault('GCM_INTERACTIVE', 'never')
VERSION = r'(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)'


def git(*args, data=None, env=None):
    return subprocess.run(['git', '-c', 'http.version=HTTP/1.1', '-c', 'http.lowSpeedLimit=1024',
                           '-c', 'http.lowSpeedTime=30', *args], cwd=ROOT, input=data,
                          capture_output=True, check=True, env=env, timeout=120).stdout


def remote_version_tags(listing):
    """Annotated tags are compared using their peeled commit IDs."""
    direct, peeled = {}, {}
    for line in listing.splitlines():
        sha, ref = line.split('\t', 1)
        match = re.fullmatch(rf'refs/tags/({VERSION})(\^\{{\}})?', ref)
        if match:
            target = peeled if match[2] else direct
            target[match[1]] = sha
    return {**direct, **peeled}


def verify_main_version(version, source, tags):
    if not isinstance(version, str) or not re.fullmatch(VERSION, version):
        raise ValueError(f'Main localVersion is invalid: {version!r}')
    conflicts = sorted(tag for tag, commit in tags.items() if commit == source and tag != version)
    if conflicts:
        raise ValueError(f'Main localVersion {version!r} conflicts with tags on {source}: {", ".join(conflicts)}')
    if version in tags:
        if tags[version] != source:
            raise ValueError(f'Main localVersion {version!r} is already assigned to a different commit: {tags[version]}')
        return
    version_key = lambda value: tuple(map(int, value.split('.')))
    latest = max(tags, key=version_key, default=None)
    if latest is not None and version_key(version) <= version_key(latest):
        raise ValueError(f'Main localVersion {version!r} must be newer than the latest occupied version {latest!r}')


def check_main_version(ref):
    source = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').decode().strip()
    release = json.loads(git('show', source + ':release.json'))
    version = release['localVersion']
    tags = remote_version_tags(git('ls-remote', '--tags', 'origin').decode())
    verify_main_version(version, source, tags)
    print('Main production version verified:', version, source)


def verify_build_version(files, release):
    info = json.loads(files['build-info.json'].read_text(encoding='utf-8'))
    if info.get('localVersion') != release['localVersion'] or info.get('sourceVersion') != release['officialVersion']:
        raise ValueError('Pages build metadata does not match the committed version')
    title = f'<title>FocusTodo {app_version(release)}</title>'
    if title not in files['index.html'].read_text(encoding='utf-8'):
        raise ValueError('Pages HTML title does not match the committed version')


def build(ref='HEAD', output=Path('dist/pages')):
    source = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').decode().strip()
    release = json.loads(git('show', source + ':release.json'))
    version = app_version(release)
    if json.loads(git('show', source + ':package.json'))['version'] != version:
        raise ValueError('Committed package version does not match release.json')
    inputs = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require('./scripts/app-inputs.cjs').inputs))"], cwd=ROOT))
    git('diff', '--exit-code', source, '--', *inputs)
    if git('ls-files', '--others', '--exclude-standard', '--', *inputs).strip():
        raise ValueError('Commit production build inputs before deploying')
    files = built_files()
    verify_build_version(files, release)
    output = output.resolve()
    if output.exists():
        raise FileExistsError('Choose a new Pages output directory: ' + str(output))
    output.mkdir(parents=True)
    for name, file in files.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(file.read_bytes())
    (output / '.nojekyll').write_bytes(b'')
    (output / 'deployment.json').write_text(json.dumps({'version': version, 'sourceCommit': source, 'sourceRef': ref}, indent=2) + '\n', encoding='utf-8')
    print('Pages React app:', version, source)
    return


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD', help='Committed Git revision to build locally')
    parser.add_argument('--output', type=Path, default=Path('dist/pages'), help='New directory for the Pages artifact or local preview')
    parser.add_argument('--check-main-version', action='store_true', help='Only check the committed production version against remote tags')
    args = parser.parse_args()
    try:
        if args.check_main_version:
            check_main_version(args.ref)
        else:
            build(args.ref, args.output)
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode('utf-8', errors='replace'), file=sys.stderr)
        sys.exit(error.returncode)
    except subprocess.TimeoutExpired:
        sys.exit('Git connection timed out; retry after checking connectivity.')
    except ValueError as error:
        sys.exit(str(error))
