/** Required artifacts and PR sections for onboarding PRs (Phase 5 shape). */

export const ONBOARDING_ARTIFACT_PATHS = [
  "integration.params.json",
  "vault/policy.hcl",
  "vault/auth-kubernetes-role.json",
  "k8s/vso-dynamic-secret.yaml",
  "k8s/deployment.yaml",
  ".github/workflows/vault-verify.yml",
] as const;

export const PR_TEMPLATE_REPO_PATH =
  ".github/PULL_REQUEST_TEMPLATE/wath-onboarding.md";

/** Markdown checklist embedded in the agent prompt. */
export function artifactChecklistMarkdown(): string {
  return ONBOARDING_ARTIFACT_PATHS.map((p) => `- [ ] \`${p}\``).join("\n");
}
