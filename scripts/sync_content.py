"""Stage and validate every input before touching published files."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

from PIL import Image

BASE = 'https://forge-master-kr.menam1407.chatgpt.site'
COMMON = ['Pets.png', 'MountIcons.png', 'SkillIcons.png', 'SkinsUiIcons.png',
          'FairyIconLora.png', 'FairyIconMira.png', 'FairyIconTira.png',
          'TechTreeIcons.png', 'ClanTechTreeIcons.png', 'EmblemHolder.png',
          'EmblemIcons.png', 'EmblemShapes.png']
COMMON += [f'SteppingStoneCharIcon{i}.png' for i in range(27)]


def validate_html(data):
    html = data.decode('utf-8')
    if (len(data) < 10000 or not re.search(r'<title[^>]*>[^<]*Forge Master', html, re.I)
            or '<script' not in html.lower() or '</html>' not in html.lower()
            or '</body>' not in html.lower()):
        raise ValueError('Source is not a complete Forge Master planner')
    return html


def validate_image(path):
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        image.load()  # detect truncated pixel data as well as invalid headers
        if min(image.size) < 1:
            raise ValueError(f'Empty image: {path}')


def download(url, dest, cookie_file):
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                            '--proto', '=https', '--proto-redir', '=https',
                            '--connect-timeout', '15', '--max-time', '90',
                            '-A', 'Mozilla/5.0 (GitHub Pages sync)',
                            '-b', str(cookie_file), '-e', BASE + '/', url,
                            '-o', str(dest)], check=True)
            return
        except subprocess.CalledProcessError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def stage_pages(stage):
    cookies = stage.parent / 'cookies'
    # One cookie writer; concurrent asset requests only read the resulting jar.
    subprocess.run(['curl', '-fsSL', '--proto', '=https', '--proto-redir', '=https',
                    '--connect-timeout', '15', '--max-time', '90', '--retry', '2',
                    '-A', 'Mozilla/5.0 (GitHub Pages sync)', '-c', str(cookies),
                    BASE + '/forge-master.html', '-o', str(stage / 'index.html')], check=True)
    html = validate_html((stage / 'index.html').read_bytes())
    paths = set(re.findall(r'embedded-images/[A-Za-z0-9._-]+', html))
    for kind, count in (('skills', 64), ('pets', 64), ('mounts', 16)):
        for asc in range(4):
            for index in range(count):
                paths.add(f'companion-icons/{kind}-{asc}-{index:02d}.png')
    def fetch(rel):
        download(BASE + '/' + rel, stage / rel, cookies)
        try:
            validate_image(stage / rel)
        except Exception as error:
            raise ValueError(f'Invalid downloaded image: {rel}: {error}') from error
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(fetch, sorted(paths)))
    (stage / '.nojekyll').touch()


def stage_game(stage, source):
    public = source / 'public'
    candidates = sorted(p for p in (public / 'Texture2D').iterdir()
                        if p.is_dir() and re.fullmatch(r'\d{4}_\d{2}_\d{2}(?:_\d{2}_\d{2})?', p.name))
    if not candidates:
        raise ValueError('No dated texture directory')
    tex = candidates[-1]  # Never silently fall back to an older release on failure.
    mapping = json.loads((public / 'parsed_configs/AutoItemMapping.json').read_text())
    if not isinstance(mapping, dict) or not mapping:
        raise ValueError('Empty or invalid item mapping')
    names = {row['SpriteName'] for row in mapping.values()}
    if any(not re.fullmatch(r'[A-Za-z0-9_-]+', name) for name in names):
        raise ValueError('Unsafe sprite name')
    files = [(tex / (name + '.png'), stage / 'assets/game/items' / (name + '.png'))
             for name in sorted(names)]
    files += [(tex / name, stage / 'assets/game' / name) for name in COMMON]
    for src, dst in files:
        validate_image(src)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    print(f'Validated {len(files)} images from {tex.name}')


def apply(stage, root):
    # Called only after the entire snapshot passes. Old, unreferenced assets stay
    # available for cached pages; no deletions and no timestamp/state commits.
    for src in sorted(stage.rglob('*')):
        if src.is_file():
            dst = root / src.relative_to(stage)
            if dst.is_symlink() or any(p.is_symlink() for p in dst.parents):
                raise ValueError(f'Refusing symlink destination: {dst}')
    for src in sorted(stage.rglob('*')):
        if src.is_file():
            dst = root / src.relative_to(stage)
            if dst.exists() and dst.read_bytes() == src.read_bytes():
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)


def sync(mode, root, source=None):
    with tempfile.TemporaryDirectory(prefix='fm-sync-') as tmp:
        stage = Path(tmp) / 'snapshot'
        stage.mkdir()
        if mode == 'pages':
            stage_pages(stage)
        else:
            stage_game(stage, source)
        apply(stage, root)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pages', 'game'])
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    if args.mode == 'game' and args.source is None:
        parser.error('--source is required for game sync')
    sync(args.mode, Path.cwd(), args.source)
