import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boxShadowEdgeHairline,
  structuralHairlinesFromStyles,
} from "@/lib/webImport/bridgeCaptureHairlines";
import type { DomSnapshotStyles } from "@/lib/webImport/types";

describe("bridgeCaptureHairlines", () => {
  it("detects PML footer top divider from negative box-shadow offset", () => {
    const edge = boxShadowEdgeHairline("0px -1px 0px 0px rgb(224, 224, 224)");
    assert.deepEqual(edge, { edge: "top", color: "rgb(224, 224, 224)" });
  });

  it("detects bottom border-bottom hairline", () => {
    const styles: DomSnapshotStyles = {
      borderBottomWidth: "1px",
      borderBottomColor: "rgb(224, 224, 224)",
    };
    const lines = structuralHairlinesFromStyles(styles, 320, 48);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0], {
      edge: "bottom",
      x: 0,
      y: 47,
      width: 320,
      height: 1,
      color: "rgb(224, 224, 224)",
    });
  });

  it("prefers border-top over box-shadow top hairline", () => {
    const styles: DomSnapshotStyles = {
      borderTopWidth: "1px",
      borderTopColor: "rgb(200, 200, 200)",
      boxShadow: "0px -1px 0px 0px rgb(224, 224, 224)",
    };
    const lines = structuralHairlinesFromStyles(styles, 376, 120);
    assert.equal(lines.filter((l) => l.edge === "top").length, 1);
    assert.equal(lines[0]?.color, "rgb(200, 200, 200)");
  });

  it("captures left and right single-edge borders", () => {
    const styles: DomSnapshotStyles = {
      borderLeftWidth: "1px",
      borderLeftColor: "rgb(100, 100, 100)",
      borderRightWidth: "2px",
      borderRightColor: "rgb(50, 50, 50)",
    };
    const lines = structuralHairlinesFromStyles(styles, 100, 40);
    assert.equal(lines.length, 2);
    assert.deepEqual(lines[0], {
      edge: "left",
      x: 0,
      y: 0,
      width: 1,
      height: 40,
      color: "rgb(100, 100, 100)",
    });
    assert.deepEqual(lines[1], {
      edge: "right",
      x: 98,
      y: 0,
      width: 2,
      height: 40,
      color: "rgb(50, 50, 50)",
    });
  });

  it("skips four-sided box borders so rounded CTAs use frame stroke", () => {
    const styles: DomSnapshotStyles = {
      borderTopWidth: "1px",
      borderTopColor: "rgb(52, 163, 77)",
      borderRightWidth: "1px",
      borderRightColor: "rgb(52, 163, 77)",
      borderBottomWidth: "1px",
      borderBottomColor: "rgb(52, 163, 77)",
      borderLeftWidth: "1px",
      borderLeftColor: "rgb(52, 163, 77)",
      borderRadius: "24px",
    };
    const lines = structuralHairlinesFromStyles(styles, 344, 52);
    assert.equal(lines.length, 0);
  });

  it("emits four edge rects for outline buttons when includeFullBoxBorder is set", () => {
    const styles: DomSnapshotStyles = {
      borderTopWidth: "1px",
      borderTopColor: "rgb(52, 163, 77)",
      borderRightWidth: "1px",
      borderRightColor: "rgb(52, 163, 77)",
      borderBottomWidth: "1px",
      borderBottomColor: "rgb(52, 163, 77)",
      borderLeftWidth: "1px",
      borderLeftColor: "rgb(52, 163, 77)",
    };
    const lines = structuralHairlinesFromStyles(styles, 120, 40, { includeFullBoxBorder: true });
    assert.equal(lines.length, 4);
    assert.ok(lines.every((l) => l.color.includes("52, 163, 77") || l.color.includes("34a34d")));
  });
});
