# Deploy Wath core with Podman

Run the Wath orchestrator as a single container: HTTP REST API + MCP endpoint, engine, standards catalog, and a persistent state volume.

## Prerequisites

- Podman (or Docker) on your machine
- `GITHUB_TOKEN` — required for GitHub API access (wath.json fetch, PR discovery, merge poll)
- Optional: `CURSOR_API_KEY` for `--launch` / agent-backed lifecycle runs

## Quick start (Podman Compose)

```bash
cd /path/to/wath
cp deploy/.env.example deploy/.env
# Edit deploy/.env — set GITHUB_TOKEN, CURSOR_API_KEY, and optional WATH_TOKEN

podman compose -f deploy/podman-compose.yml up --build -d
curl http://localhost:8080/health
```

## Quick start (plain Podman)

```bash
podman build -t wath-core:local .

podman run -d \
  --name wath-core \
  -p 8080:8080 \
  -e CURSOR_API_KEY="${CURSOR_API_KEY}" \
  -e WATH_TOKEN="${WATH_TOKEN:-}" \
  -v "$(pwd)/state/applications:/app/state/applications:Z" \
  -v "$(pwd)/standards:/app/standards:Z" \
  -v "$(pwd)/templates:/app/templates:Z" \
  -v "$(pwd)/examples:/app/examples:Z" \
  wath-core:local

curl http://localhost:8080/health
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | JSON health + `wathRoot` |
| GET | `/healthz` | Plain OK (container healthcheck) |
| POST | `/api/v1/lifecycle` | Body: `{ "repo": "https://github.com/org/app", "launch": true }` — blocking JSON response |
| POST | `/api/v1/lifecycle/stream` | Same body; **SSE** stream (`started` → `progress` → `done` / `error`). Use `curl -N`. |
| GET | `/api/v1/status?target=examples/consumer-demo` | Lifecycle state |
| POST | `/api/v1/record-merge` | Body: `{ "appId": "org/repo", "type": "manifest" }` |
| POST | `/api/v1/poll-merges` | Poll GitHub for merged PRs and update state |
| GET | `/api/v1/audit?apply=false` | Compliance report |
| POST | `/mcp` | MCP Streamable HTTP (Cursor / HTTP MCP clients) |

If `WATH_TOKEN` is set, pass `Authorization: Bearer <token>` on all API and MCP requests.

### Automatic merge detection

wath-core runs a background poller every 30s when `GITHUB_TOKEN` (or `GH_TOKEN`) is set. For each application in `await_merge`, it checks open PR URLs via the GitHub API and calls `record-merge` when a PR is merged. Set `WATH_MERGE_POLL_ENABLED=0` to disable.

`GITHUB_TOKEN` is **required** for all GitHub API access from wath-core (wath.json fetch, branch/PR discovery, merge polling). Unauthenticated requests are capped at ~60/hour per IP — insufficient for fleet-wide onboarding or policy-driven bulk reruns.

### Example: dry-run lifecycle

```bash
curl -s -X POST http://localhost:8080/api/v1/lifecycle \
  -H 'content-type: application/json' \
  -d '{"consumerPath":"examples/consumer-demo"}' | head
```

Note: the default image includes baked-in copies of `standards/`, `templates/`, and `examples/`. **`deploy/podman-compose.yml` bind-mounts all three from the host** so registry bumps, standard edits, and template changes apply immediately — no image rebuild or container restart. The engine reads `standards/registry.yaml` from disk on every request (no in-process cache).

Mount additional app repos at runtime if needed.

## Cursor / MCP clients

Point HTTP MCP at:

```text
http://127.0.0.1:8080/mcp
```

Set `WATH_MCP_URL=http://127.0.0.1:8080/mcp` when launching cloud agents from the engine.

## State persistence

Onboarding ledger files live in `state/applications/` on the host (bind-mounted). Commit them from the Wath repo or back up the volume separately.

## Logs

```bash
podman logs -f wath-core
```

## Stop

```bash
podman compose -f deploy/podman-compose.yml down
# or: podman stop wath-core && podman rm wath-core
```
