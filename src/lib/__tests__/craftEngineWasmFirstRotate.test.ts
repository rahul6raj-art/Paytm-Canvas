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

  it("endRotateInteraction no-ops when snapshot missing", () => {
    const id = `rect-rot2-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: null,
    });
    useEditorStore.getState().endRotateInteraction(id, 90);
    assert.equal(useEditorStore.getState().nodes[id]?.rotation, 0);
    assert.equal(useEditorStore.getState().transformInteractionMode, "none");
  });
});
