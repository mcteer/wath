#!/usr/bin/env bash
# Shared helpers — wath-core HTTP API with CLI fallback.
#
# When wath-core is running (Podman), demo scripts prefer the container REST API.
# Set WATH_CORE_URL to override (default http://127.0.0.1:8080).
# Set WATH_USE_CLI=1 to force local CLI even when the container is up.
set -euo pipefail

WATH_CORE_URL="${WATH_CORE_URL:-http://127.0.0.1:8080}"
WATH_TOKEN="${WATH_TOKEN:-}"

_wath_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

wath_core_available() {
  [ "${WATH_USE_CLI:-0}" = "1" ] && return 1
  curl -sf --max-time 3 "${WATH_CORE_URL}/healthz" >/dev/null 2>&1
}

_wath_curl_auth_args() {
  if [ -n "${WATH_TOKEN}" ]; then
    echo -H "Authorization: Bearer ${WATH_TOKEN}"
  fi
}

# POST /api/v1/lifecycle — prints JSON lifecycle result to stdout.
wath_lifecycle_json() {
  local consumer_path="$1"
  local launch="${2:-0}"
  local materialize="${3:-0}"

  if wath_core_available; then
    local body
    body="$(CONSUMER_PATH="${consumer_path}" LAUNCH="${launch}" MATERIALIZE="${materialize}" python3 - <<'PY'
import json, os
print(json.dumps({
  "consumerPath": os.environ["CONSUMER_PATH"],
  "launch": os.environ.get("LAUNCH") == "1",
  "materialize": os.environ.get("MATERIALIZE") == "1",
  **({"repoUrl": os.environ["WATH_CONSUMER_REPO_URL"]} if os.environ.get("WATH_CONSUMER_REPO_URL") else {}),
}))
PY
)"
    # shellcheck disable=SC2046
    curl -sS -X POST "${WATH_CORE_URL}/api/v1/lifecycle" \
      -H 'content-type: application/json' \
      $(_wath_curl_auth_args) \
      -d "${body}"
    return
  fi

  local repo_root engine args
  repo_root="$(_wath_repo_root)"
  engine="${repo_root}/packages/engine/dist/cli/index.js"
  args=(lifecycle "${consumer_path}")
  [ "${launch}" = "1" ] && args+=(--launch)
  [ "${materialize}" = "1" ] && args+=(--materialize)
  if [ -n "${WATH_CONSUMER_REPO_URL:-}" ]; then
    args+=(--repo-url "${WATH_CONSUMER_REPO_URL}")
  fi
  node "${engine}" "${args[@]}"
}

# GET /api/v1/status — prints JSON status to stdout.
wath_status_json() {
  local target="$1"

  if wath_core_available; then
    local query
    query="$(TARGET="${target}" python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.urlencode({"target": os.environ["TARGET"]}))
PY
)"
    # shellcheck disable=SC2046
    curl -sS "${WATH_CORE_URL}/api/v1/status?${query}" $(_wath_curl_auth_args)
    return
  fi

  local repo_root engine
  repo_root="$(_wath_repo_root)"
  engine="${repo_root}/packages/engine/dist/cli/index.js"
  node "${engine}" status "${target}"
}

wath_backend_label() {
  if wath_core_available; then
    echo "wath-core (${WATH_CORE_URL})"
  else
    echo "local CLI"
  fi
}
