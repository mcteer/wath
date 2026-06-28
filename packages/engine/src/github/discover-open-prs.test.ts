import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  listOpenWathPrs,
  parseStandardIdFromWathPrTitle,
} from "./discover-open-prs.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;

describe("discover-open-prs", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  it("parses standard id from Wath PR titles", () => {
    assert.equal(
      parseStandardIdFromWathPrTitle("Wath onboarding: vault-dynamic-secrets for my-service"),
      "vault-dynamic-secrets"
    );
    assert.equal(parseStandardIdFromWathPrTitle("Fix typo"), undefined);
  });

  it("lists open Wath PRs by title or cursor/* head", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    globalThis.fetch = async (input) => {
      const url = String(input);
      assert.match(url, /repos\/mcteer\/demo-app\/pulls/);
      return new Response(
        JSON.stringify([
          {
            html_url: "https://github.com/mcteer/demo-app/pull/9",
            title: "Wath onboarding: vault-dynamic-secrets for my-service",
            head: { ref: "cursor/vault-dynamic-secrets-v7" },
          },
          {
            html_url: "https://github.com/mcteer/demo-app/pull/10",
            title: "Unrelated feature",
            head: { ref: "feature/foo" },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const prs = await listOpenWathPrs("https://github.com/mcteer/demo-app");
    assert.equal(prs.length, 1);
    assert.equal(prs[0]?.prUrl, "https://github.com/mcteer/demo-app/pull/9");
    assert.equal(prs[0]?.standardId, "vault-dynamic-secrets");
  });
});
