#!/usr/bin/env bash
# Run Wath onboarding across multiple consumer repos (platform-push fleet).
#
# Usage:
#   ./scripts/onboard-fleet.sh [--launch] [--materialize] <consumer-path>...
#
# Examples:
#   ./scripts/onboard-fleet.sh examples/consumer-demo
#   ./scripts/onboard-fleet.sh --launch --materialize examples/consumer-demo examples/consumer-demo-payments
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="${REPO_ROOT}/packages/engine/dist/cli/index.js"
WATH_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --launch|--materialize|--local|--dry-run|--force-materialize)
      WATH_ARGS+=("$1")
      shift
      ;;
    --standard-id|--repo-url|--requirements-path)
      WATH_ARGS+=("$1" "${2:?missing value for $1}")
      shift 2
      ;;
    -*)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 [--launch] [--materialize] <consumer-path>..." >&2
  exit 1
fi

if [[ ! -f "${ENGINE}" ]]; then
  echo "Engine not built. Run: npm run build --workspace=@wath/engine" >&2
  exit 1
fi

for CONSUMER in "$@"; do
  echo "== onboarding: ${CONSUMER} =="
  node "${ENGINE}" onboard "${CONSUMER}" "${WATH_ARGS[@]}"
  echo ""
done
