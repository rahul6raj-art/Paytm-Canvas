import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("craftEngineWasmFirstImportStyle", () => {
  it("setNodeFillHex updates node fill", () => {
    const id = `rect-fill-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "rectangle",
          name: "Rect",
          x: 0,
          y: 0,
          width: 80,
          height: 60,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          fill: "#000000",
          fillEnabled: true,
          fillOpacity: 1,
          strokePosition: "center",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().setNodeFillHex(id, "#ff5500");
    assert.equal(useEditorStore.getState().nodes[id]?.fill, "#ff5500");
  });

  it("applyTokenToSelection binds fill token", () => {
    const id = `rect-tok-${Date.now()}`;
    const tokenId = `color-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "rectangle",
          name: "Rect",
          x: 0,
          y: 0,
          width: 80,
          height: 60,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          fill: "#000000",
          fillEnabled: true,
          fillOpacity: 1,
          strokePosition: "center",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
      designTokens: {
        [tokenId]: {
          id: tokenId,
          name: "Brand",
          type: "color",
          value: "#3366ff",
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    useEditorStore.getState().applyTokenToSelection(tokenId);
    assert.equal(useEditorStore.getState().nodes[id]?.fillTokenId, tokenId);
  });

  it("toggleLockSelection flips locked on selected nodes", () => {
    const id = `rect-lock-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "rectangle",
          name: "Rect",
          x: 0,
          y: 0,
          width: 80,
          height: 60,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().toggleLockSelection();
    assert.equal(useEditorStore.getState().nodes[id]?.locked, true);
  });

  it("detachTokenFromSelection clears fill token", () => {
    const id = `rect-det-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "rectangle",
          name: "Rect",
          x: 0,
          y: 0,
          width: 80,
          height: 60,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          fillTokenId: "tok-1",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().detachTokenFromSelection("color");
    assert.equal(useEditorStore.getState().nodes[id]?.fillTokenId, undefined);
  });
});
