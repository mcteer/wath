import type { OnboardingContext } from "../onboarding/pipeline.js";
import { deriveAuthMethod } from "../requirements/parser.js";
import {
  artifactChecklistMarkdown,
  goldenReferenceLines,
  standardSkillRepoPath,
  standardVerifyRepoPath,
} from "../onboarding/artifacts.js";
import { prSubmissionInstructions, driftPrSubmissionInstructions } from "../onboarding/pr-template.js";
import { resolveStandard } from "../standards/registry.js";
import type { DriftRemediationInfo } from "./drift-context.js";

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

function driftDeltaBlock(drift: DriftRemediationInfo): string {
  const lines = [
    `- **Recorded version (ledger):** v${drift.fromVersion}`,
    `- **Target registry version:** v${drift.toVersion}`,
    `- **Standard content version (standard.yaml):** v${drift.contentVersion}`,
  ];
  if (drift.versionNotes) {
    lines.push("", "## Version notes (registry)", drift.versionNotes);
  }
  if (drift.targetChangelog) {
    lines.push("", "## Changelog for v" + drift.toVersion, drift.targetChangelog);
  }
  if (!drift.versionNotes && !drift.targetChangelog) {
    lines.push(
      "",
      "_No version-specific changelog documented — assume minimal diff: run conformance first and fix only what the gate reports._"
    );
  }
  return lines.join("\n");
}

/** Drift remediation — minimal diff against main; do not regenerate unchanged artifacts. */
export function buildDriftRemediatePrompt(
  context: OnboardingContext,
  drift: DriftRemediationInfo
): string {
  const spec = context.wathSpec;
  const standard = resolveStandard(context.repoRoot, drift.standardId);
  const skillRel = standardSkillRepoPath(standard);
  const authMethod = deriveAuthMethod(context.runtime);
  const ruleList = standard.metadata.rules.join(", ");

  return `# Wath drift remediation — ${drift.standardId}

**This is a version-drift remediation run — NOT first-time onboarding.**

The integration was previously merged at registry **v${drift.fromVersion}**. The Wath registry now requires **v${drift.toVersion}**.

Follow \`templates/consumer/.cursor/rules/wath-agent-process.mdc\`.
Load the governing standard at \`${skillRel}\`.

## Version delta

${driftDeltaBlock(drift)}

## Critical — minimal diff (do not re-integrate from scratch)

1. **Start from \`main\`** — the consumer repo already has merged integration artifacts. Read what is on \`main\` before changing anything.
2. **Diff first** — compare \`main\` against the version changelog above. **Do NOT regenerate** \`vault/policy.hcl\`, \`integration.params.json\`, or other artifacts that already satisfy the standard on \`main\` unless conformance fails on them.
3. **Conformance-driven fixes only** — run the verify gates on existing artifacts first. Change only files the gate reports as failing or that the changelog explicitly requires for v${drift.toVersion}.
4. **No spurious duplication** — do not add Deployments, policies, or CRs that duplicate what \`main\` already has unless a gate proves a namespace or rule is uncovered.
5. **One integration branch** — commit only necessary fixes. **Do not open a PR yet** — validation runs next.

## Context
- **Runtime:** ${context.runtime}
- **Auth method:** ${authMethod}
- **Standard:** ${drift.standardId} registry v${drift.toVersion} / content v${drift.contentVersion} (${ruleList})
- **Target repo:** ${spec.repo}

## wath.json
\`\`\`json
${specJsonBlock(context)}
\`\`\`

## Required artifacts (verify on main first; regenerate only if failing)

${artifactChecklistMarkdown(standard)}

${goldenReferenceLines(standard)}

## Steps
1. Check out \`main\` and inventory existing integration artifacts.
2. Run conformance mentally or via verify — list gaps only.
3. Apply **minimal** fixes for v${drift.fromVersion} → v${drift.toVersion} (or gate failures).
4. Push commits to **one integration branch** — do not open a PR.
`;
}

/** Validation agent — run gates and open integration PR on pass. */
export function buildValidatePrompt(
  context: OnboardingContext,
  standardId: string,
  workBranch?: string,
  options: {
    sameAgentSession?: boolean;
    driftRemediation?: DriftRemediationInfo;
    verifyOnMain?: boolean;
  } = {}
): string {
  const spec = context.wathSpec;
  const standard = resolveStandard(context.repoRoot, standardId);
  const verifyScript = standardVerifyRepoPath(standard);

  const verifyOnMainBlock =
    options.verifyOnMain && options.driftRemediation
      ? `
## Drift verify on main (critical)

Registry **v${options.driftRemediation.fromVersion} → v${options.driftRemediation.toVersion}** — verify existing artifacts on \`main\` first.

- Check out and stay on **\`main\`** — **do NOT create a \`cursor/*\` branch** unless you must commit integration artifact fixes.
- Run verify gates on artifacts already on \`main\`; change only what a failing gate or the version changelog requires.
- Do **not** commit \`.wath/*\` — paste verify evidence only if you open a PR.
- If verify passes and \`git diff origin/main\` has **no integration artifact changes**, end with \`DRIFT_NO_PR_REQUIRED\` — **no branch, no PR**.
- If fixes are required, create **one** integration branch, apply minimal fixes, then open a PR with \`gh pr create\` using the drift template below.
`
      : "";

  const branchBlock = options.verifyOnMain
    ? ""
    : options.sameAgentSession
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

  const driftBlock =
    verifyOnMainBlock ||
    (options.driftRemediation
      ? `
## Drift remediation (critical)

Registry **v${options.driftRemediation.fromVersion} → v${options.driftRemediation.toVersion}** — minimal diff only.

- Run verify gates on \`main\` or the integration branch.
- Change only what the version changelog or a failing gate requires.
- Do **not** commit \`.wath/*\` — paste verify evidence in the PR body.
- If verify passes and \`git diff origin/main\` has **no integration artifact changes**, do **not** open a PR; end with \`DRIFT_NO_PR_REQUIRED\`.
`
      : "");

  const prInstructions = options.driftRemediation
    ? driftPrSubmissionInstructions(context.repoRoot, standard, options.driftRemediation)
    : prSubmissionInstructions(context.repoRoot, standard);

  const goalLine = options.verifyOnMain
    ? `Verify registry drift for **${standardId}** on \`main\`. Open a PR **only** if integration artifacts must change.`
    : `Verify the integration for **${standardId}** and open **one integration PR** on success.`;

  return `# Wath validation — ${standardId}

${goalLine}
${branchBlock}${driftBlock}
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
1. Paste \`.wath/verify-summary.json\` evidence in the PR body (do not commit \`.wath/\` on drift runs).
2. Open one PR${workBranch ? ` from \`${workBranch}\`` : ""} to \`${spec.repo}\` **only when integration files changed vs \`main\`**.
3. Use the PR template below.

${prInstructions}

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
  attempt: number,
  options: { driftRemediation?: DriftRemediationInfo } = {}
): string {
  const spec = context.wathSpec;
  const standard = resolveStandard(context.repoRoot, standardId);

  const prInstructions = options.driftRemediation
    ? driftPrSubmissionInstructions(context.repoRoot, standard, options.driftRemediation)
    : prSubmissionInstructions(context.repoRoot, standard);

  const title = options.driftRemediation
    ? `Wath drift remediation: ${standardId} v${options.driftRemediation.toVersion} for <app from integration.params.json>`
    : `Wath onboarding: ${standardId} for <app from integration.params.json>`;

  return `# Wath PR creation retry (attempt ${attempt})

Integration and verification on **${standardId}** are already on branch \`${workBranch}\`.

**Do NOT** re-integrate, re-run the full conformance suite, or create a new branch.

## Required action

Verification is already complete on \`${workBranch}\`. **Do NOT run \`gh pr create\`.**

Ensure Cursor opens **one PR** via \`autoCreatePR\` with title \`${title}\`.
Complete the PR description per the template below (include verify evidence pasted in the body — do not commit \`.wath/\` on drift runs).

${prInstructions}

## Response

End with the PR URL (e.g. \`https://github.com/.../pull/N\`) once Cursor has opened the pull request, or \`DRIFT_NO_PR_REQUIRED\` if the diff vs \`main\` is empty.
`;
}

/** Re-export legacy full onboarding prompt for single-shot runs. */
export { buildOnboardingPrompt } from "../onboarding/prompt.js";
