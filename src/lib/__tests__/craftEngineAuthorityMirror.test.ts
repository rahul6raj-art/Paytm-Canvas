import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  flushDeferredWasmReconcile,
  isWasmDocumentMutationIdle,
  requestDeferredWasmReconcile,
  shouldElideCompositorDocumentSync,
  storePatchMatchesDocument,
} from "@/engine/craftEngineAuthorityMirror";
import { useEditorStore } from "@/stores/useEditorStore";
import { createCraftEngineSyncState } from "@/engine/craftEngineIncrementalSync";
import type { CraftEngineDocument } from "@/engine/craftEngineTypes";

function baseDoc(): CraftEngineDocument {
  return {
    rootIds: ["a"],
    childOrder: { __root__: ["a"] },
    nodes: {
      a: { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 80 },
    },
  };
}

describe("craftEngineAuthorityMirror", () => {
  it("detects matching store patches", () => {
    const patch = {
      nodes: { a: { id: "a", type: "rectangle", x: 1, y: 2, width: 10, height: 10 } },
      childOrder: { __root__: ["a"] },
    };
    assert.equal(storePatchMatchesDocument(patch, patch.nodes, patch.childOrder), true);
    assert.equal(
      storePatchMatchesDocument(patch, { b: { id: "b" } }, patch.childOrder),
      false,
    );
  });

  it("detects idle document mutation state", () => {
    useEditorStore.setState({
      transformInteractionMode: "none",
      isMovingSelection: false,
      isApplyingWasmMirror: false,
      isApplyingHistory: false,
    });
    assert.equal(isWasmDocumentMutationIdle(), true);
    useEditorStore.setState({ isMovingSelection: true });
    assert.equal(isWasmDocumentMutationIdle(), false);
    useEditorStore.setState({ isMovingSelection: false, transformInteractionMode: "resize" });
    assert.equal(isWasmDocumentMutationIdle(), false);
  });

  it("clears deferred reconcile without applying WASM snapshot to store", () => {
    assert.equal(flushDeferredWasmReconcile(), false);
    requestDeferredWasmReconcile();
    assert.equal(flushDeferredWasmReconcile(), false);
  });

  it("elides compositor sync when baseline matches", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevMirror = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    try {
      const state = createCraftEngineSyncState();
      const doc = baseDoc();
      state.lastDocument = doc;
      assert.equal(shouldElideCompositorDocumentSync(doc, state), true);
      const moved = {
        ...doc,
        nodes: {
          ...doc.nodes,
          a: { ...doc.nodes.a!, x: 12, y: 8 },
        },
      };
      assert.equal(shouldElideCompositorDocumentSync(moved, state), false);
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevMirror === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR = prevMirror;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
    }
  });
});
