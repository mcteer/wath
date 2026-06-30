import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ONBOARD_PROGRESS_TOTAL,
  driftResolvedProgress,
  integratingProgress,
  prSubmittedProgress,
  validatingProgress,
} from "./progress.js";

describe("onboard progress messages", () => {
  it("uses monotonic progress steps 1–3", () => {
    const integrate = integratingProgress("vault-dynamic-secrets");
    const validate = validatingProgress("vault-dynamic-secrets");
    const pr = prSubmittedProgress(
      "vault-dynamic-secrets",
      "https://github.com/org/app/pull/1"
    );
    assert.equal(integrate.progress, 1);
    assert.equal(validate.progress, 2);
    assert.equal(pr.progress, ONBOARD_PROGRESS_TOTAL);
    assert.equal(pr.total, ONBOARD_PROGRESS_TOTAL);
    assert.match(integrate.message, /Integrating vault-dynamic-secrets/);
    assert.match(validate.message, /Validating vault-dynamic-secrets/);
    assert.match(pr.message, /PR submitted: https:\/\/github.com\/org\/app\/pull\/1/);
  });

  it("uses drift_resolved stage when no PR is required", () => {
    const resolved = driftResolvedProgress("vault-dynamic-secrets", 8);
    assert.equal(resolved.stage, "drift_resolved");
    assert.equal(resolved.progress, ONBOARD_PROGRESS_TOTAL);
    assert.match(resolved.message, /no PR required/);
  });
});
