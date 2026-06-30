import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDriftRemediatePrompt, buildValidatePrompt } from "./prompts.js";
import type { OnboardingContext } from "../onboarding/pipeline.js";
import { resolveRepoRoot } from "../standards/registry.js";

const repoRoot = resolveRepoRoot();
const context = {
  repoRoot,
  consumerRoot: "/consumer",
  runtime: "kubernetes",
  wathSpec: {
    repo: "https://github.com/org/app",
    contact: { team: "t", email: "t@example.com" },
    stack: {
      runtime: "kubernetes",
      language: "Go",
      environments: ["dev"],
      applications: { "my-service": "inventory" },
    },
    services: { "vault-dynamic-secrets": { datastore: "postgres" } },
    feedback: {},
  },
} as unknown as OnboardingContext;

describe("buildDriftRemediatePrompt", () => {
  it("instructs minimal diff from main and references version delta", () => {
    const prompt = buildDriftRemediatePrompt(context, {
      standardId: "vault-dynamic-secrets",
      fromVersion: 7,
      toVersion: 8,
      contentVersion: 5,
      versionNotes: "No content change — verify only.",
      targetChangelog: "Fix gate failures only.",
    });
    assert.match(prompt, /drift remediation/i);
    assert.match(prompt, /minimal diff/i);
    assert.match(prompt, /Start from `main`/);
    assert.match(prompt, /v7.*v8/s);
    assert.match(prompt, /Do NOT regenerate.*vault\/policy\.hcl/is);
    assert.match(prompt, /Fix gate failures only/);
  });
});

describe("buildValidatePrompt", () => {
  it("requires continuing on the integrate branch when workBranch is set", () => {
    const prompt = buildValidatePrompt(
      context,
      "vault-dynamic-secrets",
      "cursor/vault-dynamic-secrets-3006"
    );
    assert.match(prompt, /Integration branch \(required\)/);
    assert.match(prompt, /cursor\/vault-dynamic-secrets-3006/);
    assert.match(prompt, /do not create a new branch/i);
  });

  it("instructs same-branch PR when sameAgentSession is set", () => {
    const prompt = buildValidatePrompt(context, "vault-dynamic-secrets", undefined, {
      sameAgentSession: true,
    });
    assert.match(prompt, /Same agent session/);
    assert.match(prompt, /autoCreatePR/);
    assert.match(prompt, /Do NOT create a new branch/);
  });

  it("includes drift remediation PR guidance when requested", () => {
    const prompt = buildValidatePrompt(context, "vault-dynamic-secrets", "cursor/foo", {
      driftRemediation: {
        standardId: "vault-dynamic-secrets",
        fromVersion: 7,
        toVersion: 8,
        contentVersion: 5,
      },
    });
    assert.match(prompt, /Drift remediation/);
    assert.match(prompt, /wath-drift-remediation\.md/);
    assert.match(prompt, /DRIFT_NO_PR_REQUIRED/);
    assert.match(prompt, /Do \*\*not\*\* copy the full first-onboarding artifact checklist/);
    assert.doesNotMatch(prompt, /Artifacts in this PR.*integration\.params\.json/s);
  });
});

describe("buildCreatePrRetryPrompt", () => {
  it("focuses on PR creation without re-integrating", async () => {
    const { buildCreatePrRetryPrompt } = await import("./prompts.js");
    const prompt = buildCreatePrRetryPrompt(
      context,
      "vault-dynamic-secrets",
      "cursor/vault-dynamic-secrets-8a32",
      2
    );
    assert.match(prompt, /attempt 2/);
    assert.match(prompt, /cursor\/vault-dynamic-secrets-8a32/);
    assert.match(prompt, /Do NOT.*re-integrate/is);
    assert.match(prompt, /autoCreatePR/);
  });
});
