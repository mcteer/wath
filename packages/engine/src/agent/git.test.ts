import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractAgentBranch } from "./git.js";

describe("extractAgentBranch", () => {
  it("prefers a branch without a PR (integrate run)", () => {
    assert.equal(
      extractAgentBranch([
        { branch: "cursor/vault-dynamic-secrets-3006" },
        { branch: "main" },
      ]),
      "cursor/vault-dynamic-secrets-3006"
    );
  });

  it("falls back to any named branch", () => {
    assert.equal(
      extractAgentBranch([{ branch: "cursor/foo", prUrl: "https://github.com/x/pull/1" }]),
      "cursor/foo"
    );
  });

  it("returns undefined when no branch names", () => {
    assert.equal(extractAgentBranch([]), undefined);
    assert.equal(extractAgentBranch(undefined), undefined);
  });
});
