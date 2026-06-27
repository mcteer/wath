#!/usr/bin/env bash
# Live cloud-agent rehearsal — lifecycle launch via wath-core (or CLI fallback).
#
# Requires CURSOR_API_KEY and WATH_CONSUMER_REPO_URL (GitHub repo the agent can push to).
# Loads deploy/.env when present.
#
# Usage:
#   ./scripts/demo-live-launch.sh
#   ./scripts/demo-live-launch.sh examples/consumer-demo
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"
# shellcheck source=scripts/wath-core.sh
source "${REPO_ROOT}/scripts/wath-core.sh"

CONSUMER_PATH="${1:-${WATH_DEMO_CONSUMER:-examples/consumer-demo}}"

if [ -f deploy/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source deploy/.env
  set +a
fi

if [ -z "${CURSOR_API_KEY:-}" ]; then
  echo "CURSOR_API_KEY is not set. Add it to deploy/.env or export it." >&2
  exit 1
fi

if [ -z "${WATH_CONSUMER_REPO_URL:-}" ]; then
  echo "WATH_CONSUMER_REPO_URL is not set (GitHub repo URL for cloud agent)." >&2
  exit 1
fi

echo "== live lifecycle launch =="
echo "backend: $(wath_backend_label)"
echo "consumer: ${CONSUMER_PATH}"
echo "repo: ${WATH_CONSUMER_REPO_URL}"
echo ""

wath_lifecycle_json "${CONSUMER_PATH}" 1 1 | python3 -m json.tool

echo ""
echo "After the agent opens a PR, poll merges with:"
echo "  ./scripts/poll-merge-prs.sh"
echo "Or record manually:"
echo "  wath record-merge --app org/repo --type integration --standard vault-dynamic-secrets --pr <url>"
