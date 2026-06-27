# Consumer repository templates

Files in this directory are **installed into application repos** when a team adopts Wath or when the engine materializes config during onboarding (`wath onboard --materialize`).

## Layout

| Path | Purpose |
|------|---------|
| `wath.json.example` | **Starter template** — copy to `wath.json` and fill in your repo |
| `wath.json` | **Living integration manifest** (not in this directory; you create it in your app repo) |
| `schema/wath.schema.json` | JSON Schema for the manifest |
| `.cursor/mcp.json` | MCP servers (Wath, HashiCorp docs, internal docs) |
| `.cursor/environment.json` | Sandbox install/start for Tier-1 verification |
| `.cursor/rules/*.mdc` | Agent process and standard-scoped rules |
| `.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md` | PR template for Wath onboarding PRs |
| `.github/workflows/wath-verify.yml.template` | Tier-2 CI workflow template |

## wath.json

Single manifest per application repo. Wath discovers it at the repo root (override with `--wath-path`). Re-submit whenever the stack or service integrations change.

Start from `wath.json.example` — it includes a `_instructions` block at the top (how to fill out the file and which standards are currently registered). Wath ignores `_`-prefixed keys.

```bash
cp wath.json.example wath.json
# edit wath.json — set repo URL, stack, and services
```

Minimal shape (without `_instructions`):

```json
{
  "version": 1,
  "repo": "https://github.com/org/my-app",
  "stack": {
    "runtime": "kubernetes",
    "applications": {
      "orders-api": "What this app does in plain language"
    }
  },
  "services": {
    "vault-dynamic-secrets": { "datastore": "postgres", "access": "..." }
  },
  "feedback": {}
}
```

**`stack.applications`** — app name → purpose (your components).

**`services`** — either an array of standard IDs (`["vault-dynamic-secrets"]`) or an object with per-service config blocks. Keys must match IDs in `standards/registry.yaml` (aliases: `vault` → `vault-dynamic-secrets`).

**`feedback`** — written by Wath after validation runs; leave `{}` on submit.

## Iterative lifecycle

1. User commits `wath.json` (first time or after a change).
2. Wath validates and generates integration artifacts for each requested service (one standard per run today; multi-service orchestration follows).
3. On failure → update the same file (user edits `stack` / `services`; Wath writes `feedback`) → re-run `wath onboard`.
4. On pass → PR to `repo`.

## Install into an app repo

```bash
./scripts/install-consumer-template.sh /path/to/app-repo
# copies wath.json.example and seeds wath.json if missing
```

Or materialize during launch:

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo --materialize
```

## Relationship to the Wath project repo

The Wath **project** uses `CONTRIBUTING.md` for contributions to Wath itself. Application repos use **this** manifest and PR template for integration PRs opened by Wath.
