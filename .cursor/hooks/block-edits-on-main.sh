#!/usr/bin/env bash
# Block Write/StrReplace/EditNotebook/Delete on main or master.
# See .cursor/rules/branch-first.mdc

set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
branch="$(git -C "$root" branch --show-current 2>/dev/null || true)"

if [[ "$branch" == "main" || "$branch" == "master" ]]; then
  cat <<EOF
{
  "permission": "deny",
  "user_message": "Edits on \`$branch\` are blocked. Create a branch first: git checkout -b feat/<short-description>",
  "agent_message": "STOP: You are on \`$branch\`. Your first action must be \`git checkout -b feat/<short-description>\` per .cursor/rules/branch-first.mdc. Do not edit files until you are off main."
}
EOF
  exit 0
fi

echo '{"permission":"allow"}'
exit 0
