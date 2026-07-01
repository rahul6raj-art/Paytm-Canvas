import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { validateBridgeCaptureFidelity } from "@/lib/craftBridge/bridgeCaptureValidate";

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
    visible: true,
    locked: false,
    ...extra,
  } as EditorNode;
}

function text(id: string, parentId: string, content: string, extra?: Partial<EditorNode>): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: id,
    x: 0,
    y: 0,
    width: 80,
    height: 16,
    visible: true,
    locked: false,
    content,
    fontSize: 12,
    ...extra,
  } as EditorNode;
}

describe("validateBridgeCaptureFidelity", () => {
  it("flags empty chip pill", () => {
    const nodes: Record<string, EditorNode> = {
      chip: frame("chip", EDITOR_ROOT_KEY, 0, 0, 72, 20, {
        codeClassName: "badge badge--muted",
        fillEnabled: true,
        fill: "#FFE8D6",
        codeJsxTag: "span",
      }),
    };
    const result = validateBridgeCaptureFidelity(nodes, { [EDITOR_ROOT_KEY]: ["chip"] }, {
      requireRoundTripMetadata: false,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.rule === "chip-badge-label"));
  });

  it("flags selected card without stroke", () => {
    const nodes: Record<string, EditorNode> = {
      card: frame("card", EDITOR_ROOT_KEY, 0, 0, 344, 120, {
        codeClassName: "ob-flow-sig-option ob-flow-sig-option--selected",
        fill: "#E8F5EC",
        fillEnabled: true,
        codeJsxTag: "div",
      }),
    };
    const result = validateBridgeCaptureFidelity(nodes, { [EDITOR_ROOT_KEY]: ["card"] }, {
      requireRoundTripMetadata: false,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.rule === "selected-card-stroke"));
  });

  it("flags auto-width bridge heading text", () => {
    const nodes: Record<string, EditorNode> = {
      title: text("title", EDITOR_ROOT_KEY, "Draw your signature", {
        textResizeMode: "auto-width",
        layoutSizingHorizontal: "hug",
        codeClassName: "ob-flow__title",
        codeJsxTag: "h1",
      }),
    };
    const result = validateBridgeCaptureFidelity(nodes, { [EDITOR_ROOT_KEY]: ["title"] }, {
      requireRoundTripMetadata: false,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.rule === "bridge-text-fixed-resize"));
  });

  it("allows wrapped onboarding heading without explicit newlines", () => {
    const nodes: Record<string, EditorNode> = {
      title: text("title", EDITOR_ROOT_KEY, "You are already registered with DigiLocker", {
        width: 328,
        height: 56,
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 133,
        lineHeightUnit: "PERCENT",
        textResizeMode: "fixed",
        layoutSizingHorizontal: "fixed",
        bridgeDomTextBox: true,
        codeClassName: "ob-flow__title",
        codeJsxTag: "h1",
      }),
    };
    const result = validateBridgeCaptureFidelity(nodes, { [EDITOR_ROOT_KEY]: ["title"] }, {
      requireRoundTripMetadata: false,
    });
    assert.ok(!result.errors.some((e) => e.rule === "single-line-text-height"));
  });

  it("still flags inflated single-line capture height", () => {
    const nodes: Record<string, EditorNode> = {
      label: text("label", EDITOR_ROOT_KEY, "Confirm", {
        width: 320,
        height: 56,
        fontSize: 14,
        lineHeight: 20,
        lineHeightUnit: "PIXELS",
        textResizeMode: "fixed",
        bridgeDomTextBox: true,
      }),
    };
    const result = validateBridgeCaptureFidelity(nodes, { [EDITOR_ROOT_KEY]: ["label"] }, {
      requireRoundTripMetadata: false,
    });
    assert.ok(result.errors.some((e) => e.rule === "single-line-text-height"));
  });
});
