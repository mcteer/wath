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

## Quick start

```bash
# Install dependencies
npm install

# Build engine + MCP server
npm run build

# List registered standards
node packages/engine/dist/cli/index.js list

# Dry-run lifecycle (no agent) — shows phase, state, and prompt
node packages/engine/dist/cli/index.js lifecycle ./examples/consumer-demo

# Inspect lifecycle state for an app
node packages/engine/dist/cli/index.js status ./examples/consumer-demo

# Compliance audit vs standards registry
node packages/engine/dist/cli/index.js audit

# Launch cloud agent (requires CURSOR_API_KEY + repo URL)
# export CURSOR_API_KEY=...
# export WATH_CONSUMER_REPO_URL=https://github.com/org/app-repo
# node packages/engine/dist/cli/index.js lifecycle ./examples/consumer-demo --launch --materialize

# Verify the golden tier-4 fixture (hand-written reference integration)
./scripts/verify-golden-fixture.sh --static-only
```

### App repo setup

```bash
cp templates/consumer/wath.json.example wath.json
# edit repo, stack, services
# optional: ./scripts/install-consumer-template.sh /path/to/app-repo
```

### Cursor Desktop (MCP)

Build the MCP server (`npm run build`), configure [templates/consumer/.cursor/mcp.json](templates/consumer/.cursor/mcp.json) with your `WATH_ROOT`, then invoke **`wath.onboard`** from Cursor chat. See [Cursor Automation guide](./docs/onboarding/cursor-automation.md).

## CLI reference

| Command | Purpose |
|---------|---------|
| `wath list` / `wath show <id>` | Standards registry |
| `wath lifecycle <path>` | Multi-phase onboarding (preferred) |
| `wath onboard <path>` | Legacy single-shot onboarding |
| `wath status <path\|url\|org/repo>` | Lifecycle state |
| `wath record-merge --app org/repo --type …` | Mark a PR merged; advance phase |
| `wath audit [--apply]` | Drift / compliance report |
| `wath verify <standard-id> <path>` | Run conformance gate |

## Project layout

```
standards/              SME standards registry (marketplace catalog)
packages/engine/        SDK orchestrator — lifecycle, verification, CLI
packages/mcp-server/    Cursor Desktop MCP (wath.onboard, wath.status, …)
templates/consumer/     wath.json.example, schema, .cursor templates
examples/               Runnable demos — see examples/consumer-demo/README.md
state/applications/     Git-native onboarding ledger (per managed app)
docs/onboarding/        Lifecycle and Cursor Automation docs
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — standards, engine changes, **README sync policy**
- [Onboarding lifecycle](./docs/onboarding/lifecycle.md) — phases, state schema, operator commands
- [Cursor Automation](./docs/onboarding/cursor-automation.md) — MCP setup, merge polling
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
