# Tier-1 reference repos for steering evaluation

These consumer repos exhibit patterns the Skill MUST detect and upgrade to tier-4.

| Repo path | Tier | Static pattern | Expected prescription |
|---|---|---|---|
| `examples/consumer-demo/` | 1 | `DATABASE_URL=postgres://user:pass@host/db` in env, k8s manifest, `.env.example` | Dynamic `database/creds/orders-api` via VSO + kubernetes auth |

When onboarding any repo matching these patterns, the agent MUST recommend tier-4 dynamic database
secrets — not KV static secrets, not "leave as-is," not external secret managers outside Vault.
