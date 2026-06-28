import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { requireGitHubToken, resolveGitHubToken } from "./token.js";

describe("requireGitHubToken", () => {
  const originalGithub = process.env.GITHUB_TOKEN;
  const originalGh = process.env.GH_TOKEN;

  afterEach(() => {
    if (originalGithub === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalGithub;
    if (originalGh === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = originalGh;
  });

  it("returns GITHUB_TOKEN when set", () => {
    process.env.GITHUB_TOKEN = "ghp_test";
    delete process.env.GH_TOKEN;
    assert.equal(resolveGitHubToken(), "ghp_test");
    assert.equal(requireGitHubToken(), "ghp_test");
  });

  it("falls back to GH_TOKEN", () => {
    delete process.env.GITHUB_TOKEN;
    process.env.GH_TOKEN = "ghp_alt";
    assert.equal(requireGitHubToken(), "ghp_alt");
  });

  it("throws when neither token is set", () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    assert.throws(() => requireGitHubToken("merge poll"), /requires GITHUB_TOKEN/);
  });
});
