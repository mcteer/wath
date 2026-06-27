# Integration requirements — feedback-loop example (v2)

Use this when simulating a **Tier-2 CI finding** that requires re-onboarding. Copy relevant sections into the consumer repo's `INTEGRATION_REQUIREMENTS.md` and re-run `wath onboard`.

---

## 1. Environment

| Field | Value |
|-------|-------|
| Runtime | `kubernetes` |
| Cluster | `prod-us-east-1` |
| Namespace | `payments` |
| Service account | `payments-api` |
| Database | PostgreSQL 15 (RDS) |
| Connection pooler | **PgBouncer (transaction mode)** |

## 2. Intent

| Field | Value |
|-------|-------|
| Application | `payments-api` — processes card settlements |
| Secret need | Dynamic PostgreSQL credentials via Vault database secrets engine |
| Delivery | Vault Secrets Operator (`VaultDynamicSecret`) |
| Target tier | Tier-4 dynamic database secrets |

## 3. Known constraints

- **PgBouncer transaction pooling (NEW — Tier-2 finding):** The database sits behind PgBouncer in *transaction* pooling mode. Session-level features (`SET ROLE`, long-lived prepared statements tied to session) may not work. Dynamic creds must use connection strings compatible with transaction pooling; document any SQL grant assumptions for SME review.
- No static credentials in manifests, env, or source — VDS-001 applies.
- TTL default ≤ 30 minutes per security policy.

## 4. Out of scope (admin / platform)

- Vault cluster provisioning, database secrets engine mount configuration
- Kubernetes auth backend enablement on the Vault cluster
- Creating the Vault policy or role in production (document steps in PR only)

---

**What changes for the agent:** Stage 1 re-detects the pooler constraint; Stage 3 params may need shorter TTL or delivery adjustments; Stage 4 app diff may switch to pooler-compatible connection handling; PR must call out the PgBouncer assumption explicitly.
