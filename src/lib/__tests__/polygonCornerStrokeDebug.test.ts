import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldUseFilledStrokeRingForNode } from "@/lib/strokeAlign";
import { polygonPathPoints } from "@/lib/shapes/polygonGeometry";
import { resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import type { EditorNode } from "@/stores/useEditorStore";

function hexNode(cornerRadius: number, strokeWidth: number): EditorNode {
  return {
    id: "p1",
    parentId: null,
    type: "polygon",
    name: "Polygon 1",
    x: 0,
    y: 0,
    width: 400,
    height: 400,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    polygonSides: 6,
    cornerRadius,
    fill: "#cfcfcf",
    fillEnabled: true,
    strokeColor: "#ffffff",
    strokeWidth,
    strokeEnabled: true,
    strokePosition: "center",
  };
}

describe("polygon corner radius stroke", () => {
  it("center solid stroke skips filled ring so SVG stroke follows fillet fill path", () => {
    const node = hexNode(80, 40);
    const fillD = resolvePathOutlineD(node);
    assert.match(fillD, / A /, "fill should use fillet arcs");

    assert.equal(
      shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
      false,
    );
  });

  it("center gradient stroke skips filled ring on rounded polygons", () => {
    const node = {
      ...hexNode(80, 40),
      strokeType: "gradient" as const,
      strokeGradient: {
        kind: "linear" as const,
        stops: [
          { id: "s1", color: "#ff0000", position: 0 },
          { id: "s2", color: "#0000ff", position: 100 },
        ],
        transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 0 },
        handles: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 1, y: 0 },
        ],
      },
    };
    assert.equal(
      shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
      false,
    );
  });

  it("outside stroke on rounded polygon still uses filled ring", () => {
    const node = {
      ...hexNode(80, 40),
      strokePosition: "outside" as const,
      pathPoints: polygonPathPoints(6, 400, 400),
    };
    assert.equal(
      shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
      true,
    );
  });
});
