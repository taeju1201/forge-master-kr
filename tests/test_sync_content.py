import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('sync_content', Path(__file__).parents[1] / 'scripts/sync_content.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncTests(unittest.TestCase):
    def test_error_html_rejected(self):
        with self.assertRaises(ValueError):
            sync.validate_html(b'<html>Access denied</html>')

    def test_truncated_html_rejected(self):
        with self.assertRaises(ValueError):
            sync.validate_html(b'<title>Forge Master</title><script>' + b' ' * 10000)

    def test_corrupt_image_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'image.png'
            path.write_text('<html>error</html>')
            with self.assertRaises(Exception):
                sync.validate_image(path)

    def test_late_download_failure_preserves_all_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'index.html').write_text('old planner')
            def failed(stage):
                (stage / 'index.html').write_text('new planner')
                raise RuntimeError('last asset failed')
            with patch.object(sync, 'stage_pages', failed):
                with self.assertRaises(RuntimeError):
                    sync.sync('pages', root)
            self.assertEqual((root / 'index.html').read_text(), 'old planner')
            self.assertEqual(len(list(root.iterdir())), 1)

    def test_missing_newest_game_assets_do_not_fall_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            public = root / 'source/public'
            for date in ['2026_09_08_08_08', '2026_10_08_09_03']:
                (public / 'Texture2D' / date).mkdir(parents=True)
            (public / 'parsed_configs').mkdir()
            (public / 'parsed_configs/AutoItemMapping.json').write_text('{"a":{"SpriteName":"valid"}}')
            Image.new('RGB', (2, 2)).save(public / 'Texture2D/2026_09_08_08_08/valid.png')
            dest = root / 'published'
            dest.mkdir()
            (dest / 'index.html').write_text('old')
            with self.assertRaises(FileNotFoundError):
                sync.sync('game', dest, root / 'source')
            self.assertEqual(list(dest.iterdir()), [dest / 'index.html'])

    def test_identical_snapshot_is_git_noop_and_preserves_old_assets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            stage = root / 'stage'
            dest = root / 'repo'
            stage.mkdir()
            dest.mkdir()
            (stage / 'index.html').write_text('validated')
            (dest / 'old.png').write_bytes(b'keep')
            subprocess.run(['git', 'init', '-q', str(dest)], check=True)
            sync.apply(stage, dest)
            subprocess.run(['git', '-C', str(dest), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(dest), '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'baseline'], check=True)
            before = (dest / 'index.html').stat().st_mtime_ns
            sync.apply(stage, dest)
            self.assertEqual((dest / 'index.html').stat().st_mtime_ns, before)
            self.assertEqual(subprocess.check_output(['git', '-C', str(dest), 'status', '--porcelain']), b'')
            self.assertTrue((dest / 'old.png').exists())


if __name__ == '__main__':
    unittest.main()
