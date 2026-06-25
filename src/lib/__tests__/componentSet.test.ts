import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { markNodeAsComponent, listComponentMasters } from "@/lib/componentModel";
import { combineComponentsAsVariants, instancePlacementParentAtWorldPoint } from "@/lib/componentUx";
import { frameParentAtWorldPoint } from "@/lib/tree";
import {
  addPropertyToSet,
  addVariantForPropertyValue,
  alignVariantStableIds,
  buildComponentSet,
  deletePropertyFromSet,
  deleteVariantMaster,
  duplicateVariantMaster,
  inferVariantAxesFromNames,
  isInsideComponentSet,
  isVariantMasterInComponentSet,
  renamePropertyInSet,
  resolveVariantMasterIdWithFallback,
  shouldShowCanvasFrameLabel,
} from "@/lib/components/componentSet";
import {
  buildInstanceFromMaster,
  buildSetInstanceVariantResult,
} from "@/lib/components/componentActions";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";

function frame(id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: partial.name ?? id,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: partial.width ?? 100,
    height: partial.height ?? 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: partial.layoutMode,
    ...partial,
  } as EditorNode;
}

function text(id: string, parentId: string, content: string): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: "Label",
    content,
    x: 8,
    y: 8,
    width: 80,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fontSize: 14,
    fontFamily: "Inter",
  } as EditorNode;
}

function buildButtonVariants() {
  const primaryId = "btn-primary";
  const secondaryId = "btn-secondary";
  const dangerId = "btn-danger";
  const labelA = "lbl-a";
  const labelB = "lbl-b";
  const labelC = "lbl-c";
  let nodes: Record<string, EditorNode> = {
    [primaryId]: frame(primaryId, { name: "Button/Primary", x: 0, fill: "#0066ff", fillEnabled: true }),
    [labelA]: text(labelA, primaryId, "Primary"),
    [secondaryId]: frame(secondaryId, { name: "Button/Secondary", x: 140, fill: "#333333", fillEnabled: true }),
    [labelB]: text(labelB, secondaryId, "Secondary"),
    [dangerId]: frame(dangerId, { name: "Button/Danger", x: 280, fill: "#cc0000", fillEnabled: true }),
    [labelC]: text(labelC, dangerId, "Danger"),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [primaryId, secondaryId, dangerId],
    [primaryId]: [labelA],
    [secondaryId]: [labelB],
    [dangerId]: [labelC],
  };
  for (const id of [primaryId, secondaryId, dangerId]) {
    nodes = markNodeAsComponent(nodes, childOrder, id);
  }
  return { nodes, childOrder, primaryId, secondaryId, dangerId, labelA, labelB, labelC };
}

describe("component set model", () => {
  it("inferVariantAxesFromNames detects Button/Primary slash pattern", () => {
    const inferred = inferVariantAxesFromNames(["Button/Primary", "Button/Secondary", "Button/Danger"]);
    assert.equal(inferred.setName, "Button");
    assert.equal(inferred.properties.length, 1);
    assert.equal(inferred.properties[0]!.name, "Variant");
    assert.deepEqual(inferred.properties[0]!.values, ["Primary", "Secondary", "Danger"]);
    assert.deepEqual(inferred.assignments[0], { Variant: "Primary" });
  });

  it("combine as variants assigns shared group and variant values", () => {
    const { nodes, childOrder, primaryId, secondaryId, dangerId } = buildButtonVariants();
    const out = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId, dangerId]);
    assert.ok(out);
    const vg = out!.nodes[primaryId]!.variantGroupId;
    assert.ok(vg);
    assert.equal(out!.nodes[secondaryId]!.variantGroupId, vg);
    assert.equal(out!.nodes[primaryId]!.variantProperties?.Variant, "Primary");
    assert.equal(out!.nodes[secondaryId]!.variantProperties?.Variant, "Secondary");
    assert.equal(out!.nodes[dangerId]!.variantProperties?.Variant, "Danger");
    assert.equal(out!.nodes[primaryId]!.parentId, out!.setContainerId);
    assert.ok(out!.nodes[out!.setContainerId]!.isComponentSet);
    assert.equal(out!.nodes[out!.setContainerId]!.layoutMode, "horizontal");
    assert.ok((out!.nodes[out!.setContainerId]!.layoutGap ?? 0) >= 0);
    assert.equal(shouldShowCanvasFrameLabel(out!.nodes, out!.setContainerId), false);
    assert.equal(shouldShowCanvasFrameLabel(out!.nodes, primaryId), false);
    assert.ok(isVariantMasterInComponentSet(out!.nodes, primaryId));

    const childId = "rect-in-variant";
    out!.nodes[childId] = {
      ...frame(childId, { parentId: primaryId, name: "Rectangle" }),
      type: "rectangle",
    } as EditorNode;
    assert.equal(isInsideComponentSet(out!.nodes, childId), true);
    assert.equal(isInsideComponentSet(out!.nodes, out!.setContainerId), true);

    const set = buildComponentSet(out!.nodes, vg!);
    assert.ok(set);
    assert.equal(set!.name, "Button");
    assert.equal(set!.variants.length, 3);
  });

  it("create property adds axis to all variants", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!;
    const vg = combined.nodes[primaryId]!.variantGroupId!;
    const next = addPropertyToSet(combined.nodes, vg, "State", "Default");
    assert.ok(next);
    assert.equal(next![primaryId]!.variantProperties?.State, "Default");
    assert.equal(next![secondaryId]!.variantProperties?.State, "Default");
  });

  it("add property value creates a new variant master", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!;
    const withState = addPropertyToSet(combined.nodes, combined.nodes[primaryId]!.variantGroupId!, "State", "Default")!;
    const added = addVariantForPropertyValue(withState, childOrder, primaryId, "State", "Hover");
    assert.ok(added);
    assert.equal(added!.nodes[added!.newMasterId]!.variantProperties?.State, "Hover");
    assert.equal(added!.nodes[added!.newMasterId]!.variantProperties?.Variant, "Primary");
  });

  it("switch variant preserves text override", () => {
    const { nodes, childOrder, primaryId, secondaryId, labelA } = buildButtonVariants();
    let allNodes = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    allNodes = alignVariantStableIds(allNodes, childOrder, primaryId, secondaryId);
    const vg = allNodes[primaryId]!.variantGroupId!;
    const labelStable = allNodes[primaryId]!.componentLayerStableIds![labelA]!;

    const inst = buildInstanceFromMaster(allNodes, childOrder, primaryId, null, 0, 0)!;
    allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        variantGroupId: vg,
        instanceOverridesByStableId: { [labelStable]: { content: "Custom label" } },
      },
    };

    const switched = buildSetInstanceVariantResult(allNodes, inst.childOrder, inst.newRootId, {
      Variant: "Secondary",
    });
    assert.ok(switched);
    const preserved = readInstanceOverrideMap(switched!.nodes[switched!.newRootId]!);
    assert.equal(preserved[labelStable]?.content, "Custom label");
  });

  it("switch variant preserves fill override", () => {
    const { nodes, childOrder, primaryId, secondaryId, labelA } = buildButtonVariants();
    let allNodes = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    allNodes = alignVariantStableIds(allNodes, childOrder, primaryId, secondaryId);
    const vg = allNodes[primaryId]!.variantGroupId!;
    const labelStable = allNodes[primaryId]!.componentLayerStableIds![labelA]!;

    const inst = buildInstanceFromMaster(allNodes, childOrder, primaryId, null, 0, 0)!;
    allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        variantGroupId: vg,
        instanceOverridesByStableId: { [labelStable]: { fill: "#ff00ff", fillEnabled: true } },
      },
    };

    const switched = buildSetInstanceVariantResult(allNodes, inst.childOrder, inst.newRootId, {
      Variant: "Secondary",
    });
    assert.ok(switched);
    const preserved = readInstanceOverrideMap(switched!.nodes[switched!.newRootId]!);
    assert.equal(preserved[labelStable]?.fill, "#ff00ff");
  });

  it("switch variant preserves nested instance override", () => {
    const iconId = "icon";
    let nodes: Record<string, EditorNode> = {
      [iconId]: frame(iconId, { name: "Icon/Star", width: 16, height: 16 }),
    };
    let childOrder: Record<string, string[]> = { [ROOT]: [iconId] };
    nodes = markNodeAsComponent(nodes, childOrder, iconId);

    const btnId = "btn";
    const iconInstId = "icon-inst";
    nodes = {
      ...nodes,
      [btnId]: frame(btnId, { name: "Button/Primary" }),
      [iconInstId]: frame(iconInstId, {
        parentId: btnId,
        name: "Icon",
        width: 16,
        height: 16,
        sourceComponentId: iconId,
        componentId: nodes[iconId]!.componentId,
      }),
    };
    childOrder = { ...childOrder, [ROOT]: [...childOrder[ROOT]!, btnId], [btnId]: [iconInstId] };
    nodes = markNodeAsComponent(nodes, childOrder, btnId);

    const btn2Id = "btn2";
    const iconInst2Id = "icon-inst-2";
    nodes = {
      ...nodes,
      [btn2Id]: frame(btn2Id, { name: "Button/Secondary", x: 140 }),
      [iconInst2Id]: frame(iconInst2Id, {
        parentId: btn2Id,
        name: "Icon",
        width: 16,
        height: 16,
        sourceComponentId: iconId,
        componentId: nodes[iconId]!.componentId,
      }),
    };
    childOrder = {
      ...childOrder,
      [ROOT]: [...childOrder[ROOT]!, btn2Id],
      [btn2Id]: [iconInst2Id],
    };
    nodes = markNodeAsComponent(nodes, childOrder, btn2Id);

    let allNodes = combineComponentsAsVariants(nodes, childOrder, [btnId, btn2Id])!.nodes;
    allNodes = alignVariantStableIds(allNodes, childOrder, btnId, btn2Id);
    const iconStable = allNodes[iconId]!.componentLayerStableIds![iconId]!;
    allNodes = {
      ...allNodes,
      [btn2Id]: {
        ...allNodes[btn2Id]!,
        componentLayerStableIds: {
          ...allNodes[btnId]!.componentLayerStableIds,
          [btn2Id]: allNodes[btnId]!.componentLayerStableIds![btnId]!,
          [iconInst2Id]: allNodes[btnId]!.componentLayerStableIds![iconInstId]!,
        },
      },
    };
    void iconStable;

    const inst = buildInstanceFromMaster(allNodes, childOrder, btnId, null, 0, 0)!;
    const nestedInstId = Object.keys(inst.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).find(
      (id) => inst.nodes[id]?.sourceComponentId === iconId,
    )!;
    const nestedStable = inst.nodes[inst.newRootId]!.instanceStableIdMap![nestedInstId]!;
    allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        variantGroupId: allNodes[btnId]!.variantGroupId,
        instanceOverridesByStableId: {
          [nestedStable]: { fill: "#gold", fillEnabled: true },
        },
      },
    };

    const switched = buildSetInstanceVariantResult(allNodes, inst.childOrder, inst.newRootId, {
      Variant: "Secondary",
    });
    assert.ok(switched);
    const preserved = readInstanceOverrideMap(switched!.nodes[switched!.newRootId]!);
    assert.equal(preserved[nestedStable]?.fill, "#gold");
  });

  it("add new variant via duplicate", () => {
    const { nodes, childOrder, primaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, "btn-secondary"])!.nodes;
    const before = listComponentMasters(combined).filter(
      (m) => m.variantGroupId === combined[primaryId]!.variantGroupId,
    ).length;
    const dup = duplicateVariantMaster(combined, childOrder, primaryId);
    assert.ok(dup);
    const after = listComponentMasters(dup!.nodes).filter(
      (m) => m.variantGroupId === combined[primaryId]!.variantGroupId,
    ).length;
    assert.equal(after, before + 1);
  });

  it("delete variant removes master from set", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    const removed = deleteVariantMaster(combined, childOrder, secondaryId);
    assert.ok(removed);
    assert.equal(removed!.nodes[secondaryId], undefined);
    assert.ok(removed!.nodes[primaryId]);
  });

  it("missing variant combination falls back to nearest match", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    let allNodes = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    allNodes = addPropertyToSet(allNodes, allNodes[primaryId]!.variantGroupId!, "State", "Default")!;
    const vg = allNodes[primaryId]!.variantGroupId!;

    const resolved = resolveVariantMasterIdWithFallback(
      allNodes,
      vg,
      { Variant: "Secondary", State: "Hover" },
      primaryId,
    );
    assert.equal(resolved, secondaryId);
  });

  it("missing variant with no partial match keeps current master", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const allNodes = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    const vg = allNodes[primaryId]!.variantGroupId!;
    const resolved = resolveVariantMasterIdWithFallback(
      allNodes,
      vg,
      { Variant: "Nonexistent" },
      primaryId,
    );
    assert.equal(resolved, primaryId);
  });

  it("instance placement skips component set containers as parent", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!;
    const setId = combined.setContainerId;
    const setNode = combined.nodes[setId]!;
    const centerX = setNode.x + setNode.width / 2;
    const centerY = setNode.y + setNode.height / 2;

    assert.equal(frameParentAtWorldPoint(centerX, centerY, combined.nodes, combined.childOrder), setId);
    assert.equal(
      instancePlacementParentAtWorldPoint(centerX, centerY, combined.nodes, combined.childOrder),
      null,
    );
  });

  it("placing instance from component set keeps children after resolve", () => {
    const { nodes, childOrder, primaryId, secondaryId, labelA } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!;
    const allNodes = combined.nodes;
    const order = combined.childOrder;

    const inst = buildInstanceFromMaster(allNodes, order, primaryId, null, 200, 100)!;
    const resolved = resolveComponentInstance(inst.nodes, inst.childOrder, inst.newRootId, {
      force: true,
    });
    const root = resolved.nodes[inst.newRootId]!;
    assert.equal(root.parentId ?? null, null, "instance root must not inherit set container parent");
    const kids = resolved.childOrder[inst.newRootId] ?? [];
    assert.ok(kids.length > 0, "instance should keep master children");
    const labelStable = allNodes[primaryId]!.componentLayerStableIds![labelA]!;
    const labelNodeId = Object.entries(root.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0];
    assert.ok(labelNodeId, "text layer should remain mapped");
    assert.equal(resolved.nodes[labelNodeId!]!.content, "Primary");
  });

  it("instance updates after variant change", () => {
    const { nodes, childOrder, primaryId, secondaryId, labelA } = buildButtonVariants();
    const allNodes = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;

    const inst = buildInstanceFromMaster(allNodes, childOrder, primaryId, null, 0, 0)!;
    const switched = buildSetInstanceVariantResult(inst.nodes, inst.childOrder, inst.newRootId, {
      Variant: "Secondary",
    })!;
    const resolved = resolveComponentInstance(switched.nodes, switched.childOrder, switched.newRootId, {
      force: true,
    });
    const labelNodeId = Object.entries(
      resolved.nodes[switched.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === allNodes[primaryId]!.componentLayerStableIds![labelA])?.[0];
    assert.ok(labelNodeId);
    assert.equal(resolved.nodes[labelNodeId!]!.content, "Secondary");
  });

  it("auto layout updates after variant change when heights differ", () => {
    const smallId = "small";
    const largeId = "large";
    let nodes: Record<string, EditorNode> = {
      [smallId]: frame(smallId, {
        name: "Card/Small",
        height: 40,
        layoutMode: "vertical",
        layoutPaddingTop: 8,
        layoutPaddingBottom: 8,
        layoutItemSpacing: 4,
      }),
      [largeId]: frame(largeId, {
        name: "Card/Large",
        x: 140,
        height: 120,
        layoutMode: "vertical",
        layoutPaddingTop: 8,
        layoutPaddingBottom: 8,
        layoutItemSpacing: 4,
      }),
    };
    const childOrder = { [ROOT]: [smallId, largeId] };
    nodes = markNodeAsComponent(nodes, childOrder, smallId);
    nodes = markNodeAsComponent(nodes, childOrder, largeId);
    let allNodes = combineComponentsAsVariants(nodes, childOrder, [smallId, largeId])!.nodes;

    const parentId = "parent";
    allNodes = {
      ...allNodes,
      [parentId]: frame(parentId, {
        y: 200,
        width: 200,
        height: 200,
        layoutMode: "vertical",
        layoutPaddingTop: 0,
        layoutPaddingBottom: 0,
        layoutItemSpacing: 8,
      }),
    };
    const inst = buildInstanceFromMaster(allNodes, { ...childOrder, [ROOT]: [smallId, largeId, parentId], [parentId]: [] }, smallId, parentId, 0, 0)!;
    childOrder[parentId] = [inst.newRootId];
    childOrder[ROOT] = [smallId, largeId, parentId];

    const switched = buildSetInstanceVariantResult(inst.nodes, childOrder, inst.newRootId, {
      Variant: "Large",
    })!;
    const resolved = resolveComponentInstance(switched.nodes, childOrder, switched.newRootId, {
      force: true,
    });
    assert.ok(resolved.nodes[switched.newRootId]!.height >= 100);
  });

  it("rename property updates all variant masters", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    const vg = combined[primaryId]!.variantGroupId!;
    const withSize = addPropertyToSet(combined, vg, "Size", "Medium")!;
    const renamed = renamePropertyInSet(withSize, vg, "Size", "Scale")!;
    assert.ok(renamed);
    assert.equal(renamed![primaryId]!.variantProperties?.Scale, "Medium");
    assert.equal(renamed![secondaryId]!.variantProperties?.Size, undefined);
  });

  it("delete property removes axis from all variants", () => {
    const { nodes, childOrder, primaryId, secondaryId } = buildButtonVariants();
    const combined = combineComponentsAsVariants(nodes, childOrder, [primaryId, secondaryId])!.nodes;
    const vg = combined[primaryId]!.variantGroupId!;
    const withState = addPropertyToSet(combined, vg, "State", "Default")!;
    const deleted = deletePropertyFromSet(withState, vg, "State")!;
    assert.ok(deleted);
    assert.equal(deleted![primaryId]!.variantProperties?.State, undefined);
  });

  it("infers multiple properties from deep slash names", () => {
    const inferred = inferVariantAxesFromNames([
      "Button/Primary/Small/Default",
      "Button/Primary/Large/Default",
      "Button/Secondary/Small/Hover",
    ]);
    assert.ok(inferred.properties.length >= 2);
    assert.ok(inferred.properties.some((p) => p.name === "Variant"));
    assert.ok(inferred.properties.some((p) => p.name === "Size"));
  });
});
