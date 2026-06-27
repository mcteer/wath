#!/usr/bin/env bash
# Copy consumer templates into a target application repository.
#
# Usage: ./scripts/install-consumer-template.sh <target-repo-path>
set -euo pipefail

TARGET="${1:?target repo path required}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/templates/consumer"

if [ ! -d "${TARGET}" ]; then
  echo "Error: target directory does not exist: ${TARGET}"
  exit 1
fi

cp "${TEMPLATE}/INTEGRATION_REQUIREMENTS.md" "${TARGET}/"
mkdir -p "${TARGET}/.cursor/rules/standards"
cp "${TEMPLATE}/.cursor/mcp.json" "${TARGET}/.cursor/"
cp "${TEMPLATE}/.cursor/rules/"*.mdc "${TARGET}/.cursor/rules/"
cp "${TEMPLATE}/.cursor/rules/standards/"*.mdc "${TARGET}/.cursor/rules/standards/" 2>/dev/null || true

echo "Installed consumer template into: ${TARGET}"
echo "  - INTEGRATION_REQUIREMENTS.md"
echo "  - .cursor/mcp.json"
echo "  - .cursor/rules/*.mdc"
