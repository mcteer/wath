import { readFileSync, existsSync } from "node:fs";

import type { OnboardingIntent } from "../types.js";

export interface RequirementsSlices {
  environment: Record<string, string>;
  intent: Record<string, string>;
  constraints: string[];
  raw: string;
}

/** Auth method prescribed from runtime (standard SKILL §4 table for vault-dynamic-secrets). */
export function deriveAuthMethod(runtime: string): string {
  switch (runtime) {
    case "kubernetes":
      return "kubernetes";
    case "nomad":
      return "jwt (Nomad workload identity)";
    case "vm":
      return "approle / cloud identity";
    default:
      return "unknown";
  }
}

/**
 * Parse INTEGRATION_REQUIREMENTS.md into structured slices.
 * Lightweight table extraction — sufficient for demo; extend as needed.
 */
export function parseRequirements(requirementsPath: string): RequirementsSlices {
  if (!existsSync(requirementsPath)) {
    throw new Error(`Requirements file not found: ${requirementsPath}`);
  }
  const raw = readFileSync(requirementsPath, "utf8");
  const environment: Record<string, string> = {};
  const intent: Record<string, string> = {};
  const constraints: string[] = [];

  let section: "environment" | "intent" | "constraints" | null = null;

  for (const line of raw.split("\n")) {
    if (/^## 1\. Environment/.test(line)) {
      section = "environment";
      continue;
    }
    if (/^## 2\. Intent/.test(line)) {
      section = "intent";
      continue;
    }
    if (/^## 3\. Known constraints/.test(line)) {
      section = "constraints";
      continue;
    }
    if (/^## [4-9]\./.test(line)) {
      section = null;
      continue;
    }

    const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (tableMatch && section === "environment") {
      const key = tableMatch[1].trim();
      const value = tableMatch[2].trim();
      if (key !== "Field" && !key.startsWith("---")) {
        environment[key] = value;
      }
    }
    if (tableMatch && section === "intent") {
      const key = tableMatch[1].trim();
      const value = tableMatch[2].trim();
      if (key !== "Field" && !key.startsWith("---")) {
        intent[key] = value;
      }
    }
    if (section === "constraints" && line.startsWith("-")) {
      constraints.push(line.trim());
    }
  }

  return { environment, intent, constraints, raw };
}

/** Derive runtime from parsed requirements (kubernetes | nomad | vm). */
export function deriveRuntime(requirements: RequirementsSlices): string {
  const runtime = requirements.environment["Runtime"] ?? "";
  const normalized = runtime.replace(/[`<>]/g, "").trim().toLowerCase();
  if (["kubernetes", "nomad", "vm"].includes(normalized)) {
    return normalized;
  }
  throw new Error(
    `Could not derive runtime from requirements. Got: "${runtime}". Expected kubernetes, nomad, or vm.`
  );
}

/** Resolve path to INTEGRATION_REQUIREMENTS.md for an onboarding intent. */
export function resolveRequirementsPath(intent: OnboardingIntent): string {
  if (intent.requirementsPath) {
    return intent.requirementsPath;
  }
  return `${intent.consumerRepoPath}/INTEGRATION_REQUIREMENTS.md`;
}
