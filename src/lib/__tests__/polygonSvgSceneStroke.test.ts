import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { shouldUseFilledStrokeRingForNode } from "@/lib/strokeAlign";
import { layerPanelChildIds } from "@/lib/editorGraph";
import { polygonPathPoints } from "@/lib/shapes/polygonGeometry";
import { svgPathMarkup } from "@/lib/svgMarkupCore";
import { ROOT, type EditorNode } from "@/stores/useEditorStore";

function hexPolygonNode(
  partial: Partial<EditorNode> = {},
): EditorNode {
  return {
    id: "poly-1",
    parentId: null,
    type: "polygon",
    name: "Polygon 1",
    x: 100,
    y: 100,
    width: 400,
    height: 400,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    polygonSides: 6,
    cornerRadius: 80,
    pathPoints: polygonPathPoints(6, 400, 400),
    fill: "#cfcfcf",
    fillEnabled: true,
    strokeColor: "#ffffff",
    strokeWidth: 40,
    strokeEnabled: true,
    strokePosition: "center",
    ...partial,
  };
}

describe("polygon SVG scene stroke", () => {
  it("center solid stroke on rounded polygon uses native SVG stroke on the fill path", () => {
    const node = hexPolygonNode();
    assert.equal(
      shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
      false,
      "center solid rounded polygons must not use filled stroke rings",
    );

    const markup = svgPathMarkup(node, { nodeId: node.id });
    assert.match(markup, /stroke-width="40"/, "markup should use native SVG stroke-width");
    assert.match(markup, /stroke="#ffffff"/, "markup should use native SVG stroke color");
    assert.doesNotMatch(
      markup,
      /fill-rule="evenodd"/,
      "markup must not embed a tessellated even-odd stroke ring",
    );
  });

  it("center gradient stroke on rounded polygon uses native SVG stroke on the fill path", () => {
    const defs: string[] = [];
    const node = hexPolygonNode({
      strokeType: "gradient",
      strokeGradient: {
        kind: "linear",
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
    });
    assert.equal(
      shouldUseFilledStrokeRingForNode(node, { closed: true, showStroke: true }),
      false,
    );

    const markup = svgPathMarkup(node, {
      nodeId: node.id,
      registerGradient: (id, m) => defs.push(m),
    });
    assert.match(markup, /stroke-width="40"/);
    assert.match(markup, /stroke="url\(#pc-grad-pc-sg-poly-1\)"/);
    assert.doesNotMatch(markup, /fill-rule="evenodd"/);
    assert.ok(defs.some((d) => d.includes('id="pc-grad-pc-sg-poly-1"')));
  });

  it("buildSvgScene renders rounded polygon with native SVG stroke", () => {
    const node = hexPolygonNode();
    const nodes = { [node.id]: node };
    const childOrder = { [ROOT]: [node.id] };

    const scene = buildSvgScene({
      rootIds: layerPanelChildIds(ROOT, nodes, childOrder),
      nodes,
      childOrder,
    });

    assert.match(scene.body, /stroke-width="40"/);
    assert.doesNotMatch(scene.body, /fill-rule="evenodd"/);
  });
});
