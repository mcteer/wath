import { isPullRequestMerged } from "../github/pr-status.js";
import { requireGitHubToken } from "../github/token.js";
import { resolveRepoRoot } from "../standards/registry.js";
import { recordMerge } from "./merge.js";
import { loadAllApplicationStates } from "./state.js";
import type { ApplicationState, MergeRecordType } from "./types.js";

export interface PollMergeRecorded {
  appId: string;
  type: MergeRecordType;
  standardId?: string;
  prUrl: string;
}

export interface PollMergeError {
  appId: string;
  prUrl: string;
  message: string;
}

export interface PollMergeResult {
  polledAt: string;
  recorded: PollMergeRecorded[];
  errors: PollMergeError[];
}

export interface PollMergeOptions {
  wathRoot?: string;
  githubToken?: string;
  /** @internal Test override */
  isMerged?: (prUrl: string) => Promise<boolean>;
}

function manifestAwaitingMerge(state: ApplicationState): string | undefined {
  if (state.manifest.status !== "pending_pr") return undefined;
  const url = state.manifest.pr_url;
  return url && url !== "null" ? url : undefined;
}

function integrationsAwaitingMerge(
  state: ApplicationState
): Array<{ standardId: string; prUrl: string }> {
  const out: Array<{ standardId: string; prUrl: string }> = [];
  for (const [standardId, entry] of Object.entries(state.integrations)) {
    if (entry.status !== "pr_open") continue;
    const url = entry.pr_url;
    if (!url || url === "null") continue;
    out.push({ standardId, prUrl: url });
  }
  return out;
}

/** Scan await_merge applications and record merges for closed+merged GitHub PRs. */
export async function pollMergedPrs(options: PollMergeOptions = {}): Promise<PollMergeResult> {
  const wathRoot = options.wathRoot ?? resolveRepoRoot();
  const token = options.githubToken ?? requireGitHubToken("merge poll");
  const checkMerged = options.isMerged ?? ((url: string) => isPullRequestMerged(url, token));

  const result: PollMergeResult = {
    polledAt: new Date().toISOString(),
    recorded: [],
    errors: [],
  };

  for (const { appId, state } of loadAllApplicationStates(wathRoot)) {
    if (state.phase !== "await_merge") continue;

    const manifestUrl = manifestAwaitingMerge(state);
    if (manifestUrl) {
      try {
        if (await checkMerged(manifestUrl)) {
          recordMerge({ appId, type: "manifest", prUrl: manifestUrl });
          result.recorded.push({ appId, type: "manifest", prUrl: manifestUrl });
        }
      } catch (err) {
        result.errors.push({
          appId,
          prUrl: manifestUrl,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const { standardId, prUrl } of integrationsAwaitingMerge(state)) {
      try {
        if (await checkMerged(prUrl)) {
          recordMerge({ appId, type: "integration", standardId, prUrl });
          result.recorded.push({ appId, type: "integration", standardId, prUrl });
        }
      } catch (err) {
        result.errors.push({
          appId,
          prUrl,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
