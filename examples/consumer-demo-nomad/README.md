# Nomad runtime example spec

Prepped `WATCH_INTEGRATIONS.json` with `"runtime": "nomad"`. Use with the consumer-demo codebase:

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo \
  --integrations-path ./examples/consumer-demo-nomad/WATCH_INTEGRATIONS.json
```

Auth method in the prompt becomes JWT (Nomad workload identity) per the vault-dynamic-secrets standard.
