"""Reuse original exact-commit CI evidence and its tested release archives."""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import filecmp
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MATRIX = {f'{system}-latest / Node {node}' for system in ('ubuntu', 'windows', 'macos') for node in ('22', '24')}
MAX_ARTIFACT = 512 * 1024 * 1024
VERSION = r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)'
WORKFLOW = '.github/workflows/ci.yml'
NODE_24_STEPS = {
    'Test extracted ZIP and tar.gz without dependencies',
    'Browser acceptance',
    'Standalone Chromium and both extracted preview archives',
}
LINUX_BROWSER_STEPS = {'Capability fallback in Firefox and WebKit', 'Standalone Firefox and WebKit'}


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def eligible(event, ref):
    return event in ('push', 'workflow_dispatch') and bool(re.fullmatch(
        rf'refs/(?:heads/(?:dev|main|release/{VERSION})|tags/{VERSION})', ref))


def source_order(ref, version, release_matches, tag_matches, published):
    """Use only original sources with an independently established ref identity."""
    release = f'release/{version}'
    if ref == f'refs/heads/{release}':
        return ('dev',) if release_matches else ()
    if ref == f'refs/tags/{version}':
        # If release itself reused dev, look up the original dev run directly.
        return (release, 'dev') if tag_matches and release_matches else ()
    if ref in ('refs/heads/main', 'refs/heads/dev'):
        formal = (version,) if tag_matches and published else ()
        if release_matches and (ref == 'refs/heads/main' or formal):
            formal += (release,)
        return formal + (('dev',) if ref == 'refs/heads/main' else ())
    return ()


def source_policy(api, ref, version, sha):
    if not re.fullmatch(VERSION, version):
        raise ValueError('Invalid localVersion')
    release_ref = 'refs/heads/release/' + version
    tag_ref = 'refs/tags/' + version
    remote = subprocess.check_output(
        ['git', 'ls-remote', 'origin', release_ref, tag_ref, tag_ref + '^{}'],
        cwd=ROOT, text=True, timeout=45)
    refs = dict(reversed(line.split('\t', 1)) for line in remote.splitlines())
    release_matches = refs.get(release_ref) == sha
    tag_matches = tag_ref in refs and refs.get(tag_ref + '^{}', refs[tag_ref]) == sha
    published = False
    if tag_matches and ref in ('refs/heads/dev', 'refs/heads/main'):
        try:
            release = api.read(f'releases/tags/{version}')
            published = (release.get('tag_name') == version and release.get('draft') is False
                         and release.get('prerelease') is False and bool(release.get('published_at')))
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
    return source_order(ref, version, release_matches, tag_matches, published)


def succeeded(job):
    return job.get('status') == 'completed' and job.get('conclusion') == 'success'


def successful_steps(job):
    return {step.get('name') for step in job.get('steps', []) if succeeded(step)}


def trusted_run(run, repository, sha, workflow_id):
    return (run.get('head_sha') == sha and run.get('path') == WORKFLOW
            and run.get('workflow_id') == workflow_id
            and run.get('repository', {}).get('full_name') == repository
            and run.get('head_repository', {}).get('full_name') == repository)


def evidence(run, jobs, artifacts, sha, version, now=None):
    """Require original jobs and the independent gate; never follow reuse pointers."""
    now = now or datetime.now(timezone.utc)
    gates = {job.get('name'): job for job in jobs if succeeded(job)}
    if 'preflight' not in gates or 'Verify CI evidence' not in gates:
        return None
    preflight_steps = successful_steps(gates['preflight'])
    branch = run['head_branch']
    if branch == version and ('Check tag version identity' not in preflight_steps
                              or 'Publish version tag' not in gates):
        return None
    if branch.startswith('release/') and 'Check release branch version identity' not in preflight_steps:
        return None
    successful = {}
    for job in jobs:
        name = job.get('name')
        if name in MATRIX:
            if name in successful or job.get('status') != 'completed' or job.get('conclusion') != 'success':
                return None
            successful[name] = job
    if set(successful) != MATRIX:
        return None
    for name, job in successful.items():
        if name.endswith('Node 24'):
            required = NODE_24_STEPS | (LINUX_BROWSER_STEPS if name.startswith('ubuntu-') else set())
            if not required <= successful_steps(job):
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
    return {'run_id': run['id'], 'run_number': run['run_number'], 'run_url': run['html_url'],
            'branch': branch, 'sha': sha,
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


def proof_for(api, run, sha, version):
    jobs = api.read(f"actions/runs/{int(run['id'])}/jobs?filter=latest&per_page=100")['jobs']
    artifacts = api.read(f"actions/runs/{int(run['id'])}/artifacts?per_page=100")['artifacts']
    return evidence(run, jobs, artifacts, sha, version)


def original_proofs(api, repository, sha, current, version, order, expected_run=None):
    if not order:
        return
    workflow = api.read('actions/workflows/ci.yml')
    if workflow.get('path') != WORKFLOW:
        raise ValueError('Unexpected workflow identity')
    response = api.read(f"actions/workflows/{int(workflow['id'])}/runs?head_sha={sha}&per_page=100")
    runs = response['workflow_runs']
    if response['total_count'] != len(runs):
        raise ValueError('Incomplete history for this SHA')
    runs = [run for run in runs if trusted_run(run, repository, sha, workflow['id'])]
    runs.sort(key=lambda run: (timestamp(run['updated_at']), run['id']), reverse=True)
    for branch in order:
        for run in runs:
            if (run.get('head_branch') != branch or str(run['id']) == str(current)
                    or run.get('event') not in ('push', 'workflow_dispatch')
                    or not succeeded(run) or (expected_run is not None and str(run['id']) != expected_run)):
                continue
            if newer_failure(runs, run, sha, current, lambda failed: failed_tag_identity(api, failed, version)):
                continue
            proof = proof_for(api, run, sha, version)
            if proof:
                yield proof


def failed_tag_identity(api, run, version):
    """Only the tag-only identity step can prove an unrelated version mismatch."""
    name = run.get('head_branch', '')
    if (run.get('conclusion') != 'failure' or name == version
            or not re.fullmatch(r'\d+\.\d+\.\d+', name)
            or run.get('event') not in ('push', 'workflow_dispatch')):
        return False
    jobs = api.read(f"actions/runs/{int(run['id'])}/jobs?filter=latest&per_page=100")['jobs']
    return any(job.get('name') == 'preflight' and job.get('conclusion') == 'failure'
               and any(step.get('name') == 'Check tag version identity' and step.get('conclusion') == 'failure'
                       for step in job.get('steps', []))
               for job in jobs)


def newer_failure(runs, source, sha, current_run, tag_identity_failure=lambda run: False):
    """Never hide a later failed/cancelled run behind an older green result."""
    for run in runs:
        if (run.get('head_sha') == sha and str(run.get('id')) != str(current_run)
                and run.get('status') == 'completed'
                and run.get('conclusion') in ('failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure')
                and timestamp(run['updated_at']) > timestamp(source['updated_at'])
                and not tag_identity_failure(run)):
            return True
    return False


def release_artifact_names(version):
    return {f'FocusTodo-{version}.zip', f'FocusTodo-{version}.tar.gz', 'SHA256SUMS.txt', 'release-notes.md'}


def unpack(archive, digest, version, destination):
    if archive.stat().st_size > MAX_ARTIFACT:
        raise ValueError('Artifact exceeds the size limit')
    with archive.open('rb') as source:
        actual_digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if 'sha256:' + actual_digest != digest:
        raise ValueError('Artifact digest mismatch')
    names = release_artifact_names(version)
    with zipfile.ZipFile(archive) as package:
        entries = package.infolist()
        if {entry.filename for entry in entries} != names or len(entries) != len(names):
            raise ValueError('Unexpected artifact file list')
        if sum(entry.file_size for entry in entries) > MAX_ARTIFACT:
            raise ValueError('Unpacked artifact exceeds the size limit')
        for entry in entries:
            with package.open(entry) as source, (destination / entry.filename).open('wb') as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)


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
        summary('Full tests required: this ref is outside the release reuse policy.')
        return
    repository, sha, current = env['GITHUB_REPOSITORY'], env['GITHUB_SHA'], env['GITHUB_RUN_ID']
    api = API(repository, env['GH_TOKEN'])
    selected = None
    with ExitStack() as stack:
        try:
            version = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))['localVersion']
            order = source_policy(api, env['GITHUB_REF'], version, sha)
            selected = next(original_proofs(api, repository, sha, current, version, order), None)
            if not selected:
                output({'reused': 'false'})
                summary('Full tests required: no eligible original run with verified matrix jobs and unexpired archives.')
                return
            stage = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix='FocusTodo-CI-', dir=env.get('RUNNER_TEMP'))))
            archive = stage / 'artifact.zip'
            api.download(selected['artifact_id'], archive)
            unpack(archive, selected['artifact_digest'], version, stage)
            # Validate every payload byte against a fresh build of this commit.
            subprocess.run(['python', 'scripts/verify-release-workflows.py', version, str(stage), '--reference', 'dist'], cwd=ROOT, check=True)
            if not filecmp.cmp(stage / 'release-notes.md', ROOT / 'dist/release-notes.md', shallow=False):
                raise ValueError('Release notes differ from the current commit')
        except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
            output({'reused': 'false'})
            summary(f'Full tests required: reuse could not be verified ({type(error).__name__}).')
            return
        # Verification leaves the fresh dist batch untouched. A write failure
        # here fails preflight before another job can use a mixed batch.
        for name in release_artifact_names(version):
            shutil.copyfile(stage / name, ROOT / 'dist' / name)
    output({'reused': 'true', 'run_id': selected['run_id'], 'artifact_id': selected['artifact_id'], 'artifact_digest': selected['artifact_digest']})
    summary(f"Reused the six original matrix jobs for {sha} from {selected['branch']} "
            f"run #{selected['run_number']} ({selected['run_url']}); restored artifact "
            f"{selected['artifact_id']} with {selected['artifact_digest']}.")


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
        repository, sha, current = env['GITHUB_REPOSITORY'], env['GITHUB_SHA'], env['GITHUB_RUN_ID']
        api = API(repository, env['GH_TOKEN'])
        version = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))['localVersion']
        order = source_policy(api, env['GITHUB_REF'], version, sha)
        selected = next(original_proofs(api, repository, sha, current, version, order, env['REUSED_RUN_ID']), None)
        if (not selected or str(selected['artifact_id']) != env['REUSED_ARTIFACT_ID']
                or selected['artifact_digest'] != env['REUSED_ARTIFACT_DIGEST']):
            raise ValueError('Reused evidence is no longer valid')
        summary(f"CI gate passed: {sha} traced to original {selected['branch']} run #{selected['run_number']} "
                f"({selected['run_url']}), artifact {selected['artifact_id']} ({selected['artifact_digest']}).")
    else:
        summary(f'CI gate passed: {mode} checks succeeded in this run.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('reuse', 'gate'))
    args = parser.parse_args()
    try:
        reuse() if args.mode == 'reuse' else gate()
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as failure:
        raise SystemExit(f'CI validation failed ({type(failure).__name__}); publication is blocked.')
