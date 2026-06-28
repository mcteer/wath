import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { stringify as stringifyYaml } from "yaml";

import { resolveRepoRoot } from "../standards/registry.js";
import type { ApplicationState } from "./types.js";
import { pollMergedPrs } from "./poll-merges.js";

const originalWathRoot = process.env.WATH_ROOT;
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

describe("pollMergedPrs", () => {
  let statePath: string | undefined;
  let testDir: string | undefined;

  afterEach(() => {
    if (statePath) rmSync(statePath, { force: true });
    if (testDir) rmSync(testDir, { recursive: true, force: true });
    statePath = undefined;
    testDir = undefined;
    if (originalWathRoot === undefined) delete process.env.WATH_ROOT;
    else process.env.WATH_ROOT = originalWathRoot;
  });

  it("records integration merge when GitHub reports merged", async () => {
    process.env.WATH_ROOT = repoRoot;
    const appId = "wath-poll-test/demo-app";
    statePath = join(repoRoot, "state/applications/wath-poll-test/demo-app.yaml");
    testDir = join(repoRoot, "state/applications/wath-poll-test");

    const prUrl = "https://github.com/mcteer/demo-app/pull/99";
    writeState(repoRoot, appId, {
      repo: "https://github.com/mcteer/demo-app",
      wath_path: "wath.json",
      phase: "await_merge",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "pr_open",
          standard_version: 5,
          pr_url: prUrl,
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

    const result = await pollMergedPrs({
      wathRoot: repoRoot,
      githubToken: "test-token",
      isMerged: async (url) => url === prUrl,
    });

    assert.equal(result.recorded.length, 1);
    assert.equal(result.recorded[0]?.type, "integration");
    assert.equal(result.recorded[0]?.standardId, "vault-dynamic-secrets");

    const { loadApplicationState } = await import("./state.js");
    const updated = loadApplicationState(repoRoot, appId);
    assert.equal(updated?.phase, "compliant");
    assert.equal(updated?.integrations["vault-dynamic-secrets"]?.status, "merged");
  });

  it("ignores apps not in await_merge", async () => {
    process.env.WATH_ROOT = repoRoot;
    const appId = "wath-poll-test/demo-app2";
    statePath = join(repoRoot, "state/applications/wath-poll-test/demo-app2.yaml");
    testDir = join(repoRoot, "state/applications/wath-poll-test");

    writeState(repoRoot, appId, {
      repo: "https://github.com/mcteer/demo-app",
      wath_path: "wath.json",
      phase: "integrate",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "pr_open",
          standard_version: 5,
          pr_url: "https://github.com/mcteer/demo-app/pull/13",
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

    const result = await pollMergedPrs({
      wathRoot: repoRoot,
      githubToken: "test-token",
      isMerged: async () => true,
    });
    assert.equal(result.recorded.length, 0);
  });
});
