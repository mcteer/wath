import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, afterEach } from "node:test";
import { stringify as stringifyYaml } from "yaml";

import type { ApplicationState } from "./types.js";
import { recordAgentPr } from "./merge.js";

const originalWathRoot = process.env.WATH_ROOT;

function writeState(wathRoot: string, appId: string, state: ApplicationState): void {
  const [org, repo] = appId.split("/");
  const dir = join(wathRoot, "state/applications", org);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${repo}.yaml`), stringifyYaml(state, { lineWidth: 0 }), "utf8");
}

describe("recordAgentPr duplicate PRs", () => {
  let wathRoot: string;

  afterEach(() => {
    if (wathRoot) rmSync(wathRoot, { recursive: true, force: true });
    if (originalWathRoot === undefined) delete process.env.WATH_ROOT;
    else process.env.WATH_ROOT = originalWathRoot;
  });

  it("records integration_pr_duplicate when a second PR URL arrives", () => {
    wathRoot = mkdtempSync(join(tmpdir(), "wath-merge-test-"));
    process.env.WATH_ROOT = wathRoot;

    const appId = "mcteer/demo-app";
    writeState(wathRoot, appId, {
      repo: "https://github.com/mcteer/demo-app",
      wath_path: "wath.json",
      phase: "validate",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "pr_open",
          standard_version: 1,
          pr_url: "https://github.com/mcteer/demo-app/pull/3",
          last_verify: "unknown",
          compliance: "in_compliance",
        },
      },
      history: [],
      updated_at: new Date().toISOString(),
    });

    const updated = recordAgentPr(
      appId,
      "integration",
      "https://github.com/mcteer/demo-app/pull/4",
      "vault-dynamic-secrets"
    );

    assert.equal(
      updated.integrations["vault-dynamic-secrets"].pr_url,
      "https://github.com/mcteer/demo-app/pull/3"
    );
    const dup = updated.history.find((h) => h.event === "integration_pr_duplicate");
    assert.ok(dup);
    assert.match(dup!.detail ?? "", /pull\/4/);
    assert.match(dup!.detail ?? "", /pull\/3/);
  });
});
