/** Shared types for the Wath engine and standards registry. */

export interface StandardOnboardingSandbox {
  install: string;
  start: string;
}

/** Per-standard onboarding metadata — keeps engine generic across marketplace standards. */
export interface StandardOnboarding {
  artifacts: string[];
  /** One-line purpose per artifact path for PR descriptions and agent prompts. */
  artifact_purposes?: Record<string, string>;
  golden_fixture?: string;
  golden_params?: string;
  sandbox?: StandardOnboardingSandbox;
  /** Basename of templates/consumer/.cursor/rules/standards/<name>.mdc */
  consumer_rule?: string;
  /** Repo-relative PR template path under templates/consumer/ */
  pr_template?: string;
}

export interface StandardMetadata {
  id: string;
  version: number;
  owner: string;
  rule_prefix: string;
  rules: string[];
  schema: string;
  conformance_entry: string;
  runtimes: string[];
  services: string[];
  onboarding?: StandardOnboarding;
}

export interface StandardRegistryEntry {
  id: string;
  path: string;
  owner: string;
  version: number;
  rule_prefix: string;
  runtimes: string[];
  services: string[];
}

export interface StandardRegistry {
  standards: StandardRegistryEntry[];
}

export interface ResolvedStandard {
  entry: StandardRegistryEntry;
  metadata: StandardMetadata;
  rootPath: string;
  skillPath: string;
  schemaPath: string;
  conformancePath: string;
}

export interface OnboardingIntent {
  standardId?: string;
  /** Optional local checkout under WATH_ROOT (verify/materialize only). */
  consumerRepoPath?: string;
  localConsumerPath?: string;
  /** Pre-resolved spec from GitHub or local wath.json. */
  wathSpec?: import("./requirements/parser.js").WathSpec;
  /** Override path to wath.json */
  wathPath?: string;
  /** @deprecated Use wathPath */
  integrationsPath?: string;
  /** @deprecated Use wathPath */
  requirementsPath?: string;
}

export interface VerifyResult {
  standardId: string;
  passed: boolean;
  output: string;
}
