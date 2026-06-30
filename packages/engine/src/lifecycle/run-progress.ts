import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { resolveRepoRoot } from "../standards/registry.js";
import type { LifecycleProgressUpdate, LifecycleResult, OnboardingPhase } from "./types.js";

export type ActiveRunStatus = "running" | "done" | "error";

/** Runs older than this are treated as orphaned (e.g. after wath-core redeploy). */
export const STALE_RUN_MAX_AGE_MS = 15 * 60 * 1000;

/** Slim completion payload — no prompts or agent markdown (safe for status polling). */
export interface ActiveRunResultSummary {
  phase?: OnboardingPhase;
  prUrl?: string;
  branch?: string;
  integrateAgentId?: string;
  validateAgentId?: string;
}

export interface ActiveOnboardRun {
  appId: string;
  status: ActiveRunStatus;
  stage?: LifecycleProgressUpdate["stage"];
  message?: string;
  progress?: number;
  total?: number;
  startedAt: string;
  updatedAt: string;
  prUrl?: string;
  branch?: string;
  result?: ActiveRunResultSummary;
  error?: string;
}

/** Poll-friendly activeRun view returned by wath.status (no large text fields). */
export interface ActiveRunStatusView {
  appId: string;
  status: ActiveRunStatus;
  stage?: LifecycleProgressUpdate["stage"];
  message?: string;
  progress?: number;
  total?: number;
  startedAt: string;
  updatedAt: string;
  prUrl?: string;
  branch?: string;
  result?: ActiveRunResultSummary;
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
  const run = parseYaml(readFileSync(path, "utf8")) as ActiveOnboardRun & {
    result?: ActiveRunResultSummary | LifecycleResult;
  };
  return normalizeStoredActiveRun(run);
}

function saveActiveRun(run: ActiveOnboardRun, wathRoot: string = resolveRepoRoot()): void {
  const path = runProgressPath(wathRoot, run.appId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(run, { lineWidth: 0 }), "utf8");
}

function isFullLifecycleResult(value: unknown): value is LifecycleResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "prompt" in value &&
    typeof (value as LifecycleResult).prompt === "string"
  );
}

export function summarizeLifecycleResult(result: LifecycleResult): ActiveRunResultSummary {
  return {
    phase: result.state?.phase ?? result.phase,
    prUrl: result.agent?.prUrl ?? result.integrateAgent?.prUrl ?? result.existingPrUrl,
    branch: result.agent?.branch ?? result.integrateAgent?.branch,
    integrateAgentId: result.integrateAgent?.agentId,
    validateAgentId: result.agent?.agentId,
  };
}

function normalizeStoredActiveRun(
  run: ActiveOnboardRun & { result?: ActiveRunResultSummary | LifecycleResult }
): ActiveOnboardRun {
  const summary = run.result
    ? isFullLifecycleResult(run.result)
      ? summarizeLifecycleResult(run.result)
      : run.result
    : undefined;
  return {
    appId: run.appId,
    status: run.status,
    stage: run.stage,
    message: run.message,
    progress: run.progress,
    total: run.total,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    error: run.error,
    prUrl: run.prUrl ?? summary?.prUrl,
    branch: run.branch ?? summary?.branch,
    ...(summary ? { result: summary } : {}),
  };
}

/** Strip legacy full results before returning via wath.status / REST. */
export function toActiveRunStatusView(run: ActiveOnboardRun | null): ActiveRunStatusView | null {
  if (!run) return null;
  const normalized = normalizeStoredActiveRun(run);
  return {
    appId: normalized.appId,
    status: normalized.status,
    stage: normalized.stage,
    message: normalized.message,
    progress: normalized.progress,
    total: normalized.total,
    startedAt: normalized.startedAt,
    updatedAt: normalized.updatedAt,
    prUrl: normalized.prUrl,
    branch: normalized.branch,
    error: normalized.error,
    ...(normalized.result ? { result: normalized.result } : {}),
  };
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
    ...(update.prUrl ? { prUrl: update.prUrl } : {}),
    ...(update.branch ? { branch: update.branch } : {}),
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
  const summary = summarizeLifecycleResult(result);
  const prUrl = summary.prUrl;
  const driftResolved = existing?.stage === "drift_resolved";
  const run: ActiveOnboardRun = {
    appId,
    status: "done",
    stage: prUrl ? "pr_submitted" : driftResolved ? "drift_resolved" : existing?.stage,
    message: prUrl
      ? `PR submitted: ${prUrl}`
      : driftResolved && existing?.message
        ? existing.message
        : "Onboarding complete",
    progress: existing?.total ?? 3,
    total: existing?.total ?? 3,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    prUrl,
    branch: summary.branch ?? existing?.branch,
    result: summary,
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
