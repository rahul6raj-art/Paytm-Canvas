import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { markNodeAsComponent } from "@/lib/componentModel";
import { combineComponentsAsVariants } from "@/lib/componentUx";
import { alignVariantStableIds } from "@/lib/components/componentSet";
import {
  applyInstanceInteractionTrigger,
  buildApplyInteractiveVariantResult,
  buildResetInteractiveVariantResult,
  clearEphemeralInteractiveFields,
} from "@/lib/components/componentInteractiveActions";
import {
  defaultComponentInteraction,
  effectiveVariantValuesForInstance,
  findInteractionForTrigger,
  isInstanceInteractionDisabled,
  resolveInteractionTargetVariant,
  syncInteractionsToVariantGroup,
} from "@/lib/components/componentInteractions";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
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
    width: partial.width ?? 120,
    height: partial.height ?? 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
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

function buildInteractiveButtonSet() {
  const defaultId = "btn-default";
  const hoverId = "btn-hover";
  const pressedId = "btn-pressed";
  const disabledId = "btn-disabled";
  const labelDefault = "lbl-default";
  const labelHover = "lbl-hover";
  const labelPressed = "lbl-pressed";
  const labelDisabled = "lbl-disabled";

  let nodes: Record<string, EditorNode> = {
    [defaultId]: frame(defaultId, { name: "Button/Default", fill: "#0066ff", fillEnabled: true }),
    [labelDefault]: text(labelDefault, defaultId, "Default"),
    [hoverId]: frame(hoverId, { name: "Button/Hover", x: 140, fill: "#0052cc", fillEnabled: true }),
    [labelHover]: text(labelHover, hoverId, "Hover"),
    [pressedId]: frame(pressedId, { name: "Button/Pressed", x: 280, fill: "#003d99", fillEnabled: true }),
    [labelPressed]: text(labelPressed, pressedId, "Pressed"),
    [disabledId]: frame(disabledId, { name: "Button/Disabled", x: 420, fill: "#999999", fillEnabled: true }),
    [labelDisabled]: text(labelDisabled, disabledId, "Disabled"),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [defaultId, hoverId, pressedId, disabledId],
    [defaultId]: [labelDefault],
    [hoverId]: [labelHover],
    [pressedId]: [labelPressed],
    [disabledId]: [labelDisabled],
  };
  for (const id of [defaultId, hoverId, pressedId, disabledId]) {
    nodes = markNodeAsComponent(nodes, childOrder, id);
  }
  let combined = combineComponentsAsVariants(nodes, childOrder, [defaultId, hoverId, pressedId, disabledId])!;
  const vg = combined.nodes[defaultId]!.variantGroupId!;
  combined.nodes = {
    ...combined.nodes,
    [defaultId]: {
      ...combined.nodes[defaultId]!,
      variantProperties: { State: "Default" },
    },
    [hoverId]: { ...combined.nodes[hoverId]!, variantProperties: { State: "Hover" } },
    [pressedId]: { ...combined.nodes[pressedId]!, variantProperties: { State: "Pressed" } },
    [disabledId]: { ...combined.nodes[disabledId]!, variantProperties: { State: "Disabled" } },
  };
  const interactions = [
    defaultComponentInteraction({ State: "Default" }, "ON_MOUSE_ENTER", { State: "Hover" }),
    defaultComponentInteraction({ State: "Hover" }, "ON_PRESS", { State: "Pressed" }),
    defaultComponentInteraction({ State: "Pressed" }, "ON_RELEASE", { State: "Hover" }),
    defaultComponentInteraction({ State: "Hover" }, "ON_MOUSE_LEAVE", { State: "Default" }),
  ];
  combined.nodes = syncInteractionsToVariantGroup(combined.nodes, vg, interactions);
  return {
    nodes: combined.nodes,
    childOrder,
    defaultId,
    hoverId,
    pressedId,
    disabledId,
    labelDefault,
    vg,
    interactions,
  };
}

describe("interactive components", () => {
  it("hover changes default variant to hover variant", () => {
    const { nodes, childOrder, defaultId } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, defaultId, null, 0, 0)!;
    const instId = inst.newRootId;
    const hovered = applyInstanceInteractionTrigger(inst.nodes, inst.childOrder, instId, "ON_MOUSE_ENTER");
    assert.ok(hovered?.applied);
    const root = hovered!.nodes[hovered!.newRootId]!;
    assert.deepEqual(root.currentInteractiveVariantValues, { State: "Hover" });
    assert.deepEqual(root.selectedVariantProperties, { State: "Default" });
  });

  it("press changes hover variant to pressed variant", () => {
    const { nodes, childOrder, defaultId } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, defaultId, null, 0, 0)!;
    let allNodes = inst.nodes;
    let allOrder = inst.childOrder;
    let instId = inst.newRootId;
    const hover = applyInstanceInteractionTrigger(allNodes, allOrder, instId, "ON_MOUSE_ENTER")!;
    instId = hover.newRootId;
    allNodes = hover.nodes;
    allOrder = hover.childOrder;
    const pressed = applyInstanceInteractionTrigger(allNodes, allOrder, instId, "ON_PRESS");
    assert.ok(pressed?.applied);
    assert.deepEqual(pressed!.nodes[pressed!.newRootId]!.currentInteractiveVariantValues, {
      State: "Pressed",
    });
  });

  it("mouse leave returns to base variant", () => {
    const { nodes, childOrder, defaultId } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, defaultId, null, 0, 0)!;
    let instId = inst.newRootId;
    let allNodes = inst.nodes;
    let allOrder = inst.childOrder;
    const hover = applyInstanceInteractionTrigger(allNodes, allOrder, instId, "ON_MOUSE_ENTER")!;
    instId = hover.newRootId;
    allNodes = hover.nodes;
    allOrder = hover.childOrder;
    const left = applyInstanceInteractionTrigger(allNodes, allOrder, instId, "ON_MOUSE_LEAVE");
    assert.ok(left?.applied);
    const root = left!.nodes[left!.newRootId]!;
    assert.equal(root.currentInteractiveVariantValues, undefined);
    assert.deepEqual(root.selectedVariantProperties, { State: "Default" });
  });

  it("runtime state does not mutate selectedVariant", () => {
    const { nodes, childOrder, defaultId } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, defaultId, null, 0, 0)!;
    const before = inst.nodes[inst.newRootId]!.selectedVariantProperties;
    const after = applyInstanceInteractionTrigger(inst.nodes, inst.childOrder, inst.newRootId, "ON_MOUSE_ENTER");
    assert.deepEqual(after!.nodes[after!.newRootId]!.selectedVariantProperties, before);
  });

  it("text override survives hover variant switch", () => {
    const { nodes, childOrder, defaultId, labelDefault } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, defaultId, null, 0, 0)!;
    const labelStable = nodes[defaultId]!.componentLayerStableIds![labelDefault]!;
    const withOverride = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Custom" } },
      },
    };
    const hovered = applyInstanceInteractionTrigger(withOverride, inst.childOrder, inst.newRootId, "ON_MOUSE_ENTER");
    assert.ok(hovered);
    const preserved = readInstanceOverrideMap(hovered!.nodes[hovered!.newRootId]!);
    assert.equal(preserved[labelStable]?.content, "Custom");
  });

  it("missing target variant falls back safely", () => {
    const { nodes, childOrder, defaultId, vg } = buildInteractiveButtonSet();
    const { masterId, usedFallback } = resolveInteractionTargetVariant(
      nodes,
      vg,
      { State: "Missing", Size: "Large" },
      defaultId,
    );
    assert.ok(masterId);
    assert.equal(usedFallback, true);
  });

  it("disabled state does not respond to hover by default", () => {
    const { nodes, childOrder, disabledId } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, disabledId, null, 0, 0)!;
    const root = inst.nodes[inst.newRootId]!;
    assert.equal(isInstanceInteractionDisabled(root, inst.nodes), true);
    const hovered = applyInstanceInteractionTrigger(inst.nodes, inst.childOrder, inst.newRootId, "ON_MOUSE_ENTER");
    assert.equal(hovered?.applied, false);
  });

  it("auto layout reruns when interactive variant size changes", () => {
    const smallId = "small";
    const largeId = "large";
    let nodes: Record<string, EditorNode> = {
      [smallId]: frame(smallId, { name: "Chip/Small", height: 32 }),
      [largeId]: frame(largeId, { name: "Chip/Large", x: 140, height: 96 }),
    };
    const childOrder = { [ROOT]: [smallId, largeId] };
    nodes = markNodeAsComponent(nodes, childOrder, smallId);
    nodes = markNodeAsComponent(nodes, childOrder, largeId);
    let combined = combineComponentsAsVariants(nodes, childOrder, [smallId, largeId])!.nodes;
    const vg = combined[smallId]!.variantGroupId!;
    combined = {
      ...combined,
      [smallId]: { ...combined[smallId]!, variantProperties: { Size: "Small" } },
      [largeId]: { ...combined[largeId]!, variantProperties: { Size: "Large" } },
    };
    combined = syncInteractionsToVariantGroup(combined, vg, [
      defaultComponentInteraction({ Size: "Small" }, "ON_MOUSE_ENTER", { Size: "Large" }),
      defaultComponentInteraction({ Size: "Large" }, "ON_MOUSE_LEAVE", { Size: "Small" }),
    ]);
    const inst = buildInstanceFromMaster(combined, childOrder, smallId, null, 0, 0)!;
    const hovered = applyInstanceInteractionTrigger(inst.nodes, inst.childOrder, inst.newRootId, "ON_MOUSE_ENTER");
    assert.ok(hovered);
    assert.ok(hovered!.nodes[hovered!.newRootId]!.height >= 90);
  });

  it("interaction definitions survive component set edits via sync", () => {
    const { nodes, vg, interactions, defaultId, hoverId } = buildInteractiveButtonSet();
    const updated = syncInteractionsToVariantGroup(nodes, vg, [
      ...interactions,
      defaultComponentInteraction({ State: "Default" }, "ON_CLICK", { State: "Pressed" }),
    ]);
    assert.equal(updated[defaultId]?.componentInteractions?.length, 5);
    assert.equal(updated[hoverId]?.componentInteractions?.length, 5);
  });

  it("clearEphemeralInteractiveFields strips runtime state for persistence", () => {
    const { nodes, childOrder, defaultId } = buildInteractiveButtonSet();
    const inst = buildInstanceFromMaster(nodes, childOrder, defaultId, null, 0, 0)!;
    const hovered = applyInstanceInteractionTrigger(inst.nodes, inst.childOrder, inst.newRootId, "ON_MOUSE_ENTER")!;
    const stripped = clearEphemeralInteractiveFields(hovered.nodes);
    const root = stripped[hovered.newRootId]!;
    assert.equal(root.currentInteractiveVariantValues, undefined);
    assert.equal(root.interactionState, undefined);
  });

  it("effectiveVariantValuesForInstance prefers interactive override", () => {
    const root = {
      selectedVariantProperties: { State: "Default" },
      currentInteractiveVariantValues: { State: "Hover" },
    } as EditorNode;
    assert.deepEqual(effectiveVariantValuesForInstance(root), { State: "Hover" });
  });

  it("findInteractionForTrigger matches partial from values", () => {
    const interactions = [defaultComponentInteraction({ State: "Default" }, "ON_MOUSE_ENTER", { State: "Hover" })];
    const hit = findInteractionForTrigger(interactions, { State: "Default", Size: "Medium" }, "ON_MOUSE_ENTER");
    assert.ok(hit);
  });
});

describe("interactive nested components", () => {
  it("interactive instance preserves fill override on hover", () => {
    const iconId = "icon";
    const iconHoverId = "icon-hover";
    let nodes: Record<string, EditorNode> = {
      [iconId]: frame(iconId, { name: "Icon/Default", width: 24, height: 24 }),
      [iconHoverId]: frame(iconHoverId, {
        name: "Icon/Hover",
        x: 40,
        width: 24,
        height: 24,
        fill: "#00ff00",
        fillEnabled: true,
      }),
    };
    let childOrder: Record<string, string[]> = { [ROOT]: [iconId, iconHoverId] };
    nodes = markNodeAsComponent(nodes, childOrder, iconId);
    nodes = markNodeAsComponent(nodes, childOrder, iconHoverId);
    let iconCombined = combineComponentsAsVariants(nodes, childOrder, [iconId, iconHoverId])!.nodes;
    iconCombined = alignVariantStableIds(iconCombined, childOrder, iconId, iconHoverId);
    const iconVg = iconCombined[iconId]!.variantGroupId!;
    iconCombined = {
      ...iconCombined,
      [iconId]: { ...iconCombined[iconId]!, variantProperties: { State: "Default" } },
      [iconHoverId]: { ...iconCombined[iconHoverId]!, variantProperties: { State: "Hover" } },
    };
    iconCombined = syncInteractionsToVariantGroup(iconCombined, iconVg, [
      defaultComponentInteraction({ State: "Default" }, "ON_MOUSE_ENTER", { State: "Hover" }),
    ]);

    const inst = buildInstanceFromMaster(iconCombined, childOrder, iconId, null, 0, 0)!;
    const rootStable = iconCombined[iconId]!.componentLayerStableIds![iconId]!;
    const withOverride = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [rootStable]: { fill: "#gold", fillEnabled: true } },
      },
    };
    const hovered = applyInstanceInteractionTrigger(
      withOverride,
      inst.childOrder,
      inst.newRootId,
      "ON_MOUSE_ENTER",
    );
    assert.ok(hovered?.applied);
    const preserved = readInstanceOverrideMap(hovered!.nodes[hovered!.newRootId]!);
    assert.equal(preserved[rootStable]?.fill, "#gold");
  });
});
