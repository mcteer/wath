import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { stringify as stringifyYaml } from "yaml";

import { resolveRepoRoot } from "../standards/registry.js";
import { loadApplicationState } from "./state.js";
import type { ApplicationState } from "./types.js";
import { reconcileInFlightArtifacts } from "./reconcile-github.js";

const repoRoot = resolveRepoRoot();
const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;

function writeState(wathRoot: string, appId: string, state: ApplicationState): void {
  const [org, repo] = appId.split("/");
  mkdirSync(join(wathRoot, "state/applications", org), { recursive: true });
  writeFileSync(
    join(wathRoot, "state/applications", org, `${repo}.yaml`),
    stringifyYaml(state, { lineWidth: 0 }),
    "utf8"
  );
}

describe("reconcileInFlightArtifacts", () => {
  let statePath: string | undefined;
  let testDir: string | undefined;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (statePath) rmSync(statePath, { force: true });
    if (testDir) rmSync(testDir, { recursive: true, force: true });
    statePath = undefined;
    testDir = undefined;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  it("records open Wath PRs and skips duplicate agent launch", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    const appId = "wath-reconcile-test/demo-app";
    statePath = join(repoRoot, "state/applications/wath-reconcile-test/demo-app.yaml");
    testDir = join(repoRoot, "state/applications/wath-reconcile-test");

    const state: ApplicationState = {
      repo: "https://github.com/wath-reconcile-test/demo-app",
      wath_path: "wath.json",
      phase: "integrate",
      manifest: { status: "accepted", pr_url: null },
      integrations: {
        "vault-dynamic-secrets": {
          status: "pending",
          standard_version: 5,
          pr_url: null,
          work_branch: null,
          integrate_agent_id: null,
          last_verify: "unknown",
          compliance: "drift",
          retry_count: 0,
        },
      },
      history: [],
      updated_at: new Date().toISOString(),
    };
    writeState(repoRoot, appId, state);

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/pulls")) {
        return new Response(
          JSON.stringify([
            {
              html_url: "https://github.com/wath-reconcile-test/demo-app/pull/3",
              title: "Wath onboarding: vault-dynamic-secrets for my-service",
              head: { ref: "cursor/vault-dynamic-secrets-v7" },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("[]", { status: 404 });
    };

    const { state: synced, result } = await reconcileInFlightArtifacts(repoRoot, appId, state);
    assert.equal(result.updated, true);
    assert.equal(result.openPrUrl, "https://github.com/wath-reconcile-test/demo-app/pull/3");
    assert.equal(synced.phase, "await_merge");
    assert.equal(synced.integrations["vault-dynamic-secrets"]?.status, "pr_open");

    const persisted = loadApplicationState(repoRoot, appId);
    assert.equal(persisted?.integrations["vault-dynamic-secrets"]?.pr_url, result.openPrUrl);
  });
});
