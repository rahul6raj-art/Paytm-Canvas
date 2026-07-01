import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldUseFilledStrokeRingForNode } from "@/lib/strokeAlign";
import { polygonPathPoints } from "@/lib/shapes/polygonGeometry";
import { svgPathMarkup, svgRectLike } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

const gradient = {
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
};

function baseNode(partial: Partial<EditorNode> & Pick<EditorNode, "type">): EditorNode {
  return {
    id: "shape-1",
    parentId: null,
    name: "Shape",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#cfcfcf",
    fillEnabled: true,
    strokeColor: "#ffffff",
    strokeWidth: 20,
    strokeEnabled: true,
    strokePosition: "center",
    strokeType: "solid",
    ...partial,
  };
}

describe("center stroke uses native SVG on all shapes", () => {
  it("skips filled ring for center strokes on every closed shape kind", () => {
    const shapes: Array<Partial<EditorNode> & Pick<EditorNode, "type">> = [
      { type: "rectangle", cornerRadius: 40 },
      { type: "frame", cornerRadius: 40 },
      { type: "ellipse" },
      { type: "polygon", polygonSides: 6, cornerRadius: 40 },
      {
        type: "path",
        pathClosed: true,
        cornerRadius: 40,
        pathPoints: polygonPathPoints(6, 400, 300),
      },
      {
        type: "path",
        pathClosed: true,
        starPoints: 5,
        starInnerRadius: 0.4,
        starOuterCornerRadius: 24,
      },
    ];

    for (const partial of shapes) {
      const node = baseNode(partial);
      assert.equal(
        shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
        false,
        `${partial.type} center stroke should not use filled ring`,
      );
    }
  });

  it("still uses filled ring for outside strokes on rounded shapes", () => {
    const node = baseNode({
      type: "rectangle",
      cornerRadius: 40,
      strokePosition: "outside",
    });
    assert.equal(
      shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
      true,
    );
  });

  it("still renders frame stroke when svgScene passes strokeWidthOverride", () => {
    const node = baseNode({
      type: "frame",
      cornerRadius: 26,
      strokeWidth: 1,
      strokeColor: "#34a34d",
      strokePosition: "inside",
      fill: "#ffffff",
    });
    const markup = svgRectLike(node, {
      nodeId: node.id,
      strokeOverride: "#34a34d",
      strokeWidthOverride: 1,
    });
    assert.match(markup, /fill="rgba\(52,163,77,1\)"/);
    assert.doesNotMatch(markup, /stroke="none" \/>$/);
  });

  it("exports center gradient stroke on rounded rect as native SVG stroke", () => {
    const defs: string[] = [];
    const node = baseNode({
      type: "rectangle",
      cornerRadius: 40,
      strokeType: "gradient",
      strokeGradient: gradient,
    });
    const markup = svgRectLike(node, {
      nodeId: node.id,
      registerGradient: (id, m) => defs.push(m),
    });
    assert.match(markup, /stroke="url\(#pc-grad-pc-sg-shape-1\)"/);
    assert.match(markup, /stroke-width="20"/);
    assert.doesNotMatch(markup, /fill-rule="evenodd"/);
    assert.ok(defs.some((d) => d.includes('id="pc-grad-pc-sg-shape-1"')));
  });

  it("exports center gradient stroke on rounded polygon as native SVG stroke", () => {
    const defs: string[] = [];
    const node = baseNode({
      type: "polygon",
      polygonSides: 6,
      cornerRadius: 40,
      pathPoints: polygonPathPoints(6, 400, 300),
      strokeType: "gradient",
      strokeGradient: gradient,
    });
    const markup = svgPathMarkup(node, {
      nodeId: node.id,
      registerGradient: (id, m) => defs.push(m),
    });
    assert.match(markup, /stroke="url\(#pc-grad-pc-sg-shape-1\)"/);
    assert.doesNotMatch(markup, /fill-rule="evenodd"/);
  });
});
