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
  parseWathSpec,
  parseWathSpecJson,
  parseIntegrationsSpec,
  parseRequirements,
  resolveWathPath,
  resolveIntegrationsPath,
  resolveRequirementsPath,
  SERVICE_ALIASES,
} from "./requirements/parser.js";
export type { WathSpec, WathIntegrationsSpec, RequirementsSlices } from "./requirements/parser.js";

export { fetchWathSpecFromRepo } from "./requirements/fetch-wath-spec.js";

export { writeWathFeedback, writeManifestFeedback } from "./requirements/writer.js";

export { composeOnboardingContext, runOnboarding } from "./onboarding/pipeline.js";
export type { OnboardingContext, OnboardingOptions, OnboardingResult } from "./onboarding/pipeline.js";
export { buildOnboardingPrompt } from "./onboarding/prompt.js";
export {
  artifactChecklistMarkdown,
  artifactPrSectionMarkdown,
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
export {
  resolveConsumer,
  resolveConsumerRepoPath,
} from "./onboarding/resolve-consumer.js";
export type { ResolveConsumerInput, ResolvedConsumer } from "./onboarding/resolve-consumer.js";
export { loadConfig } from "./config/env.js";
export { launchOnboardingAgent, launchIntegrateValidateChain } from "./agent/client.js";
export { runConformanceGate } from "./verify/runner.js";
export type { StandardOnboarding } from "./types.js";

export {
  runLifecycle,
  getLifecycleStatus,
  recordMerge,
  audit,
  resolveApplicationId,
  loadApplicationState,
} from "./lifecycle/orchestrator.js";
export type {
  OnboardingPhase,
  ApplicationState,
  LifecycleOptions,
  LifecycleResult,
  LifecycleProgressStage,
  LifecycleProgressUpdate,
  AuditReport,
  MergeRecordType,
} from "./lifecycle/types.js";
export type { RecordMergeInput } from "./lifecycle/merge.js";
export {
  buildManifestEnrichmentPrompt,
  buildIntegratePrompt,
  buildValidatePrompt,
} from "./lifecycle/prompts.js";
export { isManifestComplete } from "./lifecycle/manifest.js";
