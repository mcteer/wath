import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { listRequestedStandardIds, type WathSpec } from "../requirements/parser.js";
import { resolveStandard, resolveRepoRoot } from "../standards/registry.js";
import type { ApplicationState, HistoryEntry, IntegrationState } from "./types.js";

/** org/repo from https://github.com/org/repo(.git)? */
export function resolveApplicationId(repoUrl: string): string {
  const trimmed = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
  const match = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  if (!match) {
    throw new Error(`Cannot resolve application id from repo URL: ${repoUrl}`);
  }
  return `${match[1]}/${match[2]}`;
}

/** Absolute path: state/applications/<org>/<repo>.yaml */
export function applicationStatePath(wathRoot: string, appId: string): string {
  const [org, repo] = appId.split("/");
  if (!org || !repo) {
    throw new Error(`Invalid application id (expected org/repo): ${appId}`);
  }
  return join(wathRoot, "state/applications", org, `${repo}.yaml`);
}

export function listApplicationStateFiles(wathRoot: string): string[] {
  const root = join(wathRoot, "state/applications");
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const org of readdirSync(root, { withFileTypes: true })) {
    if (!org.isDirectory() || org.name.startsWith(".")) continue;
    const orgDir = join(root, org.name);
    for (const file of readdirSync(orgDir)) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        out.push(join(orgDir, file));
      }
    }
  }
  return out;
}

export function loadApplicationState(wathRoot: string, appId: string): ApplicationState | null {
  const path = applicationStatePath(wathRoot, appId);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  return parseYaml(raw) as ApplicationState;
}

export function saveApplicationState(
  wathRoot: string,
  appId: string,
  state: ApplicationState
): string {
  const path = applicationStatePath(wathRoot, appId);
  mkdirSync(dirname(path), { recursive: true });
  state.updated_at = new Date().toISOString();
  writeFileSync(path, stringifyYaml(state, { lineWidth: 0 }), "utf8");
  return path;
}

function defaultIntegrationState(wathRoot: string, standardId: string): IntegrationState {
  const standard = resolveStandard(wathRoot, standardId);
  return {
    status: "pending",
    standard_version: standard.entry.version,
    pr_url: null,
    work_branch: null,
    integrate_agent_id: null,
    last_verify: "unknown",
    compliance: "non_compliant",
    retry_count: 0,
  };
}

export function appendHistory(
  state: ApplicationState,
  event: string,
  detail?: string
): void {
  const entry: HistoryEntry = { at: new Date().toISOString(), event };
  if (detail) entry.detail = detail;
  state.history.push(entry);
}

/** Create or refresh integration slots from wath.json services. */
export function initStateFromWathSpec(
  wathRoot: string,
  spec: WathSpec,
  wathPath: string,
  existing?: ApplicationState | null
): ApplicationState {
  const appId = resolveApplicationId(spec.repo);
  const serviceIds = listRequestedStandardIds(spec);
  const integrations: Record<string, IntegrationState> = {
    ...(existing?.integrations ?? {}),
  };
  for (const id of serviceIds) {
    if (!integrations[id]) {
      integrations[id] = defaultIntegrationState(wathRoot, id);
    }
  }
  return {
    repo: spec.repo,
    wath_path: wathPath.endsWith(".json")
      ? wathPath.split("/").slice(-1)[0] ?? "wath.json"
      : "wath.json",
    phase: existing?.phase ?? "discover",
    manifest: existing?.manifest ?? { status: "pending", pr_url: null },
    integrations,
    current_standard_id: existing?.current_standard_id,
    history: existing?.history ?? [],
    updated_at: new Date().toISOString(),
  };
}

export function loadOrInitState(
  wathRoot: string,
  spec: WathSpec,
  wathPath: string
): { appId: string; state: ApplicationState } {
  const appId = resolveApplicationId(spec.repo);
  const existing = loadApplicationState(wathRoot, appId);
  const state = initStateFromWathSpec(wathRoot, spec, wathPath, existing);
  return { appId, state };
}

export function loadAllApplicationStates(wathRoot: string): Array<{ appId: string; state: ApplicationState }> {
  const files = listApplicationStateFiles(wathRoot);
  return files.map((path) => {
    const raw = readFileSync(path, "utf8");
    const state = parseYaml(raw) as ApplicationState;
    const rel = path.replace(join(wathRoot, "state/applications/"), "").replace(/\\/g, "/");
    const appId = rel.replace(/\.ya?ml$/, "");
    return { appId, state };
  });
}
