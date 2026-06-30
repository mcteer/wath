import type { AgentLaunchResult } from "../agent/client.js";
import {
  listBranchDiffFiles,
  meaningfulIntegrationDiffPaths,
} from "../github/compare-branch.js";
import { deleteRemoteBranch } from "../github/delete-branch.js";
import { resolveGitHubToken } from "../github/token.js";
import type { DriftRemediationInfo } from "./drift-context.js";
import { recordAgentPr, recordDriftResolvedWithoutPr } from "./merge.js";
import type { ApplicationState } from "./types.js";

/** Agent signals verify passed with no artifact delta — ledger bump only. */
export const DRIFT_NO_PR_REQUIRED = "DRIFT_NO_PR_REQUIRED";

export function agentSignaledDriftNoPr(agentResult: AgentLaunchResult): boolean {
  return Boolean(agentResult.result?.includes(DRIFT_NO_PR_REQUIRED));
}

async function branchHasMeaningfulDriftDiff(
  repoUrl: string,
  branch: string
): Promise<boolean | null> {
  try {
    const token = resolveGitHubToken();
    const files = await listBranchDiffFiles(repoUrl, branch, "main", token);
    return meaningfulIntegrationDiffPaths(files).length > 0;
  } catch (err) {
    console.error(
      `[wath] drift diff check failed for ${branch}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

async function cleanupOrphanDriftBranch(
  repoUrl: string,
  branch: string | undefined
): Promise<void> {
  if (!branch || branch === "main" || branch === "master") return;
  try {
    await deleteRemoteBranch(repoUrl, branch, resolveGitHubToken());
    console.error(`[wath] deleted orphan drift branch ${branch}`);
  } catch (err) {
    console.error(
      `[wath] failed to delete orphan drift branch ${branch}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

export type FinalizeValidateOutcome =
  | { kind: "pr_opened"; state: ApplicationState; prUrl: string }
  | { kind: "drift_no_pr"; state: ApplicationState }
  | { kind: "pr_missing"; state: ApplicationState };

/** After validate: open PR, bump ledger on no-op drift, or report PR failure. */
export async function finalizeIntegrationValidate(input: {
  appId: string;
  standardId: string;
  repoUrl: string;
  driftRemediation?: DriftRemediationInfo | null;
  agentResult: AgentLaunchResult;
  workBranch?: string;
  state: ApplicationState;
}): Promise<FinalizeValidateOutcome> {
  const { appId, standardId, repoUrl, driftRemediation, agentResult, state } = input;
  const branch = agentResult.branch ?? input.workBranch;

  if (driftRemediation) {
    const agentNoPr = agentSignaledDriftNoPr(agentResult);
    const meaningfulDiff = branch ? await branchHasMeaningfulDriftDiff(repoUrl, branch) : null;

    if (agentNoPr || meaningfulDiff === false) {
      if (agentResult.prUrl) {
        console.error(
          `[wath] drift verify passed with no meaningful diff — ignoring PR ${agentResult.prUrl}, ledger → v${driftRemediation.toVersion}`
        );
      } else {
        console.error(
          `[wath] drift resolved without PR for ${appId} — ledger → v${driftRemediation.toVersion}`
        );
      }
      await cleanupOrphanDriftBranch(repoUrl, branch);
      return {
        kind: "drift_no_pr",
        state: recordDriftResolvedWithoutPr(appId, standardId, driftRemediation.toVersion),
      };
    }
  }

  if (agentResult.prUrl) {
    return {
      kind: "pr_opened",
      prUrl: agentResult.prUrl,
      state: recordAgentPr(appId, "integration", agentResult.prUrl, standardId),
    };
  }

  return { kind: "pr_missing", state };
}
