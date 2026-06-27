import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  clearOnboardLocks,
  releaseOnboardLock,
  tryAcquireOnboardLock,
} from "./in-flight.js";

describe("onboard in-flight lock", () => {
  beforeEach(() => clearOnboardLocks());

  it("allows first acquire per appId", () => {
    const result = tryAcquireOnboardLock("org/app", "integrate");
    assert.equal(result.acquired, true);
  });

  it("rejects second acquire while lock held", () => {
    tryAcquireOnboardLock("org/app", "integrate");
    const second = tryAcquireOnboardLock("org/app", "validate");
    assert.equal(second.acquired, false);
    if (!second.acquired) {
      assert.equal(second.active.phase, "integrate");
    }
  });

  it("allows re-acquire after release", () => {
    tryAcquireOnboardLock("org/app", "integrate");
    releaseOnboardLock("org/app");
    const again = tryAcquireOnboardLock("org/app", "validate");
    assert.equal(again.acquired, true);
  });

  it("isolates locks by appId", () => {
    tryAcquireOnboardLock("org/a", "integrate");
    const other = tryAcquireOnboardLock("org/b", "integrate");
    assert.equal(other.acquired, true);
  });
});
