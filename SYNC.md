> Main application update (2026-11-25): the root page is now TEST WORLD. The historical KR calculator is preserved under `archive/kr-2.11.1/`, with in-memory edits only. The game uses the immutable `live_2_12_1` release; the existing `assets/game` collector does not rewrite this release. See `TEST_WORLD.md`.

# Automated synchronization

The current app defaults to the verified `apk_2_11_1` release. Its configuration
and matching images live in `data/releases/apk_2_11_1` and
`assets/releases/apk_2_11_1`; see [APK_DATA.md](APK_DATA.md). The hourly collector
continues to maintain `assets/game`, but cannot replace the selected APK
release's atlases or calculation data. A new game-data release must update the
configs, mappings and images together after validation.

After merge to main, upstream 1vcian/fm game images are checked hourly at :47
UTC. GitHub schedules can be delayed and only run
on the default branch. Public repository schedules may be disabled after 60 days
without repository activity. The game-image workflow also supports Run workflow.

HTML synchronization is paused. The historical `/forge-master.html` source is
the V72 planner using `fmkr_personal_stable`; the current published app uses
`fmkr_rebuild_v1` with multiple profiles. The V72 source does not migrate those
profiles, restores removed UI, and requires root-absolute scripts, images and
configuration JSON that this repository does not publish at those paths. Its
embedded images also contain corrupt pixel data. Fixing images alone would not
make replacing the current app safe.

`Check Forge Master Pages source` is manual and read-only. It rejects a source
with a missing/different profile storage contract or missing current app marker
before downloading images. It uses `--check-only`, so even a successful check
cannot modify or publish files. Re-enable HTML publishing only after a compatible
source, complete dependencies and any explicit profile migration are verified.

Every game-image run validates the full snapshot, including image bytes, so changes at an
unchanged URL are detected. No timestamps or upstream revision markers are
committed. Only generated paths are staged. Unreferenced images are retained
for cached clients. A concurrency group serializes game-image writes; GitHub may
replace a pending run, and the next run checks the latest source again.

Downloads use HTTPS, timeouts and retries. HTML must be a complete Forge Master
planner. Every image must decode successfully. All downloads/validation finish
in a temporary directory before published files are touched. Failed jobs never
commit or deploy partial downloads. Push conflicts fail without force or rebase.

Game images use the newest dated Texture2D directory and current AutoItemMapping
from the same upstream checkout. Missing assets fail closed; there is no fallback
to the obsolete 2.9 directory. This updates images, not planner game rules/data.

Existing main / root branch-based Pages configuration is checked before syncing
and is not changed. Bot-token pushes do not start Pages builds, so the workflow
explicitly requests a build. An unchanged run skips both commit and build when
the same commit is already built/queued; a prior failed build is requested again.
A build-request error fails visibly and leaves the previous deployment available.
Inspect the Pages build run for final deployment status.

Local checks: install Pillow==11.3.0, then run
`python -m unittest discover -s tests -v`,
`node tests/test_profile_migration.cjs`, `node tests/test_game_math.cjs`,
and `bash -n scripts/publish_sync.sh`.
Use `python scripts/sync_content.py game --source PATH --check-only` to validate
the real upstream snapshot without applying it. Pages source diagnosis is
`python scripts/sync_content.py pages --check-only` and is expected to reject
the incompatible V72 source while the current profile app is published.
