# Integration requirements — Nomad runtime variant

Prepped extension target: change **Runtime** to `nomad` and re-run onboarding. Auth method becomes JWT (Nomad workload identity) per the vault-dynamic-secrets standard.

Copy this file to `INTEGRATION_REQUIREMENTS.md` in a consumer repo, or use:

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo-nomad \
  --requirements-path ./examples/consumer-demo-nomad/INTEGRATION_REQUIREMENTS.md
```

---

## 1. Environment

| Field | Value |
|-------|-------|
| Runtime | `nomad` |
| Nomad namespace | `default` |
| Nomad job | `orders-api` |
| Vault address | `https://vault.example.com` |
| Database | PostgreSQL 15 (local dev: docker-compose) |

## 2. Intent

| Field | Value |
|-------|-------|
| Application | `orders-api` — order CRUD API |
| Secret need | Dynamic PostgreSQL credentials via Vault database secrets engine |
| Delivery | Vault Agent sidecar with template injection |
| Target tier | Tier-4 dynamic database secrets |

## 3. Known constraints

- No static credentials in job spec, env, or source.
- Job must bind to a Nomad workload identity claim Vault trusts (JWT auth).

## 4. Out of scope (admin / platform)

- Vault JWT auth method configuration for Nomad
- Database secrets engine role creation in production
