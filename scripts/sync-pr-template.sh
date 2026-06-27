#!/usr/bin/env bash
# Sync .github/PULL_REQUEST_TEMPLATE.md from CONTRIBUTING.md (single source of truth).
#
# Usage: ./scripts/sync-pr-template.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${REPO_ROOT}/CONTRIBUTING.md"
TARGET="${REPO_ROOT}/.github/PULL_REQUEST_TEMPLATE.md"
START='<!-- pr-template-start -->'
END='<!-- pr-template-end -->'

if [ ! -f "${SOURCE}" ]; then
  echo "Error: ${SOURCE} not found"
  exit 1
fi

python3 - "${SOURCE}" "${TARGET}" "${START}" "${END}" <<'PY'
import sys

source_path, target_path, start, end = sys.argv[1:5]
text = open(source_path, encoding="utf-8").read()
if start not in text or end not in text:
    sys.exit(f"Markers {start!r} / {end!r} not found in {source_path}")

body = text.split(start, 1)[1].split(end, 1)[0].strip() + "\n"
open(target_path, "w", encoding="utf-8").write(body)
print(f"Synced {target_path} from {source_path}")
PY
