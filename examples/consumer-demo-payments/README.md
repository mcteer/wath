# Payments API — fleet demo target

Second consumer path for **platform-push fleet** demos. Uses the same vault-dynamic-secrets standard as `consumer-demo`; differs only in application identity.

For a full onboarding run, either:

1. Copy the tier-1 app structure from `examples/consumer-demo/` here, updating names to `payments-api`, or
2. Use this path in fleet dry-runs to show multi-repo orchestration:

```bash
./scripts/onboard-fleet.sh examples/consumer-demo examples/consumer-demo-payments
```

Requirements below are sufficient for dry-run prompt composition.
