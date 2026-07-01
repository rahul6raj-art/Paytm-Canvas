import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  buildBridgeImportWebRequest,
  enforceBridgeViewportArtboard,
  PML_PHONE_COLUMN_WIDTH,
  PML_PHONE_VIEWPORT_HEIGHT,
} from "../bridgeCaptureViewport";

function frame(id: string, extra?: Partial<EditorNode>): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 400,
    height: 2000,
    rotation: 0,
    visible: true,
    locked: false,
    ...extra,
  } as EditorNode;
}

describe("bridgeCaptureViewport", () => {
  it("builds a viewport-faithful capture request for any preview URL", () => {
    const req = buildBridgeImportWebRequest("http://localhost:5173/?screen=stocks&homeTab=ipos");
    assert.equal(req.bridgeViewportCapture, true);
    assert.equal(req.urlPolicy, "react-preview");
    assert.equal(req.mode, "editable");
    assert.equal(req.viewport.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(req.viewport.height, PML_PHONE_VIEWPORT_HEIGHT);
  });

  it("locks every phone shell artboard to the preview viewport", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", { codeClassName: "pml-more", height: 1960 }),
      inner: frame("inner", { parentId: "root", codeClassName: "pml-stocks", height: 1800 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["inner"] };

    enforceBridgeViewportArtboard(nodes, childOrder);

    assert.equal(nodes.root?.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(nodes.root?.height, PML_PHONE_VIEWPORT_HEIGHT);
    assert.equal(nodes.root?.clipChildren, true);
    assert.equal(nodes.inner?.height, PML_PHONE_VIEWPORT_HEIGHT);
  });
});
