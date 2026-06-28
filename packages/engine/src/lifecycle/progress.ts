/** User-facing onboarding progress milestones for MCP notifications. */

import type { LifecycleProgressUpdate } from "./types.js";

export type { LifecycleProgressStage, LifecycleProgressUpdate } from "./types.js";

export const ONBOARD_PROGRESS_TOTAL = 3;

export function integratingProgress(standardId: string): LifecycleProgressUpdate {
  return {
    stage: "integrating",
    progress: 1,
    total: ONBOARD_PROGRESS_TOTAL,
    standardId,
    message: `Integrating ${standardId} — Cloud Agent is writing integration code…`,
  };
}

export function validatingProgress(
  standardId: string,
  extras?: { branch?: string; prUrl?: string }
): LifecycleProgressUpdate {
  return {
    stage: "validating",
    progress: 2,
    total: ONBOARD_PROGRESS_TOTAL,
    standardId,
    ...(extras?.branch ? { branch: extras.branch } : {}),
    ...(extras?.prUrl ? { prUrl: extras.prUrl } : {}),
    message: `Validating ${standardId} — running conformance checks and opening a PR…`,
  };
}

export function prSubmittedProgress(
  standardId: string,
  prUrl: string
): LifecycleProgressUpdate {
  return {
    stage: "pr_submitted",
    progress: ONBOARD_PROGRESS_TOTAL,
    total: ONBOARD_PROGRESS_TOTAL,
    standardId,
    prUrl,
    message: `PR submitted: ${prUrl}`,
  };
}
