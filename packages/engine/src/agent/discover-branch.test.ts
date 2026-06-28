import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseBranchFromAgentText } from "./discover-branch.js";

describe("parseBranchFromAgentText", () => {
  it("extracts branch from Branch: backtick format", () => {
    assert.equal(
      parseBranchFromAgentText("Branch: `cursor/vault-dynamic-secrets-integration-984b`"),
      "cursor/vault-dynamic-secrets-integration-984b"
    );
  });

  it("returns undefined when no cursor branch mentioned", () => {
    assert.equal(parseBranchFromAgentText("Integration complete."), undefined);
  });
});
