# Cursor Automations for Wath

Use Cursor Automations to trigger onboarding and poll PR merge status without a hosted Wath service.

## Prerequisites

- **wath-core** running (Podman or hosted): `curl http://127.0.0.1:8080/healthz`
- Consumer repo has `wath.json`
- `CURSOR_API_KEY` and `gh` authenticated for merge polling

## MCP configuration (remote host)

Consumer repos point at the **wath-core HTTP endpoint** — the same pattern as any remote MCP service (Notion, Linear, etc.). No local Wath clone or filesystem paths on the developer machine.

In your app repo `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wath": {
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

During onboarding materialization (`wath onboard --materialize`), the engine writes this file from `WATH_MCP_URL` in the Wath deploy environment.

In Cursor Desktop, ask the agent: **"Run wath.onboard for this repository."**

Set `WATH_MCP_URL` when launching cloud agents from the engine so remote agents reach the same host.

## Automation: onboard on wath.json push

**Trigger:** Git push to default branch when `wath.json` changes.

**Action:** MCP → Wath server → tool `wath.onboard` with `consumerPath` set to the repo root and `launch: true`.

**Prompt hint for the automation agent:**

> When `wath.json` changes on the default branch, call Wath MCP `wath.onboard` with this repo path. If the result phase is `await_merge`, stop and wait for the developer to merge the PR before re-running.

## Automation: poll open PRs (merge detection)

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

## Automation: compliance drift scan

**Trigger:** Scheduled daily, or on push to `standards/registry.yaml` in the Wath repo.

**Action:** Run `wath audit --json`. For each app with `compliance: drift`, invoke `wath.onboard` with `phase: integrate` to open update PRs.
