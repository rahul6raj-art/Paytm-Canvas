import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextRevision } from "../envelope.js";

describe("craft-api envelope", () => {
  it("nextRevision bumps numeric revision strings", () => {
    assert.equal(nextRevision("1"), "2");
    assert.equal(nextRevision("42"), "43");
  });
});
