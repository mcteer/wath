#!/usr/bin/env bash
# Scaffold a new standard from standards/_template/
#
# Usage: ./scripts/scaffold-standard.sh <business-unit> <standard-id>
# Example: ./scripts/scaffold-standard.sh security my-new-standard
set -euo pipefail

BU="${1:?business unit required (e.g. security)}"
ID="${2:?standard id required (e.g. my-new-standard)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${REPO_ROOT}/standards/${BU}/${ID}"
TEMPLATE="${REPO_ROOT}/standards/_template"

if [ -d "${TARGET}" ]; then
  echo "Error: ${TARGET} already exists"
  exit 1
fi

cp -r "${TEMPLATE}" "${TARGET}"

# Replace placeholders in standard.yaml
RULE_PREFIX="$(echo "${ID}" | tr '[:lower:]-' '[:upper:]_' | cut -c1-3)"
sed -i.bak \
  -e "s/{{STANDARD_ID}}/${ID}/g" \
  -e "s/{{RULE_PREFIX}}/${RULE_PREFIX}/g" \
  -e "s/{{OWNER}}/${BU}/g" \
  "${TARGET}/standard.yaml"
rm -f "${TARGET}/standard.yaml.bak"

echo "Scaffolded standard at: ${TARGET}"
echo ""
echo "Next steps:"
echo "  1. Edit ${TARGET}/SKILL.md with SME rules"
echo "  2. Edit ${TARGET}/schema/integration.params.schema.json"
echo "  3. Implement ${TARGET}/conformance/test_conformance.py (1:1 rule→test naming)"
echo "  4. Register in standards/registry.yaml"
echo "  5. Add glob-scoped rule to templates/consumer/.cursor/rules/standards/ if needed"
