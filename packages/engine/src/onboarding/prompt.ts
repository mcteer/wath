import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { OnboardingContext } from "../onboarding/pipeline.js";
import { parseRequirements } from "../requirements/parser.js";
import { artifactChecklistMarkdown } from "./artifacts.js";
import { prSubmissionInstructions } from "./pr-template.js";

/** Build the cloud agent onboarding prompt from composed context. */
export function buildOnboardingPrompt(context: OnboardingContext): string {
  const requirements = parseRequirements(context.requirementsPath);
  const standard = context.standard;
  const skillRel = join("standards", standard.entry.path, "SKILL.md");
  const verifyScript = join(
    "standards",
    standard.entry.path,
    "conformance",
    "verify.sh"
  );

  return `# Wath onboarding run

You are a Wath cloud agent executing an onboarding run for **${standard.entry.id}**.

Follow \`templates/consumer/.cursor/rules/wath-agent-process.mdc\` stage by stage. Do not skip ahead.
Load the governing standard at \`${skillRel}\`.

## Detected context

- **Runtime:** ${context.runtime}
- **Standard:** ${standard.entry.id} v${standard.entry.version}
- **Requirements:** ${context.requirementsPath}
- **Consumer path:** ${context.consumerRepoPath}
- **Consumer root:** ${context.consumerRoot}

## Requirements (summary)

**Environment:**
${JSON.stringify(requirements.environment, null, 2)}

**Intent:**
${JSON.stringify(requirements.intent, null, 2)}

## Required artifacts (all must appear in the PR)

${artifactChecklistMarkdown()}

Also include the **application diff** removing static credential patterns.

Golden params: \`standards/security/vault-dynamic-secrets/examples/integration.params.orders-api.json\`
Golden tier-4 layout: \`standards/security/vault-dynamic-secrets/fixtures/tier4-orders-api/\`

## Your mission

1. **Detect** tier-1 static credentials; state tier-1→tier-4 rationale explicitly.
2. **Parameterize** — emit \`integration.params.json\` (schema-valid) before any HCL.
3. **Render** all artifacts from params; match paths in the standard's §2 layout.
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

${prSubmissionInstructions(context.repoRoot)}

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
