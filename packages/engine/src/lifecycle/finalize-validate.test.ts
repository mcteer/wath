import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, afterEach } from "node:test";
import { stringify as stringifyYaml } from "yaml";

import type { ApplicationState } from "./types.js";
import { recordDriftResolvedWithoutPr } from "./merge.js";
import { agentSignaledDriftNoPr, DRIFT_NO_PR_REQUIRED } from "./finalize-validate.js";

const originalWathRoot = process.env.WATH_ROOT;

function writeState(wathRoot: string, appId: string, state: ApplicationState): void {
  const [org, repo] = appId.split("/");
  const dir = join(wathRoot, "state/applications", org);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${repo}.yaml`), stringifyYaml(state, { lineWidth: 0 }), "utf8");
}

describe("recordDriftResolvedWithoutPr", () => {
  let wathRoot: string;

  afterEach(() => {
    if (wathRoot) rmSync(wathRoot, { recursive: true, force: true });
    if (originalWathRoot === undefined) delete process.env.WATH_ROOT;
    else process.env.WATH_ROOT = originalWathRoot;
  });

  it("bumps standard_version and returns to compliant without a PR", () => {
    wathRoot = mkdtempSync(join(tmpdir(), "wath-drift-noop-"));
    process.env.WATH_ROOT = wathRoot;

    const appId = "mcteer/demo-app";
    writeState(wathRoot, appId, {
      repo: "https://github.com/mcteer/demo-app",
      wath_path: "wath.json",
      phase: "integrate",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "pending",
          standard_version: 7,
          pr_url: null,
          work_branch: "cursor/vault-v8",
          last_verify: "unknown",
          compliance: "drift",
        },
      },
      history: [],
      updated_at: new Date().toISOString(),
    });

    const updated = recordDriftResolvedWithoutPr(appId, "vault-dynamic-secrets", 8);

    assert.equal(updated.integrations["vault-dynamic-secrets"].standard_version, 8);
    assert.equal(updated.integrations["vault-dynamic-secrets"].status, "merged");
    assert.equal(updated.integrations["vault-dynamic-secrets"].compliance, "in_compliance");
    assert.equal(updated.integrations["vault-dynamic-secrets"].last_verify, "passed");
    assert.equal(updated.integrations["vault-dynamic-secrets"].work_branch, null);
    assert.equal(updated.phase, "compliant");
    assert.ok(updated.history.some((h) => h.event === "drift_resolved_no_pr"));
  });
});

describe("agentSignaledDriftNoPr", () => {
  it("detects DRIFT_NO_PR_REQUIRED in agent result text", () => {
    assert.equal(
      agentSignaledDriftNoPr({
        agentId: "a",
        runId: "r",
        status: "completed",
        result: `Verify passed. ${DRIFT_NO_PR_REQUIRED}`,
      }),
      true
    );
    assert.equal(
      agentSignaledDriftNoPr({ agentId: "a", runId: "r", status: "completed" }),
      false
    );
  });
});
