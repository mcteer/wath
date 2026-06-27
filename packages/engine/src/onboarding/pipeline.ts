import type { OnboardingIntent, ResolvedStandard } from "../types.js";
import {
  deriveRuntime,
  parseRequirements,
  resolveRequirementsPath,
} from "../requirements/parser.js";
import {
  findStandardsForRuntime,
  resolveRepoRoot,
  resolveStandard,
} from "../standards/registry.js";

export interface OnboardingContext {
  repoRoot: string;
  standard: ResolvedStandard;
  requirementsPath: string;
  runtime: string;
}

/**
 * Compose onboarding context: select the governing standard from the registry
 * based on explicit intent or inferred runtime from requirements.
 */
export function composeOnboardingContext(
  intent: OnboardingIntent
): OnboardingContext {
  const repoRoot = resolveRepoRoot();
  const requirementsPath = resolveRequirementsPath(intent);
  const requirements = parseRequirements(requirementsPath);
  const runtime = deriveRuntime(requirements);

  // If standardId is explicit, use it; otherwise pick the first standard for runtime
  let standard: ResolvedStandard;
  if (intent.standardId) {
    standard = resolveStandard(repoRoot, intent.standardId);
  } else {
    const candidates = findStandardsForRuntime(repoRoot, runtime);
    if (candidates.length === 0) {
      throw new Error(
        `No standards registered for runtime "${runtime}". Add one to standards/registry.yaml.`
      );
    }
    standard = resolveStandard(repoRoot, candidates[0].id);
  }

  return {
    repoRoot,
    standard,
    requirementsPath,
    runtime,
  };
}

/**
 * Placeholder for the full onboarding pipeline.
 * Phase 4 will wire @cursor/sdk Agent.create here.
 */
export async function runOnboarding(intent: OnboardingIntent): Promise<OnboardingContext> {
  const context = composeOnboardingContext(intent);
  // TODO(Phase 4): generate environment.json, launch cloud agent, stream events
  return context;
}
