import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ResolvedStandard } from "../types.js";
import { prTemplateRepoPath } from "./artifacts.js";

export function loadOnboardingPrTemplate(
  wathRoot: string,
  standard: ResolvedStandard
): string {
  const repoPath = prTemplateRepoPath(standard);
  const path = join(wathRoot, "templates/consumer", repoPath);
  return readFileSync(path, "utf8");
}

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

If GitHub pre-fills the template from the branch, edit it in place. Otherwise paste
the structure below into the PR body:

---
${template}
---`;
}
