import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { getNodeWorldMatrix, getNodeTransformedWorldCorners } from "@/lib/transformMath";
import {
  getNodeTransformedWorldCornersFromChildOrder,
  getNodeWorldMatrixFromChildOrder,
} from "@/lib/editorGraph";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { useEditorStore } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 100,
    y: 80,
    width: 200,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#000000",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
    ...partial,
  };
}

describe("rotateGeometryLock", () => {
  it("updateNode keeps width/height fixed during single rotate interaction", () => {
    const id = `rot-lock-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: rect(id) },
      childOrder: { [EDITOR_ROOT_KEY]: [id] },
      transformInteractionMode: "none",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: null,
    });
    useEditorStore.getState().beginRotateInteraction(id, {
      x: 100,
      y: 80,
      width: 200,
      height: 100,
    });
    for (const rotation of [15, 45, 90, 135]) {
      useEditorStore.getState().updateNode(id, { rotation }, { skipHistory: true });
      const n = useEditorStore.getState().nodes[id];
      assert.equal(n?.width, 200, `width at ${rotation}°`);
      assert.equal(n?.height, 100, `height at ${rotation}°`);
      assert.equal(n?.x, 100, `x at ${rotation}°`);
      assert.equal(n?.y, 80, `y at ${rotation}°`);
    }
  });

  it("updateNodes keeps width/height fixed during multi rotate interaction", () => {
    const a = `rot-a-${Date.now()}`;
    const b = `rot-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [a]: rect(a, { x: 0, y: 0, width: 40, height: 40 }),
        [b]: rect(b, { x: 80, y: 0, width: 60, height: 30 }),
      },
      childOrder: { [EDITOR_ROOT_KEY]: [a, b] },
      transformInteractionMode: "none",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: null,
    });
    useEditorStore.getState().beginMultiRotateInteraction({
      [a]: { x: 0, y: 0, width: 40, height: 40 },
      [b]: { x: 80, y: 0, width: 60, height: 30 },
    });
    useEditorStore.getState().updateNodes(
      {
        [a]: { rotation: 30, x: 5, y: 2 },
        [b]: { rotation: 30, x: 85, y: 2 },
      },
      { skipHistory: true },
    );
    const nodes = useEditorStore.getState().nodes;
    assert.equal(nodes[a]?.width, 40);
    assert.equal(nodes[a]?.height, 40);
    assert.equal(nodes[b]?.width, 60);
    assert.equal(nodes[b]?.height, 30);
  });

  it("buildSvgScene root transform matches childOrder render tree", () => {
    const frameId = "frame";
    const rectId = "rect";
    const nodes = {
      [frameId]: rect(frameId, {
        type: "frame",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rotation: 15,
      }),
      [rectId]: rect(rectId, {
        parentId: frameId,
        x: 20,
        y: 30,
        width: 120,
        height: 80,
        rotation: 45,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: [frameId],
      [frameId]: [rectId],
    };
    const scene = buildSvgScene({
      rootIds: [frameId],
      nodes,
      childOrder,
    });
    const wm = getNodeWorldMatrixFromChildOrder(frameId, nodes, childOrder);
    assert.ok(scene.body.includes(`matrix(${wm!.a}`));
    assert.ok(!scene.body.includes("NaN"));
  });

  it("childOrder corners differ from parentId corners when parentId is stale", () => {
    const frameId = "frame";
    const rectId = "rect";
    const childOrder = { [EDITOR_ROOT_KEY]: [frameId], [frameId]: [rectId] };
    const nodes = {
      [frameId]: rect(frameId, { type: "frame", x: 100, y: 100, width: 400, height: 300 }),
      [rectId]: rect(rectId, {
        parentId: null,
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        rotation: 45,
      }),
    };
    const oldCorners = getNodeTransformedWorldCorners(rectId, nodes);
    const newCorners = getNodeTransformedWorldCornersFromChildOrder(rectId, nodes, childOrder);
    assert.ok(oldCorners && newCorners);
    const delta = Math.hypot(oldCorners[0].x - newCorners[0].x, oldCorners[0].y - newCorners[0].y);
    assert.ok(delta > 50, "stale parentId corners should diverge from childOrder render tree");
    const oldWm = getNodeWorldMatrix(rectId, nodes);
    const newWm = getNodeWorldMatrixFromChildOrder(rectId, nodes, childOrder);
    assert.notDeepEqual(oldWm, newWm);
  });
});
