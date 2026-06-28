import { loadConfig, requireApiKey } from "../config/env.js";
import { resolveRepoRoot } from "../standards/registry.js";
import { applyAuditToState } from "./audit.js";
import { hasAwaitableOpenPr } from "./phase.js";
import { runLifecycle } from "./orchestrator.js";
import { reconcileInFlightArtifacts } from "./reconcile-github.js";
import { isOnboardInFlight } from "./run-progress.js";
import { loadApplicationState } from "./state.js";
import type { AuditEntry, AuditReport } from "./types.js";

export interface PollDriftTriggered {
  appId: string;
  repo: string;
  drift: AuditEntry["drift"];
}

export interface PollDriftSkipped {
  appId: string;
  reason: string;
}

export interface PollDriftError {
  appId: string;
  message: string;
}

export interface PollDriftResult {
  auditedAt: string;
  audit: AuditReport;
  triggered: PollDriftTriggered[];
  skipped: PollDriftSkipped[];
  errors: PollDriftError[];
}

export interface PollDriftOptions {
  wathRoot?: string;
  /** Launch cloud agents for drift remediation (default: true). */
  launch?: boolean;
  /** @internal Test override — called instead of runLifecycle when set. */
  triggerOnboard?: (appId: string, repo: string) => Promise<void>;
}

async function shouldSkipDriftLaunch(
  appId: string,
  wathRoot: string
): Promise<PollDriftSkipped | null> {
  const state = loadApplicationState(wathRoot, appId);
  if (!state) {
    return { appId, reason: "state_not_found" };
  }

  const { state: synced } = await reconcileInFlightArtifacts(wathRoot, appId, state);

  if (isOnboardInFlight(appId, wathRoot)) {
    return { appId, reason: "onboard_in_progress" };
  }

  if (synced.phase === "await_merge" || hasAwaitableOpenPr(synced)) {
    return { appId, reason: "await_merge" };
  }

  const openRemediation = Object.values(synced.integrations).some(
    (entry) => entry.status === "pr_open" && entry.pr_url
  );
  if (openRemediation) {
    return { appId, reason: "pr_open" };
  }

  return null;
}

/** Run compliance audit, apply drift flags, and launch onboard for drifted apps. */
export async function pollDrift(options: PollDriftOptions = {}): Promise<PollDriftResult> {
  const wathRoot = options.wathRoot ?? resolveRepoRoot();
  const launch = options.launch !== false;

  if (launch && !options.triggerOnboard) {
    requireApiKey(loadConfig());
  }

  const audit = applyAuditToState(wathRoot);
  const result: PollDriftResult = {
    auditedAt: new Date().toISOString(),
    audit,
    triggered: [],
    skipped: [],
    errors: [],
  };

  for (const entry of audit.applications) {
    if (entry.drift.length === 0) continue;

    const skip = await shouldSkipDriftLaunch(entry.appId, wathRoot);
    if (skip) {
      result.skipped.push(skip);
      continue;
    }

    if (!launch) {
      result.skipped.push({ appId: entry.appId, reason: "launch_disabled" });
      continue;
    }

    try {
      if (options.triggerOnboard) {
        await options.triggerOnboard(entry.appId, entry.repo);
      } else {
        void runLifecycle(
          {},
          { launch: true, trackProgress: true, repo: entry.repo, target: entry.repo }
        ).catch((err: unknown) => {
          console.error(
            `[wath] drift poller onboard failed for ${entry.appId}:`,
            err instanceof Error ? err.message : String(err)
          );
        });
      }

      result.triggered.push({
        appId: entry.appId,
        repo: entry.repo,
        drift: entry.drift,
      });
    } catch (err) {
      result.errors.push({
        appId: entry.appId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
