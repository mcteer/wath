import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  summarizeLifecycleResult,
  sweepStaleActiveRuns,
  STALE_RUN_MAX_AGE_MS,
  toActiveRunStatusView,
  tryClaimActiveRun,
} from "./run-progress.js";
import type { LifecycleResult } from "./types.js";

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
        prompt: "x".repeat(5000),
        agent: {
          agentId: "a",
          runId: "r",
          status: "ok",
          prUrl: "https://github.com/mcteer/demo-app/pull/1",
          branch: "cursor/vault-dynamic-secrets-integration-abc",
          result: "## long agent markdown\n\nwith many lines",
        },
      },
      wathRoot
    );
    const done = loadActiveRun(appId, wathRoot);
    assert.equal(done?.status, "done");
    assert.match(done?.message ?? "", /pull\/1/);
    assert.equal(done?.prUrl, "https://github.com/mcteer/demo-app/pull/1");
    assert.equal(done?.branch, "cursor/vault-dynamic-secrets-integration-abc");
    assert.equal(done?.result?.prUrl, "https://github.com/mcteer/demo-app/pull/1");
    assert.equal((done?.result as { prompt?: string } | undefined)?.prompt, undefined);

    const view = toActiveRunStatusView(done);
    const serialized = JSON.stringify(view);
    assert.ok(serialized.length < 2000, "status view stays small for polling");
    const py = spawnSync("python3", ["-c", "import json,sys; json.loads(sys.stdin.read())"], {
      input: serialized,
    });
    assert.equal(py.status, 0, py.stderr?.toString());
    clearActiveRun(appId, wathRoot);
  });

  it("normalizes legacy full result blobs in stored runs", () => {
    beginActiveRun(appId, wathRoot);
    const legacyResult: LifecycleResult = {
      appId,
      phase: "await_merge",
      state: {} as never,
      prompt: "line1\nline2\ncontrol\x07char",
      agent: {
        agentId: "v",
        runId: "r",
        status: "ok",
        prUrl: "https://github.com/mcteer/demo-app/pull/9",
        branch: "cursor/test",
      },
    };
    writeFileSync(
      join(wathRoot, "state/runs/mcteer/demo-app.yaml"),
      stringifyYaml(
        {
          appId,
          status: "done",
          message: "PR submitted",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          result: legacyResult,
        },
        { lineWidth: 0 }
      ),
      "utf8"
    );
    const view = toActiveRunStatusView(loadActiveRun(appId, wathRoot));
    assert.equal(view?.prUrl, "https://github.com/mcteer/demo-app/pull/9");
    assert.equal(view?.branch, "cursor/test");
    assert.equal(JSON.stringify(view).includes("line1"), false);
    clearActiveRun(appId, wathRoot);
  });

  it("records branch during validate progress", () => {
    beginActiveRun(appId, wathRoot);
    recordActiveRunProgress(
      appId,
      {
        stage: "validating",
        progress: 2,
        total: 3,
        message: "Validating…",
        branch: "cursor/vault-dynamic-secrets-integration-xyz",
      },
      wathRoot
    );
    const run = loadActiveRun(appId, wathRoot);
    assert.equal(run?.branch, "cursor/vault-dynamic-secrets-integration-xyz");
    clearActiveRun(appId, wathRoot);
  });

  it("summarizes lifecycle results", () => {
    const summary = summarizeLifecycleResult({
      appId,
      phase: "await_merge",
      state: {} as never,
      prompt: "ignored",
      integrateAgent: { agentId: "i", runId: "r1", status: "ok", branch: "cursor/b" },
      agent: { agentId: "v", runId: "r2", status: "ok", prUrl: "https://github.com/o/r/pull/3" },
    });
    assert.equal(summary.integrateAgentId, "i");
    assert.equal(summary.validateAgentId, "v");
    assert.equal(summary.branch, "cursor/b");
    assert.equal(summary.prUrl, "https://github.com/o/r/pull/3");
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
