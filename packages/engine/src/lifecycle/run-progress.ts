import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { resolveRepoRoot } from "../standards/registry.js";
import type { LifecycleProgressUpdate, LifecycleResult } from "./types.js";

export type ActiveRunStatus = "running" | "done" | "error";

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
