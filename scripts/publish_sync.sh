#!/usr/bin/env bash
set -euo pipefail
# Only explicit generated paths; never include an upstream checkout or tooling.
for path in "$@"; do
  if [[ -e "$path" ]]; then git add -- "$path"; fi
done
if git diff --cached --quiet; then
  echo 'No content changes'
else
  git config user.name 'github-actions[bot]'
  git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
  git commit -m 'Sync validated Forge Master content'
  # Non-fast-forward is deliberately fatal: never force-push over another writer.
  git push origin HEAD:main
fi
# GITHUB_TOKEN pushes do not automatically start branch-based Pages builds.
# Also retry a previously failed/missing build without making another commit.
head=$(git rev-parse HEAD)
latest=$(gh api "repos/$GITHUB_REPOSITORY/pages/builds/latest")
if jq -e --arg head "$head" '.commit == $head and (.status == "built" or .status == "building" or .status == "queued")' <<< "$latest" >/dev/null; then
  echo 'Pages already built or queued for this commit'
else
  gh api --method POST "repos/$GITHUB_REPOSITORY/pages/builds"
fi
