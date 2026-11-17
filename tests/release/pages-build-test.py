"""Verify Pages artifacts preserve the committed runtime whitelist."""
import importlib.util
import json
import io
import tarfile
from pathlib import Path
import subprocess
import tempfile
import unittest
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))

spec = importlib.util.spec_from_file_location('pages', ROOT / 'scripts/deploy-pages.py')
pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pages)


class PagesBuildTests(unittest.TestCase):
    def test_artifact_matches_committed_runtime_and_does_not_mutate_repository(self):
        before = pages.git('status', '--porcelain')
        self.assertFalse(pages.git('ls-tree', '--name-only', 'HEAD', '--', 'CNAME').strip(), 'Checkout must not contain CNAME')
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'site'
            pages.build('HEAD', output)
            release = json.loads(pages.git('show', 'HEAD:release.json'))
            from app_runtime import built_files
            runtime = built_files()
            actual = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
            self.assertEqual(actual, set(runtime) | {'.nojekyll', 'deployment.json'})
            for name, file in runtime.items():
                self.assertEqual((output / name).read_bytes(), file.read_bytes(), name)
            self.assertFalse((output / 'js/main.js').exists())
            self.assertFalse((output / 'prototype-build.json').exists())
            for excluded in ('CNAME', 'package.json', 'README.md', '.github', 'scripts', 'tests', 'docs', 'src', 'public', 'startup.css'):
                self.assertFalse((output / excluded).exists(), excluded)
            manifest = json.loads((output / 'deployment.json').read_text(encoding='utf-8'))
            release = json.loads(pages.git('show', 'HEAD:release.json'))
            self.assertEqual(manifest, {
                'version': pages.app_version(release),
                'sourceCommit': pages.git('rev-parse', 'HEAD').decode().strip(),
                'sourceRef': 'HEAD',
            })
            self.assertEqual((output / '.nojekyll').read_bytes(), b'')
            with self.assertRaises(FileExistsError):
                pages.build('HEAD', output)
        self.assertEqual(pages.git('status', '--porcelain'), before)

    def test_missing_revision_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'site'
            with self.assertRaises(subprocess.CalledProcessError):
                pages.build('does-not-exist', output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
