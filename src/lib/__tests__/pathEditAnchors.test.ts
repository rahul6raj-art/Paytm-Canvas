import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pathPointSelectionPosition,
  togglePathPointInSelection,
} from "@/lib/pathEditAnchors";

describe("pathEditAnchors", () => {
  it("toggles path point selection with shift", () => {
    assert.deepEqual(togglePathPointInSelection([], "a", false), ["a"]);
    assert.deepEqual(togglePathPointInSelection(["a"], "b", true), ["a", "b"]);
    assert.deepEqual(togglePathPointInSelection(["a", "b"], "a", true), ["b"]);
  });

  it("reports average position for multi-selected anchors", () => {
    const pos = pathPointSelectionPosition(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 10, y: 20 },
      ],
      ["a", "b"],
    );
    assert.equal(pos?.x, 5);
    assert.equal(pos?.y, 10);
    assert.equal(pos?.mixed, true);
  });
});
