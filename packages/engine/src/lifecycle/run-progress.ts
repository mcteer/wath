import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { resolveRepoRoot } from "../standards/registry.js";
import type { LifecycleProgressUpdate, LifecycleResult } from "./types.js";

export type ActiveRunStatus = "running" | "done" | "error";

/** Runs older than this are treated as orphaned (e.g. after wath-core redeploy). */
export const STALE_RUN_MAX_AGE_MS = 15 * 60 * 1000;

export interface ActiveOnboardRun {
  appId: string;
  status: ActiveRunStatus;
  stage?: LifecycleProgressUpdate["stage"];
  message?: string;
  progress?: number;
  total?: number;
  startedAt: string;
  updatedAt: string;
  result?: LifecycleResult;
  error?: string;
}

function runProgressPath(wathRoot: string, appId: string): string {
  const [org, repo] = appId.split("/");
  if (!org || !repo) {
    throw new Error(`Invalid application id (expected org/repo): ${appId}`);
  }
  return join(wathRoot, "state/runs", org, `${repo}.yaml`);
}

export function loadActiveRun(
  appId: string,
  wathRoot: string = resolveRepoRoot()
): ActiveOnboardRun | null {
  const path = runProgressPath(wathRoot, appId);
  if (!existsSync(path)) return null;
  return parseYaml(readFileSync(path, "utf8")) as ActiveOnboardRun;
}

function saveActiveRun(run: ActiveOnboardRun, wathRoot: string = resolveRepoRoot()): void {
  const path = runProgressPath(wathRoot, run.appId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(run, { lineWidth: 0 }), "utf8");
}

export function beginActiveRun(appId: string, wathRoot?: string): ActiveOnboardRun {
  const root = wathRoot ?? resolveRepoRoot();
  const now = new Date().toISOString();
  const run: ActiveOnboardRun = {
    appId,
    status: "running",
    message: "Onboarding started",
    progress: 0,
    total: 3,
    startedAt: now,
    updatedAt: now,
  };
  saveActiveRun(run, root);
  return run;
}

/** Atomically claim an onboard run; rejects concurrent launches for the same app. */
export function tryClaimActiveRun(
  appId: string,
  wathRoot?: string
): { claimed: true; run: ActiveOnboardRun } | { claimed: false; run: ActiveOnboardRun } {
  const root = wathRoot ?? resolveRepoRoot();
  const existing = loadActiveRun(appId, root);
  if (existing?.status === "running" && !isActiveRunStale(existing)) {
    return { claimed: false, run: existing };
  }

  const now = new Date().toISOString();
  const run: ActiveOnboardRun = {
    appId,
    status: "running",
    message: "Onboarding started",
    progress: 0,
    total: 3,
    startedAt: now,
    updatedAt: now,
  };

  const path = runProgressPath(root, appId);
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, stringifyYaml(run, { lineWidth: 0 }), { flag: "wx" });
    return { claimed: true, run };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "EEXIST") throw err;
    const retry = loadActiveRun(appId, root);
    if (retry?.status === "running" && !isActiveRunStale(retry)) {
      return { claimed: false, run: retry };
    }
    saveActiveRun(run, root);
    return { claimed: true, run };
  }
}

export function isOnboardInFlight(appId: string, wathRoot?: string): boolean {
  const run = loadActiveRun(appId, wathRoot);
  return run?.status === "running" && !isActiveRunStale(run);
}

export function recordActiveRunProgress(
  appId: string,
  update: LifecycleProgressUpdate,
  wathRoot?: string
): void {
  const root = wathRoot ?? resolveRepoRoot();
  const existing = loadActiveRun(appId, root);
  if (!existing || existing.status !== "running") return;
  const run: ActiveOnboardRun = {
    ...existing,
    stage: update.stage,
    message: update.message,
    progress: update.progress,
    total: update.total,
    updatedAt: new Date().toISOString(),
  };
  saveActiveRun(run, root);
}

export function completeActiveRun(
  appId: string,
  result: LifecycleResult,
  wathRoot?: string
): void {
  const root = wathRoot ?? resolveRepoRoot();
  const existing = loadActiveRun(appId, root);
  const now = new Date().toISOString();
  const prUrl =
    result.existingPrUrl ??
    result.agent?.prUrl ??
    result.integrateAgent?.prUrl;
  const run: ActiveOnboardRun = {
    appId,
    status: "done",
    stage: prUrl ? "pr_submitted" : existing?.stage,
    message: prUrl ? `PR submitted: ${prUrl}` : "Onboarding complete",
    progress: existing?.total ?? 3,
    total: existing?.total ?? 3,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    result,
  };
  saveActiveRun(run, root);
}

export function failActiveRun(appId: string, error: string, wathRoot?: string): void {
  const root = wathRoot ?? resolveRepoRoot();
  const existing = loadActiveRun(appId, root);
  const now = new Date().toISOString();
  const run: ActiveOnboardRun = {
    appId,
    status: "error",
    message: error,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    error,
  };
  saveActiveRun(run, root);
}

export function clearActiveRun(appId: string, wathRoot?: string): void {
  const root = wathRoot ?? resolveRepoRoot();
  const path = runProgressPath(root, appId);
  if (existsSync(path)) unlinkSync(path);
}

function listActiveRunAppIds(wathRoot: string): string[] {
  const root = join(wathRoot, "state/runs");
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const org of readdirSync(root, { withFileTypes: true })) {
    if (!org.isDirectory() || org.name.startsWith(".")) continue;
    const orgDir = join(root, org.name);
    for (const file of readdirSync(orgDir)) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        out.push(`${org.name}/${file.replace(/\.ya?ml$/, "")}`);
      }
    }
  }
  return out;
}

export function isActiveRunStale(
  run: ActiveOnboardRun,
  maxAgeMs: number = STALE_RUN_MAX_AGE_MS
): boolean {
  if (run.status !== "running") return false;
  const age = Date.now() - Date.parse(run.updatedAt);
  return Number.isFinite(age) && age > maxAgeMs;
}

/** Mark long-running activeRun files as error (e.g. on wath-core startup after redeploy). */
export function sweepStaleActiveRuns(
  wathRoot?: string,
  maxAgeMs: number = STALE_RUN_MAX_AGE_MS
): number {
  const root = wathRoot ?? resolveRepoRoot();
  let swept = 0;
  for (const appId of listActiveRunAppIds(root)) {
    const run = loadActiveRun(appId, root);
    if (run && isActiveRunStale(run, maxAgeMs)) {
      failActiveRun(appId, "Stale run cleared (process restarted or exceeded max age)", root);
      swept++;
    }
  }
  return swept;
}
