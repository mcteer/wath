#!/usr/bin/env bash
# Poll open onboarding PRs and record merges via wath record-merge.
#
# Usage: ./scripts/poll-merge-prs.sh
# Requires: gh, wath CLI built, state under state/applications/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="${REPO_ROOT}/packages/engine/dist/cli/index.js"
STATE_ROOT="${REPO_ROOT}/state/applications"

shopt -s nullglob
for org_dir in "${STATE_ROOT}"/*/; do
  org="$(basename "${org_dir}")"
  [ "${org}" = "." ] && continue
  for f in "${org_dir}"*.yaml; do
    repo="$(basename "${f}" .yaml)"
    app="${org}/${repo}"
    phase="$(grep '^phase:' "${f}" | awk '{print $2}')"
    [ "${phase}" = "await_merge" ] || continue

    manifest_url="$(grep -A1 '^manifest:' "${f}" | grep 'pr_url:' | sed 's/.*pr_url: //' | tr -d \"'\" || true)"
    if [ -n "${manifest_url}" ] && [ "${manifest_url}" != "null" ]; then
      if gh pr view "${manifest_url}" --json state -q .state 2>/dev/null | grep -q MERGED; then
        echo "[poll] manifest merged: ${app} ${manifest_url}"
        node "${ENGINE}" record-merge --app "${app}" --type manifest --pr "${manifest_url}"
      fi
    fi

    # Integration PRs — parse YAML loosely for pr_open entries
    while IFS= read -r line; do
      std="$(echo "${line}" | cut -d: -f1 | tr -d ' ')"
      url="$(echo "${line}" | grep -o 'https://[^ ]*' || true)"
      [ -n "${url}" ] || continue
      if gh pr view "${url}" --json state -q .state 2>/dev/null | grep -q MERGED; then
        echo "[poll] integration merged: ${app} ${std} ${url}"
        node "${ENGINE}" record-merge --app "${app}" --type integration --standard "${std}" --pr "${url}"
      fi
    done < <(grep -E 'pr_url: https' "${f}" | grep -v manifest || true)
  done
done

echo "[poll] done"
