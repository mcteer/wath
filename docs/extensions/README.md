# Wath extension seams

Phase 6 prepares **cold extension** — changes you can make live when an interviewer throws an unplanned prompt. The engine stays generic; standards and the integration spec drive behavior.

## The four seams

| Seam | What to change | Example cold prompt |
|------|----------------|---------------------|
| **Standard (SKILL)** | Add or edit `standards/<bu>/<id>/` + one registry line | "Also require mTLS via our PKI standard" |
| **Integration spec** | Edit `wath.json` (`stack`, `services`) | "This runs on Nomad, not Kubernetes" |
| **Feedback loop** | Re-submit the same spec after validation findings (`feedback`) | "PgBouncer transaction pooling breaks session auth" |
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

Add a key under `services` in wath.json and re-run onboard.

## 2. Change runtime / auth method

Auth method is derived from **`stack.runtime`** in wath.json:

| Runtime | Auth method |
|---------|-------------|
| `kubernetes` | kubernetes |
| `nomad` | jwt (Nomad workload identity) |
| `vm` | approle / cloud identity |

Example: change `"runtime": "nomad"`, re-run onboard.

See `examples/consumer-demo-nomad/wath.json` for a prepped Nomad variant.

## 3. Iterative re-onboarding (same file, re-run)

When validation surfaces a gap, update **wath.json in place** and re-run:

1. User edits `stack` / `services`; Wath appends to `feedback`.
2. Re-run `wath onboard <path> --launch --materialize`.

Example: add `"connection_pooler": "pgbouncer-transaction"` under the service's `constraints`.

## 4. Platform-push fleet

```bash
./scripts/onboard-fleet.sh examples/consumer-demo examples/consumer-demo-payments
```

## Engine vs standard boundaries

Keep **standard-specific** logic in `standards/<bu>/<id>/` (SKILL, schema, conformance). The engine loads the registry and `standard.yaml` onboarding metadata.

## Rehearsal checklist

- [ ] Can add a registry entry and a `services` key, then re-run onboard
- [ ] Can change `stack.runtime` and see auth method update in dry-run prompt
- [ ] Can edit service `constraints` and re-run to show the feedback loop
- [ ] Can run fleet script across two consumer paths
