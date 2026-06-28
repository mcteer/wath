import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { stringify as stringifyYaml } from "yaml";

import { resolveRepoRoot } from "../standards/registry.js";
import { loadApplicationState } from "./state.js";
import type { ApplicationState } from "./types.js";
import { pollDrift } from "./poll-drift.js";

const originalApiKey = process.env.CURSOR_API_KEY;
const repoRoot = resolveRepoRoot();

function writeState(wathRoot: string, appId: string, state: ApplicationState): void {
  const [org, repo] = appId.split("/");
  mkdirSync(join(wathRoot, "state/applications", org), { recursive: true });
  writeFileSync(
    join(wathRoot, "state/applications", org, `${repo}.yaml`),
    stringifyYaml(state, { lineWidth: 0 }),
    "utf8"
  );
}

describe("pollDrift", () => {
  let statePath: string | undefined;
  let testDir: string | undefined;

  afterEach(() => {
    if (statePath) rmSync(statePath, { force: true });
    if (testDir) rmSync(testDir, { recursive: true, force: true });
    statePath = undefined;
    testDir = undefined;
    if (originalApiKey === undefined) delete process.env.CURSOR_API_KEY;
    else process.env.CURSOR_API_KEY = originalApiKey;
  });

  it("applies drift flags and triggers onboard for version mismatch", async () => {
    process.env.CURSOR_API_KEY = "test-key";
    const appId = "wath-drift-test/demo-app";
    statePath = join(repoRoot, "state/applications/wath-drift-test/demo-app.yaml");
    testDir = join(repoRoot, "state/applications/wath-drift-test");

    writeState(repoRoot, appId, {
      repo: "https://github.com/wath-drift-test/demo-app",
      wath_path: "wath.json",
      phase: "compliant",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "merged",
          standard_version: 5,
          pr_url: "https://github.com/wath-drift-test/demo-app/pull/1",
          work_branch: null,
          integrate_agent_id: null,
          last_verify: "unknown",
          compliance: "in_compliance",
          retry_count: 0,
        },
      },
      history: [],
      updated_at: new Date().toISOString(),
    });

    const triggered: string[] = [];
    const result = await pollDrift({
      wathRoot: repoRoot,
      triggerOnboard: async (id) => {
        triggered.push(id);
      },
    });

    assert.equal(result.triggered.filter((t) => t.appId === appId).length, 1);
    assert.equal(triggered.filter((id) => id === appId).length, 1);

    const updated = loadApplicationState(repoRoot, appId);
    assert.equal(updated?.integrations["vault-dynamic-secrets"]?.compliance, "drift");
    assert.equal(updated?.phase, "integrate");
  });

  it("skips apps awaiting merge", async () => {
    process.env.CURSOR_API_KEY = "test-key";
    const appId = "wath-drift-test/demo-app2";
    statePath = join(repoRoot, "state/applications/wath-drift-test/demo-app2.yaml");
    testDir = join(repoRoot, "state/applications/wath-drift-test");

    writeState(repoRoot, appId, {
      repo: "https://github.com/wath-drift-test/demo-app2",
      wath_path: "wath.json",
      phase: "await_merge",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "pr_open",
          standard_version: 5,
          pr_url: "https://github.com/wath-drift-test/demo-app2/pull/2",
          work_branch: null,
          integrate_agent_id: null,
          last_verify: "unknown",
          compliance: "in_compliance",
          retry_count: 0,
        },
      },
      history: [],
      updated_at: new Date().toISOString(),
    });

    const result = await pollDrift({
      wathRoot: repoRoot,
      triggerOnboard: async () => {
        assert.fail("should not trigger onboard while await_merge");
      },
    });

    assert.equal(result.triggered.length, 0);
    assert.ok(result.skipped.some((s) => s.appId === appId && s.reason === "await_merge"));
  });
});
