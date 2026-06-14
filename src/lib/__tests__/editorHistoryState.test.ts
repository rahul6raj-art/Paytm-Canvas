import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editorCanRedoHistory, editorCanUndoHistory } from "@/engine/editorHistoryState";

describe("editorHistoryState", () => {
  it("uses zustand stacks when wasm authority is off", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = "false";
    try {
      assert.equal(
        editorCanUndoHistory({
          historyPast: [{}],
          historyFuture: [],
          wasmHistoryCanUndo: false,
          wasmHistoryCanRedo: false,
        }),
        true,
      );
      assert.equal(
        editorCanRedoHistory({
          historyPast: [],
          historyFuture: [{}],
          wasmHistoryCanUndo: false,
          wasmHistoryCanRedo: false,
        }),
        true,
      );
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
    }
  });

  it("uses wasm history flags when native authority is on", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    try {
      assert.equal(
        editorCanUndoHistory({
          historyPast: [{}],
          historyFuture: [],
          wasmHistoryCanUndo: true,
          wasmHistoryCanRedo: false,
        }),
        true,
      );
      assert.equal(
        editorCanUndoHistory({
          historyPast: [{}],
          historyFuture: [],
          wasmHistoryCanUndo: false,
          wasmHistoryCanRedo: false,
        }),
        false,
      );
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
    }
  });
});
