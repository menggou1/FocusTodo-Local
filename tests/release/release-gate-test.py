"""A successful tag test cannot substitute for main tests or Pages."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('gate', Path(__file__).resolve().parents[2] / 'scripts/verify-release-workflows.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def run(**changes):
    return dict(dict(id=1, head_sha='current', head_branch='main', event='push', path='.github/workflows/ci.yml',
                     status='completed', conclusion='success', html_url='https://example.com/run'), **changes)


class ReleaseGateTests(unittest.TestCase):
    def test_only_successful_main_run_for_this_sha_is_eligible(self):
        self.assertEqual(gate.required_run([run()], 'current'), run())
        self.assertIsNone(gate.required_run([], 'current'))
        for field, value in [('head_sha', 'old'), ('head_branch', '1.8.2'), ('status', 'in_progress'),
                             ('path', '.github/workflows/pages.yml'), ('event', 'pull_request')]:
            self.assertIsNone(gate.required_run([run(**{field: value})], 'current'), field)
        self.assertEqual(gate.required_run([run(event='workflow_dispatch')], 'current'),
                         run(event='workflow_dispatch'))

    def test_failure_or_cancellation_prevents_publication(self):
        for conclusion in ('failure', 'cancelled', 'skipped'):
            with self.assertRaises(RuntimeError):
                gate.required_run([run(), run(id=2, conclusion=conclusion)], 'current')

    def test_green_main_run_must_have_actually_deployed_pages(self):
        job = dict(name='Deploy GitHub Pages', status='completed', conclusion='success')
        gate.require_pages_deploy(run(), [job])
        for jobs in ([], [dict(job, name='pages-build')], [dict(job, conclusion='skipped')]):
            with self.assertRaises(RuntimeError):
                gate.require_pages_deploy(run(), jobs)


if __name__ == '__main__':
    unittest.main()
