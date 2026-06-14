import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

function rect(id: string, x: number, y: number) {
  return {
    id,
    parentId: null,
    type: "rectangle" as const,
    name: id,
    x,
    y,
    width: 80,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#3366ff",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center" as const,
  };
}

describe("craftEngineWasmFirstBooleanPath", () => {
  it("createBooleanGroup inserts a boolean group", () => {
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [a]: rect(a, 0, 0), [b]: rect(b, 40, 20) },
      childOrder: { [ROOT]: [a, b] },
      selectedIds: [a, b],
    });
    useEditorStore.getState().createBooleanGroup("union");
    const st = useEditorStore.getState();
    const group = Object.values(st.nodes).find((n) => n.isBooleanGroup);
    assert.ok(group);
    assert.equal(st.selectedIds[0], group!.id);
  });

  it("startPathAt begins pen drawing", () => {
    useEditorStore.setState({
      editorMode: "design",
      tool: "pen",
      penDrawingNodeId: null,
      selectedIds: [],
    });
    useEditorStore.getState().startPathAt({ x: 100, y: 120 });
    const st = useEditorStore.getState();
    assert.ok(st.penDrawingNodeId);
    assert.equal(st.nodes[st.penDrawingNodeId!]?.type, "path");
  });
});
