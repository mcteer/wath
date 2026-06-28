import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { artifactChecklistMarkdown, artifactPrSectionMarkdown } from "./artifacts.js";
import { resolveStandard, resolveRepoRoot } from "../standards/registry.js";

describe("artifact PR descriptions", () => {
  const standard = resolveStandard(resolveRepoRoot(), "vault-dynamic-secrets");

  it("includes one-line purpose per artifact when includePurpose is set", () => {
    const md = artifactChecklistMarkdown(standard, { includePurpose: true });
    assert.match(md, /integration\.params\.json.*Typed source of truth/);
    assert.match(md, /vault\/policy\.hcl.*Least-privilege/);
    assert.match(md, /vso-dynamic-secret.*Vault Secrets Operator/);
  });

  it("artifactPrSectionMarkdown adds app-level items", () => {
    const md = artifactPrSectionMarkdown(standard);
    assert.match(md, /Application code changes/);
    assert.match(md, /Removed static secrets/);
  });
});
