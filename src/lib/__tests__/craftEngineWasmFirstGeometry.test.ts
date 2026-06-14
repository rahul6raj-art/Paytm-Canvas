import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchTouchesGeometry } from "@/engine/craftEngineAuthorityGeometry";
import { commitWasmFirstGeometryPatches } from "@/engine/craftEngineWasmFirstMutation";

describe("craftEngineWasmFirstGeometry", () => {
  it("detects geometry patches", () => {
    assert.equal(patchTouchesGeometry({ x: 1 }), true);
    assert.equal(patchTouchesGeometry({ fill: "#fff" }), false);
  });

  it("commitWasmFirstGeometryPatches returns false without engine", () => {
    const ok = commitWasmFirstGeometryPatches([
      {
        nodeId: "a",
        node: {
          id: "a",
          parentId: null,
          type: "rectangle",
          name: "Rect",
          x: 10,
          y: 20,
          width: 100,
          height: 80,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
    ]);
    assert.equal(ok, false);
  });
});
