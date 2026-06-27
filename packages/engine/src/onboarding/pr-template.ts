import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PR_TEMPLATE_REPO_PATH } from "./artifacts.js";

/** Load the consumer onboarding PR template from Wath templates. */
export function loadOnboardingPrTemplate(wathRoot: string): string {
  const path = join(
    wathRoot,
    "templates/consumer",
    PR_TEMPLATE_REPO_PATH
  );
  return readFileSync(path, "utf8");
}

/** Instructions for the agent when opening the onboarding PR. */
export function prSubmissionInstructions(wathRoot: string): string {
  const template = loadOnboardingPrTemplate(wathRoot);
  return `## Pull request requirements (mandatory)

When opening the PR (\`autoCreatePR\`), the description MUST follow the structure of
\`${PR_TEMPLATE_REPO_PATH}\`. Complete every section; do not omit verification evidence
or admin prerequisites.

If GitHub pre-fills the template from the branch, edit it in place. Otherwise paste
the structure below into the PR body:

---
${template}
---`;
}
