# bootstrap.md — Wath project orientation

> Read this first. It explains what each file in this project is for and how they fit
> together, so you (an agent) start with the right mental model instead of inferring it.

## What Wath is

Wath is an **onboarding & conformance engine**. A developer describes their app and what it
needs in business terms; Wath prescribes a compliant integration with a platform service,
**verifies** it, and opens a **pull request** for humans to review and merge. The reference
implementation onboards applications to **HashiCorp Vault dynamic database secrets** (tier-4).

The governing principle: **the language model is an untrusted drafter.** SME-ratified standards
steer it, but adherence is never assumed — it is enforced by deterministic checks compiled from
the same standards, proven in a sandbox, and ratified by humans. The model proposes; nothing it
writes reaches production without passing gates it cannot influence.

## Mental model

Two ideas explain almost everything here:

1. **A standard is a *paired* artifact: steer → bound → verify.** Each standard ships as (a) a
   Skill that steers generation, (b) a schema that bounds the model's output, and (c) a
   conformance suite that gates the result. All three are compiled from the *same* numbered rules
   (`VDS-001…008`), so steering and enforcement are visibly one source of truth.
2. **Two homes.** The **standards registry** is SME-owned and is the source of truth. The
   **consumer repo** is the team's own application, where Wath is invoked and where the agent's PR
   lands. Files below are tagged with which home they belong to.

## Repository layout

```
standards/              SME standards registry (marketplace catalog)
  registry.yaml         Index of all available standards
  security/             Business-unit owned standards
packages/engine/        SDK orchestrator (@wath/engine)
templates/consumer/     Artifacts teams install in application repos
examples/               Runnable demos (tier-1 consumer app)
docs/                   Architecture, roadmap, demo prep (not runtime)
```

## File map

### A. The standard — lives in the **standards registry** (SME-owned)

This is the heart of the system. The reference standard is `vault-dynamic-secrets`.

- **`standards/security/vault-dynamic-secrets/SKILL.md`** — *Steering.* The security team's codified
  judgment as a Cursor Skill: the runtime→auth-method prescription, the consumer-vs-admin
  boundary, and the imperative rules `VDS-001…008`. This is the context placed in front of the
  agent when it generates an integration.
- **`standards/security/vault-dynamic-secrets/schema/integration.params.schema.json`** — *Bounding.* The
  typed parameters the agent MUST emit **before** writing any HCL. The schema caps the dangerous
  decisions (TTLs ≤ 1800/3600, capabilities only `["read"]`, identity bindings reject `*`),
  shrinking the model's freedom from "all of HCL" to a handful of validated values.
- **`standards/security/vault-dynamic-secrets/conformance/test_conformance.py`** — *Verifying (the real
  guarantee).* One deterministic test per rule (`test_VDS_003_…`), parsing what the agent produced
  and asserting pass/fail in code the model cannot talk past. The 1:1 rule→test naming is
  load-bearing — do not break it.
- **`standards/security/vault-dynamic-secrets/conformance/verify.sh`** — *The gate's entry point.* Runs the
  rule assertions plus native validators (`vault policy fmt`, `kubeconform`) plus an optional
  behavioral stub. The sandbox runs it (Tier-1); the shipped CI re-runs it in the team's real
  environment (Tier-2).
- **`standards/registry.yaml`** — Marketplace catalog; the engine loads this to discover standards.
- **`standards/_template/`** — Scaffold for adding new platform service integrations.

### B. Consumer-repo artifacts — live in the **team's application repo**

What a team adds to adopt Wath. Install from `templates/consumer/` via `scripts/install-consumer-template.sh`.

- **`templates/consumer/INTEGRATION_REQUIREMENTS.md`** — The developer-facing intake form. Three slices —
  *Environment* (runtime, stack, the static pattern to replace), *Intent* (datastore, access, TTL
  tolerance, in plain language), and *Feedback* (auto-filled by the verification loop) — plus a
  constraints/gotchas section and an admin-prerequisites acknowledgment. This is what a team
  submits to onboard.
- **`templates/consumer/.cursor/mcp.json`** — The desktop trigger surface. Registers Wath as an MCP server so its
  tools (`wath.onboard`, `wath.status`, …) appear in Cursor Desktop and onboarding can be kicked
  off with `@wath onboard`. HTTP transport keeps Wath's credentials proxied server-side.
- **`templates/consumer/.cursor/rules/wath-overview.mdc`** — *Always-on rule.* Terse prime directives that hold on
  every turn (see Invariants below).
- **`templates/consumer/.cursor/rules/wath-agent-process.mdc`** — *Agent-requested rule.* The cloud agent's six-stage
  operating procedure (Detect → Compose → Parameterize → Render → Verify → Open PR), each stage
  with a definition-of-done and a hard-stop. This tells the agent what to do based on where it is
  in the process flow.
- **`templates/consumer/.cursor/rules/standards/vault-dynamic-secrets.mdc`** — *Glob-scoped rule.* Auto-loads when editing
  `policy.hcl`, `integration.params.json`, or k8s manifests; restates `VDS-001…008` as working
  rules with a valid/invalid example and points back to the SKILL and conformance suite.

> Note: `.cursor/rules/*.md` files (if present) are viewable copies; the **`.mdc`** files are the
> canonical ones Cursor reads (only `.mdc` honors the `description`/`globs`/`alwaysApply`
> frontmatter). Cursor reads these `.mdc` files automatically — you do not need to load them by hand.

### C. Engine — lives in **this repo** (`packages/engine/`)

- **`packages/engine/`** — TypeScript orchestrator on `@cursor/sdk` (Phase 4). Loads `standards/registry.yaml`,
  parses requirements, selects standards, invokes conformance gates, and will launch cloud agents.
- **`packages/mcp-server/`** — HTTP MCP server for `wath.onboard` / `wath.status` (Phase 4).

### D. Prep / reference docs — **documentation, not runtime components**

Design and presentation material for the project's author. Useful for context; not part of the
running system.

- **`docs/architecture/01-architecture.md`** — The design of record: problem, thesis, components, agent flow,
  two-tier verification, guardrails, and the evolution roadmap (stateful fleet, GEPA, lifecycle
  triggers, external-guidance ingestion).
- **`docs/demo/02-talk-track.md`** — The demo script and Q&A arsenal (when added).
- **`docs/roadmap/03-build-roadmap.md`** — The sequenced build plan (Phases 0–7), riskiest-infrastructure-first.

## How an onboarding run flows

1. Developer fills `INTEGRATION_REQUIREMENTS.md` and runs `@wath onboard` in Cursor.
2. The orchestrator composes the relevant **standard** (SKILL + schema + context) and launches a
   cloud agent against the repo.
3. The agent follows `wath-agent-process.mdc`: detect → select standard → **emit typed params** →
   render artifacts → **run `verify.sh`** → open one PR with evidence.
4. Humans review and merge. The agent never merges and never touches a real secret.

## Invariants (non-negotiable — never work around these)

- **Standards are the source of truth.** Apply the SME-owned standard; do not improvise
  security/platform patterns.
- **Typed params first.** Emit `integration.params.json` (schema-valid) before any HCL; render
  policy/role from it.
- **Propose, never merge.** Open a PR; never apply to production, never merge. Two human gates are
  mandatory (SME merges policy; repo owner merges the PR).
- **No real secrets.** Verify only against ephemeral/throwaway resources. Privileged platform setup
  is an admin step you *document*, not perform.
- **A failing conformance gate is a hard stop.** Fix the artifacts; never weaken a check or a
  standard to make it pass.
- **Escalate, don't guess.** If a standard is silent or a case is novel/ambiguous, stop and surface
  it for a human SME.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Every change requires a dedicated branch (`feat/`, `fix/`, etc.).
