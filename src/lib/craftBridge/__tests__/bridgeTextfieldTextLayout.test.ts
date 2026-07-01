import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bridgeTextfieldHostWidthPatches,
  bridgeTextfieldTextLayoutPatchForContent,
  isBridgeTextInsideTextfield,
} from "@/lib/craftBridge/bridgeTextfieldTextLayout";
import { preserveBridgeCaptureTextGeometry } from "@/lib/craftBridge/finalizeBridgeLiveCapture";
import type { EditorNode } from "@/stores/useEditorStore";

describe("bridgeTextfieldTextLayout", () => {
  it("detects text inside captured textfield hosts", () => {
    const nodes: Record<string, EditorNode> = {
      box: {
        id: "box",
        parentId: "root",
        type: "frame",
        name: "box",
        x: 0,
        y: 0,
        width: 344,
        height: 52,
        rotation: 0,
        visible: true,
        locked: false,
        codeClassName: "textfield__box",
      },
      value: {
        id: "value",
        parentId: "box",
        type: "text",
        name: "Value",
        x: 16,
        y: 16,
        width: 120,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "98765",
        codeClassName: "textfield__input body-medium",
        fontSize: 16,
      },
    };
    assert.equal(isBridgeTextInsideTextfield(nodes.value!, nodes), true);
  });

  it("preserveBridgeCaptureTextGeometry uses auto-width for textfield text", () => {
    const nodes: Record<string, EditorNode> = {
      box: {
        id: "box",
        parentId: null,
        type: "frame",
        name: "box",
        x: 0,
        y: 0,
        width: 344,
        height: 52,
        rotation: 0,
        visible: true,
        locked: false,
        codeClassName: "textfield__box",
      },
      value: {
        id: "value",
        parentId: "box",
        type: "text",
        name: "Value",
        x: 16,
        y: 16,
        width: 120,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Mobile number",
        codeClassName: "textfield__input body-medium",
        fontSize: 16,
        textResizeMode: "fixed",
      },
    };
    preserveBridgeCaptureTextGeometry(nodes);
    assert.equal(nodes.value?.textResizeMode, "auto-width");
    assert.equal(nodes.value?.autoResize, "width-height");
  });

  it("grows text width while typing and expands the textfield host when needed", () => {
    const nodes: Record<string, EditorNode> = {
      box: {
        id: "box",
        parentId: null,
        type: "frame",
        name: "box",
        x: 0,
        y: 0,
        width: 160,
        height: 52,
        rotation: 0,
        visible: true,
        locked: false,
        codeClassName: "textfield__box",
      },
      value: {
        id: "value",
        parentId: "box",
        type: "text",
        name: "Value",
        x: 16,
        y: 16,
        width: 80,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "98",
        codeClassName: "textfield__input body-medium",
        fontSize: 16,
        textResizeMode: "auto-width",
        autoResize: "width-height",
      },
    };

    const layoutPatch = bridgeTextfieldTextLayoutPatchForContent(
      nodes.value!,
      "98765432109999",
      nodes,
    );
    assert.ok(layoutPatch?.width, "expected width patch");
    assert.ok((layoutPatch?.width ?? 0) > 80, `got width ${layoutPatch?.width}`);

    const grown = { ...nodes.value!, ...layoutPatch };
    const hostPatches = bridgeTextfieldHostWidthPatches(grown, nodes);
    assert.ok(hostPatches.box?.width && hostPatches.box.width > 160);
  });
});
