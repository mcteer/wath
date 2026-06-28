import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSseEvent } from "./sse.js";

describe("formatSseEvent", () => {
  it("formats a single-line JSON payload", () => {
    assert.equal(
      formatSseEvent("progress", { stage: "integrating", progress: 1 }),
      'event: progress\ndata: {"stage":"integrating","progress":1}\n\n'
    );
  });

  it("splits multiline JSON across data lines", () => {
    const frame = formatSseEvent("done", { message: "line1\nline2" });
    assert.match(frame, /^event: done\n/);
    assert.match(frame, /data: .*line1\\nline2/);
    assert.ok(frame.endsWith("\n\n"));
  });
});
