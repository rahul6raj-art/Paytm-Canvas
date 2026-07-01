import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  hasMeaningfulCaptureClass,
  organizeBridgeCaptureLayerNames,
} from "../organizeBridgeCaptureLayers";

describe("organizeBridgeCaptureLayers", () => {
  it("detects BEM and component class names", () => {
    assert.equal(hasMeaningfulCaptureClass("pml-more__header"), true);
    assert.equal(hasMeaningfulCaptureClass("bn__icon-wrap"), true);
    assert.equal(hasMeaningfulCaptureClass(""), false);
    assert.equal(hasMeaningfulCaptureClass("flex items-center"), false);
  });

  it("renames generic Frame names to codeClassName", () => {
    const nodes: Record<string, EditorNode> = {
      header: {
        id: "header",
        parentId: "root",
        type: "frame",
        name: "Frame 42",
        x: 0,
        y: 0,
        width: 376,
        height: 56,
        rotation: 0,
        visible: true,
        locked: false,
        codeClassName: "pml-more__header header",
      },
      label: {
        id: "label",
        parentId: "header",
        type: "text",
        name: "Frame 47",
        x: 48,
        y: 16,
        width: 40,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "More",
        codeClassName: "header__title",
      },
    };

    organizeBridgeCaptureLayerNames(nodes);
    assert.equal(nodes.header?.name, "pml-more__header");
    assert.equal(nodes.label?.name, "header__title");
  });
});
