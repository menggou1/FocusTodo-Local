"""Build filtered static assets for the official GitHub Pages workflow."""
import argparse
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

from runtime_layout import ROOT, runtime_entries, output_path, verify_runtime

os.environ.setdefault('GIT_TERMINAL_PROMPT', '0')
os.environ.setdefault('GCM_INTERACTIVE', 'never')


def git(*args, data=None, env=None):
    return subprocess.run(['git', '-c', 'http.version=HTTP/1.1', '-c', 'http.lowSpeedLimit=1024',
                           '-c', 'http.lowSpeedTime=30', *args], cwd=ROOT, input=data,
                          capture_output=True, check=True, env=env, timeout=120).stdout


def build(ref='HEAD', output=Path('dist/pages')):
    source = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').decode().strip()
    release = json.loads(git('show', source + ':release.json'))
    version = release['officialVersion'] + '-local.' + release['localVersion']
    if json.loads(git('show', source + ':package.json'))['version'] != version:
        raise ValueError('Committed package version does not match release.json')
    flat = not git('ls-tree', source, '--', 'src/index.html')
    mounts = list(runtime_entries(flat))
    paths = [path for path, _ in mounts]
    tree = git('ls-tree', '-rz', source, '--', *paths)
    names = {}
    for entry in tree.split(b'\0'):
        if not entry:
            continue
        metadata, name = entry.split(b'\t', 1)
        mode, kind, _ = metadata.split()
        if kind != b'blob' or mode not in (b'100644', b'100755'):
            raise ValueError('Only regular static files may be published')
        name = name.decode('utf-8')
        names[name] = output_path(name, mounts)
    verify_runtime(names.values())
    manifest = (json.dumps({'version': version, 'sourceCommit': source, 'sourceRef': ref},
                           ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    generated = {'.nojekyll': b'', 'deployment.json': manifest}
    output = output.resolve()
    if output.exists():
        raise FileExistsError('Choose a new Pages output directory: ' + str(output))
    output.mkdir(parents=True)
    archive = git('archive', '--format=tar', source, '--', *paths)
    with tarfile.open(fileobj=io.BytesIO(archive)) as files:
        for name, destination in names.items():
            target = output / destination
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(files.extractfile(name).read())
    for name, contents in generated.items():
        (output / name).write_bytes(contents)
    print('Pages version:', version)
    print('Source commit:', source)
    print('Static files:', len(names) + len(generated))
    print('Pages artifact:', output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD', help='Committed Git revision to build locally')
    parser.add_argument('--output', type=Path, default=Path('dist/pages'), help='New directory for the Pages artifact or local preview')
    args = parser.parse_args()
    try:
        build(args.ref, args.output)
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode('utf-8', errors='replace'), file=sys.stderr)
        sys.exit(error.returncode)
    except subprocess.TimeoutExpired:
        sys.exit('Git connection timed out; retry after checking connectivity.')
