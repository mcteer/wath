/** Shared types for the Wath engine and standards registry. */

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
