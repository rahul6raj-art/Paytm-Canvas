import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { ROOT } from "@/stores/useEditorStore";
import { markNodeAsComponent } from "@/lib/componentModel";
import {
  addVariantAxisToGroup,
  buildCreateComponentSetFromSelectionResult,
  canCombineAsVariants,
  canCreateComponentSetFromSelection,
  combineComponentsAsVariants,
  nextVariantMasterPosition,
  readRecentComponentIds,
  recordRecentComponent,
  resolveRecentMasters,
  variantAxesForGroup,
  variantValuesForAxis,
} from "@/lib/componentUx";
import {
  canCreateComponentFromSelection,
  groupComponentMasters,
  listComponentMasters,
} from "@/lib/componentModel";

function frame(id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: partial.name ?? id,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: 100,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  } as EditorNode;
}

function buildTwoMasters() {
  let nodes: Record<string, EditorNode> = {
    a: frame("a", { name: "Button/Default", x: 0 }),
    b: frame("b", { name: "Button/Hover", x: 120 }),
  };
  const childOrder = { [ROOT]: ["a", "b"] };
  nodes = markNodeAsComponent(nodes, childOrder, "a");
  nodes = markNodeAsComponent(nodes, childOrder, "b");
  return { nodes, childOrder };
}

describe("componentUx helpers", () => {
  it("canCombineAsVariants requires 2+ component masters", () => {
    const { nodes } = buildTwoMasters();
    assert.equal(canCombineAsVariants(["a"], nodes), false);
    assert.equal(canCombineAsVariants(["a", "b"], nodes), true);
  });

  it("canCreateComponentSetFromSelection accepts 2+ raw frames", () => {
    const nodes: Record<string, EditorNode> = {
      a: frame("a", { name: "Button/Primary" }),
      b: frame("b", { name: "Button/Secondary", x: 140 }),
    };
    assert.equal(canCreateComponentSetFromSelection(["a", "b"], nodes), true);
    assert.equal(canCreateComponentFromSelection(["a", "b"], nodes), false);
  });

  it("buildCreateComponentSetFromSelectionResult componentizes frames then combines", () => {
    const nodes: Record<string, EditorNode> = {
      a: frame("a", { name: "Button/Primary" }),
      b: frame("b", { name: "Button/Secondary", x: 140 }),
    };
    const childOrder = { [ROOT]: ["a", "b"] };
    const out = buildCreateComponentSetFromSelectionResult(nodes, childOrder, ["a", "b"]);
    assert.ok(out);
    assert.equal(out!.nodes.a!.isComponent, true);
    assert.equal(out!.nodes.b!.isComponent, true);
    assert.equal(out!.nodes.a!.variantGroupId, out!.nodes.b!.variantGroupId);
    assert.equal(out!.nodes.a!.variantProperties?.Variant, "Primary");
    assert.equal(out!.nodes.b!.variantProperties?.Variant, "Secondary");
    const setContainer = out!.nodes[out!.setContainerId];
    assert.ok(setContainer?.isComponentSet);
    assert.equal(setContainer!.name, "Button");
    assert.equal(setContainer!.layoutMode, "horizontal");
    assert.equal(out!.nodes.a!.parentId, out!.setContainerId);
    assert.equal(out!.nodes.b!.parentId, out!.setContainerId);
    assert.deepEqual(out!.childOrder[out!.setContainerId], ["a", "b"]);
    assert.equal(out!.childOrder[ROOT]!.includes(out!.setContainerId), true);
    assert.equal(out!.childOrder[ROOT]!.includes("a"), false);
  });

  it("names generic frames Component 1 when creating a component set", () => {
    const nodes: Record<string, EditorNode> = {
      a: frame("a", { name: "Frame 1" }),
      b: frame("b", { name: "Frame 2", x: 140 }),
    };
    const childOrder = { [ROOT]: ["a", "b"] };
    const out = buildCreateComponentSetFromSelectionResult(nodes, childOrder, ["a", "b"]);
    assert.ok(out);
    assert.equal(out!.nodes[out!.setContainerId]!.name, "Component 1");
    assert.equal(out!.nodes.a!.name, "Frame 1");
    assert.equal(out!.nodes.b!.name, "Frame 2");
    assert.equal(out!.nodes.a!.parentId, out!.setContainerId);
    assert.equal(out!.nodes.b!.parentId, out!.setContainerId);
  });

  it("combineComponentsAsVariants assigns shared variant group", () => {
    const { nodes, childOrder } = buildTwoMasters();
    const out = combineComponentsAsVariants(nodes, childOrder, ["a", "b"]);
    assert.ok(out);
    assert.ok(out!.nodes.a!.variantGroupId);
    assert.equal(out!.nodes.a!.variantGroupId, out!.nodes.b!.variantGroupId);
    assert.equal(out!.nodes.a!.variantProperties?.Variant, "Default");
    assert.equal(out!.nodes.b!.variantProperties?.Variant, "Hover");
  });

  it("nextVariantMasterPosition places variant to the right without overlap", () => {
    const { nodes, childOrder } = buildTwoMasters();
    const combined = combineComponentsAsVariants(nodes, childOrder, ["a", "b"])!;
    const vg = combined.nodes.a!.variantGroupId!;
    const pos = nextVariantMasterPosition(combined.nodes, vg, combined.nodes.a!);
    assert.equal(pos.x, combined.nodes.b!.x + combined.nodes.b!.width + 24);
    assert.equal(pos.y, combined.nodes.a!.y);
  });

  it("variant axes derive from component set", () => {
    const { nodes, childOrder } = buildTwoMasters();
    const combined = combineComponentsAsVariants(nodes, childOrder, ["a", "b"])!;
    const groups = groupComponentMasters(listComponentMasters(combined.nodes));
    assert.equal(groups.length, 1);
    const axes = variantAxesForGroup(groups[0]!);
    assert.deepEqual(axes, ["Variant"]);
    assert.deepEqual(variantValuesForAxis(groups[0]!, "Variant"), ["Default", "Hover"]);
  });

  it("addVariantAxisToGroup adds axis to all variants", () => {
    const { nodes, childOrder } = buildTwoMasters();
    const combined = combineComponentsAsVariants(nodes, childOrder, ["a", "b"])!;
    const vg = combined.nodes.a!.variantGroupId!;
    const next = addVariantAxisToGroup(combined.nodes, vg, "State", "Default");
    assert.equal(next.a!.variantProperties?.State, "Default");
    assert.equal(next.b!.variantProperties?.State, "Default");
  });

  it("tracks recent components in localStorage", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    const prev = (globalThis as { localStorage?: typeof storage }).localStorage;
    (globalThis as { localStorage: typeof storage }).localStorage = storage;
    try {
      recordRecentComponent("master-1");
      recordRecentComponent("master-2");
      recordRecentComponent("master-1");
      const recent = readRecentComponentIds();
      assert.equal(recent[0], "master-1");
      assert.equal(recent[1], "master-2");
      const resolved = resolveRecentMasters(
        {
          "master-1": frame("master-1", { isComponent: true, componentId: "c1" }),
          ghost: frame("ghost"),
        },
        recent,
      );
      assert.equal(resolved.length, 1);
      assert.equal(resolved[0]!.id, "master-1");
    } finally {
      if (prev) (globalThis as { localStorage?: typeof storage }).localStorage = prev;
      else delete (globalThis as { localStorage?: typeof storage }).localStorage;
    }
  });
});
