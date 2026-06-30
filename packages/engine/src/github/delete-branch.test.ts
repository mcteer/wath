import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { deleteRemoteBranch } from "./delete-branch.js";

describe("deleteRemoteBranch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("skips protected default branches", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("ok");
    };
    await deleteRemoteBranch("https://github.com/org/app", "main");
    assert.equal(called, false);
  });

  it("deletes a remote branch ref", async () => {
    let method: string | undefined;
    let url: string | undefined;
    globalThis.fetch = async (input, init) => {
      url = String(input);
      method = init?.method;
      return new Response(null, { status: 204 });
    };
    await deleteRemoteBranch("https://github.com/org/app", "cursor/foo-bar", "test-token");
    assert.equal(method, "DELETE");
    assert.match(url!, /repos\/org\/app\/git\/refs\/heads\/cursor%2Ffoo-bar/);
  });

  it("ignores 404 when branch is already gone", async () => {
    globalThis.fetch = async () => new Response("missing", { status: 404 });
    await assert.doesNotReject(() =>
      deleteRemoteBranch("https://github.com/org/app", "cursor/gone", "test-token")
    );
  });
});
