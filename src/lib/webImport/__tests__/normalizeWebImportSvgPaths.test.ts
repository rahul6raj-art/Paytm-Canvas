import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  isPassThroughWrapper,
  normalizeWebImportSvgPaths,
} from "../normalizeWebImportLayers";

describe("normalizeWebImportSvgPaths", () => {
  it("keeps stroke on stroke-only icon paths", () => {
    const nodes: Record<string, EditorNode> = {
      path: {
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
        fill: "none",
        fillEnabled: true,
        strokeColor: "#111111",
        strokeWidth: 1.5,
        strokeEnabled: true,
      },
    };

    normalizeWebImportSvgPaths(nodes);
    assert.equal(nodes.path?.fillEnabled, false);
    assert.equal(nodes.path?.strokeEnabled, true);
    assert.equal(nodes.path?.strokeWidth, 1.5);
  });

  it("does not collapse icon-wrap around an SVG frame", () => {
    const wrap: EditorNode = {
      id: "wrap",
      parentId: "tab",
      type: "frame",
      name: "bn__icon-wrap",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      codeClassName: "bn__icon-wrap",
    };
    const svg: EditorNode = {
      id: "svg",
      parentId: "wrap",
      type: "frame",
      name: "SVG",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
    };
    assert.equal(isPassThroughWrapper(wrap, [svg]), false);
  });
});
