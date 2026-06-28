import { discoverIntegrateBranch } from "../agent/discover-branch.js";
import { listOpenWathPrs } from "../github/discover-open-prs.js";
import { resolveGitHubToken } from "../github/token.js";
import { hasAwaitableOpenPr } from "./phase.js";
import { appendHistory, saveApplicationState } from "./state.js";
import type { ApplicationState } from "./types.js";

export interface ReconcileResult {
  updated: boolean;
  openPrUrl?: string;
  workBranch?: string;
}

function cloneState(state: ApplicationState): ApplicationState {
  return {
    ...state,
    integrations: Object.fromEntries(
      Object.entries(state.integrations).map(([id, entry]) => [id, { ...entry }])
    ),
  };
}

function resolvePrStandardId(
  pr: { standardId?: string },
  openPrs: Array<{ standardId?: string }>,
  driftOrPendingIds: string[],
  hint?: string
): string | undefined {
  if (pr.standardId && driftOrPendingIds.includes(pr.standardId)) return pr.standardId;
  if (hint && driftOrPendingIds.includes(hint)) return hint;
  if (openPrs.length === 1 && driftOrPendingIds.length === 1) return driftOrPendingIds[0];
  if (driftOrPendingIds.length === 1) return driftOrPendingIds[0];
  return pr.standardId;
}

function driftOrPendingIds(state: ApplicationState): string[] {
  return Object.entries(state.integrations)
    .filter(
      ([, entry]) =>
        entry.compliance === "drift" ||
        entry.status === "pending" ||
        entry.status === "failed" ||
        entry.status === "pr_open"
    )
    .map(([id]) => id);
}

/**
 * Sync ledger from GitHub before launching agents — open Wath PRs and orphan cursor/* branches.
 * No-op when GITHUB_TOKEN is unset (graceful degradation).
 */
export async function reconcileInFlightArtifacts(
  wathRoot: string,
  appId: string,
  state: ApplicationState,
  options?: { standardId?: string }
): Promise<{ state: ApplicationState; result: ReconcileResult }> {
  if (!resolveGitHubToken()) {
    return { state, result: { updated: false } };
  }

  const working = cloneState(state);
  let updated = false;

  try {
    const openPrs = await listOpenWathPrs(state.repo);
    const candidates = driftOrPendingIds(working);

    for (const pr of openPrs) {
      const standardId = resolvePrStandardId(pr, openPrs, candidates, options?.standardId);
      if (!standardId || !working.integrations[standardId]) continue;

      const entry = working.integrations[standardId]!;
      if (entry.status === "pr_open" && entry.pr_url === pr.prUrl && entry.work_branch === pr.branch) {
        continue;
      }

      entry.status = "pr_open";
      entry.pr_url = pr.prUrl;
      entry.work_branch = pr.branch;
      updated = true;
    }

    if (hasAwaitableOpenPr(working)) {
      if (working.phase !== "await_merge") {
        working.phase = "await_merge";
        updated = true;
      }
    } else if (!openPrs.length) {
      const branch = await discoverIntegrateBranch(state.repo);
      if (branch) {
        const targets = options?.standardId
          ? candidates.includes(options.standardId)
            ? [options.standardId]
            : []
          : candidates.filter((id) => {
              const entry = working.integrations[id];
              return entry?.compliance === "drift" || entry?.status === "pending";
            });

        if (targets.length === 1) {
          const entry = working.integrations[targets[0]!]!;
          if (entry.status !== "merged" && !entry.pr_url && entry.work_branch !== branch) {
            entry.work_branch = branch;
            entry.status = "pending";
            updated = true;
          }
        }
      }
    }

    if (updated) {
      appendHistory(working, "github_reconciled");
      saveApplicationState(wathRoot, appId, working);
    }

    const openPrUrl = openPrs[0]?.prUrl;
    const workBranch =
      Object.values(working.integrations).find((e) => e.work_branch)?.work_branch ?? undefined;

    return {
      state: updated ? working : state,
      result: { updated, openPrUrl, workBranch: workBranch ?? undefined },
    };
  } catch (err) {
    console.error(
      `[wath] reconcileInFlightArtifacts failed for ${appId}:`,
      err instanceof Error ? err.message : String(err)
    );
    return { state, result: { updated: false } };
  }
}
