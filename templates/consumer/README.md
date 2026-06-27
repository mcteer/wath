# Consumer repository templates

Files in this directory are **installed into application repos** when a team adopts Wath or when the engine materializes config during onboarding (`wath onboard --materialize`).

## Layout

| Path | Purpose |
|------|---------|
| `INTEGRATION_REQUIREMENTS.md` | **Living intake** — environment, intent, constraints; re-submitted whenever integration needs change |
| `.cursor/mcp.json` | MCP servers (Wath, HashiCorp docs, internal docs) |
| `.cursor/environment.json` | Sandbox install/start for Tier-1 verification |
| `.cursor/rules/*.mdc` | Agent process and standard-scoped rules |
| `.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md` | **PR template for Wath onboarding PRs** |
| `.github/workflows/wath-verify.yml.template` | Tier-2 CI workflow template (copied/renamed by agent) |

## Iterative lifecycle

Wath is **not** one-and-done. The flow is always:

1. User submits `INTEGRATION_REQUIREMENTS.md` (first time or after a stack/requirements change).
2. Wath validates and generates integration artifacts against the governing standard.
3. If validation fails or something was missing → update **the same file** (user edits §1–3; Wath writes §5 Feedback) → re-run `wath onboard`.
4. When the gate passes → Wath opens a **PR** to the repository named in §1.

Three months later, when runtime, datastore, or constraints change, edit the requirements and submit again. Wath produces a new PR with updated integration code.

## Onboarding pull request template

Wath opens a **single PR** back to the application repo with all integration artifacts. The PR description MUST follow:

`.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md`

GitHub pre-fills this template when the file exists on the branch. The Wath agent completes every section with:

- Migration / change rationale
- Artifact checklist (all boxes addressed)
- Verification evidence from `verify.sh` / `.wath/verify-summary.json`
- Vault admin steps the platform team must perform (Wath documents, never executes)
- SQL grant and identity-binding assumptions for SME ratification

### Install into an app repo

```bash
./scripts/install-consumer-template.sh /path/to/app-repo
```

Or let the engine materialize during launch:

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo --materialize
```

## Relationship to the Wath project repo

The Wath **project** uses its own `CONTRIBUTING.md` PR template for contributions to Wath itself. Application repos use **this** template for service-integration PRs opened by Wath.
