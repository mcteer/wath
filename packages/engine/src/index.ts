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
  deriveAuthMethod,
  listRequestedStandardIds,
  normalizeServices,
  parseIntegrationsSpec,
  parseRequirements,
  resolveIntegrationsPath,
  resolveRequirementsPath,
  SERVICE_ALIASES,
} from "./requirements/parser.js";
export type { WathIntegrationsSpec, RequirementsSlices } from "./requirements/parser.js";

export { composeOnboardingContext, runOnboarding } from "./onboarding/pipeline.js";
export type { OnboardingContext, OnboardingOptions, OnboardingResult } from "./onboarding/pipeline.js";
export { buildOnboardingPrompt } from "./onboarding/prompt.js";
export {
  artifactChecklistMarkdown,
  DEFAULT_PR_TEMPLATE_REPO_PATH,
  goldenReferenceLines,
  prTemplateRepoPath,
  resolveOnboardingConfig,
  standardSkillRepoPath,
  standardSchemaRepoPath,
  standardVerifyRepoPath,
} from "./onboarding/artifacts.js";
export { loadOnboardingPrTemplate, prSubmissionInstructions } from "./onboarding/pr-template.js";
export { materializeConsumerConfig } from "./onboarding/materialize.js";
export { loadConfig } from "./config/env.js";
export { launchOnboardingAgent } from "./agent/client.js";
export { runConformanceGate } from "./verify/runner.js";
export type { StandardOnboarding } from "./types.js";
