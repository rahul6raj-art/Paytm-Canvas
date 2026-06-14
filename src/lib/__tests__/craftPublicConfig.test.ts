import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { craftPublicConfigFromEnv } from "@/lib/craftPublicConfig";
import { LEGACY_RENDERER_ENVS } from "@/lib/legacyRendererEnv";

describe("craftPublicConfig", () => {
  it("defaults renderer to native when env unset", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    try {
      assert.equal(craftPublicConfigFromEnv().renderer, "native");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prev;
    }
  });

  it("coerces legacy dom/svg/webgl env values to native", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    try {
      for (const legacy of LEGACY_RENDERER_ENVS) {
        process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = legacy;
        assert.equal(craftPublicConfigFromEnv().renderer, "native");
      }
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prev;
    }
  });

  it("respects native WASM GPU renderer override", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    try {
      assert.equal(craftPublicConfigFromEnv().renderer, "native");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prev;
    }
  });

  it("defaults wasm authority on for native renderer", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    try {
      assert.equal(craftPublicConfigFromEnv().wasmAuthority, true);
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
    }
  });

  it("defaults wasm UI mirror on with native WASM authority", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    const prevMirror = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
    try {
      assert.equal(craftPublicConfigFromEnv().wasmUiMirror, true);
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
      if (prevMirror === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR = prevMirror;
    }
  });

  it("defaults wasm first mutations on with native authority and UI mirror", () => {
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

  it("disables wasm authority when env is false", () => {
    const prevRenderer = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    const prevAuth = process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = "native";
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = "false";
    try {
      assert.equal(craftPublicConfigFromEnv().wasmAuthority, false);
    } finally {
      if (prevRenderer === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prevRenderer;
      if (prevAuth === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY = prevAuth;
    }
  });
});
