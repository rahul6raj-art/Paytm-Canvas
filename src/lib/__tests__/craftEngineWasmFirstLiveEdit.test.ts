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

describe("craftEngineWasmFirstLiveEdit", () => {
  it("updateNode applies geometry patch", () => {
    const id = `rect-upd-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id, 10, 20) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().updateNode(id, { x: 40, y: 50 }, { skipHistory: true });
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.x, 40);
    assert.equal(n?.y, 50);
  });

  it("updateNodes applies batch patches", () => {
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [a]: baseRect(a, 0, 0),
        [b]: baseRect(b, 100, 0),
      },
      childOrder: { [ROOT]: [a, b] },
      selectedIds: [a, b],
    });
    useEditorStore.getState().updateNodes(
      { [a]: { x: 5 }, [b]: { x: 105 } },
      { skipHistory: true },
    );
    assert.equal(useEditorStore.getState().nodes[a]?.x, 5);
    assert.equal(useEditorStore.getState().nodes[b]?.x, 105);
  });

  it("setNodeTextColorHex updates text color", () => {
    const id = `text-col-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "text",
          name: "Label",
          x: 0,
          y: 0,
          width: 120,
          height: 24,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          content: "Hi",
          textResizeMode: "auto-width",
          textColor: "#000000",
          fillEnabled: true,
          fillOpacity: 1,
        },
      },
      childOrder: { [ROOT]: [id] },
    });
    useEditorStore.getState().setNodeTextColorHex(id, "#ff5500", { skipHistory: true });
    assert.equal(useEditorStore.getState().nodes[id]?.textColor, "#ff5500");
  });
});
