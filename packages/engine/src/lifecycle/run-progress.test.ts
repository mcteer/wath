import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { integratingProgress } from "./progress.js";
import {
  beginActiveRun,
  clearActiveRun,
  completeActiveRun,
  failActiveRun,
  loadActiveRun,
  recordActiveRunProgress,
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
});
