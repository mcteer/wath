import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveRepoRoot } from "../standards/registry.js";
import type { WathSpec } from "../requirements/parser.js";
import { initStateFromWathSpec } from "./state.js";

describe("initStateFromWathSpec", () => {
  it("initializes new integrations as non_compliant until merged", () => {
    const wathRoot = resolveRepoRoot();
    const state = initStateFromWathSpec(
      wathRoot,
      {
        repo: "https://github.com/org/new-app",
        contact: { team: "t", email: "t@example.com" },
        stack: {
          runtime: "kubernetes",
          language: "Go",
          environments: ["dev"],
          applications: { svc: "demo" },
        },
        services: { "vault-dynamic-secrets": { datastore: "postgres" } },
        feedback: {},
      } as unknown as WathSpec,
      "wath.json"
    );

    const entry = state.integrations["vault-dynamic-secrets"];
    assert.ok(entry);
    assert.equal(entry.status, "pending");
    assert.equal(entry.compliance, "non_compliant");
    assert.equal(entry.last_verify, "unknown");
  });
});
