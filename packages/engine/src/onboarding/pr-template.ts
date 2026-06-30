import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ResolvedStandard } from "../types.js";
import type { DriftRemediationInfo } from "../lifecycle/drift-context.js";
import { artifactPrSectionMarkdown, prTemplateRepoPath, resolveOnboardingConfig } from "./artifacts.js";

/** Default drift remediation PR template when a standard does not override. */
export const DEFAULT_DRIFT_PR_TEMPLATE_REPO_PATH =
  ".github/PULL_REQUEST_TEMPLATE/wath-drift-remediation.md";

/** Load the consumer onboarding PR template from Wath templates. */
export function loadOnboardingPrTemplate(
  wathRoot: string,
  standard: ResolvedStandard
): string {
  const repoPath = prTemplateRepoPath(standard);
  const path = join(wathRoot, "templates/consumer", repoPath);
  return readFileSync(path, "utf8");
}

export function driftPrTemplateRepoPath(standard: ResolvedStandard): string {
  return (
    resolveOnboardingConfig(standard).drift_pr_template ??
    DEFAULT_DRIFT_PR_TEMPLATE_REPO_PATH
  );
}

/** Load the drift remediation PR template from Wath templates. */
export function loadDriftPrTemplate(wathRoot: string, standard: ResolvedStandard): string {
  const repoPath = driftPrTemplateRepoPath(standard);
  const path = join(wathRoot, "templates/consumer", repoPath);
  return readFileSync(path, "utf8");
}

/** Instructions for the agent when opening the onboarding PR. */
export function prSubmissionInstructions(
  wathRoot: string,
  standard: ResolvedStandard
): string {
  const templatePath = prTemplateRepoPath(standard);
  const template = loadOnboardingPrTemplate(wathRoot, standard);
  return `## Pull request requirements (mandatory)

When opening the PR (\`autoCreatePR\`), the description MUST follow the structure of
\`${templatePath}\`. Complete every section; do not omit verification evidence
or admin prerequisites.

In **Artifacts in this PR**, use the checklist below — keep each file's purpose
(one line after the em dash). Do not reduce entries to bare filenames.

${artifactPrSectionMarkdown(standard)}

If GitHub pre-fills the template from the branch, edit it in place. Otherwise paste
the structure below into the PR body:

---
${template}
---`;
}

/** Instructions for drift remediation PRs — list only files in the diff. */
export function driftPrSubmissionInstructions(
  wathRoot: string,
  standard: ResolvedStandard,
  drift: DriftRemediationInfo
): string {
  const templatePath = driftPrTemplateRepoPath(standard);
  const template = loadDriftPrTemplate(wathRoot, standard);
  return `## Pull request requirements (drift remediation — mandatory)

This is **registry drift remediation**, not first-time onboarding.

When opening the PR (\`autoCreatePR\`), the description MUST follow \`${templatePath}\`.

**Critical:**
- In **Files changed in this PR**, check **only** paths that appear in \`git diff origin/main\`.
- Do **not** copy the full first-onboarding artifact checklist.
- Do **not** claim tier-1→tier-4 migration unless static creds were reintroduced.
- Do **not** commit \`.wath/verify-summary.json\` or \`.wath/verification-evidence.json\` — paste evidence in the PR body only.
- PR title: \`Wath drift remediation: ${drift.standardId} v${drift.toVersion} for <app>\`

Version context: ledger v${drift.fromVersion} → registry v${drift.toVersion} (standard content v${drift.contentVersion}).

If \`git diff origin/main\` shows **no integration artifact changes** (empty diff or only would-be \`.wath/\` files) after verify passes:
1. Do **not** open a PR.
2. End your response with exactly: \`DRIFT_NO_PR_REQUIRED\`

---
${template}
---`;
}
