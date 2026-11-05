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
from runtime_layout import runtime_entries, output_path

spec = importlib.util.spec_from_file_location('pages', ROOT / 'scripts/deploy-pages.py')
pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pages)


class PagesBuildTests(unittest.TestCase):
    def test_artifact_matches_committed_runtime_and_does_not_mutate_repository(self):
        mounts = list(runtime_entries())
        sources = [source for source, _ in mounts]
        before = pages.git('status', '--porcelain')
        self.assertFalse(pages.git('ls-tree', '--name-only', 'HEAD', '--', 'CNAME').strip(), 'Checkout must not contain CNAME')
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'site'
            pages.build('HEAD', output)
            expected = pages.git('ls-tree', '-rz', 'HEAD', '--', *sources)
            names = [entry.split(b'\t', 1)[1].decode() for entry in expected.split(b'\0') if entry]
            actual = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
            self.assertEqual(actual, {output_path(name, mounts) for name in names} | {'.nojekyll', 'deployment.json'})
            with tarfile.open(fileobj=io.BytesIO(pages.git('archive', 'HEAD', '--', *sources))) as archive:
                for member in archive.getmembers():
                    if member.isfile():
                        self.assertEqual((output / output_path(member.name, mounts)).read_bytes(), archive.extractfile(member).read(), member.name)
            for excluded in ('CNAME', 'package.json', 'README.md', '.github', 'scripts', 'tests', 'docs', 'src', 'public', 'startup.css'):
                self.assertFalse((output / excluded).exists(), excluded)
            manifest = json.loads((output / 'deployment.json').read_text(encoding='utf-8'))
            release = json.loads(pages.git('show', 'HEAD:release.json'))
            self.assertEqual(manifest, {
                'version': release['officialVersion'] + '-local.' + release['localVersion'],
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
