"""Contracts for exact-commit test reuse; no network, credentials or user data."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ci_validation', ROOT / 'scripts/ci-validation.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
NOW = datetime(2026, 11, 17, 12, tzinfo=timezone.utc)
SHA, REPO = 'a' * 40, 'owner/repository'
VERSION = '2.1.5'
WORKFLOW_ID = 123


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.run = {'id': 10, 'workflow_id': WORKFLOW_ID, 'path': policy.WORKFLOW,
                    'run_number': 42, 'head_sha': SHA, 'head_branch': 'dev', 'event': 'push',
                    'repository': {'full_name': REPO}, 'head_repository': {'full_name': REPO},
                    'status': 'completed', 'conclusion': 'success', 'updated_at': '2026-11-17T10:30:00Z',
                    'html_url': 'https://github.com/owner/repository/actions/runs/10'}
        self.jobs = [{'name': name, 'status': 'completed', 'conclusion': 'success',
                      'started_at': '2026-11-17T10:01:00Z',
                      'steps': [self.step(step) for step in policy.NODE_24_STEPS | policy.LINUX_BROWSER_STEPS]}
                     for name in policy.MATRIX]
        self.jobs += [self.step('Verify CI evidence'), {
            **self.step('preflight'), 'steps': [self.step('Check release branch version identity')]
        }]
        self.artifact = {'id': 20, 'name': 'portable-test-archives', 'expired': False,
                         'created_at': '2026-11-17T10:00:00Z', 'expires_at': '2026-11-18T10:00:00Z',
                         'digest': 'sha256:' + 'b' * 64, 'size_in_bytes': 100,
                         'workflow_run': {'id': 10, 'head_sha': SHA}}

    @staticmethod
    def step(name, conclusion='success'):
        return {'name': name, 'status': 'completed', 'conclusion': conclusion}

    def evidence(self, run=None, jobs=None, artifacts=None):
        return policy.evidence(run or self.run, jobs if jobs is not None else self.jobs,
                               artifacts if artifacts is not None else [self.artifact], SHA, VERSION, NOW)

    def test_only_eligible_release_and_integration_refs_can_reuse(self):
        for ref in ('refs/heads/dev', 'refs/heads/main', 'refs/heads/release/2.1.5', 'refs/tags/2.1.5'):
            self.assertTrue(policy.eligible('push', ref))
            self.assertTrue(policy.eligible('workflow_dispatch', ref))
            self.assertFalse(policy.eligible('pull_request', ref))
        for ref in ('refs/heads/feature', 'refs/pull/1/merge', 'refs/tags/v2.1.5', 'refs/tags/02.1.5'):
            self.assertFalse(policy.eligible('push', ref))

    def test_direction_priority_and_required_identity(self):
        release = 'release/' + VERSION
        for ref, matches, tagged, published, expected in (
                ('refs/heads/' + release, True, False, False, ('dev',)),
                ('refs/heads/release/2.1.4', True, True, True, ()),
                ('refs/heads/' + release, False, False, False, ()),
                ('refs/tags/' + VERSION, True, True, False, (release, 'dev')),
                ('refs/tags/' + VERSION, False, True, False, ()),
                ('refs/tags/' + VERSION, True, False, False, ()),
                ('refs/tags/2.1.4', True, True, True, ()),
                ('refs/heads/main', True, True, True, (VERSION, release, 'dev')),
                ('refs/heads/main', True, False, False, (release, 'dev')),
                ('refs/heads/main', False, False, False, ('dev',)),
                ('refs/heads/dev', True, True, True, (VERSION, release)),
                ('refs/heads/dev', True, True, False, ()),
                ('refs/heads/dev', True, False, True, ())):
            with self.subTest(ref=ref, release=matches, tag=tagged, release_published=published):
                self.assertEqual(policy.source_order(ref, VERSION, matches, tagged, published), expected)

    def test_remote_identity_peels_tag_and_requires_a_published_stable_release_for_dev(self):
        api = Mock()
        api.read.return_value = {'tag_name': VERSION, 'draft': False, 'prerelease': False,
                                 'published_at': '2026-11-17T12:30:00Z'}
        tag, branch = 'refs/tags/' + VERSION, 'refs/heads/release/' + VERSION
        with patch.object(policy.subprocess, 'check_output', return_value=
                          f"{'b'*40}\t{tag}\n{SHA}\t{tag}^{{}}\n{SHA}\t{branch}\n") as remote:
            self.assertEqual(policy.source_policy(api, 'refs/heads/dev', VERSION, SHA), (VERSION, 'release/' + VERSION))
            api.read.return_value['prerelease'] = True
            self.assertEqual(policy.source_policy(api, 'refs/heads/dev', VERSION, SHA), ())
            remote.assert_called_with(['git', 'ls-remote', 'origin', branch, tag, tag + '^{}'],
                                      cwd=policy.ROOT, text=True, timeout=45)
            remote.return_value = f"{'b'*40}\t{tag}\n{SHA}\t{branch}\n"
            self.assertEqual(policy.source_policy(api, tag, VERSION, SHA), ())

    def test_successful_exact_commit_preserves_the_tested_artifact_identity(self):
        proof = self.evidence()
        self.assertEqual(proof['run_id'], 10)
        self.assertEqual(proof['sha'], SHA)
        self.assertEqual(proof['artifact_id'], 20)
        self.assertEqual(proof['artifact_digest'], self.artifact['digest'])
        self.assertEqual(set(proof['jobs']), policy.MATRIX)

    def proofs(self, runs, order, jobs=None, expected_run=None):
        api = Mock()
        def read(url):
            if url == 'actions/workflows/ci.yml':
                return {'path': policy.WORKFLOW, 'id': WORKFLOW_ID}
            if '/runs?' in url:
                return {'workflow_runs': runs, 'total_count': len(runs)}
            run_id = int(url.split('/')[2])
            if '/jobs?' in url:
                return {'jobs': self.jobs if jobs is None else jobs[run_id]}
            return {'artifacts': [{**self.artifact, 'workflow_run': {'id': run_id, 'head_sha': SHA}}]}
        api.read.side_effect = read
        verify = policy.evidence
        with patch.object(policy, 'evidence', wraps=lambda run, jobs, artifacts, sha, version:
                          verify(run, jobs, artifacts, sha, version, NOW)):
            return list(policy.original_proofs(api, REPO, SHA, '99', VERSION, order, expected_run))

    def test_other_commits_refs_workflows_forks_and_incomplete_runs_are_rejected(self):
        changes = [('head_sha', 'c' * 40), ('head_branch', 'release/2.1.4'), ('path', '.github/workflows/other.yml'),
                   ('workflow_id', WORKFLOW_ID + 1), ('repository', {'full_name': 'other/repository'}),
                   ('event', 'pull_request'), ('head_repository', {'full_name': 'fork/repository'}),
                   ('status', 'in_progress'), ('conclusion', 'failure'), ('conclusion', 'cancelled'),
                   ('conclusion', 'timed_out'), ('conclusion', 'skipped'), ('id', 99)]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                self.assertEqual(self.proofs([{**self.run, key: value}], ('dev', 'release/' + VERSION, VERSION)), [])

    def test_tag_release_and_dev_resolve_directly_to_original_jobs(self):
        release = {**self.run, 'id': 11, 'head_branch': 'release/' + VERSION}
        tag = {**self.run, 'id': 12, 'head_branch': VERSION}
        tag_jobs = deepcopy(self.jobs)
        tag_jobs[-1]['steps'].append(self.step('Check tag version identity'))
        tag_jobs.append(self.step('Publish version tag'))
        for ref, order, ids in (
                ('release', ('dev',), [10]),
                ('tag', ('release/' + VERSION, 'dev'), [11, 10]),
                ('main', (VERSION, 'release/' + VERSION, 'dev'), [12, 11, 10]),
                ('dev', (VERSION, 'release/' + VERSION), [12, 11])):
            with self.subTest(ref=ref):
                sources = self.proofs([self.run, release, tag], order, {10: self.jobs, 11: self.jobs, 12: tag_jobs})
                self.assertEqual([source['run_id'] for source in sources], ids)
        self.assertEqual(self.proofs([tag], (VERSION,), {12: self.jobs}), [])

    def test_reuse_runs_and_circular_references_have_no_original_jobs(self):
        reused_release = {**self.run, 'id': 11, 'head_branch': 'release/' + VERSION, 'reused_run_id': 12}
        reused_tag = {**self.run, 'id': 12, 'head_branch': VERSION, 'reused_run_id': 11}
        skipped = [self.step('test', 'skipped'), *self.jobs[-2:]]
        jobs = {10: self.jobs, 11: skipped, 12: skipped}
        order = (VERSION, 'release/' + VERSION, 'dev')
        self.assertEqual(self.proofs([reused_release, reused_tag], order, jobs), [])
        self.assertEqual([item['run_id'] for item in self.proofs(
            [reused_release, reused_tag, self.run], order, jobs)], [10])
        self.assertEqual(self.proofs([reused_release, self.run], order, jobs, expected_run='11'), [])
        self.assertEqual(self.proofs([self.run], order, jobs, expected_run='10')[0]['artifact_id'], 20)

    def test_browser_package_and_independent_validation_steps_must_succeed(self):
        for index, job in enumerate(self.jobs):
            if job['name'].endswith('Node 24'):
                for step in policy.NODE_24_STEPS | (policy.LINUX_BROWSER_STEPS if job['name'].startswith('ubuntu-') else set()):
                    jobs = deepcopy(self.jobs)
                    next(s for s in jobs[index]['steps'] if s['name'] == step)['conclusion'] = 'skipped'
                    with self.subTest(job=job['name'], step=step):
                        self.assertIsNone(self.evidence(jobs=jobs))
        self.assertIsNone(self.evidence(jobs=[job for job in self.jobs if job['name'] != 'Verify CI evidence']))

    def test_missing_failed_skipped_or_duplicate_matrix_jobs_cannot_be_reused(self):
        self.assertIsNone(self.evidence(jobs=self.jobs[1:]))
        for result in ('failure', 'skipped', 'cancelled', None):
            jobs = deepcopy(self.jobs); jobs[0]['conclusion'] = result
            self.assertIsNone(self.evidence(jobs=jobs))
        self.assertIsNone(self.evidence(jobs=self.jobs + [self.jobs[0]]))
        self.assertIsNone(self.evidence(jobs=self.jobs[:-1]))

    def test_expired_missing_ambiguous_or_unidentified_archive_batches_are_rejected(self):
        self.assertIsNone(self.evidence(artifacts=[]))
        self.assertIsNone(self.evidence(artifacts=[self.artifact, self.artifact]))
        for key, value in [('expired', True), ('expires_at', '2026-11-17T11:00:00Z'), ('digest', ''),
                           ('size_in_bytes', 0), ('size_in_bytes', policy.MAX_ARTIFACT + 1),
                           ('workflow_run', {'id': 11, 'head_sha': SHA}),
                           ('workflow_run', {'id': 10, 'head_sha': 'd' * 40})]:
            candidate = deepcopy(self.artifact); candidate[key] = value
            self.assertIsNone(self.evidence(artifacts=[candidate]))

    def test_replaced_artifact_requires_all_three_archive_jobs_to_have_tested_it(self):
        changed = deepcopy(self.artifact); changed['created_at'] = '2026-11-17T10:02:00Z'
        self.assertIsNone(self.evidence(artifacts=[changed]))
        jobs = deepcopy(self.jobs)
        for job in jobs:
            if job['name'].endswith('Node 24'):
                job['started_at'] = '2026-11-17T10:03:00Z'
        self.assertIsNotNone(self.evidence(jobs=jobs, artifacts=[changed]))

    def test_only_verified_skips_can_pass_the_publication_gate(self):
        self.assertEqual(policy.gate_mode('success', 'success', 'true', 'false', 'push'), 'full')
        self.assertEqual(policy.gate_mode('success', 'skipped', 'true', 'true', 'push'), 'reuse')
        self.assertEqual(policy.gate_mode('success', 'skipped', 'false', '', 'pull_request'), 'documentation')
        for preflight, tests, full, reused, event in [
                ('failure', 'skipped', 'true', 'true', 'push'),
                ('cancelled', 'success', 'true', 'false', 'push'),
                ('success', 'skipped', 'true', 'false', 'push'),
                ('success', 'failure', 'true', 'true', 'push'),
                ('success', 'cancelled', 'true', 'true', 'push'),
                ('success', 'skipped', 'false', '', 'push')]:
            with self.assertRaises(ValueError):
                policy.gate_mode(preflight, tests, full, reused, event)

    def test_later_failures_invalidate_older_success_instead_of_being_hidden(self):
        failed = {**self.run, 'id': 11, 'conclusion': 'failure', 'updated_at': '2026-11-17T11:00:00Z'}
        for conclusion in ('failure', 'cancelled', 'timed_out'):
            self.assertTrue(policy.newer_failure([{**failed, 'conclusion': conclusion}], self.run, SHA, '99'))
        self.assertFalse(policy.newer_failure([{**failed, 'updated_at': '2026-11-17T09:00:00Z'}], self.run, SHA, '99'))
        self.assertFalse(policy.newer_failure([{**failed, 'head_sha': 'c' * 40}], self.run, SHA, '99'))
        self.assertFalse(policy.newer_failure([failed], self.run, SHA, '11'))
        self.assertEqual(self.proofs([self.run, failed], ('dev',)), [])

    def test_only_proven_wrong_tag_identity_leaves_dev_evidence_valid(self):
        failed = {**self.run, 'id': 11, 'head_branch': '2.1.1',
                  'conclusion': 'failure', 'updated_at': '2026-11-17T11:00:00Z'}
        api = Mock()
        step = {'name': 'Check tag version identity', 'conclusion': 'failure'}
        api.read.return_value = {'jobs': [{'name': 'preflight', 'conclusion': 'failure', 'steps': [step]}]}
        def blocked(run):
            return policy.newer_failure([run], self.run, SHA, '99',
                                        lambda item: policy.failed_tag_identity(api, item, '2.1.2'))
        self.assertFalse(blocked(failed))
        self.assertTrue(blocked({**failed, 'head_branch': '2.1.2'}))
        self.assertTrue(blocked({**failed, 'head_branch': 'main'}))
        self.assertTrue(blocked({**failed, 'conclusion': 'cancelled'}))
        step['conclusion'] = 'success'
        self.assertTrue(blocked(failed))
        step['name'] = 'Build archives and verify tag version'
        step['conclusion'] = 'failure'
        self.assertTrue(blocked(failed))

    def test_artifact_digest_and_exact_flat_file_list_are_required_before_unpacking(self):
        names = ['FocusTodo-1.2.3.zip', 'FocusTodo-1.2.3.tar.gz', 'SHA256SUMS.txt', 'release-notes.md']
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary); archive = folder / 'artifact.zip'; target = folder / 'unpacked'; target.mkdir()
            def make(entries):
                with zipfile.ZipFile(archive, 'w') as package:
                    for name in entries:
                        package.writestr(name, b'tested bytes')
                return 'sha256:' + hashlib.sha256(archive.read_bytes()).hexdigest()
            digest = make(names)
            policy.unpack(archive, digest, '1.2.3', target)
            self.assertEqual({p.name for p in target.iterdir()}, set(names))
            with self.assertRaises(ValueError):
                policy.unpack(archive, 'sha256:' + '0' * 64, '1.2.3', target)
            for entries in (names[:-1], names + ['../escape'], names + ['unexpected.txt']):
                with self.assertRaises(ValueError):
                    policy.unpack(archive, make(entries), '1.2.3', target)

    def test_artifact_limits_include_unpacked_bytes(self):
        names = ['FocusTodo-1.2.3.zip', 'FocusTodo-1.2.3.tar.gz', 'SHA256SUMS.txt', 'release-notes.md']
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            archive = folder / 'artifact.zip'
            target = folder / 'unpacked'
            target.mkdir()
            with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
                for name in names:
                    package.writestr(name, b'x' * 1024)
            digest = 'sha256:' + hashlib.sha256(archive.read_bytes()).hexdigest()
            with patch.object(policy, 'MAX_ARTIFACT', archive.stat().st_size - 1):
                with self.assertRaisesRegex(ValueError, '^Artifact exceeds'):
                    policy.unpack(archive, digest, '1.2.3', target)
            with patch.object(policy, 'MAX_ARTIFACT', 2048):
                with self.assertRaisesRegex(ValueError, 'Unpacked artifact'):
                    policy.unpack(archive, digest, '1.2.3', target)
            self.assertEqual(list(target.iterdir()), [])

    def test_reuse_restores_the_tested_batch_only_after_verification(self):
        for mismatch in (None, 'notes', 'contents', 'digest', 'missing'):
            with self.subTest(mismatch=mismatch), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                dist = root / 'dist'
                dist.mkdir()
                (root / 'release.json').write_text('{"localVersion":"1.2.3"}', encoding='utf-8')
                names = policy.release_artifact_names('1.2.3')
                fresh = {name: b'fresh' for name in names}
                tested = {name: b'tested' for name in names}
                tested['release-notes.md'] = b'other' if mismatch == 'notes' else fresh['release-notes.md']
                for name, content in fresh.items():
                    (dist / name).write_bytes(content)

                proof = {'artifact_id': 20, 'run_id': 10, 'run_url': 'https://example.invalid/ci/10',
                         'branch': 'dev', 'run_number': 42}
                archive = root / 'tested.zip'
                with zipfile.ZipFile(archive, 'w') as package:
                    for name, content in tested.items():
                        package.writestr(name, content)
                proof['artifact_digest'] = 'sha256:' + hashlib.sha256(archive.read_bytes()).hexdigest()
                if mismatch == 'digest':
                    proof['artifact_digest'] = 'sha256:' + '0' * 64
                env = {'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/release/1.2.3',
                       'GITHUB_REPOSITORY': REPO, 'GITHUB_SHA': SHA, 'GITHUB_RUN_ID': '99',
                       'GH_TOKEN': 'fixture', 'RUNNER_TEMP': temporary, 'GITHUB_STEP_SUMMARY': '',
                       'GITHUB_OUTPUT': str(root / 'output')}
                api = Mock()
                api.read.return_value = {'workflow_runs': [self.run]}
                api.download.side_effect = lambda _, target: target.write_bytes(archive.read_bytes())
                with (patch.dict(os.environ, env), patch.object(policy, 'ROOT', root),
                      patch.object(policy, 'API', return_value=api),
                      patch.object(policy, 'source_policy', return_value=('dev',)),
                      patch.object(policy, 'original_proofs', return_value=iter([] if mismatch == 'missing' else [proof])),
                      patch.object(policy.subprocess, 'run', side_effect=policy.subprocess.CalledProcessError(1, 'verify')
                                   if mismatch == 'contents' else None) as verify):
                    policy.reuse()
                    self.assertEqual(verify.call_count, 0 if mismatch in ('digest', 'missing') else 1)
                output = (root / 'output').read_text()
                expected = fresh if mismatch else tested
                self.assertIn('reused=false' if mismatch else 'reused=true', output)
                self.assertEqual({name: (dist / name).read_bytes() for name in names}, expected)


if __name__ == '__main__':
    unittest.main()
