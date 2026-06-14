import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampFloatingPanelPosition } from "@/components/editor/useDraggableFloatingPanel";

describe("clampFloatingPanelPosition", () => {
  it("keeps panel inside viewport with padding", () => {
      const clamped = clampFloatingPanelPosition(900, 700, 280, 440, {
        width: 1000,
        height: 800,
      });
      assert.equal(clamped.left, 1000 - 280 - 8);
      assert.equal(clamped.top, 800 - 440 - 8);

      const min = clampFloatingPanelPosition(-50, -20, 280, 440, { width: 1000, height: 800 });
      assert.equal(min.left, 8);
      assert.equal(min.top, 8);
  });
});
