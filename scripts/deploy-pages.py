"""Publish committed static assets to gh-pages without changing the worktree/index."""
import argparse
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault('GIT_TERMINAL_PROMPT', '0')
os.environ.setdefault('GCM_INTERACTIVE', 'never')
RUNTIME_PATHS = (
    'index.html', 'patch.js', 'main.css', 'local-ui.css', 'purchase.html',
    'purchase.css', 'reset-password.html', 'resetpassword.css', 'favicon.ico',
    '8fzlr-o0m4w-001.ico', 'release.json', 'LICENSE',
    'js', 'audio', 'font', 'i18n', 'img',
)


def git(*args, data=None, env=None):
    return subprocess.run(['git', '-c', 'http.version=HTTP/1.1', '-c', 'http.lowSpeedLimit=1024',
                           '-c', 'http.lowSpeedTime=30', *args], cwd=ROOT, input=data,
                          capture_output=True, check=True, env=env, timeout=120).stdout


def deploy(ref='main', remote='Focustodo-local', output=None, push=False):
    source = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').decode().strip()
    git('merge-base', '--is-ancestor', source, 'main')
    release = json.loads(git('show', source + ':release.json'))
    version = release['officialVersion'] + '-local.' + release['localVersion']
    assert json.loads(git('show', source + ':package.json'))['version'] == version
    entries = git('ls-tree', '-rz', source, '--', *RUNTIME_PATHS)
    names = []
    for entry in entries.split(b'\0'):
        if not entry:
            continue
        metadata, name = entry.split(b'\t', 1)
        mode, kind, _ = metadata.split()
        if kind != b'blob' or mode not in (b'100644', b'100755'):
            raise ValueError('Only regular static files may be published')
        names.append(name.decode('utf-8'))
    for required in ('index.html', 'js/main.js', 'js/local-release.js', 'js/local-data.js',
                     'js/local-timer-core.js', 'js/local-timer-ui.js', 'js/local-app-ui.js', 'js/local-backup.js', 'js/local-theme-storage.js',
                     'js/local-i18n.js', 'js/local-i18n-catalog.js', 'js/local-settings-ui.js'):
        if required not in names:
            raise ValueError('Missing runtime asset: ' + required)
    manifest = (json.dumps({'version': version, 'sourceCommit': source, 'sourceRef': ref},
                           ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    generated = {'.nojekyll': b'', 'deployment.json': manifest}
    with tempfile.TemporaryDirectory(prefix='FocusTodo-pages-index-') as temporary:
        index_env = dict(os.environ, GIT_INDEX_FILE=str(Path(temporary) / 'index'))
        git('read-tree', '--empty', env=index_env)
        for name, contents in generated.items():
            blob = git('hash-object', '-w', '--stdin', data=contents).strip()
            entries += b'100644 blob ' + blob + b'\t' + name.encode() + b'\0'
        git('update-index', '-z', '--index-info', data=entries, env=index_env)
        tree = git('write-tree', env=index_env).decode().strip()
    if output is not None:
        output = output.resolve()
        if output.exists():
            raise FileExistsError('Choose a new preview output directory: ' + str(output))
        output.mkdir(parents=True)
        archive = git('archive', '--format=tar', source, '--', *RUNTIME_PATHS)
        with tarfile.open(fileobj=io.BytesIO(archive)) as files:
            files.extractall(output, filter='data')
        for name, contents in generated.items():
            (output / name).write_bytes(contents)
    print('Pages version:', version)
    print('Source commit:', source)
    print('Static files:', len(names) + len(generated))
    if not push:
        print('Preview only; use --push to update the remote gh-pages branch.')
        return
    branch = 'refs/heads/gh-pages'
    existing = subprocess.run(['git', '-c', 'http.version=HTTP/1.1', 'ls-remote', '--exit-code', remote, branch],
                              cwd=ROOT, capture_output=True, timeout=45)
    parent = None
    if existing.returncode == 0:
        git('fetch', '--no-tags', remote, branch)
        parent = git('rev-parse', 'FETCH_HEAD').decode().strip()
        if git('rev-parse', parent + '^{tree}').decode().strip() == tree:
            print('gh-pages already contains this deployment.')
            return
    elif existing.returncode != 2:
        raise RuntimeError('Could not read the remote gh-pages branch')
    message = f'Deploy FocusTodo {version} from {source[:12]}\n\nSource-commit: {source}\n'
    args = ['commit-tree', tree]
    if parent:
        args.extend(['-p', parent])
    commit = git(*args, data=message.encode()).decode().strip()
    # Normal push preserves deployment history and rejects concurrent updates.
    git('push', remote, commit + ':' + branch)
    print('Published gh-pages:', commit)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='main', help='Committed main revision or an ancestor tag')
    parser.add_argument('--remote', default='Focustodo-local')
    parser.add_argument('--output', type=Path, help='Optional new directory for a local static preview')
    parser.add_argument('--push', action='store_true', help='Publish to the remote gh-pages branch')
    args = parser.parse_args()
    try:
        deploy(args.ref, args.remote, args.output, args.push)
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode('utf-8', errors='replace'), file=sys.stderr)
        sys.exit(error.returncode)
    except subprocess.TimeoutExpired:
        sys.exit('Git connection timed out; retry after checking connectivity.')
