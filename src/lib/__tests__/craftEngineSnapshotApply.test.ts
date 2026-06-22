import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeWasmSnapshotWithStore,
  wasmSnapshotToStorePatch,
} from "@/engine/craftEngineSnapshotApply";
import type { EditorNode } from "@/stores/useEditorStore";

function node(id: string, overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    type: "rectangle",
    parentId: null,
    name: id,
    x: 0,
    y: 0,
    width: 80,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...overrides,
  };
}

describe("craftEngineSnapshotApply", () => {
  it("parses WASM snapshot into nodes and childOrder", () => {
    const json = JSON.stringify({
      rootIds: ["a"],
      childOrder: { __root__: ["a"] },
      nodes: {
        a: { id: "a", type: "rectangle", x: 12, y: 8, width: 40, height: 30 },
      },
    });
    const patch = wasmSnapshotToStorePatch(json);
    assert.ok(patch);
    assert.equal(patch!.nodes.a?.x, 12);
    assert.deepEqual(patch!.childOrder.__root__, ["a"]);
  });

  it("returns null for invalid json", () => {
    assert.equal(wasmSnapshotToStorePatch("{"), null);
  });

  it("preserves store layer names when merging WASM snapshots", () => {
    const patch = wasmSnapshotToStorePatch(
      JSON.stringify({
        rootIds: ["a"],
        childOrder: { __root__: ["a"] },
        nodes: {
          a: { id: "a", type: "rectangle", x: 12, y: 8, width: 40, height: 30 },
        },
      }),
    );
    assert.ok(patch);
    const merged = mergeWasmSnapshotWithStore(
      { a: node("a", { name: "Rectangle 1" }) },
      patch!,
    );
    assert.equal(merged.nodes.a?.name, "Rectangle 1");
    assert.equal(merged.nodes.a?.x, 12);
  });

  it("preserves store transform box during WASM mirror reconcile", () => {
    const previous = node("a", {
      x: 18548,
      y: 12032,
      width: 580,
      height: 598,
      rotation: 14,
    });
    const patch = wasmSnapshotToStorePatch(
      JSON.stringify({
        rootIds: ["a"],
        childOrder: { __root__: ["a"] },
        nodes: {
          a: {
            id: "a",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 7.697682711372,
            height: 7.697682711372,
            rotation: 14,
          },
        },
      }),
    );
    assert.ok(patch);
    const merged = mergeWasmSnapshotWithStore({ a: previous }, patch!, {
      preserveStoreGeometry: true,
    });
    assert.equal(merged.nodes.a?.x, 18548);
    assert.equal(merged.nodes.a?.y, 12032);
    assert.equal(merged.nodes.a?.width, 580);
    assert.equal(merged.nodes.a?.height, 598);
    assert.equal(merged.nodes.a?.rotation, 14);
  });

  it("assigns numbered names for WASM-only nodes", () => {
    const patch = wasmSnapshotToStorePatch(
      JSON.stringify({
        rootIds: ["a"],
        childOrder: { __root__: ["a"] },
        nodes: {
          a: { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        },
      }),
    );
    assert.ok(patch);
    const merged = mergeWasmSnapshotWithStore({}, patch!);
    assert.equal(merged.nodes.a?.name, "Rectangle 1");
  });

  it("deep-merges partial nested stroke from WASM snapshots", () => {
    const previous = node("a", {
      strokeWidth: 4,
      strokeColor: "#111111",
      strokeEnabled: true,
      stroke: {
        enabled: true,
        color: "#111111",
        width: 4,
        opacity: 1,
        align: "center",
        join: "miter",
        cap: "butt",
        dashPattern: [],
      },
    });
    const patch = wasmSnapshotToStorePatch(
      JSON.stringify({
        rootIds: ["a"],
        childOrder: { __root__: ["a"] },
        nodes: {
          a: {
            id: "a",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            strokeWidth: 4,
            strokeColor: "#111111",
            strokeEnabled: true,
            stroke: { enabled: true, cap: "butt", join: "miter", dashPattern: [] },
          },
        },
      }),
    );
    assert.ok(patch);
    const merged = mergeWasmSnapshotWithStore({ a: previous }, patch!);
    assert.equal(merged.nodes.a?.stroke?.width, 4);
    assert.equal(merged.nodes.a?.stroke?.color, "#111111");
    assert.equal(merged.nodes.a?.strokeWidth, 4);
  });

  it("keeps store geometry for auto-layout flow children over WASM snapshots", () => {
    const parent = node("parent", {
      type: "frame",
      name: "Frame",
      layoutMode: "vertical",
      width: 120,
      height: 200,
    });
    const child = node("child", {
      type: "rectangle",
      parentId: "parent",
      name: "Child",
      x: 0,
      y: 50,
      width: 80,
      height: 40,
    });
    const patch = wasmSnapshotToStorePatch(
      JSON.stringify({
        rootIds: ["parent"],
        childOrder: { __root__: ["parent"], parent: ["child"] },
        nodes: {
          parent: { id: "parent", type: "frame", x: 0, y: 0, width: 120, height: 200 },
          child: { id: "child", type: "rectangle", x: 60, y: 0, width: 80, height: 40 },
        },
      }),
    );
    assert.ok(patch);
    const merged = mergeWasmSnapshotWithStore({ parent, child }, patch!);
    assert.equal(merged.nodes.child?.x, 0);
    assert.equal(merged.nodes.child?.y, 50);
  });

  it("keeps auto-layout container hug size over stale WASM snapshots", () => {
    const parent = node("parent", {
      type: "frame",
      name: "Frame",
      layoutMode: "horizontal",
      layoutGap: 90,
      width: 420,
      height: 120,
    });
    const patch = wasmSnapshotToStorePatch(
      JSON.stringify({
        rootIds: ["parent"],
        childOrder: { __root__: ["parent"] },
        nodes: {
          parent: { id: "parent", type: "frame", x: 0, y: 0, width: 300, height: 120 },
        },
      }),
    );
    assert.ok(patch);
    const merged = mergeWasmSnapshotWithStore({ parent }, patch!);
    assert.equal(merged.nodes.parent?.width, 420);
    assert.equal(merged.nodes.parent?.layoutGap, 90);
  });
});
