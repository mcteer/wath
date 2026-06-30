## Wath drift remediation — <!-- standard id -->

<!-- Registry version bump remediation — NOT first-time onboarding.
     List only files that actually changed in this PR. -->

### Summary

<!-- 1–3 sentences: registry vX → vY, what the changelog required, why each changed file was needed -->

### Service & standard

- **Service:** <!-- e.g. HashiCorp Vault (database secrets engine) -->
- **Standard:** `<!-- standard-id -->` registry v<!-- target version --> (content v<!-- content version -->)
- **App:** <!-- app name from integration.params.json -->

### Version delta

- **Recorded (ledger):** v<!-- from version -->
- **Target (registry):** v<!-- to version -->
- **Integration on `main`:** unchanged unless listed below

### Files changed in this PR

<!-- Check ONLY paths present in the git diff. Do not list artifacts already on main. -->

- [ ] <!-- path --> — <!-- one line: why this file changed for the version delta or a gate failure -->

### Artifacts unchanged on `main`

<!-- Optional: one line noting prior merge PR if integration artifacts were not regenerated -->

Integration artifacts (`integration.params.json`, `vault/*`, `k8s/*`, CI workflow) are unchanged on `main` unless listed above.

### Verification evidence

<!-- Paste verify.sh summary or embed JSON in a fenced block — do not rely on committed .wath/ files -->

- [ ] Static conformance gate passed (`verify.sh`)
- [ ] Behavioral gate passed (if Tier-1 sandbox ran)

```
<!-- paste key verify.sh output -->
```

### Vault admin prerequisites (human applies — Wath did NOT execute)

- [ ] No new admin steps required for this drift — or list any new prerequisites

### Reviewer checklist

- [ ] Diff is minimal — only what v<!-- from --> → v<!-- to --> or a gate required
- [ ] No static credentials introduced
- [ ] Verification evidence attached — reviewable, not vibes
