# Boundary one-liners (Q&A)

Short answers for common questions. Rehearse until reflexive.

## Governance

**Why doesn't Wath merge the PR?**  
Wath proposes; humans ratify. Security patterns need SME and repo-owner review — the agent is an untrusted drafter.

**What if the agent fails verify?**  
Hard stop. Fix artifacts or escalate to an SME. Never weaken the standard to make tests pass.

**Who runs Vault admin steps?**  
The platform team. Wath documents prerequisites in the PR checklist — it does not execute them.

## Verify harness

**Do you need a live Kubernetes cluster?**  
No. JWT auth stand-in proves signed identity → role → policy → dynamic secret against real Postgres. K8s wiring is validated with `kubeconform`, not applied live.

**What's the honest limitation of the JWT stand-in?**  
It does not exercise Kubernetes TokenReview against a live API server. That is Tier-2 CI in the team's real cluster.

**Why typed params first?**  
Schema bounds the agent before it free-writes HCL. Params are the source of truth for TTLs, paths, and identity binding.

## Vault analogy (Q&A only)

**How is this different from "just use Vault"?**  
Vault is the platform service. Wath is the ford — it prescribes *your app's* compliant integration, verifies it deterministically, and opens a PR your team can review. The standard encodes SME judgment; the gate enforces it.

## Extension

**Can you add another standard live?**  
Yes — add a registry entry and SKILL triplet. The engine loads standards from the catalog; it does not hardcode Vault.

**What if requirements change after merge?**  
Update `wath.json` and re-run onboarding. Tier-2 CI findings feed back through `feedback` and service config.
