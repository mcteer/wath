import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildIntegrationPrTitle } from "./create-pr.js";

describe("buildIntegrationPrTitle", () => {
  it("includes app name when provided", () => {
    assert.equal(
      buildIntegrationPrTitle("vault-dynamic-secrets", "my-service"),
      "Wath onboarding: vault-dynamic-secrets for my-service"
    );
  });

  it("omits app suffix when unknown", () => {
    assert.equal(buildIntegrationPrTitle("vault-dynamic-secrets"), "Wath onboarding: vault-dynamic-secrets");
  });
});
