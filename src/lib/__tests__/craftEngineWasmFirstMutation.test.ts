import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWasmFirstMutationsMode,
  syncWasmDocumentAfterStoreUpdate,
} from "@/engine/craftEngineWasmFirstMutation";
import { craftPublicConfigFromEnv } from "@/lib/craftPublicConfig";

describe("craftEngineWasmFirstMutation", () => {
  it("defaults wasm-first mutations on with UI mirror", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    const prevMirror = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    const prevFirst = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS;
    try {
      assert.equal(craftPublicConfigFromEnv().wasmFirstMutations, true);
      assert.equal(isWasmFirstMutationsMode(), true);
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
      if (prevMirror === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR = prevMirror;
      if (prevFirst === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS = prevFirst;
    }
  });

  it("syncWasmDocumentAfterStoreUpdate falls back without engine", () => {
    assert.doesNotThrow(() => syncWasmDocumentAfterStoreUpdate());
  });

  it("disables wasm-first when UI mirror is off", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevMirror = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR = "false";
    try {
      assert.equal(craftPublicConfigFromEnv().wasmFirstMutations, false);
      assert.equal(isWasmFirstMutationsMode(), false);
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevMirror === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR = prevMirror;
    }
  });
});
