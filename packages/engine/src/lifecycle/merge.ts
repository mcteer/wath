import { resolveStandard, resolveRepoRoot } from "../standards/registry.js";
import type { ApplicationState, MergeRecordType } from "./types.js";
import { anyIntegrationPrOpen } from "./manifest.js";
import { appendHistory, loadApplicationState, saveApplicationState } from "./state.js";

export interface RecordMergeInput {
  appId: string;
  type: MergeRecordType;
  prUrl?: string;
  standardId?: string;
}

export function recordMerge(input: RecordMergeInput): ApplicationState {
  const wathRoot = resolveRepoRoot();
  const state = loadApplicationState(wathRoot, input.appId);
  if (!state) {
    throw new Error(`No application state for ${input.appId}`);
  }

  if (input.type === "manifest") {
    state.manifest.status = "accepted";
    state.manifest.pr_url = input.prUrl ?? state.manifest.pr_url;
    appendHistory(state, "manifest_merged", input.prUrl);
    if (state.phase === "await_merge") {
      state.phase = "integrate";
    }
  } else {
    const standardId = input.standardId;
    if (!standardId || !state.integrations[standardId]) {
      throw new Error(`standardId required for integration merge: ${standardId}`);
    }
    const entry = state.integrations[standardId];
    entry.status = "merged";
    entry.pr_url = input.prUrl ?? entry.pr_url;
    entry.compliance = "in_compliance";
    const current = resolveStandard(wathRoot, standardId);
    entry.standard_version = current.entry.version;
    appendHistory(state, "integration_merged", `${standardId} ${input.prUrl ?? ""}`);
    state.current_standard_id = undefined;

    const pending = Object.values(state.integrations).filter(
      (v) => v.status === "pending" || v.status === "failed"
    );
    if (pending.length === 0 && !anyIntegrationPrOpen(state.integrations)) {
      state.phase = "compliant";
      appendHistory(state, "onboarding_complete");
    } else if (!anyIntegrationPrOpen(state.integrations)) {
      state.phase = "integrate";
    }
  }

  saveApplicationState(wathRoot, input.appId, state);
  return state;
}

export function recordAgentPr(
  appId: string,
  type: MergeRecordType,
  prUrl: string | undefined,
  standardId?: string
): ApplicationState {
  const wathRoot = resolveRepoRoot();
  const state = loadApplicationState(wathRoot, appId);
  if (!state) throw new Error(`No application state for ${appId}`);

  if (type === "manifest") {
    const newUrl = prUrl ?? null;
    if (state.manifest.status === "pending_pr" && state.manifest.pr_url && newUrl && state.manifest.pr_url !== newUrl) {
      appendHistory(state, "manifest_pr_duplicate", `${newUrl} (existing: ${state.manifest.pr_url})`);
    } else {
      state.manifest.status = "pending_pr";
      state.manifest.pr_url = newUrl;
      appendHistory(state, "manifest_pr_opened", prUrl);
    }
    state.phase = "await_merge";
  } else if (standardId && state.integrations[standardId]) {
    const entry = state.integrations[standardId];
    const newUrl = prUrl ?? null;
    if (entry.status === "pr_open" && entry.pr_url && newUrl && entry.pr_url !== newUrl) {
      appendHistory(
        state,
        "integration_pr_duplicate",
        `${standardId} ${newUrl} (existing: ${entry.pr_url})`
      );
    } else {
      entry.status = "pr_open";
      entry.pr_url = newUrl;
      appendHistory(state, "integration_pr_opened", `${standardId} ${newUrl ?? ""}`);
    }
    state.phase = "await_merge";
  }

  saveApplicationState(wathRoot, appId, state);
  return state;
}

export function markVerifyResult(
  appId: string,
  standardId: string,
  passed: boolean
): ApplicationState {
  const wathRoot = resolveRepoRoot();
  const state = loadApplicationState(wathRoot, appId);
  if (!state?.integrations[standardId]) {
    throw new Error(`No integration state for ${standardId}`);
  }
  state.integrations[standardId].last_verify = passed ? "passed" : "failed";
  if (!passed) {
    state.integrations[standardId].status = "failed";
    state.integrations[standardId].retry_count =
      (state.integrations[standardId].retry_count ?? 0) + 1;
  }
  appendHistory(state, passed ? "verify_passed" : "verify_failed", standardId);
  saveApplicationState(wathRoot, appId, state);
  return state;
}
