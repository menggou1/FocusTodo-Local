"""Reuse exact-commit dev CI evidence and its immutable, tested release archives."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MATRIX = {f'{system}-latest / Node {node}' for system in ('ubuntu', 'windows', 'macos') for node in ('22', '24')}
MAX_ARTIFACT = 512 * 1024 * 1024


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def eligible(event, ref):
    return event in ('push', 'workflow_dispatch') and bool(re.fullmatch(
        r'refs/(?:heads/(?:main|release/\d+\.\d+\.\d+)|tags/\d+\.\d+\.\d+)', ref))


def evidence(run, jobs, artifacts, repository, sha, current_run, now=None):
    """A successful workflow alone is insufficient: require all six actual tests."""
    now = now or datetime.now(timezone.utc)
    if (run.get('head_sha') != sha or run.get('head_branch') != 'dev' or run.get('path') != '.github/workflows/ci.yml'
            or run.get('event') not in ('push', 'workflow_dispatch')
            or run.get('head_repository', {}).get('full_name') != repository
            or run.get('status') != 'completed' or run.get('conclusion') != 'success'
            or str(run.get('id')) == str(current_run)):
        return None
    successful = {}
    for job in jobs:
        name = job.get('name')
        if name in MATRIX:
            if name in successful or job.get('status') != 'completed' or job.get('conclusion') != 'success':
                return None
            successful[name] = job
    if set(successful) != MATRIX or not any(job.get('name') == 'preflight' and job.get('conclusion') == 'success' for job in jobs):
        return None
    matches = [item for item in artifacts if item.get('name') == 'portable-test-archives']
    if len(matches) != 1:
        return None
    artifact = matches[0]
    source = artifact.get('workflow_run', {})
    if (artifact.get('expired') or timestamp(artifact['expires_at']) <= now
            or source.get('head_sha') != sha or source.get('id') != run['id']
            or not re.fullmatch(r'sha256:[0-9a-f]{64}', artifact.get('digest', ''))
            or not 0 < artifact.get('size_in_bytes', 0) <= MAX_ARTIFACT):
        return None
    # A preflight rerun can replace an artifact after earlier matrix jobs passed.
    # Only accept a batch that existed before all three archive-testing jobs ran.
    created = timestamp(artifact['created_at'])
    if any(timestamp(job['started_at']) < created for name, job in successful.items() if name.endswith('Node 24')):
        return None
    return {'run_id': run['id'], 'run_url': run['html_url'], 'sha': sha,
            'artifact_id': artifact['id'], 'artifact_digest': artifact['digest'],
            'jobs': sorted(successful)}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


class API:
    def __init__(self, repository, token):
        self.base = os.environ.get('GITHUB_API_URL', 'https://api.github.com') + '/repos/' + repository + '/'
        self.headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'FocusTodo-CI-validation'}

    def read(self, path):
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(self.base + path, headers=self.headers), timeout=20) as response:
                    return json.load(response)
            except OSError:
                if attempt == 2:
                    raise
                time.sleep(1)

    def download(self, artifact_id, destination):
        request = urllib.request.Request(self.base + f'actions/artifacts/{int(artifact_id)}/zip', headers=self.headers)
        try:
            response = urllib.request.build_opener(NoRedirect).open(request, timeout=30)
        except urllib.error.HTTPError as error:
            if error.code != 302:
                raise
            url = error.headers['Location']
            if not url.startswith('https://'):
                raise ValueError('Artifact redirect is not HTTPS')
            # Never forward the repository token to the signed storage URL.
            response = urllib.request.urlopen(url, timeout=60)
        count = 0
        with response, destination.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                count += len(chunk)
                if count > MAX_ARTIFACT:
                    raise ValueError('Artifact exceeds the size limit')
                output.write(chunk)


def proof_for(api, run, repository, sha, current_run):
    jobs = api.read(f"actions/runs/{int(run['id'])}/jobs?filter=latest&per_page=100")['jobs']
    artifacts = api.read(f"actions/runs/{int(run['id'])}/artifacts?per_page=100")['artifacts']
    return evidence(run, jobs, artifacts, repository, sha, current_run)


def newer_failure(runs, source, sha, current_run):
    """Never hide a later failed/cancelled run behind an older green result."""
    for run in runs:
        if (run.get('head_sha') == sha and str(run.get('id')) != str(current_run)
                and run.get('status') == 'completed'
                and run.get('conclusion') in ('failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure')
                and timestamp(run['updated_at']) > timestamp(source['updated_at'])):
            return True
    return False


def unpack(archive, digest, version, destination):
    if 'sha256:' + hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
        raise ValueError('Artifact digest mismatch')
    names = {f'FocusTodo-{version}.zip', f'FocusTodo-{version}.tar.gz', 'SHA256SUMS.txt', 'release-notes.md'}
    with zipfile.ZipFile(archive) as package:
        if set(package.namelist()) != names or len(package.namelist()) != len(names):
            raise ValueError('Unexpected artifact file list')
        for name in names:
            (destination / name).write_bytes(package.read(name))


def output(values):
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as target:
        for key, value in values.items():
            target.write(f'{key}={value}\n')


def summary(message):
    print(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as target:
            target.write(message + '\n')


def reuse():
    env = os.environ
    if not eligible(env['GITHUB_EVENT_NAME'], env['GITHUB_REF']):
        output({'reused': 'false'})
        summary('Full tests required: this is dev, a PR, or another development ref.')
        return
    repository, sha, current = env['GITHUB_REPOSITORY'], env['GITHUB_SHA'], env['GITHUB_RUN_ID']
    api = API(repository, env['GH_TOKEN'])
    selected = None
    try:
        runs = api.read(f'actions/workflows/ci.yml/runs?head_sha={sha}&per_page=100')['workflow_runs']
        for run in runs:
            if run.get('head_branch') == 'dev' and run.get('head_sha') == sha:
                selected = proof_for(api, run, repository, sha, current)
                if selected and not newer_failure(runs, run, sha, current):
                    break
                selected = None
        if not selected:
            raise ValueError('No complete dev test evidence with an unexpired archive batch')
        with tempfile.TemporaryDirectory(prefix='FocusTodo-CI-', dir=env.get('RUNNER_TEMP')) as temporary:
            stage = Path(temporary)
            archive = stage / 'artifact.zip'
            api.download(selected['artifact_id'], archive)
            version = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))['localVersion']
            unpack(archive, selected['artifact_digest'], version, stage)
            # Validate every payload byte against a fresh build of this commit.
            subprocess.run(['python', 'scripts/verify-release-workflows.py', version, str(stage), '--reference', 'dist'], cwd=ROOT, check=True)
            if (stage / 'release-notes.md').read_bytes() != (ROOT / 'dist/release-notes.md').read_bytes():
                raise ValueError('Release notes differ from the current commit')
            # All fallbacks above leave the fresh dist batch untouched. A write
            # failure here must fail preflight rather than test a mixed batch.
            selected['staged'] = {name: (stage / name).read_bytes() for name in (
                f'FocusTodo-{version}.zip', f'FocusTodo-{version}.tar.gz', 'release-notes.md', 'SHA256SUMS.txt')}
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        output({'reused': 'false'})
        summary(f'Full tests required: reuse could not be verified ({type(error).__name__}).')
        return
    for name, content in selected.pop('staged').items():
        (ROOT / 'dist' / name).write_bytes(content)
    output({'reused': 'true', 'run_id': selected['run_id'], 'artifact_id': selected['artifact_id'], 'artifact_digest': selected['artifact_digest']})
    summary(f"Reused all six successful matrix jobs for `{sha}` from {selected['run_url']}; restored tested artifact `{selected['artifact_id']}` with `{selected['artifact_digest']}`.")


def gate_mode(preflight, tests, full, reused, event):
    if preflight != 'success':
        raise ValueError('Preflight did not succeed')
    if full == 'false' and event == 'pull_request' and tests == 'skipped' and reused != 'true':
        return 'documentation'
    if full == 'true' and tests == 'success' and reused != 'true':
        return 'full'
    if full == 'true' and tests == 'skipped' and reused == 'true':
        return 'reuse'
    raise ValueError('Tests failed, were cancelled, or were skipped without verified evidence')


def gate():
    env = os.environ
    mode = gate_mode(env['PREFLIGHT_RESULT'], env['TEST_RESULT'], env['FULL'], env.get('REUSED', ''), env['GITHUB_EVENT_NAME'])
    if mode == 'reuse':
        if not eligible(env['GITHUB_EVENT_NAME'], env['GITHUB_REF']):
            raise ValueError('This ref cannot reuse tests')
        api = API(env['GITHUB_REPOSITORY'], env['GH_TOKEN'])
        run = api.read('actions/runs/' + str(int(env['REUSED_RUN_ID'])))
        selected = proof_for(api, run, env['GITHUB_REPOSITORY'], env['GITHUB_SHA'], env['GITHUB_RUN_ID'])
        runs = api.read(f"actions/workflows/ci.yml/runs?head_sha={env['GITHUB_SHA']}&per_page=100")['workflow_runs']
        if (not selected or str(selected['artifact_id']) != env['REUSED_ARTIFACT_ID']
                or selected['artifact_digest'] != env['REUSED_ARTIFACT_DIGEST']
                or newer_failure(runs, run, env['GITHUB_SHA'], env['GITHUB_RUN_ID'])):
            raise ValueError('Reused evidence is no longer valid')
        summary(f"CI gate passed: exact-commit tests and artifact batch verified again from {selected['run_url']}.")
    else:
        summary(f'CI gate passed: {mode} checks succeeded in this run.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('reuse', 'gate'))
    args = parser.parse_args()
    try:
        reuse() if args.mode == 'reuse' else gate()
    except (OSError, ValueError, KeyError, TypeError) as failure:
        raise SystemExit(f'CI validation failed ({type(failure).__name__}); publication is blocked.')
