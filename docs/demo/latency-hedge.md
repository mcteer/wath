# Latency hedge

Cloud agent runs are unpredictable on stage. Plan the split before demo day.

## Recommended split

1. **Live kickoff** — run `wath onboard ... --launch --materialize` on stage for authenticity. Show the agent starting, stream a few events.
2. **Cut to fallback** — if the run exceeds ~3 minutes or stalls, switch to the pre-baked PR walkthrough:

```bash
./scripts/demo-fallback-pr.sh
```

Open these files in the IDE while narrating:

- `standards/.../fixtures/tier4-orders-api/integration.params.json`
- `vault/policy.hcl`
- `k8s/vso-dynamic-secret.yaml`
- `k8s/deployment.yaml` (no static DSN)
- `.wath/verify-summary.json`
- `.github/PULL_REQUEST_TEMPLATE/wath-onboarding.md`

3. **Screen recording** — record one clean full run (`demo-run.sh --launch`) as the ultimate fallback if live and pre-baked both fail.

## What the fallback proves

The golden fixture is a hand-written tier-4 integration that passes the same `verify.sh` the agent must satisfy. Walking it is not cheating — it shows the **output shape** and verification evidence while the live run catches up or if network fails.

## Dry-run-only path

If API key or repo URL is unavailable:

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo
./scripts/demo-fallback-pr.sh
```

Narrate: "In production this launches the cloud agent with `autoCreatePR`; here is the verified artifact set it produces."
