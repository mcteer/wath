#!/usr/bin/env bash
# Pre-warm demo environment — run before rehearsal or live demo.
#
# Builds the engine, installs Python deps, verifies the golden fixture, and
# optionally warms Docker layer cache for the tier-1 consumer demo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

echo "== demo prewarm =="

echo "-- npm install + build"
npm install
npm run build --workspace=@wath/engine

echo "-- python conformance deps"
python3 -m pip install -q -r standards/security/vault-dynamic-secrets/conformance/requirements.txt

echo "-- golden fixture static gate"
./scripts/verify-golden-fixture.sh --static-only

if command -v docker >/dev/null 2>&1; then
  echo "-- docker: postgres image + consumer-demo build cache"
  docker compose -f examples/consumer-demo/docker-compose.yml pull postgres 2>/dev/null || true
  docker compose -f examples/consumer-demo/docker-compose.yml build postgres 2>/dev/null || true
else
  echo "-- docker: not installed (skip tier-1 live curl)"
fi

if command -v vault >/dev/null 2>&1; then
  echo "-- vault CLI: $(vault version | head -1)"
else
  echo "-- vault CLI: not installed (toolchain step will skip in full verify)"
fi

if command -v kubeconform >/dev/null 2>&1; then
  echo "-- kubeconform: installed"
else
  echo "-- kubeconform: not installed (toolchain step will skip in full verify)"
fi

if [ -n "${CURSOR_API_KEY:-}" ]; then
  echo "-- CURSOR_API_KEY: set"
else
  echo "-- CURSOR_API_KEY: not set (live agent launch will fail — use dry-run or fallback PR)"
fi

if [ -n "${WATH_CONSUMER_REPO_URL:-}" ]; then
  echo "-- WATH_CONSUMER_REPO_URL: ${WATH_CONSUMER_REPO_URL}"
else
  echo "-- WATH_CONSUMER_REPO_URL: not set"
fi

echo "== prewarm done =="
