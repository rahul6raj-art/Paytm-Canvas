import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  childOrderIndexFromLayerPanelInsertBefore,
  insertDuplicatedSiblingInChildOrder,
  layerPanelDisplayChildIds,
} from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";

function rect(id: string): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ccc",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("duplicate layer panel order", () => {
  it("insertDuplicatedSiblingInChildOrder stacks duplicate in front on canvas", () => {
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b", "c"] };
    const next = insertDuplicatedSiblingInChildOrder(childOrder, EDITOR_ROOT_KEY, "b", "b-dup");
    assert.deepEqual(next[EDITOR_ROOT_KEY], ["a", "b", "b-dup", "c"]);
  });

  it("duplicate appears above source in Figma-style layer panel", () => {
    const nodes = { a: rect("a"), b: rect("b"), "b-dup": rect("b-dup"), c: rect("c") };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b", "b-dup", "c"] };
    const display = layerPanelDisplayChildIds(EDITOR_ROOT_KEY, nodes, childOrder);
    assert.deepEqual(display, ["c", "b-dup", "b", "a"]);
    assert.ok(display.indexOf("b-dup") < display.indexOf("b"));
  });

  it("childOrderIndexFromLayerPanelInsertBefore maps panel drop indices", () => {
    assert.equal(childOrderIndexFromLayerPanelInsertBefore(3, 0), 3);
    assert.equal(childOrderIndexFromLayerPanelInsertBefore(3, 3), 0);
    assert.equal(childOrderIndexFromLayerPanelInsertBefore(3, 1), 2);
  });

  it("Cmd+D places duplicate above original in layer panel", () => {
    const a = "rect-a";
    useEditorStore.setState({
      nodes: { [a]: rect(a) },
      childOrder: { [EDITOR_ROOT_KEY]: [a] },
      selectedIds: [a],
      editorMode: "design",
    });
    useEditorStore.getState().duplicateSelection();
    const st = useEditorStore.getState();
    const dupId = st.selectedIds[0]!;
    assert.notEqual(dupId, a);
    const display = layerPanelDisplayChildIds(EDITOR_ROOT_KEY, st.nodes, st.childOrder);
    assert.ok(display.indexOf(dupId) < display.indexOf(a));
  });
});
