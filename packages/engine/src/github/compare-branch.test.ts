import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEphemeralVerifyPath,
  meaningfulIntegrationDiffPaths,
} from "./compare-branch.js";

describe("meaningfulIntegrationDiffPaths", () => {
  it("excludes .wath verify artifacts", () => {
    const files = [
      "vault/policy.hcl",
      ".wath/verify-summary.json",
      ".wath/verification-evidence.json",
    ];
    assert.deepEqual(meaningfulIntegrationDiffPaths(files), ["vault/policy.hcl"]);
  });

  it("returns empty when only ephemeral paths changed", () => {
    assert.deepEqual(
      meaningfulIntegrationDiffPaths([
        ".wath/verify-summary.json",
        ".wath/verification-evidence.json",
      ]),
      []
    );
  });

  it("isEphemeralVerifyPath matches .wath root", () => {
    assert.equal(isEphemeralVerifyPath(".wath/foo.json"), true);
    assert.equal(isEphemeralVerifyPath("k8s/deployment.yaml"), false);
  });
});
