import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { detachInstanceTree, markNodeAsComponent, mergeInstanceOverrides } from "@/lib/componentModel";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import { assignStableLayerIds } from "@/lib/components/stableIds";
import {
  applyInstanceInteractionTrigger,
} from "@/lib/components/componentInteractiveActions";
import {
  defaultComponentInteraction,
  effectiveVariantValuesForInstance,
  syncInteractionsToVariantGroup,
} from "@/lib/components/componentInteractions";
import { combineComponentsAsVariants } from "@/lib/componentUx";
import { buildSetInstanceVariantResult } from "@/lib/components/componentActions";
import {
  applyInstanceSwapProperties,
  buildInstanceSwapPropertyForNestedInstance,
  buildResetComponentPropertyValueResult,
  computeSwapTargetSlotPath,
  effectiveSwapComponentId,
  findNestedInstanceBySlotPath,
  inferPreferredComponentIds,
  isInstanceSwapPropertyOverridden,
  listSwapCandidatesForProperty,
  pruneIncompatiblePropertyValues,
  swapTargetPath,
} from "@/lib/components/componentInstanceSwap";
import { resolveComponentInstance, collectInstanceRelayoutKeys } from "@/lib/components/resolveComponentInstance";
import { collectSubtreeIds } from "@/lib/editorGraph";

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
    layoutMode: partial.layoutMode ?? "horizontal",
    layoutGap: partial.layoutGap ?? 8,
    layoutSizingHorizontal: partial.layoutSizingHorizontal ?? "hug",
    ...partial,
  } as EditorNode;
}

function text(id: string, parentId: string, content: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: "Label",
    content,
    x: 8,
    y: 8,
    width: partial.width ?? 80,
    height: partial.height ?? 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fontSize: 14,
    fontFamily: "Inter",
    ...partial,
  } as EditorNode;
}

function buildIconMaster(name: string, id: string, labelId: string, content: string, fill: string) {
  let nodes: Record<string, EditorNode> = {
    [id]: frame(id, { name, width: 24, height: 24, fill, fillEnabled: true }),
    [labelId]: text(labelId, id, content),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [id],
    [id]: [labelId],
  };
  nodes = markNodeAsComponent(nodes, childOrder, id);
  return { nodes, childOrder, masterId: id, labelId, componentId: nodes[id]!.componentId! };
}

function buildButtonWithIcon(searchIcon: ReturnType<typeof buildIconMaster>, closeIcon: ReturnType<typeof buildIconMaster>) {
  let nodes = { ...searchIcon.nodes, ...closeIcon.nodes };
  let childOrder: Record<string, string[]> = {
    ...searchIcon.childOrder,
    ...closeIcon.childOrder,
    [ROOT]: [searchIcon.masterId, closeIcon.masterId],
  };

  const buttonMasterId = "button-master";
  const buttonLabelId = "button-label";
  nodes = {
    ...nodes,
    [buttonMasterId]: frame(buttonMasterId, { name: "Button" }),
    [buttonLabelId]: text(buttonLabelId, buttonMasterId, "Buy"),
  };
  childOrder = {
    ...childOrder,
    [buttonMasterId]: [buttonLabelId],
  };

  const iconInst = buildInstanceFromMaster(
    nodes,
    childOrder,
    searchIcon.masterId,
    buttonMasterId,
    0,
    0,
  )!;
  nodes = iconInst.nodes;
  childOrder = {
    ...childOrder,
    ...iconInst.childOrder,
    [buttonMasterId]: [iconInst.newRootId, buttonLabelId],
  };
  nodes = markNodeAsComponent(nodes, childOrder, buttonMasterId);

  const swapDef = buildInstanceSwapPropertyForNestedInstance(
    nodes,
    buttonMasterId,
    iconInst.newRootId,
    "Icon",
  )!;
  nodes = {
    ...nodes,
    [buttonMasterId]: {
      ...nodes[buttonMasterId]!,
      componentPropertyDefs: [swapDef],
    },
  };

  const buttonInst = buildInstanceFromMaster(nodes, childOrder, buttonMasterId, null, 100, 0)!;
  return {
    nodes: buttonInst.nodes,
    childOrder: buttonInst.childOrder,
    buttonMasterId,
    buttonInstRootId: buttonInst.newRootId,
    iconInstInMasterId: iconInst.newRootId,
    swapDef,
    searchIcon,
    closeIcon,
    masterNodes: nodes,
    masterChildOrder: childOrder,
  };
}

describe("instance swap properties", () => {
  it("creates instance swap property from nested icon with stable path", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const ctx = buildButtonWithIcon(search, buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333"));
    assert.ok(ctx.swapDef.targetStablePath);
    assert.equal(ctx.swapDef.defaultComponentId, search.componentId);
    assert.ok(ctx.swapDef.preferredComponentIds?.includes(search.componentId));
  });

  it("changing swap updates nested component on parent instance", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);

    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        componentPropertyValues: { [ctx.swapDef.key]: close.componentId },
      },
    };

    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const nestedRoot = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).find(
      (id) => resolved.nodes[id]?.sourceComponentId && id !== ctx.buttonInstRootId,
    )!;
    assert.equal(resolved.nodes[nestedRoot]?.componentId, close.componentId);
    const nestedLabel = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).find(
      (id) =>
        resolved.nodes[id]?.type === "text" &&
        resolved.nodes[id]?.parentId !== ctx.buttonInstRootId,
    );
    assert.equal(resolved.nodes[nestedLabel!]?.content, "✕");
  });

  it("reset restores default nested component", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);

    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        componentPropertyValues: { [ctx.swapDef.key]: close.componentId },
      },
    };
    const swapped = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    nodes = buildResetComponentPropertyValueResult(swapped.nodes, ctx.buttonInstRootId, ctx.swapDef.key)!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const nestedRoot = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).find(
      (id) => resolved.nodes[id]?.sourceComponentId && id !== ctx.buttonInstRootId,
    )!;
    assert.equal(resolved.nodes[nestedRoot]?.componentId, search.componentId);
  });

  it("preserves nested fill override when stable ids match", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);

    const iconLabelStableInButton = Object.entries(
      ctx.masterNodes[ctx.buttonMasterId]!.componentLayerStableIds ?? {},
    ).find(([nid]) => ctx.masterNodes[nid]?.parentId === ctx.iconInstInMasterId)?.[1]!;

    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        componentPropertyValues: { [ctx.swapDef.key]: close.componentId },
        instanceOverridesByStableId: {
          [iconLabelStableInButton]: { content: "Custom" },
        },
      },
    };
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const nestedLabel = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).find(
      (id) =>
        resolved.nodes[id]?.type === "text" &&
        resolved.nodes[id]?.parentId !== ctx.buttonInstRootId,
    );
    assert.ok(nestedLabel, "nested label should exist after swap");
    assert.equal(
      mergeInstanceOverrides(resolved.nodes[nestedLabel!]!, resolved.nodes).content,
      "Custom",
    );
  });

  it("preferred values filter candidates", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);
    const def = {
      ...ctx.swapDef,
      preferredComponentIds: [search.componentId, close.componentId],
      allowAnyComponent: false,
    };
    const candidates = listSwapCandidatesForProperty(ctx.masterNodes, def);
    assert.equal(candidates.length, 2);
  });

  it("allowAnyComponent includes all local components", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);
    const def = { ...ctx.swapDef, allowAnyComponent: true };
    const candidates = listSwapCandidatesForProperty(ctx.masterNodes, def);
    assert.ok(candidates.length >= 3);
  });

  it("parent variant switch drops swap when slot path missing", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);

    const plainMasterId = "button-plain";
    let nodes = { ...ctx.masterNodes };
    nodes[plainMasterId] = frame(plainMasterId, { name: "Button/Plain" });
    nodes["plain-label"] = text("plain-label", plainMasterId, "Plain");
    const childOrder = {
      ...ctx.masterChildOrder,
      [ROOT]: [...(ctx.masterChildOrder[ROOT] ?? []), plainMasterId],
      [plainMasterId]: ["plain-label"],
    };
    nodes = markNodeAsComponent(nodes, childOrder, plainMasterId);
    nodes = {
      ...nodes,
      [plainMasterId]: {
        ...nodes[plainMasterId]!,
        componentLayerStableIds: assignStableLayerIds(nodes, childOrder, plainMasterId),
      },
    };

    const pruned = pruneIncompatiblePropertyValues(
      nodes,
      plainMasterId,
      { [ctx.swapDef.key]: close.componentId },
      [{ ...ctx.swapDef, targetStablePath: "missing-slot" }],
    );
    assert.ok(pruned.dropped.includes(ctx.swapDef.key));
    assert.equal(pruned.values[ctx.swapDef.key], undefined);
  });

  it("swapped nested interactive component works in preview", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const hover = buildIconMaster("Icon/Hover", "icon-hover", "icon-hover-label", "🔍", "#222");
    let nodes = { ...search.nodes, ...hover.nodes };
    let childOrder = { ...search.childOrder, [ROOT]: [search.masterId, hover.masterId] };
    const combined = combineComponentsAsVariants(nodes, childOrder, [search.masterId, hover.masterId])!;
    nodes = combined.nodes;
    const vg = nodes[search.masterId]!.variantGroupId!;
    nodes = syncInteractionsToVariantGroup(nodes, vg, [
      defaultComponentInteraction({ Variant: "Search" }, "ON_MOUSE_ENTER", { Variant: "Hover" }),
    ]);

    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(
      { ...search, nodes, childOrder: { ...childOrder, ...search.childOrder } },
      close,
    );

    let instNodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        componentPropertyValues: { [ctx.swapDef.key]: search.componentId },
      },
    };
    instNodes = resolveComponentInstance(instNodes, ctx.childOrder, ctx.buttonInstRootId, { force: true }).nodes;

    const nestedRoot = collectSubtreeIds(ctx.buttonInstRootId, ctx.childOrder).find(
      (id) => instNodes[id]?.sourceComponentId && id !== ctx.buttonInstRootId,
    )!;
    const hoverResult = applyInstanceInteractionTrigger(
      instNodes,
      ctx.childOrder,
      nestedRoot,
      "ON_MOUSE_ENTER",
    );
    assert.ok(hoverResult?.applied);
    assert.equal(
      effectiveVariantValuesForInstance(hoverResult!.nodes[hoverResult!.newRootId]!).Variant,
      "Hover",
    );
  });

  it("swap size change includes parent in relayout keys", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const wide = buildIconMaster("Icon/Wide", "icon-wide", "icon-wide-label", "🔍", "#111");
    let nodes = { ...search.nodes };
    nodes = {
      ...nodes,
      [wide.masterId]: { ...nodes[wide.masterId]!, width: 48, height: 48 },
      [wide.labelId]: { ...nodes[wide.labelId]!, width: 40 },
    };
    const ctx = buildButtonWithIcon(search, wide);
    let instNodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        componentPropertyValues: { [ctx.swapDef.key]: wide.componentId },
      },
    };
    const resolved = resolveComponentInstance(instNodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const keys = collectInstanceRelayoutKeys(resolved.nodes, resolved.childOrder, ctx.buttonInstRootId);
    assert.ok(keys.includes(ctx.buttonInstRootId));
  });

  it("detach preserves swapped nested appearance", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const ctx = buildButtonWithIcon(search, close);
    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        componentPropertyValues: { [ctx.swapDef.key]: close.componentId },
      },
    };
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const detached = detachInstanceTree(resolved.nodes, resolved.childOrder, ctx.buttonInstRootId);
    assert.ok(detached);
    const texts = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder)
      .map((id) => detached![id])
      .filter((n) => n?.type === "text");
    assert.ok(
      texts.some((t) => t?.content === "✕" || t?.content === "Custom"),
      "detached tree should preserve swapped icon text",
    );
    assert.ok(
      collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).every(
        (id) => !detached![id]?.sourceComponentId,
      ),
    );
  });

  it("computeSwapTargetSlotPath is deterministic", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const ctx = buildButtonWithIcon(search, buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333"));
    const path = computeSwapTargetSlotPath(ctx.masterNodes, ctx.buttonMasterId, ctx.iconInstInMasterId);
    assert.ok(path);
    const instRoot = ctx.nodes[ctx.buttonInstRootId]!;
    const nestedId = findNestedInstanceBySlotPath(ctx.nodes, instRoot, ctx.buttonInstRootId, path!);
    assert.ok(nestedId);
    assert.equal(ctx.swapDef.targetStablePath, path);
  });

  it("inferPreferredComponentIds includes siblings in folder", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const close = buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333");
    const nodes = { ...search.nodes, ...close.nodes };
    const preferred = inferPreferredComponentIds(nodes, search.componentId);
    assert.ok(preferred.includes(search.componentId));
    assert.ok(preferred.includes(close.componentId));
  });

  it("isInstanceSwapPropertyOverridden detects override state", () => {
    const def = {
      id: "p1",
      key: "icon",
      label: "Icon",
      kind: "instanceSwap" as const,
      targetStableLayerId: "slot",
      targetPath: "componentId",
      defaultComponentId: "cmp-a",
    };
    assert.equal(isInstanceSwapPropertyOverridden(def, { icon: "cmp-b" }), true);
    assert.equal(isInstanceSwapPropertyOverridden(def, { icon: "cmp-a" }), false);
    assert.equal(isInstanceSwapPropertyOverridden(def, {}), false);
    assert.equal(effectiveSwapComponentId(def, {}), "cmp-a");
  });

  it("applyInstanceSwapProperties is idempotent", () => {
    const search = buildIconMaster("Icon/Search", "icon-search", "icon-search-label", "🔍", "#111");
    const ctx = buildButtonWithIcon(search, buildIconMaster("Icon/Close", "icon-close", "icon-close-label", "✕", "#333"));
    const first = applyInstanceSwapProperties(ctx.nodes, ctx.childOrder, ctx.buttonInstRootId);
    const second = applyInstanceSwapProperties(first.nodes, first.childOrder, ctx.buttonInstRootId);
    assert.equal(second.appliedSwaps.length, 0);
  });
});
