"""Contracts for exact-commit test reuse; no network, credentials or user data."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ci_validation', ROOT / 'scripts/ci-validation.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
NOW = datetime(2026, 11, 17, 12, tzinfo=timezone.utc)
SHA, REPO = 'a' * 40, 'owner/repository'


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.run = {'id': 10, 'path': '.github/workflows/ci.yml', 'head_sha': SHA, 'head_branch': 'dev',
                    'event': 'push', 'head_repository': {'full_name': REPO}, 'status': 'completed',
                    'conclusion': 'success', 'updated_at': '2026-11-17T10:30:00Z', 'html_url': 'https://github.com/owner/repository/actions/runs/10'}
        self.jobs = [{'name': name, 'status': 'completed', 'conclusion': 'success', 'started_at': '2026-11-17T10:01:00Z'} for name in policy.MATRIX]
        self.jobs.append({'name': 'preflight', 'conclusion': 'success'})
        self.artifact = {'id': 20, 'name': 'portable-test-archives', 'expired': False,
                         'created_at': '2026-11-17T10:00:00Z', 'expires_at': '2026-11-18T10:00:00Z',
                         'digest': 'sha256:' + 'b' * 64, 'size_in_bytes': 100,
                         'workflow_run': {'id': 10, 'head_sha': SHA}}

    def evidence(self, run=None, jobs=None, artifacts=None):
        return policy.evidence(run or self.run, jobs if jobs is not None else self.jobs,
                               artifacts if artifacts is not None else [self.artifact], REPO, SHA, '99', NOW)

    def test_only_release_refs_can_reuse_and_dev_always_runs_full_tests(self):
        for ref in ('refs/heads/main', 'refs/heads/release/2.0.1', 'refs/tags/2.0.1'):
            self.assertTrue(policy.eligible('push', ref))
            self.assertTrue(policy.eligible('workflow_dispatch', ref))
            self.assertFalse(policy.eligible('pull_request', ref))
        for ref in ('refs/heads/dev', 'refs/heads/feature', 'refs/pull/1/merge', 'refs/tags/v2.0.1'):
            self.assertFalse(policy.eligible('push', ref))

    def test_successful_exact_commit_preserves_the_tested_artifact_identity(self):
        proof = self.evidence()
        self.assertEqual(proof['run_id'], 10)
        self.assertEqual(proof['sha'], SHA)
        self.assertEqual(proof['artifact_id'], 20)
        self.assertEqual(proof['artifact_digest'], self.artifact['digest'])
        self.assertEqual(set(proof['jobs']), policy.MATRIX)

    def test_other_commits_refs_workflows_forks_and_incomplete_runs_are_rejected(self):
        changes = [('head_sha', 'c' * 40), ('head_branch', 'main'), ('path', '.github/workflows/other.yml'),
                   ('event', 'pull_request'), ('head_repository', {'full_name': 'fork/repository'}),
                   ('status', 'in_progress'), ('conclusion', 'failure'), ('conclusion', 'cancelled'), ('id', 99)]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                candidate = deepcopy(self.run); candidate[key] = value
                self.assertIsNone(self.evidence(run=candidate))

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


if __name__ == '__main__':
    unittest.main()
