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
    def test_main_version_rejects_conflicting_or_previously_occupied_tags(self):
        prior, mistaken, candidate = 'a' * 40, 'b' * 40, 'c' * 40
        tags = pages.remote_version_tags(
            f'{prior}\trefs/tags/2.1.0\n'
            f'{"d" * 40}\trefs/tags/2.1.1\n'
            f'{mistaken}\trefs/tags/2.1.1^{{}}\n'
            f'{prior}\trefs/tags/archive/1.9.4\n'
        )
        self.assertEqual(tags, {'2.1.0': prior, '2.1.1': mistaken})
        pages.verify_main_version('2.1.0', prior, tags)
        pages.verify_main_version('2.1.2', candidate, tags)
        with self.assertRaisesRegex(ValueError, 'conflicts with tags'):
            pages.verify_main_version('2.1.0', mistaken, tags)
        with self.assertRaisesRegex(ValueError, 'already assigned'):
            pages.verify_main_version('2.1.0', candidate, tags)
        with self.assertRaisesRegex(ValueError, 'already assigned'):
            pages.verify_main_version('2.1.1', candidate, tags)
        with self.assertRaisesRegex(ValueError, 'newer than.*2.1.1'):
            pages.verify_main_version('2.0.9', candidate, tags)
        pages.verify_main_version('2.1.2', candidate, {**tags, '2.1.2': candidate})
        with self.assertRaisesRegex(ValueError, 'invalid'):
            pages.verify_main_version('2.1.02', candidate, tags)

    def test_pages_rejects_wrong_build_metadata_and_browser_title(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            info, index = folder / 'build-info.json', folder / 'index.html'
            release = {'localVersion': '2.1.2', 'officialVersion': '7.1.1'}
            files = {'build-info.json': info, 'index.html': index}
            info.write_text('{"localVersion":"2.1.0","sourceVersion":"7.1.1"}', encoding='utf-8')
            index.write_text('<title>FocusTodo 2.1.2</title>', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'build metadata'):
                pages.verify_build_version(files, release)
            info.write_text('{"localVersion":"2.1.2","sourceVersion":"7.1.1"}', encoding='utf-8')
            index.write_text('<title>FocusTodo 2.1.0</title>', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'HTML title'):
                pages.verify_build_version(files, release)
            index.write_text('<title>FocusTodo 2.1.2</title>', encoding='utf-8')
            pages.verify_build_version(files, release)

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
