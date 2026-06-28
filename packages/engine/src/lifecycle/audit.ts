import { loadRegistry, resolveRepoRoot } from "../standards/registry.js";
import type { AuditReport, AuditEntry, ComplianceStatus } from "./types.js";
import {
  appendHistory,
  loadAllApplicationStates,
  loadApplicationState,
  saveApplicationState,
} from "./state.js";

/** Compare recorded standard versions to registry; flag drift. */
export function runComplianceAudit(wathRoot?: string): AuditReport {
  const root = wathRoot ?? resolveRepoRoot();
  const registry = loadRegistry(root);
  const registryVersions = Object.fromEntries(
    registry.standards.map((s) => [s.id, s.version])
  );

  const applications: AuditEntry[] = [];

  for (const { appId, state } of loadAllApplicationStates(root)) {
    const drift: AuditEntry["drift"] = [];
    const compliance: Record<string, ComplianceStatus> = {};

    for (const [standardId, entry] of Object.entries(state.integrations)) {
      const currentVersion = registryVersions[standardId];
      if (currentVersion === undefined) continue;

      if (entry.standard_version < currentVersion) {
        drift.push({
          standardId,
          recordedVersion: entry.standard_version,
          currentVersion,
        });
        compliance[standardId] = "drift";
      } else if (entry.status === "failed" || entry.status === "pr_open") {
        compliance[standardId] = "non_compliant";
      } else if (entry.status === "merged") {
        compliance[standardId] = "in_compliance";
      } else {
        compliance[standardId] = entry.compliance;
      }
    }

    applications.push({
      appId,
      repo: state.repo,
      phase: state.phase,
      drift,
      compliance,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    applications,
  };
}

/** Persist drift flags back to state files. */
export function applyAuditToState(wathRoot?: string): AuditReport {
  const root = wathRoot ?? resolveRepoRoot();
  const report = runComplianceAudit(root);

  for (const entry of report.applications) {
    const state = loadApplicationState(root, entry.appId);
    if (!state) continue;
    for (const [standardId, flag] of Object.entries(entry.compliance)) {
      if (state.integrations[standardId]) {
        state.integrations[standardId].compliance = flag;
      }
    }
    for (const drift of entry.drift) {
      const integration = state.integrations[drift.standardId];
      if (integration?.status === "merged") {
        integration.status = "pending";
        integration.pr_url = null;
        integration.work_branch = null;
        integration.integrate_agent_id = null;
        appendHistory(state, "drift_remediation_pending", drift.standardId);
      }
    }
    if (entry.drift.length > 0 && state.phase === "compliant") {
      state.phase = "integrate";
    }
    saveApplicationState(root, entry.appId, state);
  }

  return report;
}
