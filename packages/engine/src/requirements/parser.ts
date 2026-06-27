import { readFileSync, existsSync } from "node:fs";

import type { OnboardingIntent } from "../types.js";

/** Shorthand aliases → registry standard IDs. */
export const SERVICE_ALIASES: Record<string, string> = {
  vault: "vault-dynamic-secrets",
  "hashicorp-vault": "vault-dynamic-secrets",
};

export interface WathSpec {
  repo: string;
  contact?: { team?: string; email?: string };
  stack: {
    runtime: string;
    language?: string;
    environments?: string[];
    applications: Record<string, string>;
  };
  /** Standard ID → per-service integration config. */
  services: Record<string, Record<string, unknown>>;
  feedback?: Record<string, unknown>;
  raw: string;
}

/** @deprecated Use WathSpec */
export type WathIntegrationsSpec = WathSpec;

/** @deprecated Use WathSpec — kept for transitional typing. */
export interface RequirementsSlices {
  environment: Record<string, string>;
  intent: Record<string, string>;
  constraints: string[];
  raw: string;
}

/** Normalize services field (array of names or object keyed by standard ID). */
export function normalizeServices(
  services: string[] | Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  if (Array.isArray(services)) {
    const out: Record<string, Record<string, unknown>> = {};
    for (const name of services) {
      const id = SERVICE_ALIASES[name] ?? name;
      out[id] = {};
    }
    return out;
  }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, config] of Object.entries(services)) {
    const id = SERVICE_ALIASES[key] ?? key;
    out[id] = config ?? {};
  }
  return out;
}

/** Parse wath.json content (file label is used in error messages only). */
export function parseWathSpecJson(raw: string, label = "wath.json"): WathSpec {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  const doc = data as Record<string, unknown>;

  if (typeof doc.repo !== "string" || !doc.repo.startsWith("http")) {
    throw new Error(`${label}: "repo" must be an http(s) URL`);
  }
  const stack = doc.stack as Record<string, unknown> | undefined;
  if (!stack || typeof stack.runtime !== "string") {
    throw new Error(`${label}: "stack.runtime" is required (kubernetes | nomad | vm)`);
  }
  const applications = stack.applications as Record<string, string> | undefined;
  if (!applications || typeof applications !== "object" || !Object.keys(applications).length) {
    throw new Error(`${label}: "stack.applications" must list at least one app → purpose`);
  }
  if (!doc.services) {
    throw new Error(`${label}: "services" is required`);
  }

  const services = normalizeServices(
    doc.services as string[] | Record<string, Record<string, unknown>>
  );

  return {
    repo: doc.repo,
    contact: doc.contact as WathSpec["contact"],
    stack: {
      runtime: stack.runtime,
      language: stack.language as string | undefined,
      environments: stack.environments as string[] | undefined,
      applications,
    },
    services,
    feedback: (doc.feedback as Record<string, unknown>) ?? {},
    raw,
  };
}

/** Parse and validate wath.json from disk. Keys prefixed with _ are ignored. */
export function parseWathSpec(specPath: string): WathSpec {
  if (!existsSync(specPath)) {
    throw new Error(`wath.json not found: ${specPath}`);
  }
  const raw = readFileSync(specPath, "utf8");
  return parseWathSpecJson(raw, specPath);
}

/** @deprecated Use parseWathSpec */
export const parseIntegrationsSpec = parseWathSpec;

/** List standard IDs requested in the spec (registration order preserved). */
export function listRequestedStandardIds(spec: WathSpec): string[] {
  return Object.keys(spec.services);
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

/** Derive runtime from parsed spec. */
export function deriveRuntime(spec: WathSpec): string {
  const runtime = spec.stack.runtime.trim().toLowerCase();
  if (["kubernetes", "nomad", "vm"].includes(runtime)) {
    return runtime;
  }
  throw new Error(
    `Could not derive runtime from spec. Got: "${spec.stack.runtime}". Expected kubernetes, nomad, or vm.`
  );
}

/** Resolve path to wath.json for an onboarding intent. */
export function resolveWathPath(intent: OnboardingIntent): string {
  if (intent.wathPath) {
    return intent.wathPath;
  }
  if (intent.integrationsPath) {
    return intent.integrationsPath;
  }
  if (intent.requirementsPath) {
    return intent.requirementsPath;
  }
  return `${intent.consumerRepoPath}/wath.json`;
}

/** @deprecated Use resolveWathPath */
export const resolveIntegrationsPath = resolveWathPath;

/** @deprecated Use parseWathSpec */
export function parseRequirements(path: string): RequirementsSlices {
  const spec = parseWathSpec(path);
  const primary = Object.values(spec.services)[0] ?? {};
  const constraints = primary.constraints
    ? Object.entries(primary.constraints as Record<string, unknown>).map(
        ([k, v]) => `${k}: ${JSON.stringify(v)}`
      )
    : [];
  return {
    environment: {
      Runtime: spec.stack.runtime,
      Repository: spec.repo,
      Language: spec.stack.language ?? "",
    },
    intent: {
      Datastore: String(primary.datastore ?? ""),
      Access: String(primary.access ?? ""),
    },
    constraints,
    raw: spec.raw,
  };
}

/** @deprecated Use resolveWathPath */
export const resolveRequirementsPath = resolveWathPath;
