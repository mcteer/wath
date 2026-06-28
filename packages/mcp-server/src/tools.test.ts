import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listMcpToolDefinitions, resolveMcpToolName } from "./tools.js";

describe("resolveMcpToolName", () => {
  it("maps underscore aliases to canonical tool names", () => {
    assert.equal(resolveMcpToolName("wath_onboard"), "wath.onboard");
    assert.equal(resolveMcpToolName("wath.record_merge"), "wath.record_merge");
    assert.equal(resolveMcpToolName("wath.onboard"), "wath.onboard");
  });
});

describe("listMcpToolDefinitions", () => {
  it("includes underscore aliases for dotted tool names", () => {
    const names: string[] = listMcpToolDefinitions().map((t) => t.name);
    assert.ok(names.some((n) => n === "wath.onboard"));
    assert.ok(names.some((n) => n === "wath_onboard"));
  });
});
