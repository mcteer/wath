import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { OnboardingContext } from "../onboarding/pipeline.js";
import { parseRequirements } from "../requirements/parser.js";

/** Build the cloud agent onboarding prompt from composed context. */
export function buildOnboardingPrompt(context: OnboardingContext): string {
  const requirements = parseRequirements(context.requirementsPath);
  const standard = context.standard;
  const skillRel = join("standards", standard.entry.path, "SKILL.md");
  const verifyRel = join(standard.entry.path, "conformance", "verify.sh");

  return `# Wath onboarding run

You are a Wath cloud agent executing an onboarding run for **${standard.entry.id}**.

Follow \`templates/consumer/.cursor/rules/wath-agent-process.mdc\` stage by stage. Do not skip ahead.
Load the governing standard at \`${skillRel}\`.

## Detected context

- **Runtime:** ${context.runtime}
- **Standard:** ${standard.entry.id} v${standard.entry.version}
- **Requirements:** ${context.requirementsPath}
- **Consumer path:** ${context.consumerRepoPath}

## Requirements (summary)

**Environment:**
${JSON.stringify(requirements.environment, null, 2)}

**Intent:**
${JSON.stringify(requirements.intent, null, 2)}

## Your mission

1. **Detect** tier-1 static credentials in the consumer repo and state tier-1→tier-4 rationale.
2. **Emit** \`integration.params.json\` (schema-valid) at the consumer app root before any HCL.
3. **Render** vault policy, auth role, VSO wiring, updated k8s manifests, and CI verify workflow.
4. **Remove** all static DATABASE_URL / DSN patterns from manifests and config (VDS-001, VDS-007).
5. **Verify** by running:
   \`\`\`bash
   WATH_ARTIFACT_ROOT=<consumer-root> WATH_BEHAVIORAL=1 WATH_MANAGE_SANDBOX=1 \\
     bash standards/security/vault-dynamic-secrets/conformance/verify.sh
   \`\`\`
   A failing gate is a hard stop — fix artifacts, never weaken checks.
6. **Open one PR** with verification evidence, admin-step checklist, and SQL grant assumptions for SME ratification.

Golden params example: \`standards/security/vault-dynamic-secrets/examples/integration.params.orders-api.json\`

## Invariants

- Propose only — never merge.
- No real secrets — ephemeral/throwaway resources for verification only.
- Escalate ambiguous cases to a human SME; do not invent patterns.
`;
}

/** Load optional prompt overlay from file (for testing). */
export function loadPromptOverlay(path: string | undefined): string {
  if (!path) return "";
  return readFileSync(path, "utf8");
}
