import type { ApplicationState, OnboardingPhase } from "./types.js";
import {
  allIntegrationsMerged,
  isManifestComplete,
  nextPendingStandardId,
} from "./manifest.js";
import type { WathSpec } from "../requirements/parser.js";

export function hasAwaitableOpenPr(state: ApplicationState): boolean {
  if (state.manifest.status === "pending_pr" && state.manifest.pr_url) return true;
  return Object.values(state.integrations).some(
    (entry) => entry.status === "pr_open" && entry.pr_url
  );
}

/** Integrate finished but validate never recorded a PR — resume validate, not await_merge. */
export function integrationAwaitingPr(
  state: ApplicationState,
  standardId: string | undefined
): boolean {
  if (!standardId) return false;
  const entry = state.integrations[standardId];
  return Boolean(
    entry &&
      entry.status === "pending" &&
      !entry.pr_url &&
      (entry.work_branch || entry.integrate_agent_id)
  );
}

export function resolveEffectivePhase(
  state: ApplicationState,
  spec: WathSpec,
  forced?: OnboardingPhase
): OnboardingPhase {
  if (forced) return forced;

  if (state.phase === "await_merge" && hasAwaitableOpenPr(state)) return "await_merge";
  if (state.phase === "compliant" && allIntegrationsMerged(spec, state.integrations)) {
    return "compliant";
  }

  if (state.manifest.status === "pending_pr" && state.manifest.pr_url) return "await_merge";

  if (state.manifest.status !== "accepted") {
    if (!isManifestComplete(spec)) return "enrich_manifest";
    state.manifest.status = "accepted";
  }

  if (allIntegrationsMerged(spec, state.integrations)) return "compliant";

  const next = nextPendingStandardId(spec, state.integrations);
  const standardId = state.current_standard_id ?? next;

  if (integrationAwaitingPr(state, standardId)) return "validate";

  if (!next) {
    const open = Object.values(state.integrations).some((i) => i.status === "pr_open");
    return open ? "await_merge" : "integrate";
  }

  if (state.phase === "validate" && state.current_standard_id) {
    const entry = state.integrations[state.current_standard_id];
    if (entry?.status === "pr_open" && entry.pr_url) return "await_merge";
    return "validate";
  }

  return "integrate";
}
