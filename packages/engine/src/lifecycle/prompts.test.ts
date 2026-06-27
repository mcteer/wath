import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildValidatePrompt } from "./prompts.js";
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
    assert.match(prompt, /from `cursor\/vault-dynamic-secrets-3006`/);
  });
});
