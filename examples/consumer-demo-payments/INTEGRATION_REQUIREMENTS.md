# Integration requirements — payments-api (fleet demo)

## 1. Environment

| Field | Value |
|-------|-------|
| Runtime | `kubernetes` |
| Cluster | `prod-us-east-1` |
| Namespace | `payments` |
| Service account | `payments-api` |
| Database | PostgreSQL 15 |

## 2. Intent

| Field | Value |
|-------|-------|
| Application | `payments-api` — settlement processing |
| Secret need | Dynamic PostgreSQL credentials via Vault |
| Delivery | Vault Secrets Operator |
| Target tier | Tier-4 dynamic database secrets |

## 3. Known constraints

- PCI scope — no secrets in logs or manifests.
- No static credentials anywhere in repo.

## 4. Out of scope

- Vault cluster admin steps (document in PR only)
