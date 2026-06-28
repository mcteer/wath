import { resolveStandard } from "../standards/registry.js";
import type { IntegrationState } from "./types.js";

export interface DriftRemediationInfo {
  standardId: string;
  /** Version recorded in the application ledger before remediation. */
  fromVersion: number;
  /** Target version from standards/registry.yaml. */
  toVersion: number;
  /** Version in standard.yaml (content/rules); may differ from registry version. */
  contentVersion: number;
  versionNotes?: string;
  /** Changelog entry for the target registry version, if present. */
  targetChangelog?: string;
}

/** True when integration is flagged for version drift and needs remediation. */
export function isDriftRemediation(
  integration: IntegrationState | undefined,
  targetRegistryVersion: number
): boolean {
  if (!integration) return false;
  return integration.compliance === "drift" && integration.standard_version < targetRegistryVersion;
}

/** Resolve drift context for prompt selection; null when not a drift remediation run. */
export function resolveDriftRemediation(
  repoRoot: string,
  standardId: string,
  integration: IntegrationState | undefined
): DriftRemediationInfo | null {
  if (!integration) return null;
  const standard = resolveStandard(repoRoot, standardId);
  if (!isDriftRemediation(integration, standard.entry.version)) return null;

  const toVersion = standard.entry.version;
  const changelog = standard.entry.version_changelog;
  const targetChangelog =
    changelog?.[toVersion] ??
    (changelog as Record<string, string> | undefined)?.[String(toVersion)];

  return {
    standardId,
    fromVersion: integration.standard_version,
    toVersion,
    contentVersion: standard.metadata.version,
    versionNotes: standard.entry.version_notes,
    targetChangelog,
  };
}
