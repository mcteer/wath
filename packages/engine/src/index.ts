export type {
  OnboardingIntent,
  ResolvedStandard,
  StandardMetadata,
  StandardRegistry,
  StandardRegistryEntry,
  VerifyResult,
} from "./types.js";

export {
  findStandardsForRuntime,
  listStandards,
  loadRegistry,
  resolveRepoRoot,
  resolveStandard,
  resolveStandardsRoot,
} from "./standards/registry.js";

export {
  deriveRuntime,
  parseRequirements,
  resolveRequirementsPath,
} from "./requirements/parser.js";

export { composeOnboardingContext, runOnboarding } from "./onboarding/pipeline.js";
export type { OnboardingContext, OnboardingOptions, OnboardingResult } from "./onboarding/pipeline.js";
export { buildOnboardingPrompt } from "./onboarding/prompt.js";
export { materializeConsumerConfig } from "./onboarding/materialize.js";
export { loadConfig } from "./config/env.js";
export { launchOnboardingAgent } from "./agent/client.js";
export { runConformanceGate } from "./verify/runner.js";
