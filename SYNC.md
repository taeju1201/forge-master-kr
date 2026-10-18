# Automated synchronization

After merge to main, Pages content is checked hourly at :17 UTC and upstream
1vcian/fm game images at :47 UTC. GitHub schedules can be delayed and only run
on the default branch. Public repository schedules may be disabled after 60 days
without repository activity. Both workflows also support Run workflow.

Every run downloads the full snapshot, including image bytes, so changes at an
unchanged URL are detected. No timestamps or upstream revision markers are
committed. Only generated paths are staged. Unreferenced images are retained
for cached clients. A shared concurrency group serializes writers; GitHub may
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
`python -m unittest discover -s tests -v` and `bash -n scripts/publish_sync.sh`.
