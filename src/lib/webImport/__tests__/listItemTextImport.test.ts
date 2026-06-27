import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { enforceManualScreenFrames } from "../enforceManualScreenFrames";
import { normalizeListItemTextNodes } from "../normalizeWebImportLayers";

describe("enforceManualScreenFrames", () => {
  it("forces canvas root and PML screen names to manual frames", () => {
    const nodes: Record<string, EditorNode> = {
      screen: {
        id: "screen",
        parentId: null,
        type: "frame",
        name: "PML- More",
        x: 80,
        y: 80,
        width: 390,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        layoutMode: "vertical",
        layoutGap: 16,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["screen"] };

    enforceManualScreenFrames(nodes, childOrder);
    assert.equal(nodes.screen?.layoutMode, "none");
    assert.equal(nodes.screen?.layoutGap, 0);
  });
});

describe("normalizeListItemTextNodes", () => {
  it("wraps long secondary text inside list item width", () => {
    const nodes: Record<string, EditorNode> = {
      row: {
        id: "row",
        parentId: "screen",
        type: "frame",
        name: "ListItem",
        x: 0,
        y: 200,
        width: 390,
        height: 72,
        rotation: 0,
        visible: true,
        locked: false,
        codeJsxTag: "ListItem",
      },
      primary: {
        id: "primary",
        parentId: "row",
        type: "text",
        name: "Primary",
        x: 280,
        y: 12,
        width: 200,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Start onboarding",
        codeClassName: "li-item__primary",
        fontSize: 16,
      },
      secondary: {
        id: "secondary",
        parentId: "row",
        type: "text",
        name: "Secondary",
        x: 280,
        y: 36,
        width: 340,
        height: 18,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Full KYC flow from welcome to activation",
        codeClassName: "li-item__secondary",
        fontSize: 13,
      },
    };
    const childOrder = {
      screen: ["row"],
      row: ["primary", "secondary"],
    };

    normalizeListItemTextNodes(nodes, childOrder);
    assert.equal(nodes.primary?.x, 16);
    assert.ok((nodes.primary?.width ?? 0) < 300);
    assert.equal(nodes.secondary?.x, 16);
    assert.equal(nodes.secondary?.y, (nodes.primary?.y ?? 0) + (nodes.primary?.height ?? 0) + 4);
    assert.ok((nodes.secondary?.width ?? 0) <= 326);
    assert.ok((nodes.secondary?.x ?? 0) + (nodes.secondary?.width ?? 0) <= 390);
    assert.equal(nodes.secondary?.textResizeMode, "auto-height");
    assert.ok(
      (nodes.row?.height ?? 0) >=
        (nodes.secondary?.y ?? 0) + (nodes.secondary?.height ?? 0),
    );
  });

  it("aligns nested primary/secondary and expands white card background", () => {
    const nodes: Record<string, EditorNode> = {
      row: {
        id: "row",
        parentId: "screen",
        type: "frame",
        name: "ListItem",
        x: 0,
        y: 200,
        width: 358,
        height: 72,
        rotation: 0,
        visible: true,
        locked: false,
        codeJsxTag: "ListItem",
      },
      bg: {
        id: "bg",
        parentId: "row",
        type: "rectangle",
        name: "Background",
        x: 0,
        y: 0,
        width: 358,
        height: 72,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#ffffff",
        fillEnabled: true,
      },
      icon: {
        id: "icon",
        parentId: "row",
        type: "frame",
        name: "Icon",
        x: 16,
        y: 20,
        width: 24,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
      },
      content: {
        id: "content",
        parentId: "row",
        type: "frame",
        name: "Content",
        x: 56,
        y: 0,
        width: 280,
        height: 72,
        rotation: 0,
        visible: true,
        locked: false,
        codeClassName: "li-item__content",
      },
      primary: {
        id: "primary",
        parentId: "content",
        type: "text",
        name: "Primary",
        x: 0,
        y: 12,
        width: 200,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Start onboarding",
        codeClassName: "li-item__primary",
        fontSize: 16,
      },
      secondary: {
        id: "secondary",
        parentId: "content",
        type: "text",
        name: "Secondary",
        x: 280,
        y: 36,
        width: 340,
        height: 18,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Full KYC flow from welcome to activation",
        codeClassName: "li-item__secondary",
        fontSize: 13,
      },
    };
    const childOrder = {
      screen: ["row"],
      row: ["bg", "icon", "content"],
      content: ["primary", "secondary"],
    };

    normalizeListItemTextNodes(nodes, childOrder);
    assert.equal(nodes.content?.x, 52);
    assert.equal(nodes.primary?.x, 0);
    assert.equal(nodes.secondary?.x, 0);
    assert.equal(
      nodes.secondary?.y,
      (nodes.primary?.y ?? 0) + (nodes.primary?.height ?? 0) + 4,
    );
    assert.ok((nodes.bg?.height ?? 0) > 72);
    assert.ok((nodes.row?.height ?? 0) >= (nodes.bg?.height ?? 0));
    assert.ok((nodes.secondary?.y ?? 0) + (nodes.secondary?.height ?? 0) <= (nodes.bg?.height ?? 0));
  });
});
