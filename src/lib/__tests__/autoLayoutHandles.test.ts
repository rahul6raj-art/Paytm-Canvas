import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAutoLayoutInteractionHandles } from "@/lib/autoLayout/autoLayoutHandles";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(
  id: string,
  layoutMode: "horizontal" | "vertical",
  kids: { id: string; x: number; y: number; w: number; h: number; fill?: boolean }[],
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const nodes: Record<string, EditorNode> = {
    [id]: {
      id,
      parentId: null,
      type: "frame",
      name: "AL",
      x: 0,
      y: 0,
      width: 200,
      height: 120,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      layoutMode,
      layoutGap: 16,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      primaryAxisAlign: "start",
      counterAxisAlign: "start",
    },
  };
  for (const k of kids) {
    nodes[k.id] = {
      id: k.id,
      parentId: id,
      type: "rectangle",
      name: k.id,
      x: k.x,
      y: k.y,
      width: k.w,
      height: k.h,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      layoutSizingHorizontal: k.fill ? "fill" : "fixed",
      layoutSizingVertical: "fixed",
      layoutGrow: k.fill ? 1 : undefined,
    };
  }
  return { nodes, childOrder: { [id]: kids.map((k) => k.id) } };
}

describe("autoLayoutHandles", () => {
  it("returns spacing handles between horizontal flow children", () => {
    const { nodes, childOrder } = frame("f", "horizontal", [
      { id: "a", x: 12, y: 12, w: 40, h: 40 },
      { id: "b", x: 68, y: 12, w: 40, h: 40 },
    ]);
    const h = getAutoLayoutInteractionHandles("f", nodes, childOrder);
    assert.ok(h);
    assert.equal(h.spacing.length, 1);
    assert.equal(h.padding.length, 4);
  });

  it("returns fill divider when adjacent children use fill sizing", () => {
    const { nodes, childOrder } = frame("f", "horizontal", [
      { id: "a", x: 12, y: 12, w: 60, h: 40, fill: true },
      { id: "b", x: 88, y: 12, w: 60, h: 40, fill: true },
    ]);
    const h = getAutoLayoutInteractionHandles("f", nodes, childOrder);
    assert.ok(h);
    assert.equal(h.fillDividers.length, 1);
    assert.equal(h.fillDividers[0]!.leftChildId, "a");
    assert.equal(h.fillDividers[0]!.rightChildId, "b");
  });
});
