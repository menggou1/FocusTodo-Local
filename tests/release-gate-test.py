"""A successful tag test cannot substitute for main tests or Pages."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('gate', Path(__file__).resolve().parents[1] / 'scripts/verify-release-workflows.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def run(path, **changes):
    return dict(id=1, head_sha='current', head_branch='main', event='push', path=path,
                status='completed', conclusion='success', html_url='https://example.com/run', **changes)


class ReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.runs = [run('.github/workflows/ci.yml'), run('.github/workflows/pages.yml')]

    def test_both_same_commit_main_workflows_required(self):
        self.assertEqual(gate.required_runs(self.runs, 'current'), self.runs)
        for field, value in [('head_sha', 'old'), ('head_branch', '1.7.2'), ('status', 'in_progress')]:
            changed = [dict(self.runs[0], **{field: value}), self.runs[1]]
            self.assertIsNone(gate.required_runs(changed, 'current'))
        self.assertIsNone(gate.required_runs(self.runs[:1], 'current'))

    def test_failure_or_cancellation_prevents_publication(self):
        for conclusion in ('failure', 'cancelled', 'skipped'):
            with self.assertRaises(RuntimeError):
                gate.required_runs([self.runs[0], dict(self.runs[1], conclusion=conclusion)], 'current')

    def test_latest_retry_controls_the_result(self):
        with self.assertRaises(RuntimeError):
            gate.required_runs(self.runs + [dict(self.runs[0], id=2, conclusion='failure')], 'current')


if __name__ == '__main__':
    unittest.main()
