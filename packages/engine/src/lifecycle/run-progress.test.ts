import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { stringify as stringifyYaml } from "yaml";

import { integratingProgress } from "./progress.js";
import {
  beginActiveRun,
  clearActiveRun,
  completeActiveRun,
  failActiveRun,
  isActiveRunStale,
  isOnboardInFlight,
  loadActiveRun,
  recordActiveRunProgress,
  sweepStaleActiveRuns,
  STALE_RUN_MAX_AGE_MS,
  tryClaimActiveRun,
} from "./run-progress.js";

describe("run progress persistence", () => {
  const wathRoot = mkdtempSync(join(tmpdir(), "wath-run-progress-"));
  const appId = "mcteer/demo-app";

  it("records milestones and completion", () => {
    beginActiveRun(appId, wathRoot);
    recordActiveRunProgress(appId, integratingProgress("vault-dynamic-secrets"), wathRoot);
    const mid = loadActiveRun(appId, wathRoot);
    assert.equal(mid?.status, "running");
    assert.equal(mid?.stage, "integrating");

    completeActiveRun(
      appId,
      {
        appId,
        phase: "await_merge",
        state: {} as never,
        prompt: "",
        agent: { agentId: "a", runId: "r", status: "ok", prUrl: "https://github.com/mcteer/demo-app/pull/1" },
      },
      wathRoot
    );
    const done = loadActiveRun(appId, wathRoot);
    assert.equal(done?.status, "done");
    assert.match(done?.message ?? "", /pull\/1/);
  });

  it("records failures", () => {
    beginActiveRun(appId, wathRoot);
    failActiveRun(appId, "Agent run failed", wathRoot);
    assert.equal(loadActiveRun(appId, wathRoot)?.status, "error");
    clearActiveRun(appId, wathRoot);
    assert.equal(loadActiveRun(appId, wathRoot), null);
  });

  it("detects and sweeps stale running activeRun files", () => {
    beginActiveRun(appId, wathRoot);
    const run = loadActiveRun(appId, wathRoot)!;
    run.updatedAt = new Date(Date.now() - STALE_RUN_MAX_AGE_MS - 1000).toISOString();
    run.startedAt = run.updatedAt;
    writeFileSync(
      join(wathRoot, "state/runs/mcteer/demo-app.yaml"),
      stringifyYaml(run, { lineWidth: 0 }),
      "utf8"
    );

    assert.equal(isActiveRunStale(run), true);
    assert.equal(sweepStaleActiveRuns(wathRoot), 1);
    assert.equal(loadActiveRun(appId, wathRoot)?.status, "error");
    clearActiveRun(appId, wathRoot);
  });

  it("tryClaimActiveRun rejects concurrent claims", () => {
    clearActiveRun(appId, wathRoot);
    const first = tryClaimActiveRun(appId, wathRoot);
    assert.equal(first.claimed, true);
    assert.equal(isOnboardInFlight(appId, wathRoot), true);

    const second = tryClaimActiveRun(appId, wathRoot);
    assert.equal(second.claimed, false);

    clearActiveRun(appId, wathRoot);
  });
});
