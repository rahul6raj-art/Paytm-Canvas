import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  normalizeBottomNavTextNodes,
  normalizeImportedLabelTextNodes,
  normalizeWebImportTextNodes,
} from "../normalizeWebImportLayers";

function navLabel(id: string, content: string, width: number, height: number): EditorNode {
  return {
    id,
    parentId: "tab",
    type: "text",
    name: content,
    x: 8,
    y: 28,
    width,
    height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    codeClassName: "bn__label body-medium",
    fontSize: 12,
    lineHeight: 1.2,
    fill: "#111111",
    textColor: "#111111",
  };
}

describe("bottom nav text import", () => {
  it("does not wrap short tab labels to auto-height", () => {
    const nodes: Record<string, EditorNode> = {
      tab: {
        id: "tab",
        parentId: "bn",
        type: "frame",
        name: "Tab",
        x: 0,
        y: 0,
        width: 78,
        height: 56,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      home: navLabel("home", "Home", 78, 14),
    };

    normalizeWebImportTextNodes(nodes);
    assert.equal(nodes.home?.textResizeMode, "auto-width");
    assert.ok((nodes.home?.height ?? 0) <= 20, `height ${nodes.home?.height}`);
  });

  it("centers bn__label text inside its tab", () => {
    const nodes: Record<string, EditorNode> = {
      tab: {
        id: "tab",
        parentId: "bn",
        type: "frame",
        name: "Tab",
        x: 0,
        y: 0,
        width: 78,
        height: 56,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      home: navLabel("home", "Home", 20, 28),
    };

    normalizeBottomNavTextNodes(nodes);
    assert.equal(nodes.home?.textResizeMode, "auto-width");
    assert.ok((nodes.home?.width ?? 0) >= 40);
    assert.equal(nodes.home?.textAlign, "center");
    assert.ok((nodes.home?.x ?? 0) >= 10 && (nodes.home?.x ?? 0) <= 20);
    assert.ok((nodes.home?.height ?? 0) <= 20);
  });

  it("expands squeezed theme-card labels like Dark theme", () => {
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "card",
        type: "text",
        name: "Dark theme",
        x: 16,
        y: 20,
        width: 8,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Dark theme",
        codeClassName: "pml-more-theme-card__label body-medium",
        fontSize: 14,
        lineHeight: 1.27,
        fill: "#111111",
        textColor: "#111111",
      },
    };

    normalizeImportedLabelTextNodes(nodes);
    assert.ok((nodes.label?.width ?? 0) >= 80, `width ${nodes.label?.width}`);
    assert.equal(nodes.label?.textResizeMode, "auto-width");
  });
});
