import { readFileSync } from "node:fs";

import type { OnboardingContext } from "../onboarding/pipeline.js";
import { deriveAuthMethod, parseRequirements } from "../requirements/parser.js";
import {
  artifactChecklistMarkdown,
  goldenReferenceLines,
  standardSkillRepoPath,
  standardVerifyRepoPath,
} from "./artifacts.js";
import { prSubmissionInstructions } from "./pr-template.js";

/** Build the cloud agent onboarding prompt from composed context. */
export function buildOnboardingPrompt(context: OnboardingContext): string {
  const requirements = parseRequirements(context.requirementsPath);
  const standard = context.standard;
  const skillRel = standardSkillRepoPath(standard);
  const verifyScript = standardVerifyRepoPath(standard);
  const authMethod = deriveAuthMethod(context.runtime);
  const ruleList = standard.metadata.rules.join(", ");

  return `# Wath onboarding run

You are a Wath cloud agent executing an onboarding run for **${standard.entry.id}**.

Follow \`templates/consumer/.cursor/rules/wath-agent-process.mdc\` stage by stage. Do not skip ahead.
Load the governing standard at \`${skillRel}\`.

## Detected context

- **Runtime:** ${context.runtime}
- **Auth method (from requirements):** ${authMethod}
- **Standard:** ${standard.entry.id} v${standard.entry.version} (rules: ${ruleList})
- **Requirements:** ${context.requirementsPath}
- **Consumer path:** ${context.consumerRepoPath}
- **Consumer root:** ${context.consumerRoot}

## Requirements (summary)

**Environment:**
${JSON.stringify(requirements.environment, null, 2)}

**Intent:**
${JSON.stringify(requirements.intent, null, 2)}

${
  requirements.constraints.length
    ? `**Constraints:**\n${requirements.constraints.map((c) => `- ${c}`).join("\n")}\n`
    : ""
}
## Required artifacts (all must appear in the PR)

${artifactChecklistMarkdown(standard)}

Also include the **application diff** removing any anti-patterns the standard flags.

${goldenReferenceLines(standard)}

## Your mission

1. **Detect** — read the repo and requirements; identify anti-patterns the standard's SKILL prescribes replacing.
2. **Parameterize** — emit \`integration.params.json\` (schema-valid) before any rendered config.
3. **Render** all artifacts from params; match paths in the standard's artifact layout (SKILL §2).
4. **Verify** — hard stop on failure:
   \`\`\`bash
   cd ${context.repoRoot}
   WATH_ARTIFACT_ROOT=${context.consumerRoot} \\
     bash ${verifyScript}
   WATH_ARTIFACT_ROOT=${context.consumerRoot} WATH_BEHAVIORAL=1 WATH_MANAGE_SANDBOX=1 \\
     bash ${verifyScript}
   \`\`\`
5. **Attach evidence** — reference \`.wath/verify-summary.json\` and behavioral output in the PR.
6. **Open one PR** using the onboarding PR template (Stage 6).

${prSubmissionInstructions(context.repoRoot, standard)}

## Invariants

- Propose only — never merge.
- No real secrets — ephemeral resources for verification only.
- Escalate ambiguous cases to a human SME.
`;
}

/** Load optional prompt overlay from file (for testing). */
export function loadPromptOverlay(path: string | undefined): string {
  if (!path) return "";
  return readFileSync(path, "utf8");
}
