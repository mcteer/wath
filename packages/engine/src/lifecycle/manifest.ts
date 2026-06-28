import type { WathSpec } from "../requirements/parser.js";
import type { ComplianceStatus } from "./types.js";

/** Heuristic: manifest has enough for integration agents to proceed. */
export function isManifestComplete(spec: WathSpec): boolean {
  if (!spec.repo?.startsWith("http")) return false;
  const runtime = spec.stack?.runtime?.trim().toLowerCase();
  if (!["kubernetes", "nomad", "vm"].includes(runtime ?? "")) return false;
  const apps = spec.stack?.applications;
  if (!apps || Object.keys(apps).length === 0) return false;
  if (!spec.services || Object.keys(spec.services).length === 0) return false;
  return true;
}

/** Next standard id needing integration work. */
export function nextPendingStandardId(
  spec: WathSpec,
  integrations: Record<string, { status: string }>
): string | undefined {
  for (const id of Object.keys(spec.services)) {
    const entry = integrations[id];
    if (!entry || entry.status === "pending" || entry.status === "failed") {
      return id;
    }
  }
  return undefined;
}

export function allIntegrationsMerged(
  spec: WathSpec,
  integrations: Record<string, { status: string }>
): boolean {
  return Object.keys(spec.services).every((id) => integrations[id]?.status === "merged");
}

export function anyIntegrationPrOpen(
  integrations: Record<string, { status: string }>
): boolean {
  return Object.values(integrations).some((i) => i.status === "pr_open");
}


/** Standard id flagged for version drift (needs remediation). */
export function nextDriftStandardId(
  spec: WathSpec,
  integrations: Record<string, { compliance?: ComplianceStatus }>
): string | undefined {
  for (const id of Object.keys(spec.services)) {
    if (integrations[id]?.compliance === "drift") return id;
  }
  return undefined;
}

export function hasDrift(
  integrations: Record<string, { compliance?: ComplianceStatus }>
): boolean {
  return Object.values(integrations).some((e) => e.compliance === "drift");
}
