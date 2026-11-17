"""Build filtered static assets for the official GitHub Pages workflow."""
import argparse
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

from app_runtime import ROOT
from app_runtime import built_files, version as app_version

os.environ.setdefault('GIT_TERMINAL_PROMPT', '0')
os.environ.setdefault('GCM_INTERACTIVE', 'never')


def git(*args, data=None, env=None):
    return subprocess.run(['git', '-c', 'http.version=HTTP/1.1', '-c', 'http.lowSpeedLimit=1024',
                           '-c', 'http.lowSpeedTime=30', *args], cwd=ROOT, input=data,
                          capture_output=True, check=True, env=env, timeout=120).stdout


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
    args = parser.parse_args()
    try:
        build(args.ref, args.output)
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode('utf-8', errors='replace'), file=sys.stderr)
        sys.exit(error.returncode)
    except subprocess.TimeoutExpired:
        sys.exit('Git connection timed out; retry after checking connectivity.')
