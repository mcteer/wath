import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGitHubPrUrl } from "./pr-url.js";

describe("parseGitHubPrUrl", () => {
  it("parses standard GitHub PR URLs", () => {
    assert.deepEqual(parseGitHubPrUrl("https://github.com/mcteer/demo-app/pull/13"), {
      owner: "mcteer",
      repo: "demo-app",
      number: 13,
    });
  });

  it("returns null for non-PR URLs", () => {
    assert.equal(parseGitHubPrUrl("https://github.com/mcteer/demo-app"), null);
  });
});
