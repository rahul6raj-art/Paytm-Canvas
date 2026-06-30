import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import {
  clampBottomNavWidths,
  fitBridgeCaptureTextBounds,
  finalizeBridgeLiveCapture,
  layoutBridgeCaptureTextNode,
  pinBridgeCaptureChildren,
} from "../finalizeBridgeLiveCapture";

function frame(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("finalizeBridgeLiveCapture", () => {
  it("clamps bottom nav bar width without changing x", () => {
    const nodes: Record<string, EditorNode> = {
      bn: frame("bn", "root", 0, 714, 388, 130, { codeClassName: "bn" }),
      bar: frame("bar", "bn", 0, 32, 388, 98, { codeClassName: "bn__bar" }),
    };

    clampBottomNavWidths(nodes);
    assert.equal(nodes.bar?.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(nodes.bar?.x, 0);
    assert.equal(nodes.bn?.width, PML_PHONE_COLUMN_WIDTH);
  });

  it("preserves section horizontal inset (does not zero x)", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 80, 80, PML_PHONE_COLUMN_WIDTH, 844, {
        codeClassName: "pml-more",
      }),
      section: frame("section", "root", 16, 120, 360, 200, {
        codeClassName: "sh-section",
      }),
      content: frame("content", "section", 0, 56, 360, 136, {
        codeClassName: "sh-section__content",
        layoutMode: "vertical",
        layoutGap: 12,
      }),
      card: frame("card", "content", 0, 0, 344, 96, { codeClassName: "card" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["section"],
      section: ["content"],
      content: ["card"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);
    assert.equal(nodes.section?.x, 16, "section margin must stay at captured inset");
    assert.equal(nodes.content?.x, 0);
    assert.equal(nodes.card?.x, 0);
    assert.equal(nodes.card?.layoutPositioning, "absolute");
    assert.equal(nodes.content?.layoutMode, "none");
  });

  it("locks phone shell artboard to column width", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 80, 80, 390, 844, { codeClassName: "pml-more" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"] };

    finalizeBridgeLiveCapture(nodes, childOrder);
    assert.equal(nodes.root?.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(nodes.root?.clipChildren, true);
  });

  it("pinBridgeCaptureChildren keeps measured coordinates", () => {
    const nodes: Record<string, EditorNode> = {
      row: frame("row", "root", 0, 24, 280, 68, {
        codeClassName: "li-item__secondary-row",
        layoutMode: "horizontal",
      }),
      text: frame("text", "row", 0, 0, 280, 20),
    };
    const childOrder = { row: ["text"] };

    pinBridgeCaptureChildren(nodes, childOrder);
    assert.equal(nodes.text?.layoutPositioning, "absolute");
    assert.equal(nodes.text?.y, 0);
  });

  it("fitBridgeCaptureTextBounds expands narrow captured labels", () => {
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "card",
        type: "text",
        name: "Appearance",
        x: 16,
        y: 12,
        width: 28,
        height: 20,
        content: "Appearance",
        fontSize: 16,
        textResizeMode: "fixed",
      } as EditorNode,
    };
    fitBridgeCaptureTextBounds(nodes);
    assert.ok((nodes.label?.width ?? 0) > 28);
    assert.notEqual(nodes.label?.textResizeMode, "fixed");
    assert.equal(nodes.label?.x, 16);
  });

  it("layoutBridgeCaptureTextNode never shrinks below captured DOM height", () => {
    const node = {
      id: "label",
      type: "text",
      name: "Dark theme",
      x: 0,
      y: 16,
      width: 90,
      height: 20,
      content: "Dark theme",
      fontSize: 14,
      lineHeight: 1.27,
      textResizeMode: "auto-width",
    } as EditorNode;
    const next = layoutBridgeCaptureTextNode(node, "Dark theme");
    assert.ok((next.height ?? 0) >= 20, `height ${next.height}`);
  });

  it("expands clipping row when label extends below captured flex height", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, PML_PHONE_COLUMN_WIDTH, 844, {
        codeClassName: "pml-more",
      }),
      row: frame("row", "root", 16, 100, 320, 28, {
        codeClassName: "pml-more-theme-card",
        clipChildren: true,
      }),
      label: {
        id: "label",
        parentId: "row",
        type: "text",
        name: "Dark theme",
        x: 16,
        y: 16,
        width: 90,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Dark theme",
        fontSize: 14,
        lineHeight: 1.27,
        codeClassName: "pml-more-theme-card__label body-medium",
        textResizeMode: "fixed",
      } as EditorNode,
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["row"],
      row: ["label"],
    };
    finalizeBridgeLiveCapture(nodes, childOrder);
    assert.ok(
      (nodes.row?.height ?? 0) >= (nodes.label?.y ?? 0) + (nodes.label?.height ?? 0),
      `row h=${nodes.row?.height} label bottom=${(nodes.label?.y ?? 0) + (nodes.label?.height ?? 0)}`,
    );
  });
});
