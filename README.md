# Wath

**Onboarding & conformance engine** for platform service integrations.

A developer describes their app in business terms via **`WATCH_INTEGRATIONS.json`**; Wath prescribes compliant integrations with platform services, **verifies** them deterministically, and opens a **pull request** for humans to review and merge.

Re-submit the same spec whenever the stack or services change — first onboarding or remediation months later.

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

# Dry-run onboarding (compose context + prompt, no agent)
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo

# Launch cloud agent (requires CURSOR_API_KEY + repo URL)
# export CURSOR_API_KEY=...
# export WATH_CONSUMER_REPO_URL=https://github.com/mcteer/wath
# node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo --launch --materialize

# Verify the golden tier-4 fixture (hand-written reference integration)
./scripts/verify-golden-fixture.sh --static-only
```

## Project layout

```
standards/          SME standards registry (marketplace catalog)
packages/engine/    SDK orchestrator — selects standards, runs verification
templates/consumer/ Artifacts teams install in their application repos
examples/           Runnable demos — see `examples/consumer-demo/README.md`
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — how to add standards and submit PRs to **Wath**
- [Consumer templates](./templates/consumer/README.md) — app-repo intake, PR template, CI workflow
- [Extension seams](./docs/extensions/README.md) — cold-extension prep (add standard, change runtime, fleet)
- [Demo rehearsal](./docs/demo/README.md) — run-of-show, checklist, latency hedge

## Core invariants

- **Standards are the source of truth** — steer → bound → verify (Skill + schema + conformance)
- **Typed params first** — emit `integration.params.json` before any HCL
- **Propose, never merge** — the agent opens PRs; humans ratify
- **No real secrets** — verify only against ephemeral resources
- **Failing gates are hard stops** — never weaken checks to make them pass

## License

Licensed under the [Apache License, Version 2.0](./LICENSE). See also [NOTICE](./NOTICE).
