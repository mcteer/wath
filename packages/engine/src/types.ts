export interface StandardOnboardingSandbox {
  install: string;
  start: string;
}

export interface StandardOnboarding {
  artifacts: string[];
  golden_fixture?: string;
  golden_params?: string;
  sandbox?: StandardOnboardingSandbox;
  consumer_rule?: string;
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
  consumerRepoPath: string;
  requirementsPath?: string;
}

export interface VerifyResult {
  standardId: string;
  passed: boolean;
  output: string;
}
