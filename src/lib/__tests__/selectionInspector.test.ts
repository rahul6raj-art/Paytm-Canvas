import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSelectionInspectorModel,
  dedupeSelectionEffectTargets,
  resolveSelectionEffectTargets,
} from "../selectionInspector";
import type { EditorNode } from "@/stores/useEditorStore";
import type { NodeEffect } from "@/lib/nodeEffects";

function rect(id: string, x: number, fill = "#cccccc"): EditorNode {
  return {
    id,
    type: "rectangle",
    name: id,
    x,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    fill,
    visible: true,
    locked: false,
    parentId: null,
  } as EditorNode;
}

describe("buildSelectionInspectorModel", () => {
  it("detects mixed position and fill values", () => {
    const nodes = {
      a: rect("a", 10, "#aaaaaa"),
      b: rect("b", 20, "#bbbbbb"),
    };
    const model = buildSelectionInspectorModel(["a", "b"], nodes);
    assert.ok(model);
    assert.equal(model!.count, 2);
    assert.equal(model!.mixed.x, true);
    assert.equal(model!.mixed.fillHex, true);
    assert.equal(model!.caps.canFillStroke, true);
  });
});

describe("resolveSelectionEffectTargets", () => {
  function withEffects(id: string, effects: NodeEffect[]): EditorNode {
    return { ...rect(id, 0), effects };
  }

  it("maps primary effect id to same stack index on each node", () => {
    const primary = withEffects("a", [
      { id: "eff-a", type: "layerBlur", visible: true, radius: 4 },
    ]);
    const b = withEffects("b", [
      { id: "eff-b", type: "layerBlur", visible: true, radius: 4 },
    ]);
    const targets = resolveSelectionEffectTargets([primary, b], primary, "eff-a");
    assert.deepEqual(targets, [
      { nodeId: "a", effectId: "eff-a" },
      { nodeId: "b", effectId: "eff-b" },
    ]);
  });

  it("falls back to shared effect id when present on multiple nodes", () => {
    const shared = { id: "shared", type: "dropShadow" as const, visible: true, radius: 4 };
    const primary = withEffects("a", [shared]);
    const b = withEffects("b", [shared]);
    const targets = resolveSelectionEffectTargets([primary, b], primary, "shared");
    assert.deepEqual(targets, [
      { nodeId: "a", effectId: "shared" },
      { nodeId: "b", effectId: "shared" },
    ]);
  });

  it("dedupes token-backed targets so shared tokens update once", () => {
    const shared = { id: "shared", type: "layerBlur" as const, visible: true, radius: 4 };
    const a = { ...withEffects("a", [shared]), effectTokenId: "tok-1" };
    const b = { ...withEffects("b", [shared]), effectTokenId: "tok-1" };
    const targets = dedupeSelectionEffectTargets(
      [a, b],
      resolveSelectionEffectTargets([a, b], a, "shared"),
    );
    assert.equal(targets.length, 1);
    assert.equal(targets[0]!.nodeId, "a");
  });
});
