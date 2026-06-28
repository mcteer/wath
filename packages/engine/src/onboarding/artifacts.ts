import { join } from "node:path";

import type { ResolvedStandard } from "../types.js";

/** Default PR template path when a standard does not override onboarding.pr_template. */
export const DEFAULT_PR_TEMPLATE_REPO_PATH =
  ".github/PULL_REQUEST_TEMPLATE/wath-onboarding.md";

/** Load onboarding.artifacts and related metadata from standard.yaml. */
export function resolveOnboardingConfig(standard: ResolvedStandard) {
  const onboarding = standard.metadata.onboarding;
  if (!onboarding?.artifacts?.length) {
    throw new Error(
      `Standard "${standard.entry.id}" has no onboarding.artifacts in standard.yaml`
    );
  }
  return onboarding;
}

/** Repo-relative path to the governing SKILL.md. */
export function standardSkillRepoPath(standard: ResolvedStandard): string {
  return join("standards", standard.entry.path, "SKILL.md");
}

/** Repo-relative path to the params schema. */
export function standardSchemaRepoPath(standard: ResolvedStandard): string {
  return join("standards", standard.entry.path, standard.metadata.schema);
}

/** Repo-relative path to verify.sh. */
export function standardVerifyRepoPath(standard: ResolvedStandard): string {
  return join(
    "standards",
    standard.entry.path,
    standard.metadata.conformance_entry
  );
}

/** Markdown checklist embedded in the agent onboarding prompt. */
export function artifactChecklistMarkdown(
  standard: ResolvedStandard,
  options: { includePurpose?: boolean } = {}
): string {
  const onboarding = resolveOnboardingConfig(standard);
  const { artifacts, artifact_purposes: purposes } = onboarding;
  return artifacts
    .map((path) => {
      const purpose = purposes?.[path];
      if (options.includePurpose && purpose) {
        return `- [ ] \`${path}\` — ${purpose}`;
      }
      return `- [ ] \`${path}\``;
    })
    .join("\n");
}

/** Artifact checklist with purposes — for PR body "Artifacts in this PR" section. */
export function artifactPrSectionMarkdown(standard: ResolvedStandard): string {
  const checklist = artifactChecklistMarkdown(standard, { includePurpose: true });
  return `${checklist}
- [ ] **Application code changes** — remove static credential reads; keep env var names if VSO populates them (VDS-001)
- [ ] **Removed static secrets** — no committed \`Secret\` manifests, DSNs, or passwords in compose/env files`;
}

/** PR template path inside the consumer repo. */
export function prTemplateRepoPath(standard: ResolvedStandard): string {
  return (
    resolveOnboardingConfig(standard).pr_template ??
    DEFAULT_PR_TEMPLATE_REPO_PATH
  );
}

/** Optional golden reference paths for the agent prompt. */
export function goldenReferenceLines(standard: ResolvedStandard): string {
  const onboarding = resolveOnboardingConfig(standard);
  const lines: string[] = [];
  if (onboarding.golden_params) {
    lines.push(
      `Golden params: \`standards/${standard.entry.path}/${onboarding.golden_params}\``
    );
  }
  if (onboarding.golden_fixture) {
    lines.push(
      `Golden reference layout: \`standards/${standard.entry.path}/${onboarding.golden_fixture}/\``
    );
  }
  return lines.join("\n");
}
