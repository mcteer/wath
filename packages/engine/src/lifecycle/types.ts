/** Lifecycle phase and application state types. */

export type OnboardingPhase =
  | "discover"
  | "enrich_manifest"
  | "integrate"
  | "validate"
  | "await_merge"
  | "record"
  | "compliant"
  | "non_compliant";

export type ManifestStatus = "pending" | "pending_pr" | "accepted";
export type IntegrationStatus = "pending" | "pr_open" | "merged" | "failed";
export type ComplianceStatus = "in_compliance" | "drift" | "non_compliant";
export type LastVerifyResult = "passed" | "failed" | "unknown";

export interface HistoryEntry {
  at: string;
  event: string;
  detail?: string;
}

export interface ManifestState {
  status: ManifestStatus;
  pr_url?: string | null;
}

export interface IntegrationState {
  status: IntegrationStatus;
  standard_version: number;
  pr_url?: string | null;
  last_verify: LastVerifyResult;
  compliance: ComplianceStatus;
  retry_count?: number;
}

export interface ApplicationState {
  repo: string;
  wath_path: string;
  phase: OnboardingPhase;
  manifest: ManifestState;
  integrations: Record<string, IntegrationState>;
  /** Standard currently being integrated or validated. */
  current_standard_id?: string;
  history: HistoryEntry[];
  updated_at: string;
}

export type MergeRecordType = "manifest" | "integration";

export interface LifecycleOptions {
  dryRun?: boolean;
  launch?: boolean;
  local?: boolean;
  materialize?: boolean;
  forceMaterialize?: boolean;
  repoUrl?: string;
  /** Force a phase instead of resuming from state. */
  phase?: OnboardingPhase;
  standardId?: string;
  maxRetries?: number;
}

export interface LifecycleResult {
  appId: string;
  phase: OnboardingPhase;
  state: ApplicationState;
  prompt: string;
  materialized?: { filesWritten: string[] };
  agent?: {
    agentId: string;
    runId: string;
    status: string;
    prUrl?: string;
    durationMs?: number;
  };
}

export interface AuditEntry {
  appId: string;
  repo: string;
  phase: OnboardingPhase;
  drift: Array<{ standardId: string; recordedVersion: number; currentVersion: number }>;
  compliance: Record<string, ComplianceStatus>;
}

export interface AuditReport {
  generatedAt: string;
  applications: AuditEntry[];
}
