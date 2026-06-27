# Cursor Automations for Wath

Use Cursor Automations to trigger onboarding and poll PR merge status without a hosted Wath service.

## Prerequisites

- Wath MCP server built: `npm run build --workspace=@wath/mcp-server`
- Consumer repo has `wath.json` and Wath MCP configured in `.cursor/mcp.json`
- `CURSOR_API_KEY` and `gh` authenticated for merge polling

## Local MCP (development)

In your app repo `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wath": {
      "command": "node",
      "args": ["/absolute/path/to/wath/packages/mcp-server/dist/index.js"],
      "env": {
        "WATH_ROOT": "/absolute/path/to/wath"
      }
    }
  }
}
```

In Cursor Desktop, ask the agent: **"Run wath.onboard for this repository."**

## HTTP MCP (wath-core container)

When **wath-core** is running via Podman (`http://localhost:8080`), point Cursor at the Streamable HTTP endpoint instead of stdio:

```json
{
  "mcpServers": {
    "wath": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

If `WATH_TOKEN` is set on the container, add `"headers": { "Authorization": "Bearer YOUR_TOKEN" }` to the MCP config.

Set `WATH_MCP_URL=http://localhost:8080/mcp` when launching cloud agents from the engine so remote agents can reach your local orchestrator (requires network reachability from the cloud agent VM).

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
