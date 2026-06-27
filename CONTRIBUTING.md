# Contributing to Wath

Thank you for helping build Wath — an onboarding and conformance engine for platform service integrations. This project will grow into an open **service integration marketplace**; contributions that follow the patterns below keep it extensible for everyone, not just Cursor users.

## Before you start

1. Read [bootstrap.md](./bootstrap.md) for the mental model (standard triplet, two homes, invariants).
2. Read [docs/architecture/01-architecture.md](./docs/architecture/01-architecture.md) for system design.
3. For Vault work specifically, study the reference standard at `standards/security/vault-dynamic-secrets/`.

## Development setup

- Node.js 20+
- Python 3.11+ (conformance suites)
- Optional: Vault CLI, kubeconform (for running `verify.sh` locally)

```bash
git clone https://github.com/<org>/wath.git
cd wath
npm install
npm run build
```

Python deps for conformance (per standard):

```bash
pip install pytest jsonschema python-hcl2 pyyaml
```

## Branching policy (required)

**Every change must be made on a dedicated branch.** Direct commits to `main` are not accepted.

| Change type | Branch prefix | Example |
|-------------|---------------|---------|
| New feature or enhancement | `feat/` | `feat/add-nomad-workload-identity-standard` |
| Bug fix or regression | `fix/` | `fix/conformance-vds-003-wildcard-check` |
| Documentation only | `docs/` | `docs/clarify-integration-requirements` |
| Refactor / chore (no behavior change) | `chore/` | `chore/rename-standards-registry-path` |

### Rules

1. **One branch per feature or fix.** Do not combine unrelated changes.
2. **Branch from an up-to-date `main`:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/my-descriptive-title
   ```
3. **Use kebab-case** after the prefix; be specific (`feat/vault-dynamic-secrets-nomad` not `feat/update`).
4. **Bug fixes are mandatory branch work.** Even a one-line fix must use `fix/<descriptive_title>` — never push fixes directly to `main`.

## What to contribute

### Adding a new platform service (standard)

Each integration in the marketplace is a **standard triplet**:

| Artifact | Role |
|----------|------|
| `SKILL.md` | Steers the agent (SME judgment) |
| `schema/integration.params.schema.json` | Bounds typed output before artifacts |
| `conformance/verify.sh` + tests | Deterministic verification gate |

Steps:

1. Branch: `feat/<service-name>-standard`
2. Run `./scripts/scaffold-standard.sh <business-unit> <standard-id>`
3. Fill in `standard.yaml` and register the standard in `standards/registry.yaml`
4. Add a glob-scoped rule under `templates/consumer/.cursor/rules/standards/` if needed
5. Ensure `verify.sh` passes locally
6. Open a PR using the template below

**Do not weaken conformance checks to make tests pass.** Fix artifacts or escalate ambiguous cases to an SME.

### Engine / orchestrator changes

Work in `packages/engine/`. Keep standard-specific logic in `standards/`, not in the engine. The engine should load standards via the registry, not hardcode service paths.

### Consumer templates & examples

- **Templates** (`templates/consumer/`) — artifacts teams install in their repos
- **Examples** (`examples/`) — runnable demos; must stay in sync with the reference standard

## Pull request process

1. Create a branch (see above).
2. Make focused commits with clear messages.
3. Run relevant checks locally (engine build, affected standard's `conformance/verify.sh`).
4. Push and open a PR against `main` — GitHub pre-fills the description from the [pull request template](#pull-request-template) below.
5. Fill out every section of the template — incomplete PRs may not be reviewed.
6. Address review feedback on the same branch.
7. Maintainers merge after approval and green CI.

## Pull request template

Edit this section when changing the template, then run `./scripts/sync-pr-template.sh` to update the GitHub auto-fill file (`.github/PULL_REQUEST_TEMPLATE.md`).

<!-- pr-template-start -->

### Summary

<!-- 1–3 sentences: what this PR does and why -->

### Type of change

- [ ] New standard / marketplace service
- [ ] Engine / orchestrator
- [ ] Conformance / verification
- [ ] Consumer template or example
- [ ] Documentation
- [ ] Bug fix
- [ ] Other (describe):

### Standard(s) affected

<!-- e.g. vault-dynamic-secrets, or "none" -->

### Changes

<!-- Bullet list of main changes -->

### Verification

<!-- How you tested. Attach logs/evidence for conformance changes. -->

- [ ] `npm run build` passed
- [ ] Affected standard's `conformance/verify.sh` passed locally
- [ ] Example/demo still runs (if applicable)

### Breaking changes

- [ ] Yes — describe migration steps below
- [ ] No

### Checklist

- [ ] Branch follows naming convention (`feat/` or `fix/`, etc.)
- [ ] Single focused change set (no unrelated edits)
- [ ] New standards registered in `standards/registry.yaml`
- [ ] Conformance tests follow 1:1 rule→test naming (e.g. `test_VDS_003_…`)
- [ ] No real secrets, credentials, or environment-specific tokens committed
- [ ] Documentation updated where behavior changed

<!-- pr-template-end -->

## Questions

Open a GitHub issue with the `question` label. For novel security patterns not covered by an existing standard, **escalate to an SME** rather than improvising in a PR.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](./LICENSE)).
