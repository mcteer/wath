import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDriftRemediation, resolveDriftRemediation } from "./drift-context.js";
import type { IntegrationState } from "./types.js";
import { resolveRepoRoot } from "../standards/registry.js";

const repoRoot = resolveRepoRoot();

function integration(overrides: Partial<IntegrationState> = {}): IntegrationState {
  return {
    status: "pending",
    standard_version: 7,
    pr_url: null,
    work_branch: null,
    integrate_agent_id: null,
    last_verify: "unknown",
    compliance: "drift",
    retry_count: 0,
    ...overrides,
  };
}

describe("drift-context", () => {
  it("detects drift remediation when compliance is drift and version lags registry", () => {
    assert.equal(isDriftRemediation(integration(), 8), true);
    assert.equal(isDriftRemediation(integration({ compliance: "in_compliance" }), 8), false);
    assert.equal(isDriftRemediation(integration({ standard_version: 8 }), 8), false);
  });

  it("resolves version notes and changelog from registry", () => {
    const info = resolveDriftRemediation(
      repoRoot,
      "vault-dynamic-secrets",
      integration()
    );
    assert.ok(info);
    assert.equal(info.fromVersion, 7);
    assert.equal(info.toVersion, 8);
    assert.match(info.versionNotes ?? "", /minimal diff/i);
    assert.match(info.targetChangelog ?? "", /No standard content change/i);
  });
});
