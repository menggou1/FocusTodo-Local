"""Exercise release origin, assets, evidence and Pages gates."""
import importlib.util
import base64
import hashlib
from html.parser import HTMLParser
import zipfile
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
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

    def test_release_branch_tag_can_publish_after_complete_ci(self):
        gate.verify(self.tag, self.directory)
        release = self.workflow.split('  release:\n', 1)[1]
        self.assertIn('needs: [preflight, validation]', release)
        self.assertIn("github.ref_type == 'tag'", release)
        self.assertNotIn('merge-base', release)
        self.assertNotIn('needs: deploy', release)
        self.assertIn('flags=(--latest)', release)
        self.assertIn('if [[ "$CHANNEL" == prerelease ]]; then flags=(--prerelease --latest=false); fi', release)
        self.assertIn('--prerelease=false --latest', release)
        self.assertIn("os: [ubuntu-latest, windows-latest, macos-latest]", self.workflow)
        self.assertIn("node: ['22', '24']", self.workflow)
        self.assertNotIn("if: github.ref_type != 'tag'", self.workflow)

    def test_first_publication_requires_exact_remote_release_head(self):
        head = 'a' * 40
        ref = 'refs/heads/release/' + self.tag
        tag = 'refs/tags/' + self.tag
        peeled = tag + '^{}'
        plain_tag = f'{head}\t{tag}\n'
        annotated_tag = f"{'c' * 40}\t{tag}\n{head}\t{peeled}\n"
        matching_branch = f'{head}\t{ref}\n'
        for tag_listing in (plain_tag, annotated_tag):
            with patch.object(gate.subprocess, 'check_output', side_effect=[head + '\n', matching_branch + tag_listing]) as git:
                gate.verify_release_head(self.tag)
                git.assert_called_with(['git', 'ls-remote', 'origin', ref, tag, peeled], cwd=ROOT, text=True, timeout=60)
        for listing in ('', f"{'b' * 40}\t{ref}\n", f'{head}\t{ref}-other\n',
                        f'{head}\trefs/heads/dev\n', f'{head}\trefs/heads/feature/candidate\n',
                        f'{head}\trefs/heads/main\n'):
            with self.subTest(listing=listing), patch.object(gate.subprocess, 'check_output', side_effect=[head, listing + plain_tag]):
                with self.assertRaisesRegex(ValueError, 'First publication requires'):
                    gate.verify_release_head(self.tag)
        for tag_listing in ('', f"{'b' * 40}\t{tag}\n", f"{head}\t{tag}\n{'b' * 40}\t{peeled}\n"):
            with self.subTest(tag_listing=tag_listing), patch.object(gate.subprocess, 'check_output', side_effect=[head, matching_branch + tag_listing]):
                with self.assertRaisesRegex(ValueError, 'remote tag must still point'):
                    gate.verify_release_head(self.tag)
        with patch.object(gate.subprocess, 'check_output') as git:
            with self.assertRaisesRegex(ValueError, 'Tag and release versions'):
                gate.verify_release_head('0.0.0')
            git.assert_not_called()

    def test_source_lookup_failure_cannot_publish(self):
        with patch.object(gate.subprocess, 'check_output', side_effect=[
            'a' * 40, subprocess.CalledProcessError(128, 'git ls-remote')
        ]):
            with self.assertRaises(subprocess.CalledProcessError):
                gate.verify_release_head(self.tag)

    def test_only_creation_requires_release_head_and_promotion_is_explicit(self):
        release = self.workflow.split('  release:\n', 1)[1]
        promotion, creation = release.split('if ! grep -q \'HTTP 404\'', 1)
        self.assertIn('test "$remote_sha" = "$(git rev-parse HEAD)"', promotion)
        self.assertIn('"$GITHUB_EVENT_NAME" != workflow_dispatch || "$CHANNEL" != stable', promotion)
        self.assertIn('gh release edit', promotion)
        self.assertNotIn('--check-release-head', promotion)
        gate_index = creation.index('release_source=$(python scripts/verify-release-workflows.py "$RELEASE_TAG" --check-release-head)')
        self.assertLess(gate_index, creation.index('gh release create'))
        self.assertIn('--verify-tag', creation)

    def test_production_csp_allows_only_the_generated_startup_code(self):
        class StartupHTML(HTMLParser):
            def __init__(self):
                super().__init__()
                self.policy = {}
                self.inline = []
                self.handlers = []
                self.capturing = False

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)
                if tag == 'meta' and attributes.get('http-equiv') == 'Content-Security-Policy':
                    self.policy = {parts[0]: parts[1:] for part in attributes['content'].split(';') if (parts := part.split())}
                self.handlers.extend(value for name, value in attrs if name.startswith('on'))
                self.capturing = tag == 'script' and 'src' not in attributes

            def handle_data(self, data):
                if self.capturing:
                    self.inline.append(data)

            def handle_endtag(self, tag):
                if tag == 'script':
                    self.capturing = False

        def digest(text):
            return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"

        parser = StartupHTML()
        parser.feed((ROOT / 'dist/app/site/index.html').read_text(encoding='utf-8'))
        self.assertEqual(len(parser.inline), 2)
        self.assertEqual(len(parser.handlers), 3)
        self.assertEqual(parser.policy['script-src'], ["'self'", *map(digest, parser.inline)])
        self.assertCountEqual(parser.policy['script-src-attr'], ["'unsafe-hashes'", *map(digest, parser.handlers)])
        self.assertEqual(parser.policy['base-uri'], ["'none'"])
        self.assertEqual(parser.policy['form-action'], ["'none'"])

    def test_failed_or_unverified_skipped_ci_cannot_publish(self):
        release = self.workflow.split('  release:\n', 1)[1]
        self.assertIn('needs: [preflight, validation]', release)
        self.assertIn("needs.preflight.result == 'success'", release)
        self.assertIn("needs.validation.result == 'success'", release)
        self.assertIn('!cancelled()', release)
        self.assertNotIn('always()', release)
        self.assertIn("if: needs.preflight.outputs.full == 'true' && needs.preflight.outputs.reused != 'true'", self.workflow)
        validation = self.workflow.split('  validation:\n', 1)[1].split('  pages-build:\n', 1)[0]
        self.assertIn('needs: [preflight, test]', validation)
        self.assertIn('python scripts/ci-validation.py gate', validation)
        self.assertIn('full=true', self.workflow)

    def test_modified_production_output_cannot_be_packaged(self):
        from app_runtime import built_files
        files = built_files()
        script = next(file for name, file in files.items() if name.endswith('.js'))
        original = script.read_bytes()
        try:
            script.write_bytes(original + b'\n/* corrupted after build */\n')
            with tempfile.TemporaryDirectory() as temporary:
                result = subprocess.run([sys.executable, str(ROOT / 'scripts/package-release.py'),
                                         '--output', temporary], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Production asset changed after build', result.stderr)
        finally:
            script.write_bytes(original)

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
        preflight = self.workflow.split('  preflight:\n', 1)[1].split('  test:\n', 1)[0]
        guard = preflight.split('- name: Check main production version', 1)[1].split('- run: npm ci', 1)[0]
        main_check = 'python scripts/deploy-pages.py --ref "$GITHUB_SHA" --check-main-version'
        self.assertIn("if: github.ref == 'refs/heads/main'", guard)
        self.assertIn(main_check, guard)
        pages = self.workflow.split('  pages-build:\n', 1)[1].split('  release:\n', 1)[0]
        self.assertIn("github.ref == 'refs/heads/main'", pages)
        self.assertIn("needs.validation.result == 'success'", pages)
        self.assertIn('needs: pages-build', pages)
        deploy = pages.split('  deploy:\n', 1)[1]
        self.assertIn("needs.pages-build.result == 'success'", deploy)
        self.assertIn('!cancelled()', deploy)
        self.assertIn("github.ref == 'refs/heads/main'", deploy)
        self.assertIn('if [[ "$current" != "$GITHUB_SHA" ]]', pages)
        self.assertIn(main_check, deploy)
        self.assertLess(deploy.index(main_check), deploy.index('uses: actions/deploy-pages'))
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
