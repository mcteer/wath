# INTEGRATION_REQUIREMENTS.md

> **Living intake for your app.** Submit this file to start or **update** a platform integration
> through Wath — first onboarding, a failed validation retry, or a stack change six months
> later. Same file, same process: Wath reads the current requirements, regenerates integration
> artifacts, runs verification, and opens a pull request to your repo for review and merge.
>
> You describe your app in business terms; Wath prescribes the compliant integration. You do
> **not** need to know Vault, write policy, or configure auth.
>
> Submit by running **`/wath-onboard`** in Cursor (or `wath onboard` via the CLI). Wath reads
> this file. Anything you leave as `<...>` that it can infer from the repo, it will; anything
> ambiguous, it will ask about rather than guess.
>
> **Sections:** Environment (where your app runs), Intent (what it needs), Constraints (gotchas
> you know upfront), Admin ack (platform steps Wath documents only), and Feedback (written back
> by the verification loop — leave blank on first submit).

---

## 1. Environment — where and how your app runs

*Drives the sandbox config (`.cursor/environment.json`) and the auth method (your runtime
decides it: Kubernetes → kubernetes auth, Nomad → workload-identity JWT, VM → AppRole).*

| Field | Your value | Notes |
|---|---|---|
| App name | `<my-service>` | lowercase, hyphenated; used for role/policy names |
| Repository | `<git url>` | the repo Wath will open the PR against |
| Owning team / contact | `<team>` / `<slack-or-email>` | who reviews and merges the PR |
| Runtime | `<kubernetes | nomad | vm>` | determines the auth method — pick one |
| Language / framework | `<e.g. Go 1.22 / Spring Boot 3>` | so the agent edits the right DB client code |
| How it talks to the DB **today** | `<e.g. static DSN in config/app.yaml>` | the static credential we're replacing |
| Config / manifest locations | `<e.g. config/app.yaml, k8s/deployment.yaml>` | where the connection + deploy live |
| Target environments | `<dev, staging, prod>` | one integration, per-environment values |

**Kubernetes only — identity binding** (skip if not on K8s):

| Field | Your value |
|---|---|
| Namespace(s) | `<e.g. payments-dev, payments-prod>` |
| Service account(s) the app runs as | `<e.g. payments-api>` |
| Secret delivery preference | `<vso | agent-injector>` (default: vso) |

**Nomad only:** job ID / namespace the workload runs under: `<...>`
**VM only:** how the host obtains identity today (cloud instance role? none?): `<...>`

> Vault address / namespace per environment is usually supplied by the platform team via
> Wath's internal config — leave blank unless you've been told otherwise: `<...>`

---

## 2. Intent — what your app needs

*Drives what the agent prescribes. Stay in your own terms; don't describe Vault objects.*

| Field | Your value | Notes |
|---|---|---|
| Datastore | `<postgres | mysql>` | the engine you need credentials for |
| Access needed | `<e.g. read+write to the `orders` schema>` | shapes least-privilege SQL grants (VDS rules) |
| Environments needed | `<dev, prod>` | must be a subset of section 1 |
| Credential lifetime tolerance | `<e.g. fine with hourly rotation>` | Wath caps TTL at 1h; flag if your app can't re-read creds |

**One sentence, plain language, of what you're trying to do:**
> `<e.g. "My orders service needs to read and write the orders database in dev and prod.">`

---

## 3. Known constraints & gotchas — *read this, it saves a failed deploy*

*These are the things upfront docs can't know and that break integrations at Tier-2 (your real
CI). Be honest here; it's cheaper than a rollback.*

- Does the app **cache the DB connection at boot** (i.e. won't pick up a rotated credential
  without a restart)? `<yes/no>`
- Is there a **connection pooler** (PgBouncer, ProxySQL) between app and DB? `<yes/no — which>`
- Any **migration / admin** path that needs elevated DB rights separate from the app? `<...>`
- Anything else that's bitten you before: `<free text>`

---

## 4. Admin prerequisites (acknowledge — Wath will NOT do these)

Wath onboards the *consumer*. The following are privileged platform steps; Wath emits them as a
checklist in the PR for the platform/Vault-admin team, and never performs them or touches a real
root credential:

- [ ] `database/` secrets engine enabled for the target environment(s)
- [ ] DB connection configured in Vault with a **root** credential (and root rotated)
- [ ] Network path open from Vault to the database

> If you don't know whether these are done, submit anyway — Wath flags the gaps in the PR.

---

## 5. Feedback — written by Wath's verification loop (leave blank on submit)

*After each validation run, Wath appends structured results here: sandbox outcomes, Tier-2 CI
findings, and gaps to fix. You may also move lessons into section 3 and re-submit. Re-run
onboarding after updating this file — the same command as the first time.*

```
<wath:feedback>
  (populated by Wath after validation runs)
</wath:feedback>
```
