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

describe("craftEngineWasmFirstLayoutMask", () => {
  it("nudgeSelection moves selected nodes", () => {
    const id = `rect-nudge-${Date.now()}`;
    useEditorStore.setState({
      editorMode: "design",
      nodes: { [id]: baseRect(id, 10, 20) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().nudgeSelection(5, -3);
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.x, 15);
    assert.equal(n?.y, 17);
  });

  it("toggleVisible flips single node visibility", () => {
    const id = `rect-vis-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().toggleVisible(id);
    assert.equal(useEditorStore.getState().nodes[id]?.visible, false);
  });

  it("updateConstraints patches constraint fields", () => {
    const id = `rect-con-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().updateConstraints(id, {
      constraintHorizontal: "left-right",
      constraintVertical: "top-bottom",
    });
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.constraintHorizontal, "left-right");
    assert.equal(n?.constraintVertical, "top-bottom");
  });

  it("setNodeAsMask marks node as mask layer", () => {
    const id = `rect-mask-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().setNodeAsMask(id, true);
    assert.equal(useEditorStore.getState().nodes[id]?.isMask, true);
    assert.equal(useEditorStore.getState().nodes[id]?.name, "Mask");
  });
});
