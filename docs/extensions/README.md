# Wath extension seams

Phase 6 prepares **cold extension** — changes you can make live when an interviewer throws an unplanned prompt. The engine stays generic; standards and requirements drive behavior.

## The four seams

| Seam | What to change | Example cold prompt |
|------|----------------|---------------------|
| **Standard (SKILL)** | Add or edit `standards/<bu>/<id>/` + one registry line | "Also require mTLS via our PKI standard" |
| **Requirements doc** | Edit `INTEGRATION_REQUIREMENTS.md` environment/intent/constraints | "This runs on Nomad, not Kubernetes" |
| **Feedback loop** | Swap or extend requirements with a Tier-2 finding | "PgBouncer transaction pooling breaks session auth" |
| **Fleet** | Run onboarding across multiple consumer paths | "Onboard our payments API the same way" |

## 1. Add a standard (insurance: egress-policy)

A prepped stub lives at `standards/networking/egress-policy/`. It is **not** in the active registry until you enable it.

```yaml
# Add to standards/registry.yaml:
  - id: egress-policy
    path: networking/egress-policy
    owner: network-engineering
    version: 1
    rule_prefix: EGR
    runtimes:
      - kubernetes
      - nomad
    services:
      - network-policy
```

Then add a glob-scoped rule (already prepped):

`templates/consumer/.cursor/rules/standards/egress-policy.mdc`

Re-run onboarding — the engine selects standards by runtime and explicit `--standard-id`.

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo --standard-id egress-policy
```

## 2. Change runtime / auth method (one-line requirements edit)

Auth method is derived from the **Runtime** field in `INTEGRATION_REQUIREMENTS.md`:

| Runtime | Auth method |
|---------|-------------|
| `kubernetes` | kubernetes |
| `nomad` | jwt (Nomad workload identity) |
| `vm` | approle / cloud identity |

Example: change `Runtime` from `kubernetes` to `nomad`, re-run onboard. The prompt and agent process pick up the new auth method without engine changes.

See `examples/consumer-demo-nomad/INTEGRATION_REQUIREMENTS.md` for a prepped Nomad variant.

## 3. Feedback-loop regen (requirements v2)

When Tier-2 CI surfaces a constraint, update requirements and re-run:

1. Copy `templates/consumer/INTEGRATION_REQUIREMENTS.v2.example.md` into the consumer repo (or merge its constraints section).
2. Re-run `wath onboard <path> --launch --materialize`.

The agent re-detects, re-parameterizes, and re-verifies against the updated constraints.

## 4. Platform-push fleet

Onboard multiple application repos in one shot:

```bash
./scripts/onboard-fleet.sh examples/consumer-demo examples/consumer-demo-payments
```

Each path gets its own dry-run or `--launch` (pass `--launch` through). For cloud runs, set `WATH_CONSUMER_REPO_URL` per repo or fill the Repository field in each requirements doc.

## Engine vs standard boundaries

Keep **standard-specific** logic in:

- `standards/<bu>/<id>/SKILL.md` — prescribe behavior
- `standards/<bu>/<id>/standard.yaml` — `onboarding.artifacts`, sandbox scripts, golden refs
- `standards/<bu>/<id>/conformance/` — verify gate
- `templates/consumer/.cursor/rules/standards/<id>.mdc` — edit-time agent hints

The engine (`packages/engine/`) loads the registry and `standard.yaml` onboarding metadata — it should not hardcode Vault paths or rule IDs.

## Rehearsal checklist

- [ ] Can add a registry entry and re-run onboard without engine code changes
- [ ] Can change Runtime in requirements and see auth method update in dry-run prompt
- [ ] Can swap requirements v2 and explain what the agent would re-do
- [ ] Can run fleet script across two consumer paths
