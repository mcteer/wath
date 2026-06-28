import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasAwaitableOpenPr,
  integrationAwaitingPr,
  resolveEffectivePhase,
} from "./phase.js";
import type { ApplicationState } from "./types.js";
import type { WathSpec } from "../requirements/parser.js";

const spec = {
  repo: "https://github.com/mcteer/demo-app",
  contact: { team: "t", email: "t@example.com" },
  stack: {
    runtime: "kubernetes",
    language: "Go",
    environments: ["dev"],
    applications: { "my-service": "app" },
  },
  services: { "vault-dynamic-secrets": { datastore: "postgres" } },
  feedback: {},
} as unknown as WathSpec;

function baseState(overrides: Partial<ApplicationState> = {}): ApplicationState {
  return {
    repo: spec.repo,
    wath_path: "wath.json",
    phase: "integrate",
    manifest: { status: "accepted", pr_url: null },
    integrations: {
      "vault-dynamic-secrets": {
        status: "pending",
        standard_version: 4,
        pr_url: null,
        work_branch: null,
        integrate_agent_id: null,
        last_verify: "unknown",
        compliance: "in_compliance",
      },
    },
    current_standard_id: "vault-dynamic-secrets",
    history: [],
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolveEffectivePhase", () => {
  it("resumes validate when integrate finished but PR was never recorded", () => {
    const state = baseState({
      phase: "await_merge",
      integrations: {
        "vault-dynamic-secrets": {
          status: "pending",
          standard_version: 4,
          pr_url: null,
          work_branch: "cursor/vault-dynamic-secrets-integration-8a32",
          integrate_agent_id: "bc-agent",
          last_verify: "unknown",
          compliance: "in_compliance",
        },
      },
    });
    assert.equal(resolveEffectivePhase(state, spec), "validate");
  });

  it("stays on await_merge when an integration PR is open", () => {
    const state = baseState({
      phase: "await_merge",
      integrations: {
        "vault-dynamic-secrets": {
          status: "pr_open",
          standard_version: 4,
          pr_url: "https://github.com/mcteer/demo-app/pull/7",
          last_verify: "unknown",
          compliance: "in_compliance",
        },
      },
    });
    assert.equal(resolveEffectivePhase(state, spec), "await_merge");
    assert.equal(hasAwaitableOpenPr(state), true);
  });

  it("detects integration awaiting PR", () => {
    const state = baseState({
      integrations: {
        "vault-dynamic-secrets": {
          status: "pending",
          standard_version: 4,
          pr_url: null,
          work_branch: "cursor/foo",
          integrate_agent_id: null,
          last_verify: "unknown",
          compliance: "in_compliance",
        },
      },
    });
    assert.equal(integrationAwaitingPr(state, "vault-dynamic-secrets"), true);
  });
});
