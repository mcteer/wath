# Wath

**Onboarding & conformance engine** for platform service integrations.

A developer commits **`wath.json`** in their app repo (from [`wath.json.example`](templates/consumer/wath.json.example)); Wath runs a **multi-phase lifecycle** — enrich the manifest, generate compliant integrations per platform service, verify them deterministically, and open **pull requests** for humans to review and merge.

Re-submit the same manifest whenever the stack or services change — first onboarding or remediation months later.

The reference implementation onboards applications to **HashiCorp Vault dynamic database secrets** (tier-4). The architecture is designed to grow into an open **service integration marketplace** — each new platform service is a pluggable standard in `standards/`.

> **The name.** A *wath* (Old Norse *vað*) is a ford — the safe, known place to cross a river.

## How it works

```text
wath.json.example → wath.json → wath lifecycle / MCP wath.onboard
  → enrich manifest PR (if needed) → integrate → validate → integration PR
  → human merge → state recorded in Wath repo → ongoing compliance audit
```

| Phase | What happens |
|-------|----------------|
| **Manifest** | Repo analysis; PR updates `wath.json` only if incomplete |
| **Integrate** | Agent generates params + artifacts for one standard |
| **Validate** | Conformance gates run; integration PR opened on pass |
| **Record** | Merge tracked in `state/applications/<org>/<repo>.yaml` |

Full details: [Onboarding lifecycle](./docs/onboarding/lifecycle.md).

## Developer onboarding

Steps for an application team adopting Wath. Wath **opens PRs**; your team **reviews and merges** them.

### 1. Add `wath.json` to your app repo

```bash
cp /path/to/wath/templates/consumer/wath.json.example wath.json
# or from the Wath repo:
./scripts/install-consumer-template.sh /path/to/your-app-repo
```

Edit the manifest:

| Field | Set to |
|-------|--------|
| `repo` | Your app's GitHub URL (where Wath opens PRs) |
| `stack.runtime` | `kubernetes`, `nomad`, or `vm` |
| `stack.applications` | App name → plain-language purpose |
| `services` | Platform integrations — e.g. `"services": ["vault-dynamic-secrets"]` or a per-service config block |

Minimal example:

```json
{
  "version": 1,
  "repo": "https://github.com/org/my-app",
  "stack": {
    "runtime": "kubernetes",
    "applications": {
      "orders-api": "CRUD API for orders — reads/writes Postgres"
    }
  },
  "services": {
    "vault-dynamic-secrets": {
      "datastore": "postgres",
      "access": "read+write to orders schema"
    }
  },
  "feedback": {}
}
```

Commit and push `wath.json`.

See [Consumer templates](./templates/consumer/README.md) and [`wath.schema.json`](templates/consumer/schema/wath.schema.json) for the full schema.

### 2. Connect Wath in Cursor

Install the consumer template (copies `.cursor/mcp.json` — Wath + auth only):

```bash
/path/to/wath/scripts/install-consumer-template.sh .
```

`.cursor/mcp.json` is **developer-owned** — copy from the template once, then never modified by Wath:

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

`wath.onboard` does **not** write or change this file. Repo identity comes from `wath.json` when the agent calls Wath.

Use `127.0.0.1` (not `localhost`) for local Podman. The bearer token must match `WATH_TOKEN` in `deploy/.env`.

Reload MCP in Cursor. See [Cursor Automation](./docs/onboarding/cursor-automation.md).

### 3. Start onboarding

In Cursor chat:

> **Run wath.onboard**

The agent reads **`wath.json` → `repo`** and calls Wath. No paths, no duplicate URLs. Wath chains **integrate → validate** and opens an integration PR on success.

Or via REST:

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/lifecycle \
  -H 'Authorization: Bearer dev-local-token' \
  -H 'Content-Type: application/json' \
  -d '{"repo":"https://github.com/org/my-app","launch":false}'

# Wath operators: dry-run against bundled demo (local path under WATH_ROOT)
curl -s -X POST http://127.0.0.1:8080/api/v1/lifecycle \
  -H 'Authorization: Bearer dev-local-token' \
  -H 'Content-Type: application/json' \
  -d '{"consumerPath":"examples/consumer-demo","launch":false}'

# Live launch (needs CURSOR_API_KEY in deploy/.env)
./scripts/demo-live-launch.sh /path/to/your-app
```

With `launch: true`, Wath runs cloud agents against your GitHub repo and opens PRs there.

### 4. Review and merge PRs

| PR type | Your action |
|---------|-------------|
| **Manifest** | Wath enriched `wath.json` — review, merge, re-run `wath.onboard` |
| **Integration** | Wath added Vault/K8s artifacts + verify evidence — review, merge |

After each merge, record it so Wath advances the lifecycle:

```bash
wath record-merge --app org/repo --type manifest --pr https://github.com/org/repo/pull/123
wath record-merge --app org/repo --type integration --standard vault-dynamic-secrets --pr https://github.com/org/repo/pull/124
```

When **wath-core** is running with `GITHUB_TOKEN` set, a background merge poller records merges automatically (every 30s). With `CURSOR_API_KEY` set, a drift poller audits for standard version drift (every 1 min) and launches remediation onboard runs. You can also poll on demand:

```bash
wath poll-merges
wath poll-drift          # audit + launch remediation for drifted apps
wath poll-drift --dry-run  # audit only, no agent launch
# or: curl -X POST http://127.0.0.1:8080/api/v1/poll-merges -H "Authorization: Bearer $WATH_TOKEN"
# or: curl -X POST http://127.0.0.1:8080/api/v1/poll-drift -H "Authorization: Bearer $WATH_TOKEN"
# or: ./scripts/poll-merge-prs.sh  (legacy gh-based cron)
```

### 5. Check status and re-onboard

```bash
wath status https://github.com/org/my-app
# or: curl "http://localhost:8080/api/v1/status?target=org/repo"
```

In Cursor: MCP tool **`wath.status`**. When all integrations are merged, phase is **`compliant`**.

Update `wath.json` and run **`wath.onboard`** again when the stack changes, services are added, or `wath audit` reports drift.

### Developer vs Wath

| Developer | Wath |
|-----------|------|
| Writes and commits `wath.json` | Tracks phase in `state/applications/<org>/<repo>.yaml` |
| Reviews and **merges PRs** | Opens PRs — **never merges** |
| Configures Cursor MCP | Runs integrate → validate agents |
| Records merges (or automation) | Advances lifecycle phase |

## Quick start (Wath operators)

```bash
npm install
npm run build

# Standards registry
node packages/engine/dist/cli/index.js list

# Dry-run lifecycle against the demo app
node packages/engine/dist/cli/index.js lifecycle ./examples/consumer-demo

# Inspect state / audit
node packages/engine/dist/cli/index.js status ./examples/consumer-demo
node packages/engine/dist/cli/index.js audit

# Golden tier-4 reference integration
./scripts/verify-golden-fixture.sh --static-only

# Demo rehearsal (prefers wath-core on Podman when up)
npm run demo:prewarm
npm run demo:run
```

### Deploy with Podman (wath-core)

Run the orchestrator as a local HTTP service — REST at `/api/v1/*`, MCP at `/mcp`:

```bash
cp deploy/.env.example deploy/.env   # set CURSOR_API_KEY and GITHUB_TOKEN
podman compose -f deploy/podman-compose.yml up --build -d
curl http://127.0.0.1:8080/healthz
```

`deploy/podman-compose.yml` bind-mounts `standards/`, `templates/`, and `examples/` from the repo — registry and standard edits apply without rebuilding the image.

Full runbook: [Deploy with Podman](./docs/onboarding/deploy-podman.md). Demo scripts: [Demo rehearsal](./docs/demo/README.md).

## CLI reference

| Command | Purpose |
|---------|---------|
| `wath list` / `wath show <id>` | Standards registry |
| `wath lifecycle <path>` | Multi-phase onboarding (preferred) |
| `wath onboard <path>` | Legacy single-shot onboarding |
| `wath status <path\|url\|org/repo>` | Lifecycle state |
| `wath record-merge --app org/repo --type …` | Mark a PR merged; advance phase |
| `wath poll-merges` | Poll GitHub for merged PRs and update state |
| `wath poll-drift [--dry-run]` | Audit for drift and launch remediation onboard |
| `wath audit [--apply]` | Drift / compliance report |
| `wath verify <standard-id> <path>` | Run conformance gate |

## Project layout

```
standards/              SME standards registry (marketplace catalog)
packages/engine/        SDK orchestrator — lifecycle, verification, CLI
packages/mcp-server/    Cursor Desktop MCP + wath-core HTTP container
templates/consumer/     wath.json.example, schema, .cursor templates
examples/               Runnable demos — see examples/consumer-demo/README.md
state/applications/     Git-native onboarding ledger (per managed app)
docs/onboarding/        Lifecycle, Cursor Automation, Podman deploy
deploy/                 podman-compose.yml, .env.example
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — standards, engine changes, **README sync policy**
- [Onboarding lifecycle](./docs/onboarding/lifecycle.md) — phases, state schema, operator commands
- [Cursor Automation](./docs/onboarding/cursor-automation.md) — MCP setup, merge polling
- [Deploy with Podman](./docs/onboarding/deploy-podman.md) — wath-core container on local Podman
- [Consumer templates](./templates/consumer/README.md) — `wath.json.example`, PR template, CI workflow
- [Extension seams](./docs/extensions/README.md) — add standard, change runtime, fleet
- [Demo rehearsal](./docs/demo/README.md) — run-of-show, checklist, latency hedge

## Core invariants

- **Standards are the source of truth** — steer → bound → verify (Skill + schema + conformance)
- **Typed params first** — emit `integration.params.json` before any HCL
- **Propose, never merge** — the agent opens PRs; humans ratify
- **No real secrets** — verify only against ephemeral resources
- **Failing gates are hard stops** — never weaken checks to make them pass

## License

Licensed under the [Apache License, Version 2.0](./LICENSE). See also [NOTICE](./NOTICE).
