# Cursor Automations for Wath

Use Cursor Automations to trigger onboarding and poll PR merge status without a hosted Wath service.

## Prerequisites

- **wath-core** running (Podman or hosted): `curl http://127.0.0.1:8080/healthz`
- Consumer repo has `wath.json`
- `CURSOR_API_KEY` and `gh` authenticated for merge polling

## MCP configuration (remote host)

Consumer repos point at the **wath-core HTTP endpoint**. Application identity lives in **`wath.json` → `repo`** — the agent passes it on tool calls, not in `mcp.json`.

`.cursor/mcp.json` is **developer-owned** — configure once, never modified by `wath.onboard`:

```json
{
  "mcpServers": {
    "Wath": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:8080/mcp",
      "headers": {
        "Authorization": "Bearer dev-local-token"
      }
    }
  }
}
```

**Cursor requires the `Authorization` header** on HTTP MCP URLs. Without it, Cursor incorrectly initiates an OAuth flow against localhost and the connection fails with `net::ERR_FAILED` ([known Cursor bug](https://forum.cursor.com/t/remote-mcp-server-on-localhost-fails/157307)). The token must match `WATH_TOKEN` on wath-core (`deploy/.env`).

| Environment | URL |
|-------------|-----|
| Local dev (wath-core in Podman) | `http://127.0.0.1:8080/mcp` |
| Shared / staging | `https://wath.staging.example.com/mcp` |
| Production | `https://wath.example.com/mcp` |

Use **`127.0.0.1`**, not `localhost`, for local dev (avoids IPv6 resolution issues).

For non-dev environments, replace `dev-local-token` with your issued bearer token.

In Cursor Desktop, ask the agent: **"Run wath.onboard"** — the agent reads `wath.json` and passes `repo`. Wath never modifies `.cursor/mcp.json`.

Set `WATH_MCP_URL` when launching cloud agents from the engine so remote agents reach the same host.

## Automation: onboard on wath.json push

**Trigger:** Git push to default branch when `wath.json` changes.

**Action:** MCP → Wath server → tool `wath.onboard` with `{ "repo": "<wath.json repo field>", "launch": true }`.

**Prompt hint for the automation agent:**

> When `wath.json` changes on the default branch, call Wath MCP `wath.onboard` with this repo path. If the result phase is `await_merge`, stop and wait for the developer to merge the PR before re-running.

## Merge detection (automatic in wath-core)

When **wath-core** is deployed with `GITHUB_TOKEN` in `deploy/.env`, a background poller checks `state/applications/*/*.yaml` every 30s and records merges automatically. No separate Cursor Automation or cron is required for merge detection.

## Drift remediation (automatic in wath-core)

When **wath-core** has `CURSOR_API_KEY` set, a drift poller runs every 1 minute: `wath audit --apply` plus async `wath.onboard` for apps behind the current standard version. Skips apps awaiting merge or already onboarding.

## Automation: poll open PRs (optional external fallback)

**Trigger:** Scheduled (e.g. hourly) in the **Wath** repo.

**Action:** For each file under `state/applications/*/*.yaml` where `phase` is `await_merge`:

1. Read `manifest.pr_url` or each `integrations.*.pr_url` with status `pr_open`.
2. Run `gh pr view <url> --json state,mergedAt`.
3. If merged, call Wath MCP **`wath.record_merge`** (or CLI `wath record-merge`) with the PR URL and type.

**Example shell loop (run from Wath repo root):**

```bash
#!/usr/bin/env bash
set -euo pipefail
for f in state/applications/*/*.yaml; do
  phase=$(grep '^phase:' "$f" | awk '{print $2}')
  [ "$phase" = "await_merge" ] || continue
  # Parse pr_url fields and gh pr view; on MERGED:
  # wath record-merge --app org/repo --type integration --standard ID --pr URL
done
```

Prefer wiring this loop into a Cursor Automation with the `gh` and Wath MCP tools enabled.

## Automation: compliance drift scan (optional external fallback)

**Trigger:** Scheduled daily, or on push to `standards/registry.yaml` in the Wath repo.

**Action:** Prefer the built-in drift poller in wath-core (`WATH_DRIFT_POLL_ENABLED=1`). For external automation: run `wath poll-drift` or `wath audit --apply` then `wath.onboard` with `launch: true` for drifted apps.
