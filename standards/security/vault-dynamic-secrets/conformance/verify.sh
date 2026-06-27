#!/usr/bin/env bash
# Conformance gate for the vault-dynamic-secrets standard.
#
# One entry point, two callers:
#   - Tier-1: Wath's sandbox runs this against the agent's freshly generated PR.
#   - Tier-2: the shipped CI workflow (VDS-008) runs this in the team's real environment.
#
# It combines the rule assertions (test_conformance.py, VDS-001..008) with the native
# toolchain validators. All checks are deterministic; none consult the model.
#
# Usage:  WATH_ARTIFACT_ROOT=/path/to/pr/worktree ./verify.sh
set -euo pipefail

ROOT="${WATH_ARTIFACT_ROOT:-$(pwd)}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "== Wath conformance :: vault-dynamic-secrets =="
echo "artifact root: ${ROOT}"

# 1. Rule assertions (the standard, compiled to checks)
echo "-- VDS-001..008 rule assertions"
WATH_ARTIFACT_ROOT="${ROOT}" pytest -q "${HERE}/test_conformance.py"

# 2. Native toolchain validators (catch what the parser doesn't)
echo "-- vault policy fmt (syntax + canonical form)"
vault policy fmt "${ROOT}/vault/policy.hcl" >/dev/null

if [ -d "${ROOT}/k8s" ]; then
  echo "-- kubeconform (manifest schema validity, incl. VSO CRDs)"
  kubeconform -strict -summary \
    -schema-location default \
    -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
    "${ROOT}/k8s/"
fi

# 3. Behavioral gate (Tier-1 only): prove the flow actually issues an expiring credential.
#    Skipped where no ephemeral Vault+DB is available (e.g. a docs-only PR).
if [ "${WATH_BEHAVIORAL:-0}" = "1" ]; then
  echo "-- behavioral: signed-identity -> role -> policy -> dynamic secret"
  "${HERE}/behavioral_verify.sh"   # stands up ephemeral Vault + throwaway Postgres, asserts a live, expiring cred
fi

echo "== PASS =="
