# INTEGRATION_REQUIREMENTS.md

> **Living intake** for this app. Submit (or re-submit after edits) to run Wath onboarding —
> first integration, validation retry, or a requirements change later. Wath reads this file,
> validates, generates integration artifacts, and opens a PR to the repository below.
>
> Submit via **`wath onboard ./examples/consumer-demo`** from the repo root (or `@wath onboard` in Cursor).

---

## 1. Environment — where and how your app runs

| Field | Your value | Notes |
|---|---|---|
| App name | `orders-api` | lowercase, hyphenated; used for role/policy names |
| Repository | `https://github.com/mcteer/wath` | monorepo; demo lives at `examples/consumer-demo/` |
| Owning team / contact | `payments` / `payments@example.com` | who reviews and merges the PR |
| Runtime | `kubernetes` | determines the auth method |
| Language / framework | `Python 3.12 / FastAPI` | |
| How it talks to the DB **today** | `DATABASE_URL` env var with static `postgres://user:pass@host/db` DSN; also documented in `config/app.yaml` | the static credential we're replacing |
| Config / manifest locations | `config/app.yaml`, `k8s/deployment.yaml`, `.env.example` | |
| Target environments | `dev, prod` | |

**Kubernetes only — identity binding:**

| Field | Your value |
|---|---|
| Namespace(s) | `payments-dev`, `payments-prod` |
| Service account(s) the app runs as | `orders-api` |
| Secret delivery preference | `vso` |

---

## 2. Intent — what your app needs

| Field | Your value | Notes |
|---|---|---|
| Datastore | `postgres` | |
| Access needed | `read+write to the orders schema` | SELECT/INSERT on `orders.orders` |
| Environments needed | `dev, prod` | |
| Credential lifetime tolerance | `fine with hourly rotation` | app re-reads DATABASE_URL on each request |

**One sentence, plain language, of what you're trying to do:**
> My orders service needs to read and write the orders database in dev and prod.

---

## 3. Known constraints & gotchas

- Does the app **cache the DB connection at boot**? `no` — opens a connection per request
- Is there a **connection pooler** between app and DB? `no`
- Any **migration / admin** path that needs elevated DB rights separate from the app? `no`
- Anything else that's bitten you before: `none`

---

## 4. Admin prerequisites (acknowledge — Wath will NOT do these)

- [ ] `database/` secrets engine enabled for the target environment(s)
- [ ] DB connection configured in Vault with a **root** credential (and root rotated)
- [ ] Network path open from Vault to the database

---

## 5. Feedback — written by Wath's verification loop (leave blank on submit)

```
<wath:feedback>
  (populated by Wath after validation runs)
</wath:feedback>
```
