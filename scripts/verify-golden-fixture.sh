#!/usr/bin/env bash
# Run the vault-dynamic-secrets conformance gate against the golden tier-4 fixture.
#
# Usage:
#   ./scripts/verify-golden-fixture.sh              # static + toolchain
#   ./scripts/verify-golden-fixture.sh --behavioral # + JWT stand-in behavioral gate
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="${REPO_ROOT}/standards/security/vault-dynamic-secrets/fixtures/tier4-orders-api"
VERIFY="${REPO_ROOT}/standards/security/vault-dynamic-secrets/conformance/verify.sh"

export WATH_ARTIFACT_ROOT="${FIXTURE}"
export WATH_BEHAVIORAL=0
export WATH_MANAGE_SANDBOX=0
export SKIP_TOOLCHAIN=0

if [ "${1:-}" = "--behavioral" ]; then
  export WATH_BEHAVIORAL=1
  export WATH_MANAGE_SANDBOX=1
fi

if [ "${1:-}" = "--static-only" ]; then
  export SKIP_TOOLCHAIN=1
fi

echo "Golden fixture: ${FIXTURE}"
exec bash "${VERIFY}"
