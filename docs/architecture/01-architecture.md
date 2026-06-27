# Wath — Onboarding & Conformance Engine

**Cursor FDE onsite — technical challenge**
Demo instance: zero-friction HashiCorp Vault onboarding for application teams.

> **The name.** A *wath* (from Old Norse *vað*) is a ford — the safe, known place to cross a river. That is what this platform is: the sanctioned crossing that gets an application safely onto the platform services it's required to connect to, with the organization's codified expertise guiding it over. (Pronounced *WOTH*, rhyming with *moth*.)

---

## 1. The problem

The challenge asks for a meaningful SDLC problem grounded in real enterprise constraints. The one this solves is structural, not technical:

**A split-incentive problem.** The team that *mandates* a platform integration (InfoSec mandating Vault) is not the team that *pays* for it (product engineering), and the team that pays gets none of the upside — they get a tax on their revenue roadmap. "InfoSec requires me to integrate with Vault, but I'm already buried under revenue-generating requests" is the lived version.

Two consequences follow, and both keep teams stuck:

1. **Time.** The integration competes with revenue work and loses.
2. **Expertise.** Developers are not security SMEs. Even with infinite time, they can't necessarily implement the integration *correctly*.

The result is the **value-realization gap**: teams adopt the lowest-effort surface and stop. In Vault terms they ship static credentials in the KV backend and never reach dynamic secrets — at which point they're paying for Vault to be a worse AWS Secrets Manager. It is not a feature gap. The advanced capability existed the whole time; the *motion to move the team onto it* failed.

## 2. The thesis

**Business intent in, compliant implementation out.** A developer should stay in their own mental model — *"my service needs to read this Postgres database in dev and prod"* — and never have to descend into "configure a database secrets engine, bind a Kubernetes auth role, write a least-privilege policy." The engine does the labor; the developer keeps the judgment (review and merge).

Structurally: Vault abstracts over secret backends. **This engine abstracts over Vault.** The reason teams stall on KV is that Vault's abstraction still leaks its own operational complexity onto the developer. The engine seals that leak.

This is also a knowledge-distribution mechanism. There aren't enough security engineers to pair with every product team — the SME is the constraint. Encode the SME's judgment once, apply it N times.

## 3. Why this is differentiated — *positioning reference, Q&A only*

> This section is for your own prep and for answering positioning questions if they come up. It is **not** part of the default spoken demo, which leads as an engineering build. Hold it for Q&A.

The differentiation is **not** a primitive. Subagents, hooks, MCP, cloud VMs, and verify-in-sandbox are at or near parity across agentic tools. The wedge is that this is **org-scale infrastructure, not a single terminal session**:

- A model-neutral, governed, multi-surface platform an enterprise standardizes its whole engineering org on.
- An FDE motion that walks customers up the adoption ladder — from interactive single-player coding (commodity, interchangeable) to a programmatic, governed, fleet-scale standards control plane (the value).

The customer asking "why wouldn't I just use Claude Code?" is a customer stranded on tier 1. This engine is the thing that moves them up.

## 4. System components

### 4.1 SME standards registry (the control plane, made literal)
A Git repository where each business unit — security, compliance, network engineering, platform — owns and versions its own standards, behind `CODEOWNERS` so no BU can edit another's. Each standard is authored as a **Cursor Skill**. Governance gets its own SDLC: standards are version-controlled software with PR review.

- **Ownership flips the Skill's meaning:** it is no longer "best practices in the abstract," it is *the security team's codified expertise, owned by the security team.* RACI: SME owns the standard, developer owns the merge, agent does the labor.
- **Governance CI (slide, not stage):** each PR into the registry runs an LLM-as-judge GitHub Action that loads existing standards and triages the proposed change against the current gold standard for conflicts. **The judge is triage, not a gate** — it accelerates and sharpens human SME review; it never replaces ratification (see §6).

### 4.2 Requirements document (one doc, three consumers)
The team's `requirements.md` does three distinct jobs:

| Slice | Content | Consumed by |
|---|---|---|
| Environment | tech stack, config files, repo layout, **runtime (K8s / Nomad / VM)** | compiles to `.cursor/environment.json`; **runtime drives the prescribed auth method** |
| Intent | "Postgres, dev + prod, on K8s" | drives what the agent prescribes |
| Feedback | results of real-environment testing | written back by the test loop (§4.6) |

### 4.3 The engine (SDK orchestrator)
A TypeScript harness on `@cursor/sdk` that: selects the relevant BU standards for this repo, generates the environment config from the requirements' environment slice, creates a cloud agent against the consumer repo, sends the onboarding intent, lets the agent verify its own work, and opens a PR (`autoCreatePR`). Running it single-repo is *developer-pull*; looping it across N repos is *platform-push* (§5).

### 4.4 The agent flow (inside the sandbox VM)
`read repo & detect pattern → prescribe tier-4 pattern → resolve environment specifics (MCP) → generate artifacts → verify in sandbox → open PR.`

Context sources:
- **Skills** — the SME standards (the opinionated judgment).
- **MCP (HTTP transport)** — HashiCorp documentation (current API reference) and internal environment docs (namespaces, naming conventions, Vault address per environment). HTTP transport so MCP credentials are proxied and never land in the agent's VM.

### 4.5 The pull request (multi-artifact, not just app code)
This is the tell that it isn't glorified autocomplete. The PR contains:
- App diff: static connection string → injected/synced dynamic secret.
- `policy.hcl` — least-privilege.
- Auth-role configuration (Kubernetes auth).
- Consumer-side wiring — VaultStaticSecret/VaultDynamicSecret CR (VSO) or Agent Injector annotations.
- Updated deployment manifest.
- A shipped CI workflow (`.github/workflows/vault-verify.yml`) — a **durable test artifact** so the onboarding can't silently regress to static creds later.
- PR description: tier-1 → tier-4 rationale, verification evidence, advisory/roadmap flags, and the human-apply steps.

### 4.6 Two-tier verification + the feedback loop
- **Tier 1 — agent sandbox:** correct *in principle.* The agent stands up an ephemeral Vault + throwaway Postgres in its VM, applies the policy it wrote, configures the engine and auth, and proves the app pulls a dynamic credential and connects. Evidence attaches to the PR.
- **Tier 2 — team CI:** correct *in their reality.* The shipped GitHub Action runs the same verification in the team's environment, surfacing constraints no upfront doc could contain (a transaction pooler that chokes on short-TTL creds, an app that caches the connection string at boot, real namespace/SA names).

**The loop** (real environments reveal what documentation can't): the CI run emits a *structured* pass/fail-plus-diagnostics artifact — the developer authors nothing. The agent diffs intended-vs-actual and proposes a writeback, gated by a human:

- Environment-specific lesson → updates this repo's **requirements doc** (makes *this* onboarding correct).
- Generalizable lesson → proposes an update to the **Skill** (makes *every future* onboarding better). **This promotion into shared institutional knowledge is the flywheel** — it captures the tribal knowledge that today lives in an SME's head and dies when they leave.

## 5. Initiation modes
- **Developer-pull** — the dev expresses intent, the engine returns a PR. Lowest-risk; this is the core demo.
- **Platform-push** — InfoSec/platform runs the engine across N product repos via the SDK; each owning team receives a verified PR to review. This is where org-level value lives: compliance coverage without conscripting product eng. **Kickoff is a deliberate, owned action, not a cron trigger** — keeping it clear of the excluded Automations feature. This is also the axis that connects to the challenge's seeded examples: the same fan-out, pointed at an API/version delta instead of an onboarding, *is* "rebuild on a new API version" at fleet scale — and the conformance sweep (§7) is the standing version of it.

## 6. Guardrails & trust boundaries
These are the credibility of the design with a security-literate panel; state them proactively.

- **No real secrets.** The agent only ever touches an ephemeral Vault with throwaway secrets. It produces a PR; a human or CD applies it with real credentials through the normal pipeline.
- **Privilege boundary.** Privileged platform-side setup (database engine root-credential rotation, connection config) is flagged as a Vault-admin step — the agent onboards the *consumer*, it does not perform admin operations.
- **MCP credential isolation.** HTTP-transport MCP so server credentials are proxied backend-side, never present in the agent VM (stdio would expose them).
- **Authority vs labor.** Friction collapses from "spend two sprints learning Vault" to "review a verified PR and merge." The agent removes the labor, never the developer's authority over their own code.
- **Codified, not improvised, judgment.** The agent applies SME-ratified patterns to routine cases; novel or ambiguous cases escalate to a human SME. It does not manufacture security judgment.
- **Human ratification is a blast-radius control.** Encoding expertise at scale means mistakes scale too — a flawed pattern would propagate to every repo. The human gate that promotes a lesson into a shared Skill is therefore a *safety* control, not governance hygiene.

## 7. Standards composition & conflict resolution (the hard problem)
At scale, BU standards conflict — security wants lockdown, platform wants frictionless onboarding, compliance imposes residency, NetEng's egress rules fight all three. "Always considered in the build" cannot mean "concatenate every prompt and hope" — that is an unresolved merge, not governance.

- **Composition is conflict-resolution, not concatenation.** A precedence model resolves the routine cases; the agent *surfaces* irreconcilable conflicts to humans rather than silently picking a winner.
- **"Conflict" is defined narrowly:** contradictory directives in the *same decision space.* A tightening is not a conflict; a disjoint addition is not a conflict. The LLM judge depends on the precedence model to reason at all.
- **Reproducibility trade-off:** "always latest" costs reproducibility, so builds **pin to a standards version**; the conformance sweep flags drift over time.

## 8. Mapping to Cursor primitives (grounding)
| Design element | Cursor primitive |
|---|---|
| Encoded SME expertise | Skills (`.cursor/skills/`) |
| Sandbox from declared stack | `.cursor/environment.json` / Dockerfile |
| Context sources | MCP servers (HTTP transport) |
| Orchestration / fan-out | `@cursor/sdk` (`Agent.create`, cloud runtime, `autoCreatePR`) |
| Verify-before-PR | Cloud Agent isolated VM |
| Fleet / cross-repo | Multi-repo environments |
| Cost-efficient model | Composer 2 (route per task) |

## 9. Scope: demo vs slide vs extension
| Layer | Where it lives |
|---|---|
| One golden path: tier-1 app → verified PR | **Built & demoed live** |
| SME standards registry, governance CI, conflict model, feedback loop, platform-push fleet | **Architecture slide** |
| Stateful fleet / proactive conformance, GEPA layer, lifecycle triggers (§10) | **Q&A / "where it goes next"** |
| One held beat (pick one): fleet run / feedback-loop regen / add-a-standard / roadmap-flag | **Live extension** |

## 10. Limitations & how it evolves

### Limitations (honest, by design)
- **Garbage-in:** Wath is only as good as the standards and the internal env docs it's fed; the internal-docs MCP is the real dependency.
- **Sandbox fidelity:** a generated sandbox is only as faithful as the declared inputs — which is precisely why Tier-2 CI verification exists.
- **Workload-identity verification:** the in-VM verify uses a JWT stand-in for the signed-identity → role → policy → dynamic-secret flow — no Docker-in-Docker, no in-VM cluster. The literal kubernetes-auth TokenReview path is covered by Tier-2 CI in the team's real cluster. A deliberate, honest split — see build roadmap. The prescribed auth method itself is runtime-derived (K8s → kubernetes auth; Nomad → workload identity / JWT; VM → AppRole), so the design isn't K8s-bound.
- **Human in the loop is deliberate, not provisional:** the agent proposes; PR review, policy-as-code (Sentinel/OPA), and CD gate; apply stays with the team. We do not sell autonomy we wouldn't grant a real Vault integration.

### Evolution roadmap (architecture & Q&A — not demo scope)
These are the "where does this go next" answers. None of them change the 30-minute build; they are what the unit becomes at fleet scale, over time.

**A. Stateful fleet / proactive conformance.** Today Wath is a tool you invoke. The keystone evolution is giving it *state*: a registry of onboarded apps — `repo → subscribed standard + version → integration fingerprint`. Once that exists, conformance becomes proactive: a policy change merges → Wath looks up every repo subscribed to that standard → re-runs and opens remediation PRs. This is the platform-push fleet (§5) made self-activating, so developers get a genuinely hands-off experience — Wath maintains their integration over its whole lifecycle, not just at onboarding.

The autonomy is bounded by **two mandatory human gates, each protecting a different failure** — this is the core guardrail:
- **Gate 1 — the SME** merges the policy change into the standards repo. Protects the *content* of the standard (is the rule correct, does it conflict — the LLM judge assists, the human decides). A policy change is never auto-merged.
- **Gate 2 — the repo owner** merges the remediation PR into their app. Protects the *application* of the standard (does it work in my service, does it break me).

A bad policy must clear an SME *and* every affected repo owner before it reaches production anywhere — defense in depth. Two further controls keep Gate 2 honest at scale (the realistic risk is rubber-stamping 200 routine-looking PRs):
- **Verification evidence** makes the owner's review fast and confident — they're not re-reasoning about Vault, they're confirming an attached passing check.
- **Staged / canary rollout** — never open the whole fleet at once (a thundering herd is a self-inflicted incident). Roll to a canary cohort, watch verify + merge signal, then widen. A bad change surfaces in the canary before it reaches everyone.
- **Version pinning** makes it safe and legible: each repo records its standards version; a change bumps v1→v2 with a visible diff, and any repo that can't be safely updated (drift, failing tests) stays pinned and is flagged rather than receiving a broken PR.

**B. GEPA standard-optimization layer.** The standards *are* the context/prompt-engineering policy that steers the agent, so the registry runs CI on them the way an app repo runs CI on code — a **multi-signal gate over the prompt layer**. Two signals already exist: the **conflict judge** (§4.1 — does this contradict existing guidance?) and the **conformance compile** (do its assertions parse and run?). GEPA adds the third and subtlest: **steering-effectiveness** — does this prompt actually make the agent produce conformant output? — using the verify harness as the executable metric (pass/fail + diagnostics = the reward signal and traces). It proposes an optimized candidate; the SME ratifies it as intent-faithful. Critical guardrail: GEPA will Goodhart a metric — it can drift toward "whatever makes the eval repos pass" while weakening the SME's intent — so it never auto-merges, and the SME's review specifically guards intent against semantic drift. Different cost/latency profile from the conflict judge (many rollouts) → async/on-demand, not a blocking gate. Depends on the verify harness + a curated eval set, which the field-feedback loop (§4.6) feeds. A v2+ item.

**C. Lifecycle triggers beyond policy.** Once Wath holds fleet state, *policy change* is just one trigger. The same machinery handles the **upstream service shipping a breaking API change** (re-onboard the fleet to the new Vault API — this is the challenge's "rebuild on a new API version" example) and **drift detection** (an integration that no longer matches its pinned standard). This is the difference between a one-shot onboarding tool and a system that keeps a fleet of integrations continuously correct.

**D. External guidance ingestion (WAF and beyond) — auto-drafted, judge-iterated, human-ratified.** External best-practice frameworks (the HashiCorp Well-Architected Framework, and future others) enter as *contributors to the standards registry*, never as a runtime input to the onboarding agent — so they earn no privileges and inherit every existing gate. A changed framework page is just another lifecycle trigger (C). Mechanism:

1. **Watch the source, not the page.** Track the framework's open-source docs repo (clean markdown + version history = free change detection). A relevant diff is the trigger.
2. **Distill, don't paste.** An authoring agent turns the changed guidance into a *draft standard update* — imperative, ID'd rules plus conformance assertions where the guidance is mechanical — with the source page linked in the PR for provenance. Raw prose committed to the registry would just relocate the "agent improvises from prose" problem; the artifact under review is a diff of *enforceable rules*, not marketing copy.
3. **Open a PR and auto-iterate against CI.** The registry CI is the same **multi-signal gate** from (B): conflict triage (§4.1 / §7), conformance compile, and — once GEPA exists — steering-effectiveness. The authoring agent reads the *structured* CI feedback and revises automatically — the same propose → verify → iterate loop as the onboarding side, with the registry CI as its verify harness.

GEPA (B) and this ingestion loop (D) are **two producers feeding the one CI on the prompt/context layer**: GEPA *optimizes* an existing standard's steering; ingestion *drafts* a new or updated standard from external guidance. Both emit candidate standard changes, both pass the identical multi-signal gate, and both stop at SME ratification — they are the automated authors; the CI is the shared judge.

The loop's autonomy is deliberately bounded — this is the node where it would otherwise Goodhart, optimizing to silence the judge rather than to capture intent:
- **Auto-resolve only the objective, mechanical feedback:** assertions that don't compile, schema/format errors, and conflicts resolvable by the precedence model (a tightening, a disjoint addition, a scope narrowing).
- **Escalate, never silently resolve, the substantive:** an irreconcilable cross-BU conflict (security vs platform) or anything that would require *weakening* a rule to pass. It surfaces these on the PR; it never picks a winner (§7).
- **Iterations are capped, and non-convergence fails to a human** with the current draft and the unresolved feedback. The loop never thrashes, and never widens scope to escape a conflict.
- **It converges to a proposal, never a merge.** The SME gate ratifies *two* things: no conflicts (judge-assisted) and **faithful distillation** — did the draft capture what the framework actually says, without over/under-tightening or inventing a rule. Fidelity is the human's job precisely because it is the metric the loop would otherwise game; this is the GEPA Goodhart guard (B) applied to ingestion.

Net shape: **source diff → distill → PR → judge + conformance CI → bounded auto-iteration → SME ratifies fidelity & merges → versioned standard → pinned at build.** Same source of truth, same two-gate model, same reproducibility. The authoring side now mirrors the onboarding side — both propose, verify against an executable signal, iterate, and stop at a human merge — which is what lets one external framework, or ten, flow *through* the registry instead of around it.

---
*Scope boundaries for the prompt: this authors a verified integration and its test harness (SDLC) — it is not Security Review, not BugBot, and not Automations (kickoff is owned/programmatic).*
