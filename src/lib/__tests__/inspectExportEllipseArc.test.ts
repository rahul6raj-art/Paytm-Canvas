import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildBooleanRenderForGroup } from "@/lib/booleanGeometry";
import { booleanClipperPathD } from "@/lib/codeExport/booleanRenderSvg";
import type { EditorNode } from "@/stores/useEditorStore";

const root = process.cwd();

describe("inspectExport ellipse arc rasterization", () => {
  it("uses ellipse arc geometry when copying or exporting PNG", () => {
    const src = readFileSync(join(root, "src/lib/inspectExport.ts"), "utf8");
    assert.match(src, /effectiveEllipseArc\(drawNode\)/);
    assert.match(src, /ellipseArcPathD\(/);
    assert.match(src, /isFullEllipseArc\(arc\.sweepDeg\)/);
    assert.match(src, /hasEllipseArcInnerHole\(arc\.innerRadiusRatio\)/);
  });
});

describe("inspectExport boolean rasterization", () => {
  it("uses Clipper2 boolean paths when copying or exporting PNG", () => {
    const src = readFileSync(join(root, "src/lib/inspectExport.ts"), "utf8");
    assert.match(src, /paintBooleanGroupToCanvas\(/);
    assert.match(src, /buildBooleanRenderForGroup\(/);
    assert.match(src, /booleanClipperPathD\(render\)/);
    assert.match(src, /!paintedBoolean/);
  });

  it("builds the same composite path model as canvas preview", () => {
    const nodes: Record<string, EditorNode> = {
      g1: {
        id: "g1",
        type: "group",
        parentId: null,
        isBooleanGroup: true,
        booleanOperation: "subtract",
        x: 0,
        y: 0,
        width: 120,
        height: 120,
        visible: true,
        locked: false,
        fill: "#cfcfcf",
        fillEnabled: true,
      } as EditorNode,
      a: {
        id: "a",
        type: "ellipse",
        parentId: "g1",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        visible: true,
        locked: false,
        fill: "#cfcfcf",
        fillEnabled: true,
      } as EditorNode,
      b: {
        id: "b",
        type: "ellipse",
        parentId: "g1",
        x: 30,
        y: 0,
        width: 80,
        height: 80,
        visible: true,
        locked: false,
        fill: "#cfcfcf",
        fillEnabled: true,
      } as EditorNode,
    };
    const childOrder = { g1: ["a", "b"] };
    const render = buildBooleanRenderForGroup("g1", childOrder.g1, nodes, "subtract", childOrder);
    assert.ok(render);
    const pathD = booleanClipperPathD(render!);
    assert.ok(pathD);
    assert.match(pathD!, /[MLAZ]/);
  });
});
