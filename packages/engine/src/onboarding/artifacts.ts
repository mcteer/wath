import { join } from "node:path";

import type { ResolvedStandard } from "../types.js";

export const DEFAULT_PR_TEMPLATE_REPO_PATH =
  ".github/PULL_REQUEST_TEMPLATE/wath-onboarding.md";

export function resolveOnboardingConfig(standard: ResolvedStandard) {
  const onboarding = standard.metadata.onboarding;
  if (!onboarding?.artifacts?.length) {
    throw new Error(
      `Standard "${standard.entry.id}" has no onboarding.artifacts in standard.yaml`
    );
  }
  return onboarding;
}

export function standardSkillRepoPath(standard: ResolvedStandard): string {
  return join("standards", standard.entry.path, "SKILL.md");
}

export function standardSchemaRepoPath(standard: ResolvedStandard): string {
  return join("standards", standard.entry.path, standard.metadata.schema);
}

export function standardVerifyRepoPath(standard: ResolvedStandard): string {
  return join(
    "standards",
    standard.entry.path,
    standard.metadata.conformance_entry
  );
}

export function artifactChecklistMarkdown(standard: ResolvedStandard): string {
  const { artifacts } = resolveOnboardingConfig(standard);
  return artifacts.map((p) => `- [ ] \`${p}\``).join("\n");
}

export function prTemplateRepoPath(standard: ResolvedStandard): string {
  return (
    resolveOnboardingConfig(standard).pr_template ??
    DEFAULT_PR_TEMPLATE_REPO_PATH
  );
}

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
