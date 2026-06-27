# Wath

**Onboarding & conformance engine** for platform service integrations.

A developer describes their app in business terms; Wath prescribes a compliant integration with a platform service, **verifies** it deterministically, and opens a **pull request** for humans to review and merge.

The reference implementation onboards applications to **HashiCorp Vault dynamic database secrets** (tier-4). The architecture is designed to grow into an open **service integration marketplace** — each new platform service is a pluggable standard in `standards/`.

> **The name.** A *wath* (Old Norse *vað*) is a ford — the safe, known place to cross a river.

## Quick start

```bash
# Install dependencies
npm install

# Build the engine
npm run build --workspace=@wath/engine

# List registered standards
node packages/engine/dist/cli/index.js list

# Run conformance gate against an artifact root
node packages/engine/dist/cli/index.js verify vault-dynamic-secrets ./examples/consumer-demo
```

## Project layout

```
standards/          SME standards registry (marketplace catalog)
packages/engine/    SDK orchestrator — selects standards, runs verification
templates/consumer/ Artifacts teams install in their application repos
examples/           Runnable demos (tier-1 consumer app)
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — how to add standards and submit PRs

## Core invariants

- **Standards are the source of truth** — steer → bound → verify (Skill + schema + conformance)
- **Typed params first** — emit `integration.params.json` before any HCL
- **Propose, never merge** — the agent opens PRs; humans ratify
- **No real secrets** — verify only against ephemeral resources
- **Failing gates are hard stops** — never weaken checks to make them pass

## License

Licensed under the [Apache License, Version 2.0](./LICENSE). See also [NOTICE](./NOTICE).
