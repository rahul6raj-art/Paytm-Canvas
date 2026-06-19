import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { alignDiffSides, diffLines } from "../textDiff";

describe("textDiff", () => {
  it("diffs added and removed lines", () => {
    const d = diffLines("a\nb\nc", "a\nx\nc");
    assert.ok(d.some((l) => l.kind === "remove" && l.text === "b"));
    assert.ok(d.some((l) => l.kind === "add" && l.text === "x"));
  });

  it("aligns sides for UI", () => {
    const rows = alignDiffSides("a\nold", "a\nnew");
    assert.equal(rows[0]?.kind, "same");
    assert.equal(rows[1]?.kind, "change");
    assert.equal(rows[1]?.left, "old");
    assert.equal(rows[1]?.right, "new");
  });
});
