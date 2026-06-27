#!/usr/bin/env bash
# Walk through the golden tier-4 fixture as a pre-baked onboarding PR (latency hedge).
#
# Use on stage when the live cloud agent run is slow — same artifacts the agent must produce.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="${REPO_ROOT}/standards/security/vault-dynamic-secrets/fixtures/tier4-orders-api"

echo "fixture: ${FIXTURE}"
echo ""
echo "PR artifact tree:"
find "${FIXTURE}" -type f \
  ! -path '*/.wath/*' \
  ! -path '*/.git/*' \
  | sed "s|${FIXTURE}/||" \
  | sort

echo ""
echo "verify evidence:"
if [ -f "${FIXTURE}/.wath/verify-summary.json" ]; then
  python3 -m json.tool "${FIXTURE}/.wath/verify-summary.json"
else
  echo "(no verify-summary.json — run ./scripts/verify-golden-fixture.sh first)"
fi

echo ""
echo "policy excerpt:"
head -5 "${FIXTURE}/vault/policy.hcl"

echo ""
echo "PR template (first 15 lines):"
head -15 "${FIXTURE}/.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md"
