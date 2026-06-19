import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectIconColorSelectorUpdates } from "@/lib/craftBridge/exportIconColorsFromCanvas";
import type { EditorNode } from "@/stores/useEditorStore";

function nodesById(...list: EditorNode[]): Record<string, EditorNode> {
  return Object.fromEntries(list.map((n) => [n.id, n]));
}

describe("collectIconColorSelectorUpdates", () => {
  it("maps path fill to icon wrapper color selector", () => {
    const chevron: EditorNode = {
      id: "chevron-wrap",
      parentId: "root",
      type: "frame",
      name: "chevron",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "pml-home-mood-card__chevron",
    };
    const svg: EditorNode = {
      id: "svg",
      parentId: "chevron-wrap",
      type: "frame",
      name: "Svg",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    };
    const path: EditorNode = {
      id: "path",
      parentId: "svg",
      type: "path",
      name: "Vector",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#ff5500",
      fillEnabled: true,
    };

    const updates = collectIconColorSelectorUpdates(
      nodesById(chevron, svg, path),
      {},
    );

    assert.equal(updates.get(".pml-home-mood-card__chevron")?.color, "#ff5500");
  });

  it("walks through header icon button wrappers", () => {
    const btn: EditorNode = {
      id: "btn",
      parentId: "root",
      type: "frame",
      name: "icon btn",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "header__icon-btn",
    };
    const svg: EditorNode = {
      id: "svg",
      parentId: "btn",
      type: "frame",
      name: "Svg",
      x: 8,
      y: 8,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    };
    const path: EditorNode = {
      id: "path",
      parentId: "svg",
      type: "path",
      name: "Vector",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#00aa88",
      fillEnabled: true,
    };

    const updates = collectIconColorSelectorUpdates(nodesById(btn, svg, path), {});
    assert.equal(updates.get(".header__icon-btn")?.color, "#00aa88");
  });
});
