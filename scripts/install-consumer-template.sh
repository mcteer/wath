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

cp "${TEMPLATE}/wath.json.example" "${TARGET}/"
WATH_JSON_SEEDED=0
if [ ! -f "${TARGET}/wath.json" ]; then
  cp "${TEMPLATE}/wath.json.example" "${TARGET}/wath.json"
  WATH_JSON_SEEDED=1
fi
mkdir -p "${TARGET}/schema"
cp "${TEMPLATE}/schema/wath.schema.json" "${TARGET}/schema/"
mkdir -p "${TARGET}/.cursor/rules/standards"
mkdir -p "${TARGET}/.github/PULL_REQUEST_TEMPLATE"
mkdir -p "${TARGET}/.cursor"
cp "${TEMPLATE}/.cursor/mcp.json" "${TARGET}/.cursor/"
cp "${TEMPLATE}/.cursor/rules/"*.mdc "${TARGET}/.cursor/rules/"
cp "${TEMPLATE}/.cursor/rules/standards/"*.mdc "${TARGET}/.cursor/rules/standards/" 2>/dev/null || true
cp "${TEMPLATE}/.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md" \
  "${TARGET}/.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md"

if [ -f "${TARGET}/wath.json" ]; then
  node "${REPO_ROOT}/scripts/sync-consumer-mcp.js" "${TARGET}" || true
fi

echo "Installed consumer template into: ${TARGET}"
echo "  - wath.json.example"
if [ "${WATH_JSON_SEEDED}" = "1" ]; then
  echo "  - wath.json (seeded from wath.json.example — edit before onboarding)"
else
  echo "  - wath.json (already present — left unchanged)"
fi
echo "  - schema/wath.schema.json"
echo "  - .cursor/mcp.json"
echo "  - .cursor/rules/*.mdc"
echo "  - .github/PULL_REQUEST_TEMPLATE/wath-onboarding.md"
