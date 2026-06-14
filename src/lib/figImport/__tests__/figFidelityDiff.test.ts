import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots, nodeFidelityReport } from "../figFidelityDiff";
import type { FigmaComparableSnapshot } from "../figFidelityTypes";

function snap(partial: Partial<FigmaComparableSnapshot>): FigmaComparableSnapshot {
  return {
    nodeType: "frame",
    name: "Test",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    ...partial,
  };
}

describe("figFidelityDiff", () => {
  it("detects geometry and auto-layout mismatches", () => {
    const figma = snap({
      x: 10,
      y: 20,
      width: 200,
      height: 80,
      layoutMode: "horizontal",
      layoutGap: 8,
    });
    const canvas = snap({
      x: 12,
      y: 20,
      width: 200,
      height: 80,
      layoutMode: "none",
      layoutGap: 0,
    });
    const mismatches = diffSnapshots(figma, canvas);
    assert.ok(mismatches.some((m) => m.field === "x"));
    assert.ok(mismatches.some((m) => m.field === "layoutMode"));
    assert.ok(mismatches.some((m) => m.engine === "layout"));
  });

  it("builds node report with bounds deltas", () => {
    const figma = snap({ x: 0, y: 0, width: 100, height: 40, fill: "#ff0000" });
    const canvas = snap({ x: 5, y: 0, width: 110, height: 40, fill: "#00ff00" });
    const report = nodeFidelityReport("n1", figma, canvas);
    assert.equal(report.nodeId, "n1");
    assert.equal(report.positionDelta.dx, 5);
    assert.equal(report.sizeDelta.dw, 10);
    assert.ok(report.fidelityScore < 100);
    assert.ok(report.mismatches.length >= 2);
  });

  it("sorts mismatches by impact", () => {
    const figma = snap({ layoutMode: "vertical", fill: "#111" });
    const canvas = snap({ layoutMode: "none", fill: "#222" });
    const mismatches = diffSnapshots(figma, canvas);
    for (let i = 1; i < mismatches.length; i++) {
      assert.ok(mismatches[i - 1]!.impact >= mismatches[i]!.impact);
    }
  });
});
