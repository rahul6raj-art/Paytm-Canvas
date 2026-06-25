import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filledStrokeOutlineFromPathD } from "@/lib/outlineStroke";
import {
  outlineRoundedVectorRingPathD,
  roundedVectorStrokeRingForNode,
  shapeHasRoundedCornerStroke,
  useAnalyticRoundedStrokeRing,
} from "@/lib/geometry/roundedVectorStrokeRing";
import { resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import type { EditorNode } from "@/stores/useEditorStore";

function baseNode(partial: Partial<EditorNode> & Pick<EditorNode, "type">): EditorNode {
  return {
    id: "n1",
    parentId: null,
    name: "Shape",
    x: 0,
    y: 0,
    width: 1732,
    height: 1081,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#cfcfcf",
    fillEnabled: true,
    strokeColor: "#ffffff",
    strokeWidth: 53,
    strokeEnabled: true,
    strokePosition: "center",
    strokeLinejoin: "round",
    ...partial,
  };
}

describe("rounded vector stroke detection", () => {
  it("detects corner-rounded polygons, paths, and stars", () => {
    assert.equal(
      shapeHasRoundedCornerStroke(
        baseNode({
          type: "path",
          pathClosed: true,
          cornerRadius: 163,
          pathPoints: [
            { id: "a", x: 866, y: 0 },
            { id: "b", x: 1732, y: 400 },
            { id: "c", x: 1500, y: 1081 },
            { id: "d", x: 300, y: 950 },
            { id: "e", x: 0, y: 350 },
          ],
        }),
      ),
      true,
    );
    assert.equal(
      shapeHasRoundedCornerStroke(baseNode({ type: "polygon", polygonSides: 6, cornerRadius: 40 })),
      true,
    );
  });

  it("offsets edited vector paths with parallel fillet stroke rings", () => {
    const pathPoints = [
      { id: "a", x: 866, y: 0 },
      { id: "b", x: 1732, y: 400 },
      { id: "c", x: 1500, y: 1081 },
      { id: "d", x: 300, y: 950 },
      { id: "e", x: 0, y: 350 },
    ];
    const node = baseNode({
      type: "path",
      pathClosed: true,
      pathPoints,
      cornerRadii: [33, 52, 43, 68, 40],
      strokeWidth: 53,
      strokePosition: "outside",
    });
    assert.equal(useAnalyticRoundedStrokeRing(node), false);
    const fillD = resolvePathOutlineD(node);
    const ring = filledStrokeOutlineFromPathD(node, fillD, true);
    const analytic = roundedVectorStrokeRingForNode(node, 53, "outside");
    assert.ok(ring?.pathD);
    assert.equal(ring!.fillRule, "evenodd");
    assert.ok(analytic?.pathD);
    assert.equal(ring!.pathD, analytic!.pathD);
  });

  it("offsets vertices and radii in parallel for parametric polygons", () => {
    const sides = 6;
    const node = baseNode({ type: "polygon", polygonSides: sides, cornerRadius: 135, strokeWidth: 39, width: 1550, height: 1163 });
    const ring = roundedVectorStrokeRingForNode(node, 39, "center");
    assert.ok(ring?.pathD);
    assert.ok((ring!.pathD.match(/ A /g) || []).length >= sides * 2);
  });

  it("respects inside/center/outside stroke alignment on edited polygons", () => {
    const pathPoints = [
      { id: "a", x: 940, y: 0 },
      { id: "b", x: 1880, y: 480 },
      { id: "c", x: 1600, y: 1281 },
      { id: "d", x: 320, y: 1100 },
      { id: "e", x: 0, y: 400 },
    ];
    const base = baseNode({
      type: "polygon",
      width: 1880,
      height: 1281,
      pathPoints,
      cornerRadius: 141,
      strokeWidth: 186,
    });
    const fillD = resolvePathOutlineD(base);
    const inside = filledStrokeOutlineFromPathD({ ...base, strokePosition: "inside" }, fillD, true);
    const center = filledStrokeOutlineFromPathD({ ...base, strokePosition: "center" }, fillD, true);
    const outside = filledStrokeOutlineFromPathD({ ...base, strokePosition: "outside" }, fillD, true);
    assert.ok(inside?.pathD);
    assert.ok(center?.pathD);
    assert.ok(outside?.pathD);
    assert.notEqual(inside!.pathD, center!.pathD);
    assert.notEqual(center!.pathD, outside!.pathD);
  });

  it("returns null for sharp corners without radius", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    assert.equal(outlineRoundedVectorRingPathD(verts, [0, 0, 0, 0], 10, "center"), null);
  });
});
