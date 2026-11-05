"""Exercise release assets and the workflow's branch-independent gates."""
import importlib.util
import hashlib
import zipfile
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('gate', ROOT / 'scripts/verify-release-workflows.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class ReleaseGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.directory = Path(cls.temporary.name) / 'dist'
        cls.tag = json.loads((ROOT / 'release.json').read_text(encoding='utf-8'))['localVersion']
        subprocess.run([sys.executable, str(ROOT / 'scripts/package-release.py'), '--output', str(cls.directory), '--tag', cls.tag], check=True)
        cls.workflow = (ROOT / '.github/workflows/ci.yml').read_text(encoding='utf-8')

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_non_main_tag_can_publish_after_complete_ci(self):
        gate.verify(self.tag, self.directory)
        release = self.workflow.split('  release:\n', 1)[1]
        self.assertIn('needs: [preflight, test]', release)
        self.assertIn("github.ref_type == 'tag'", release)
        self.assertNotIn('merge-base', release)
        self.assertNotIn('needs: deploy', release)
        self.assertIn('flags=(--prerelease --latest=false)', release)
        self.assertIn('--prerelease=false', release)
        self.assertIn("os: [ubuntu-latest, windows-latest, macos-latest]", self.workflow)
        self.assertIn("node: ['22', '24']", self.workflow)
        self.assertNotIn("if: github.ref_type != 'tag'", self.workflow)

    def test_failed_or_skipped_ci_cannot_publish(self):
        release = self.workflow.split('  release:\n', 1)[1]
        self.assertIn('needs: [preflight, test]', release)
        self.assertNotIn('always()', release)
        self.assertIn("if: needs.preflight.outputs.full == 'true'", self.workflow)
        self.assertIn('full=true', self.workflow)

    def test_version_mismatch_and_missing_or_damaged_assets_rejected(self):
        with self.assertRaises(ValueError):
            gate.verify('0.0.0', self.directory)
        with tempfile.TemporaryDirectory() as temporary:
            broken = Path(temporary) / 'broken'
            shutil.copytree(self.directory, broken)
            archive = broken / ('FocusTodo-' + self.tag + '.zip')
            archive.write_bytes(b'damaged')
            with self.assertRaises(ValueError):
                gate.verify(self.tag, broken)
            archive.unlink()
            with self.assertRaises(FileNotFoundError):
                gate.verify(self.tag, broken)

    def test_pages_only_deploys_from_main_and_release_cannot_override(self):
        pages = self.workflow.split('  pages-build:\n', 1)[1].split('  release:\n', 1)[0]
        self.assertIn("if: github.ref == 'refs/heads/main'", pages)
        self.assertIn('needs: pages-build', pages)
        self.assertIn('if [[ "$current" != "$GITHUB_SHA" ]]', pages)
        release = self.workflow.split('  release:\n', 1)[1]
        self.assertNotIn('pages: write', release)
        self.assertNotIn('actions/deploy-pages', release)

    def test_existing_release_assets_must_match_tested_contents(self):
        gate.verify(self.tag, self.directory, self.directory)
        with tempfile.TemporaryDirectory() as temporary:
            changed = Path(temporary) / 'changed'
            shutil.copytree(self.directory, changed)
            archive = changed / ('FocusTodo-' + self.tag + '.zip')
            with zipfile.ZipFile(archive, 'a') as package:
                package.writestr('unexpected.txt', b'changed')
            sums = changed / 'SHA256SUMS.txt'
            lines = sums.read_text(encoding='utf-8').splitlines()
            sums.write_text('\n'.join(
                hashlib.sha256(archive.read_bytes()).hexdigest() + '  ' + archive.name
                if line.endswith('  ' + archive.name) else line for line in lines
            ) + '\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                gate.verify(self.tag, changed, self.directory)
        release = self.workflow.split('  release:\n', 1)[1]
        self.assertIn('--reference dist', release)
        self.assertIn("r['prerelease'] and not r['draft']", release)
        self.assertIn('refusing to overwrite', release)


if __name__ == '__main__':
    unittest.main()
