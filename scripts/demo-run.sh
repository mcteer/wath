#!/usr/bin/env bash
# Timed demo segments — local rehearsal run-of-show (no cloud agent unless --launch).
#
# Segments 1–4 target the 10-minute "working tool" front-load:
#   1 tier-1 static creds → 2 verify harness → 3 dry-run lifecycle → 4 fallback PR
#
# Prefers wath-core container (Podman) when http://127.0.0.1:8080/healthz responds.
#
# Usage:
#   ./scripts/demo-run.sh              # segments 1-4 (dry-run lifecycle)
#   ./scripts/demo-run.sh --launch     # segment 5: live cloud agent (needs API key + repo URL)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"
# shellcheck source=scripts/wath-core.sh
source "${REPO_ROOT}/scripts/wath-core.sh"

CONSUMER_PATH="${WATH_DEMO_CONSUMER:-examples/consumer-demo}"
LAUNCH=0
[[ "${1:-}" == "--launch" ]] && LAUNCH=1

SEG_START=$SECONDS
segment() {
  local name="$1"
  local elapsed=$((SECONDS - SEG_START))
  printf "\n== [%02d:%02d] %s ==\n" $((elapsed / 60)) $((elapsed % 60)) "${name}"
  SEG_START=$SECONDS
}

segment_end() {
  local elapsed=$((SECONDS - SEG_START))
  echo "   (${elapsed}s)"
}

TOTAL_START=$SECONDS

segment "1 — tier-1 problem (static creds)"
if curl -sf --max-time 2 http://localhost:8000/db-check >/dev/null 2>&1; then
  curl -s http://localhost:8000/db-check | python3 -m json.tool
else
  echo "orders-api not running on :8000 — showing tier-1 smell in k8s/deployment.yaml:"
  grep -n "DATABASE_URL\|postgres://" examples/consumer-demo/k8s/deployment.yaml || true
  echo "(start with: cd examples/consumer-demo && docker compose up --build -d)"
fi
segment_end

segment "2 — verify harness (golden tier-4 fixture, static gate)"
./scripts/verify-golden-fixture.sh --static-only
segment_end

segment "3 — Wath dry-run lifecycle ($(wath_backend_label))"
BACKEND="$(wath_backend_label)"
wath_lifecycle_json "${CONSUMER_PATH}" 0 0 | BACKEND="${BACKEND}" python3 -c "
import json, os, sys
d = json.load(sys.stdin)
print('backend:', os.environ['BACKEND'])
print('appId:', d.get('appId'))
print('phase:', d.get('phase'))
integrations = (d.get('state') or {}).get('integrations') or {}
if integrations:
    print('standards:', ', '.join(integrations.keys()))
print('prompt lines:', len((d.get('prompt') or '').splitlines()))
"
segment_end

segment "4 — fallback PR walkthrough (pre-baked tier-4 artifacts)"
"${REPO_ROOT}/scripts/demo-fallback-pr.sh"
segment_end

if [ "${LAUNCH}" = "1" ]; then
  segment "5 — live cloud agent launch ($(wath_backend_label))"
  if [ -z "${CURSOR_API_KEY:-}" ]; then
    echo "CURSOR_API_KEY not set — export it or add to deploy/.env before --launch"
    exit 1
  fi
  if [ -z "${WATH_CONSUMER_REPO_URL:-}" ]; then
    echo "WATH_CONSUMER_REPO_URL not set — cloud agent needs a GitHub repo URL to push to"
    exit 1
  fi
  wath_lifecycle_json "${CONSUMER_PATH}" 1 1 | python3 -m json.tool
  segment_end
else
  echo ""
  echo "Segment 5 (live agent) skipped. Re-run with --launch when CURSOR_API_KEY + WATH_CONSUMER_REPO_URL are set."
fi

total=$((SECONDS - TOTAL_START))
printf "\n== demo complete (%02d:%02d total) ==\n" $((total / 60)) $((total % 60))
