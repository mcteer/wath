# Wath onboarding lifecycle

Multi-phase onboarding for application repos that commit `wath.json`. Phases advance via the Wath CLI, Wath MCP tools in Cursor Desktop, or Cursor Automations.

## Developer flow

1. Copy `wath.json.example` to `wath.json` in your app repo root.
2. Fill in `repo`, `stack`, and `services` (minimal: `"services": ["vault-dynamic-secrets"]`).
3. In Cursor Desktop, connect the Wath MCP server and run **`wath.onboard`** (or `wath lifecycle ./path --launch` from the Wath repo).
4. If Wath finds gaps, it opens a **manifest-only PR** updating `wath.json`. Merge it and re-run **`wath.onboard`**.
5. For each service in `wath.json`, Wath runs **integrate → validate** agents and opens an **integration PR** (one `wath.onboard` call with `launch: true` chains both phases).
6. Your team reviews and merges integration PRs.
7. Wath records onboarding state under `state/applications/<org>/<repo>.yaml` in the Wath repo.

## Phases

| Phase | Purpose |
|-------|---------|
| `discover` | Read `wath.json`, infer whether the manifest is complete |
| `enrich_manifest` | Agent analyzes repo and opens PR scoped to `wath.json` only |
| `integrate` | Agent generates params + artifacts for one standard |
| `validate` | Agent runs conformance gates; opens integration PR on pass |
| `await_merge` | Waiting for human merge of manifest or integration PR |
| `record` | Persist successful onboarding after merges |
| `compliant` | All requested integrations merged at current standard versions |
| `non_compliant` | Stale or rejected update PRs |

## State ledger

Git-native records live in the Wath repo:

```
state/applications/<org>/<repo>.yaml
```

See [application-state.schema.yaml](../../state/schema/application-state.schema.yaml) for the schema.

## Operator commands

```bash
# Inspect lifecycle state for an app (by path or repo URL)
wath status ./examples/consumer-demo
wath status https://github.com/org/my-app

# Run lifecycle (dry-run shows phase + prompt)
wath lifecycle ./examples/consumer-demo
wath lifecycle ./examples/consumer-demo --launch --materialize

# Record a merged PR (manual or from Automation)
wath record-merge --app org/repo --type manifest --pr https://github.com/...
wath record-merge --app org/repo --type integration --standard vault-dynamic-secrets --pr https://...

# Compliance audit vs current standards registry
wath audit
wath audit --json
```

## Cursor Desktop

Configure Wath MCP in your app repo `.cursor/mcp.json` (see [cursor-automation.md](./cursor-automation.md)).

Tools:

- **`wath.onboard`** — start or resume lifecycle for a repo path or URL
- **`wath.status`** — return phase, PR URLs, compliance flags
- **`wath.record_merge`** — mark a PR as merged and advance phase

## Re-onboarding

When a standard version bumps in `standards/registry.yaml`, run `wath audit` to find drift, then `wath lifecycle` (or Automations) to open update PRs. Compliance flags on each integration track `in_compliance`, `drift`, or `non_compliant`.
