import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

function baseRect(id: string, x = 0, y = 0) {
  return {
    id,
    parentId: null,
    type: "rectangle" as const,
    name: "Rect",
    x,
    y,
    width: 80,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#000000",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center" as const,
  };
}

describe("craftEngineWasmFirstRotate", () => {
  it("endRotateInteraction commits rotation and clears rotate snapshot", () => {
    const id = `rect-rot-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id, 50, 50) },
      childOrder: { [ROOT]: [id] },
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: { nodeId: id, x: 50, y: 50, width: 80, height: 60 },
    });
    useEditorStore.getState().updateNode(id, { rotation: 45 }, { skipHistory: true });
    useEditorStore.getState().endRotateInteraction(id, 45);
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.rotation, 45);
    assert.equal(n?.x, 50);
    assert.equal(n?.y, 50);
    assert.equal(useEditorStore.getState().rotateGeomSnapshot, null);
    assert.equal(useEditorStore.getState().transformInteractionMode, "none");
  });

  it("endRotateInteraction preserves large-canvas geometry after rotate drag", () => {
    const id = `rect-rot-large-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: { ...baseRect(id, 18548, 12032), width: 580, height: 598 },
      },
      childOrder: { [ROOT]: [id] },
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: {
        nodeId: id,
        x: 18548,
        y: 12032,
        width: 580,
        height: 598,
      },
    });
    useEditorStore.getState().updateNode(
      id,
      { rotation: 352, x: 18548, y: 12032 },
      { skipHistory: true },
    );
    useEditorStore.getState().endRotateInteraction(id, 352);
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.rotation, 352);
    assert.equal(n?.x, 18548);
    assert.equal(n?.y, 12032);
    assert.equal(n?.width, 580);
    assert.equal(n?.height, 598);
  });

  it("endRotateInteraction falls back to rotateGeomSnapshots", () => {
    const id = `rect-rot-fallback-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: { ...baseRect(id, 12, 24), width: 120, height: 90 } },
      childOrder: { [ROOT]: [id] },
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: { [id]: { x: 12, y: 24, width: 120, height: 90 } },
    });
    useEditorStore.getState().updateNode(id, { rotation: 30 }, { skipHistory: true });
    useEditorStore.getState().endRotateInteraction(id, 30);
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.rotation, 30);
    assert.equal(n?.width, 120);
    assert.equal(n?.height, 90);
  });
});
