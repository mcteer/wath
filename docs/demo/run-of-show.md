# Run of show (~30 min)

Front-load the **working tool** in the first 10 minutes. Architecture and extension seams come after the audience has seen verify pass and a PR shape.

## Timeline

| Min | Segment | What you show | Command / artifact |
|-----|---------|---------------|-------------------|
| 0–2 | Hook | Static cred in tier-1 app | `curl localhost:8000/db-check` or `k8s/deployment.yaml` |
| 2–5 | Verify harness | Deterministic gate passes on golden tier-4 | `./scripts/verify-golden-fixture.sh --static-only` |
| 5–8 | Wath kickoff | Engine composes context + prompt from requirements | `node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo` |
| 8–10 | PR output | Pre-baked tier-4 PR walkthrough | `./scripts/demo-fallback-pr.sh` |
| 10–18 | Architecture | Two homes, standard triplet, invariants | README + `standards/security/vault-dynamic-secrets/SKILL.md` §1–2 |
| 18–25 | Live or hedge | Kick off cloud agent **live**, or cut to fallback PR | `--launch` or [latency-hedge.md](./latency-hedge.md) |
| 25–28 | Extension (cold) | Edit WATCH_INTEGRATIONS.json + re-run, runtime swap, or add standard | [extensions/README.md](../extensions/README.md) |
| 28–30 | Close | Propose never merge; human ratification | boundary one-liners |

## Rehearsal commands

```bash
./scripts/demo-prewarm.sh
./scripts/demo-run.sh                    # times each segment
./scripts/demo-run.sh --launch             # full live path (optional)
```

## Trim notes

- If over 30 min: cut architecture to 5 min, keep verify + PR walkthrough.
- If cloud agent is slow: live kickoff only (segment 5 start), cut to fallback PR for walkthrough.
- If Docker unavailable: skip curl; grep `deployment.yaml` for static DSN.

## Cold extension prompts (pick one per rehearsal)

Have someone throw one you did not prepare:

- "This runs on Nomad, not Kubernetes" → edit Runtime in requirements, re-run dry-run
- "PgBouncer transaction pooling" → add constraint under `services.vault-dynamic-secrets.constraints`, re-run onboard
- "Also require egress allowlisting" → enable `egress-policy` in registry, re-run
- "Onboard payments-api too" → `./scripts/onboard-fleet.sh examples/consumer-demo examples/consumer-demo-payments`
