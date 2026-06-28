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
  it("registers underscore names for Cursor MCP settings", () => {
    const names: string[] = listMcpToolDefinitions().map((t) => t.name);
    assert.deepEqual(names, [
      "wath_onboard",
      "wath_status",
      "wath_record_merge",
      "wath_audit",
    ]);
  });
});
