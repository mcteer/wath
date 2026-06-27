# Wath — Build Roadmap — Cursor FDE demo

Detailed, sequenced, and de-risked. The ordering is deliberate: **build the riskiest infrastructure first** (the verify harness), not the most visible. A beautiful narrative on a demo that breaks loses; a plain golden path that runs flawlessly wins.

---

## Key design decision (read first)

**No Docker-in-Docker, no in-VM Kubernetes cluster.** The cloud agent runs in a container; DinD is fiddly, shares the host network namespace, and a live cluster boot is the single most likely thing to break on stage. Ruled out entirely.

Instead, verify what each tier can honestly prove:

- **Workload-identity → dynamic secret (the real security model)** → proven for real, in-VM, with a **JWT stand-in**: generate a signing keypair, configure Vault's `jwt` auth to trust it, mint a token carrying ServiceAccount-style claims (`sub = system:serviceaccount:<ns>:<sa>`), bind it to a role → least-privilege policy → read the **database secrets engine** for a dynamic credential against a **real throwaway Postgres**. This exercises the actual flow — signed identity → role → policy → dynamic secret — with zero cluster.
- **Auth-wiring artifacts (kubernetes auth role, VSO CRs, deployment)** → proven by **manifest/template validation**: `helm template`, `kubeconform`, `vault policy fmt`, VSO CRD schema check — not applied to a live cluster.
- **The auth method is prescribed from the environment, not hardcoded.** The requirements doc's environment slice drives it: K8s → kubernetes auth + VSO; Nomad → Nomad workload identity / JWT; bare container or VM → AppRole. The JWT stand-in models all of them at the identity layer, so the verify path is runtime-agnostic.

Honest limitation (state it, don't hide it): the stand-in doesn't exercise the literal `kubernetes` backend's TokenReview against a live API server — which is exactly what Tier-2 CI in the team's real cluster covers.

---

## Phase 0 — Prereqs & harness de-risking (½ day)
Prove the plumbing before building anything pretty.

- [ ] Cursor API key; `npm install @cursor/sdk`.
- [ ] Two GitHub repos: `consumer-demo` (the app) and `sme-standards` (the registry).
- [ ] Fork the Cursor cookbook; run the **quickstart** and the **kanban / prototyping** sample to confirm an SDK cloud agent runs and opens a PR end to end.
- [ ] Confirm `autoCreatePR` works against `consumer-demo` with a trivial prompt.

**Exit criterion:** an SDK call opens a real PR on your repo. If this doesn't work, nothing else matters — fix it now.

## Phase 1 — The tier-1 consumer repo (½ day)
The deliberately-bad "before."

- [ ] Small service (Python/FastAPI or Go) that reads `DATABASE_URL=postgres://user:password@host/db` from `.env` or hardcoded config.
- [ ] `Dockerfile`, a K8s `deployment.yaml`, a `requirements.md` (environment + intent slices).
- [ ] Runs locally against a local Postgres.

**Exit criterion:** the app starts and queries Postgres using the static cred. This is your on-screen "problem."

## Phase 2 — The Skill: encoded SME expertise (1 day) — *the heart*
This is the FDE-in-a-box. Invest here.

- [ ] `sme-standards/security/.../SKILL.md` encoding the opinionated standard: prefer dynamic DB secrets over static; K8s auth in-cluster; least-privilege policy authored to the app's role path; VSO for consumer wiring; the guardrails (no real secrets, privilege boundary).
- [ ] Make it *prescriptive*, not descriptive — it must drive the tier-1→tier-4 recommendation, not just describe options.
- [ ] (Optional, for the add-a-standard extension) a `network-engineering/` Skill with an egress rule, and/or a PKI/mTLS standard.

**Exit criterion:** with the Skill present, the agent reliably *recommends* dynamic creds when handed a static-cred repo.

## Phase 3 — Environment + verify harness (1–1.5 days) — *highest risk*
The differentiator. Build it early so failures surface with time to fix.

- [ ] `.cursor/environment.json`: install/start Vault (dev mode) + a throwaway Postgres in the VM; set egress allowlist for any MCP/registry endpoints. No Docker, no cluster — just two processes.
- [ ] `verify.sh`: configure the database secrets engine against the throwaway Postgres → set up the **JWT auth stand-in** (trust a generated signing key; mint a token with ServiceAccount-style claims) → bind the role → write the generated `policy.hcl` → run the app/test → assert it authenticates with the signed identity and pulls a *dynamic* credential. Capture output as PR evidence.
- [ ] Manifest-validation step: `helm template` + `kubeconform` + `vault policy fmt` + VSO CRD schema check for the deployment/auth-wiring artifacts.

**Exit criterion:** running `verify.sh` by hand against a *correct* hand-written integration goes green and emits a structured artifact. (Verify the verifier before the agent ever touches it.)

## Phase 4 — The SDK orchestrator (1 day)
The engine, single-repo first.

- [ ] TS harness: select the relevant Skills from `sme-standards`, generate `.cursor/environment.json` from the requirements' environment slice, write `.cursor/mcp.json` (HTTP transport), `Agent.create({ cloud: { repos: [...], autoCreatePR: true }})`, `agent.send(<onboarding intent>)`, stream events.
- [ ] MCP: a HashiCorp-docs HTTP MCP for current API reference; a small internal-docs MCP (namespaces, naming, Vault address per env).
- [ ] **Pragmatic fallback:** for the core live run, pre-place the Skills/`.cursor` config in `consumer-demo` to cut moving parts; *describe* the harness composition as the mechanism. Keep live composition for rehearsal only.

**Exit criterion:** one command → agent runs → verifies → opens a PR.

## Phase 5 — Tune the PR shape (1 day)
Make the output consistently clean — this is iteration, budget for it.

- [ ] PR reliably contains: app diff, `policy.hcl`, auth config, VSO wiring, updated manifest, `.github/workflows/vault-verify.yml`, and a description with rationale + verification evidence + advisory/roadmap flags + human-apply steps.
- [ ] Iterate the Skill + prompt until the recommendation reasoning and artifact set are stable across 3+ consecutive runs.

**Exit criterion:** three clean runs in a row. Record one as the fallback (see Phase 7).

## Phase 6 — Extensibility prep — *the extension is interviewer-driven* (½–1 day)
Re-read the instruction: extend "based on a prompt **from the interviewers**." They will point somewhere and ask you to build, live — not watch a prepared reveal. So the real deliverable of this phase is a **well-factored core you can confidently mutate in an unplanned direction**, with prepped deltas as *insurance*, not the plan.

What "well-factored" means here — make these the seams you can extend along:
- [ ] The Skill is the single source of prescribed behavior, so "add/change a standard" is a one-file edit, not a code change.
- [ ] The prescribe → generate → verify steps are legible and separable, so you can point at where a new requirement would land.
- [ ] The requirements doc cleanly drives behavior, so "what if they also need X" is a doc edit + rerun.
- [ ] The auth method is derived from the requirements' environment slice, so "now it's Nomad / a plain VM, not K8s" is a one-line doc edit, not a rewrite — your strongest cold-prompt seam.

Prepped deltas (insurance — have them, don't lead with them):
- [ ] **Add-a-standard:** a NetEng/PKI Skill ready to enable → rerun → agent conforms (e.g. add a PKI cert for mTLS). The cleanest unscripted-friendly seam.
- [ ] **Feedback-loop regen:** a `requirements-v2.md` carrying a realistic Tier-2 finding (e.g. a PgBouncer transaction-pooler constraint) → rerun → agent adapts.
- [ ] **Platform-push fleet:** a second consumer repo so the single-repo call becomes a trivial loop — the org-scale beat, and the one that reconnects to the seeded "new API version" examples.

**Exit criterion:** you can take a *cold* extension prompt you didn't prepare (have someone throw you one — "now also require audit logging," "what if it's MySQL not Postgres," "what if this runs on Nomad, not K8s," "add a staging environment") and make a coherent change live, even if you talk through part of it rather than fully landing it. That capability — not a polished reveal — is what's being tested.

## Phase 7 — Rehearsal & demo-day hardening (½ day)
- [ ] Time the full run-of-show end to end; trim to fit 30 min.
- [ ] **Front-load the working tool.** The tier-1 repo → kickoff → verify → PR should read as an impressive *working tool* in the first ~10 minutes, before you pull back to architecture. If the slide does more work than the running code, a builder panel discounts it.
- [ ] Pre-warm: Docker layer cache, pre-cloned environment, MCP creds tested.
- [ ] **Latency hedge:** decide your live-vs-baked split. Recommended: kick off the agent *live* for authenticity, then cut to a pre-completed PR for the walk-through if the run is slow. Have a screen recording of a clean full run as the ultimate fallback.
- [ ] **Rehearse a cold extension.** Have someone throw you an extension prompt you didn't prepare and practice making a coherent live change. This is the part most candidates under-rehearse and it's explicitly graded.
- [ ] Rehearse the boundary one-liners and (for Q&A only) the Vault analogy until they're reflexive.

---

## Critical path
`Phase 0 (harness) → Phase 3 (verify harness) → Phase 4 (orchestrator) → Phase 5 (PR tuning)`

Phases 1 and 2 can run in parallel with 0/3. **If you're time-boxed, protect Phase 3 and Phase 5** — the verify loop is the differentiator and the PR is what they see. Everything in Phase 6 is cuttable to a slide.

Rough total: ~6–7 focused days. Compresses to ~4 if you pre-place config (Phase 4 fallback) and pick a single extension.

## Risk register
| Risk | Likelihood | Mitigation |
|---|---|---|
| Cloud-agent run latency on stage | High | Live kickoff + cut to pre-baked PR; recording as final fallback |
| Vault-in-VM setup fragility | High | Phase 3 first; verify the verifier by hand before the agent uses it |
| In-VM cluster / Docker-in-Docker | — | **Ruled out** — JWT stand-in proves the identity flow; manifest validation covers the wiring (see top) |
| MCP auth / egress blocked in VM | Med | HTTP transport; test creds in Phase 4; set egress allowlist in `environment.json` |
| PR output inconsistent run-to-run | Med | Phase 5 iteration; pin model (Composer 2); require 3 clean runs |
| Extension breaks live | Med | Prepared delta (requirements-v2); pick the lowest-variance extension; second prepped as backup |
| Trying to demo the governance CI / CI-feedback-bus live | — | **Slide only** — both are fragile to wire live |

## Demo-day checklist
- [ ] API key + MCP creds valid; egress allowlist set.
- [ ] `consumer-demo` reset to the tier-1 "before" state.
- [ ] One clean recorded run loaded and ready.
- [ ] `requirements-v2.md` (or chosen extension delta) staged.
- [ ] Architecture slide open in a second window.
- [ ] Boundary one-liners + Vault analogy rehearsed.
