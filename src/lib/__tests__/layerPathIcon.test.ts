import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPathLayerIconSpec, pathLayerOutlineD } from "@/lib/layerPathIcon";
import type { EditorNode } from "@/stores/useEditorStore";

function basePathNode(overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "path-1",
    parentId: null,
    type: "path",
    name: "Vector",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    pathPoints: [
      { id: "a", x: 10, y: 10 },
      { id: "b", x: 90, y: 20 },
      { id: "c", x: 80, y: 70 },
      { id: "d", x: 20, y: 60 },
    ],
    pathClosed: true,
    fill: "#18a0fb",
    fillEnabled: true,
    ...overrides,
  };
}

describe("layerPathIcon", () => {
  it("builds outline d from path points", () => {
    const d = pathLayerOutlineD(basePathNode());
    assert.match(d, /^M /);
    assert.match(d, / Z$/);
  });

  it("builds a layer thumbnail spec for pen paths", () => {
    const spec = buildPathLayerIconSpec(basePathNode());
    assert.ok(spec);
    assert.equal(spec!.fill, "currentColor");
    assert.equal(spec!.stroke, "none");
    assert.match(spec!.viewBox, /^[\d.-]+ [\d.-]+ [\d.]+ [\d.]+$/);
  });

  it("uses flattened path data when present", () => {
    const node = basePathNode({
      flattenedPathData: "M 0 0 L 40 0 L 40 30 L 0 30 Z",
      pathPoints: [],
    });
    const spec = buildPathLayerIconSpec(node);
    assert.equal(spec?.d, "M 0 0 L 40 0 L 40 30 L 0 30 Z");
  });
});
