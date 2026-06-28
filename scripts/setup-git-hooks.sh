#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

chmod +x .githooks/pre-commit .cursor/hooks/block-edits-on-main.sh
git config core.hooksPath .githooks

echo "Git hooks enabled (core.hooksPath=.githooks)"
