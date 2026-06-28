import type { OnboardingContext } from "../onboarding/pipeline.js";
import { deriveAuthMethod } from "../requirements/parser.js";
import {
  artifactChecklistMarkdown,
  goldenReferenceLines,
  standardSkillRepoPath,
  standardVerifyRepoPath,
} from "../onboarding/artifacts.js";
import { prSubmissionInstructions } from "../onboarding/pr-template.js";
import { resolveStandard } from "../standards/registry.js";

function specJsonBlock(context: OnboardingContext): string {
  const spec = context.wathSpec;
  return JSON.stringify(
    {
      repo: spec.repo,
      contact: spec.contact,
      stack: spec.stack,
      services: spec.services,
      feedback: spec.feedback,
    },
    null,
    2
  );
}

/** Manifest enrichment — PR must touch wath.json only. */
export function buildManifestEnrichmentPrompt(context: OnboardingContext): string {
  const spec = context.wathSpec;
  return `# Wath manifest enrichment

Analyze the repository and **propose updates to wath.json only**.

## Target repo
${spec.repo}

## Current wath.json
\`\`\`json
${specJsonBlock(context)}
\`\`\`

## Your mission

1. **Detect** — scan the repo: runtime, languages, app components, datastores, existing credentials/anti-patterns.
2. **Enrich wath.json** — fill missing \`stack\`, \`stack.applications\`, and per-service blocks under \`services\`. Use plain language for app purposes.
3. **Do not** generate integration artifacts, Vault policy, or application code in this run.
4. **Open one PR** that changes **only** \`wath.json\` (and optionally appends to \`feedback\` with findings).
5. PR title: \`wath: enrich integration manifest\`

## Invariants
- Propose only — never merge.
- No real secrets in the manifest.
`;
}

/** Integration agent — params + artifacts; defer PR until validate phase. */
export function buildIntegratePrompt(
  context: OnboardingContext,
  standardId: string
): string {
  const spec = context.wathSpec;
  const standard = resolveStandard(context.repoRoot, standardId);
  const skillRel = standardSkillRepoPath(standard);
  const authMethod = deriveAuthMethod(context.runtime);
  const ruleList = standard.metadata.rules.join(", ");

  return `# Wath integration — ${standardId}

Generate integration artifacts for **${standardId}** only. **Do not open a PR yet** — validation runs next.

Follow \`templates/consumer/.cursor/rules/wath-agent-process.mdc\`.
Load the governing standard at \`${skillRel}\`.

## Context
- **Runtime:** ${context.runtime}
- **Auth method:** ${authMethod}
- **Standard:** ${standardId} v${standard.entry.version} (${ruleList})
- **Consumer root:** ${context.consumerRoot}
- **Target repo:** ${spec.repo}

## wath.json
\`\`\`json
${specJsonBlock(context)}
\`\`\`

## Required artifacts (write to workspace, no PR)

${artifactChecklistMarkdown(standard)}

Also update the **application** to remove anti-patterns the standard flags.

${goldenReferenceLines(standard)}

## Steps
1. Detect anti-patterns.
2. Emit \`integration.params.json\` (schema-valid) first.
3. Render all standard artifacts from params.
4. Push all commits to **one integration branch** — do not open a PR.
`;
}

/** Validation agent — run gates and open integration PR on pass. */
export function buildValidatePrompt(
  context: OnboardingContext,
  standardId: string,
  workBranch?: string,
  options: { sameAgentSession?: boolean } = {}
): string {
  const spec = context.wathSpec;
  const standard = resolveStandard(context.repoRoot, standardId);
  const verifyScript = standardVerifyRepoPath(standard);

  const branchBlock = options.sameAgentSession
    ? `
## Same agent session (critical)

You are continuing on the **same branch** where integration just finished.

- **Do NOT create a new branch.**
- Run verify gates on the current branch; fix failures in place if needed.
- **Do NOT run \`gh pr create\`** — Cursor opens the PR via \`autoCreatePR\` when validation succeeds. Complete the PR description using the onboarding template below.
`
    : workBranch
      ? `
## Integration branch (required)

Integration commits are on **\`${workBranch}\`**.

- Check out \`${workBranch}\` — **do not create a new branch**.
- Run verify gates on that branch; fix failures in place if needed.
- **Do NOT run \`gh pr create\`** — Cursor opens the PR via \`autoCreatePR\`. Use the onboarding PR template for the description.
`
      : "";

  return `# Wath validation — ${standardId}

Verify the integration for **${standardId}** and open **one integration PR** on success.
${branchBlock}
## Target repo
${spec.repo}

## Verify commands (hard stop on failure — fix and re-run)

\`\`\`bash
cd ${context.repoRoot}
WATH_ARTIFACT_ROOT=${context.consumerRoot} \\
  bash ${verifyScript}
WATH_ARTIFACT_ROOT=${context.consumerRoot} WATH_BEHAVIORAL=1 WATH_MANAGE_SANDBOX=1 \\
  bash ${verifyScript}
\`\`\`

## On pass
1. Attach \`.wath/verify-summary.json\` evidence in the PR body.
2. Open one PR${workBranch ? ` from \`${workBranch}\`` : ""} to \`${spec.repo}\` with all integration artifacts + app diff.
3. Use the onboarding PR template.

${prSubmissionInstructions(context.repoRoot, standard)}

## On failure
- Fix artifacts and re-verify (max reasonable iterations).
- Append findings to \`wath.json\` \`feedback.${standardId}\` if blocked.

## Invariants
- Propose only — never merge.
- No real secrets.
`;
}

/** Retry after validate finished but PR URL was not returned. */
export function buildCreatePrRetryPrompt(
  context: OnboardingContext,
  standardId: string,
  workBranch: string,
  attempt: number
): string {
  const spec = context.wathSpec;
  const standard = resolveStandard(context.repoRoot, standardId);

  return `# Wath PR creation retry (attempt ${attempt})

Integration and verification on **${standardId}** are already on branch \`${workBranch}\`.

**Do NOT** re-integrate, re-run the full conformance suite, or create a new branch.

## Required action

Verification is already complete on \`${workBranch}\`. **Do NOT run \`gh pr create\`.**

Ensure Cursor opens **one PR** via \`autoCreatePR\` with title \`Wath onboarding: ${standardId} for <app from integration.params.json>\`.
Complete the PR description per the onboarding template (include \`.wath/verify-summary.json\` evidence if present).

${prSubmissionInstructions(context.repoRoot, standard)}

## Response

End with the PR URL (e.g. \`https://github.com/.../pull/N\`) once Cursor has opened the pull request.
`;
}

/** Re-export legacy full onboarding prompt for single-shot runs. */
export { buildOnboardingPrompt } from "../onboarding/prompt.js";
