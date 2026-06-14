import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  __testBuildStructuralOps,
  createCraftEngineSyncState,
  syncCraftEngineDocument,
} from "@/engine/craftEngineIncrementalSync";
import type { CraftEngineDocument, CraftEngineInstance } from "@/engine/craftEngineTypes";

function baseDoc(): CraftEngineDocument {
  return {
    rootIds: ["a"],
    childOrder: { __root__: ["a"] },
    nodes: {
      a: { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 80 },
    },
  };
}

function mockEngine() {
  const syncs: string[] = [];
  const loads: string[] = [];
  const snapshots: number[] = [];
  const ops: string[] = [];
  const engine = {
    syncDocument(json: string) {
      syncs.push(json);
    },
    loadDocument(json: string) {
      loads.push(json);
    },
    pushHistorySnapshot() {
      snapshots.push(snapshots.length + 1);
    },
    applyDocumentOp(json: string) {
      ops.push(json);
    },
    applyDocumentOps(json: string) {
      ops.push(json);
    },
    clearHistory() {},
    registerFontFamily() {},
    layoutTextNode() {
      return JSON.stringify({
        source: "wasm",
        lines: [],
        width: 0,
        height: 0,
        lineHeightPx: 16,
        paragraphSpacing: 0,
        verticalTrimTop: 0,
        innerW: 1,
        innerH: 1,
        blockOffsetY: 0,
        caretStops: [],
        glyphs: [],
        font: {
          requestedFamily: "Inter",
          resolvedFamily: "Inter",
          fallbackUsed: false,
          missing: false,
        },
        rtl: false,
      });
    },
  } as CraftEngineInstance;
  return { engine, syncs, loads, snapshots, ops };
}

describe("craftEngineIncrementalSync", () => {
  it("uses full sync on first load", () => {
    const { engine, syncs } = mockEngine();
    const state = createCraftEngineSyncState();
    const mode = syncCraftEngineDocument(engine, baseDoc(), state);
    assert.equal(mode, "full");
    assert.equal(syncs.length, 1);
  });

  it("applies updateNode ops for moved nodes", () => {
    const { engine, ops } = mockEngine();
    const state = createCraftEngineSyncState();
    syncCraftEngineDocument(engine, baseDoc(), state);
    const next = baseDoc();
    next.nodes.a = { ...next.nodes.a, x: 40, y: 20 };
    const mode = syncCraftEngineDocument(engine, next, state);
    assert.equal(mode, "incremental");
    assert.equal(ops.length, 1);
    assert.match(ops[0] ?? "", /"op":"updateNode"/);
  });

  it("uses setTree for reorder only", () => {
    const { engine, ops, syncs } = mockEngine();
    const state = createCraftEngineSyncState();
    const prev = baseDoc();
    syncCraftEngineDocument(engine, prev, state);
    const next = baseDoc();
    next.childOrder = { __root__: ["a"] };
    next.rootIds = ["a"];
    const structural = __testBuildStructuralOps(prev, next);
    assert.equal(structural, "full");

    const withB = {
      ...prev,
      rootIds: ["a", "b"],
      childOrder: { __root__: ["a", "b"] },
      nodes: {
        ...prev.nodes,
        b: { id: "b", type: "rectangle", x: 10, y: 0, width: 40, height: 40 },
      },
    };
    syncCraftEngineDocument(engine, withB, state);
    const reordered = {
      ...withB,
      childOrder: { __root__: ["b", "a"] },
    };
    const mode = syncCraftEngineDocument(engine, reordered, state);
    assert.equal(mode, "incremental");
    assert.match(ops.at(-1) ?? "", /"op":"setTree"/);
    assert.equal(syncs.length, 1);
  });

  it("uses insertNode for single add", () => {
    const { engine, ops } = mockEngine();
    const state = createCraftEngineSyncState();
    syncCraftEngineDocument(engine, baseDoc(), state);
    const next = {
      ...baseDoc(),
      rootIds: ["a", "b"],
      childOrder: { __root__: ["a", "b"] },
      nodes: {
        ...baseDoc().nodes,
        b: { id: "b", type: "ellipse", x: 20, y: 10, width: 50, height: 50 },
      },
    };
    const mode = syncCraftEngineDocument(engine, next, state);
    assert.equal(mode, "incremental");
    assert.match(ops[0] ?? "", /"op":"insertNode"/);
  });

  it("forceFull bypasses incremental ops", () => {
    const { engine, syncs, ops } = mockEngine();
    const state = createCraftEngineSyncState();
    syncCraftEngineDocument(engine, baseDoc(), state);
    const next = baseDoc();
    next.nodes.a = { ...next.nodes.a, x: 12 };
    const mode = syncCraftEngineDocument(engine, next, state, { forceFull: true });
    assert.equal(mode, "full");
    assert.equal(syncs.length, 2);
    assert.equal(ops.length, 0);
  });

  it("wasmBootstrap uses loadDocument and seeds undo snapshot", () => {
    const { engine, syncs, loads, snapshots } = mockEngine();
    const state = createCraftEngineSyncState();
    const mode = syncCraftEngineDocument(engine, baseDoc(), state, { wasmBootstrap: true });
    assert.equal(mode, "bootstrap");
    assert.equal(loads.length, 1);
    assert.equal(snapshots.length, 1);
    assert.equal(syncs.length, 0);
  });

  it("forceFull after undo uses syncDocument not bootstrap", () => {
    const { engine, syncs, loads, snapshots } = mockEngine();
    const state = createCraftEngineSyncState();
    const mode = syncCraftEngineDocument(engine, baseDoc(), state, {
      forceFull: true,
      wasmBootstrap: true,
    });
    assert.equal(mode, "full");
    assert.equal(syncs.length, 1);
    assert.equal(loads.length, 0);
    assert.equal(snapshots.length, 0);
  });
});
