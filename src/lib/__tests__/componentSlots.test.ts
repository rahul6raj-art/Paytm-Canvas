import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { detachInstanceTree, markNodeAsComponent } from "@/lib/componentModel";
import { buildInstanceFromMaster, buildSetInstanceVariantResult } from "@/lib/components/componentActions";
import { assignStableLayerIds } from "@/lib/components/stableIds";
import {
  applySlotProperties,
  buildResetSlotContentResult,
  buildSetSlotContentResult,
  buildSlotInstanceContentSnapshot,
  buildSlotPropertyForContainer,
  buildSlotTextContentSnapshot,
  collectSlotDebugInfo,
  computeSlotTargetPath,
  findSlotContainerInInstance,
  isSlotPropertyOverridden,
  pruneIncompatibleSlotOverrides,
  readSlotContentOverride,
  slotTargetPath,
  writeSlotContentOverride,
} from "@/lib/components/componentSlots";
import { readInstanceOverrideMap, writeInstanceOverrideState } from "@/lib/components/overrides";
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
    width: partial.width ?? 200,
    height: partial.height ?? 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: partial.layoutMode ?? "vertical",
    layoutGap: partial.layoutGap ?? 8,
    layoutSizingHorizontal: partial.layoutSizingHorizontal ?? "hug",
    layoutSizingVertical: partial.layoutSizingVertical ?? "hug",
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
    width: partial.width ?? 120,
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

function buildCardWithSlots() {
  const cardMasterId = "card-master";
  const headerSlotId = "header-slot";
  const bodySlotId = "body-slot";
  const footerSlotId = "footer-slot";
  const headerDefaultId = "header-default";
  const bodyDefaultId = "body-default";
  const footerDefaultId = "footer-default";

  let nodes: Record<string, EditorNode> = {
    [cardMasterId]: frame(cardMasterId, { name: "Card", width: 240 }),
    [headerSlotId]: frame(headerSlotId, { name: "Header", height: 32, parentId: cardMasterId }),
    [bodySlotId]: frame(bodySlotId, { name: "Body", height: 48, parentId: cardMasterId }),
    [footerSlotId]: frame(footerSlotId, { name: "Footer", height: 32, parentId: cardMasterId }),
    [headerDefaultId]: text(headerDefaultId, headerSlotId, "Default Header"),
    [bodyDefaultId]: text(bodyDefaultId, bodySlotId, "Default Body"),
    [footerDefaultId]: text(footerDefaultId, footerSlotId, "Default Footer"),
  };
  let childOrder: Record<string, string[]> = {
    [ROOT]: [cardMasterId],
    [cardMasterId]: [headerSlotId, bodySlotId, footerSlotId],
    [headerSlotId]: [headerDefaultId],
    [bodySlotId]: [bodyDefaultId],
    [footerSlotId]: [footerDefaultId],
  };

  nodes = markNodeAsComponent(nodes, childOrder, cardMasterId);

  const headerDef = buildSlotPropertyForContainer(nodes, childOrder, cardMasterId, headerSlotId, "Header")!;
  const bodyDef = buildSlotPropertyForContainer(nodes, childOrder, cardMasterId, bodySlotId, "Body")!;
  const footerDef = buildSlotPropertyForContainer(nodes, childOrder, cardMasterId, footerSlotId, "Footer")!;

  nodes = {
    ...nodes,
    [cardMasterId]: {
      ...nodes[cardMasterId]!,
      componentPropertyDefs: [headerDef, bodyDef, footerDef],
    },
  };

  const cardInst = buildInstanceFromMaster(nodes, childOrder, cardMasterId, null, 0, 0)!;
  return {
    nodes: cardInst.nodes,
    childOrder: cardInst.childOrder,
    cardInstRootId: cardInst.newRootId,
    cardMasterId,
    headerSlotId,
    bodySlotId,
    footerSlotId,
    headerDef,
    bodyDef,
    footerDef,
    masterNodes: nodes,
    masterChildOrder: childOrder,
  };
}

describe("slot properties", () => {
  it("creates slot property from selected container with stable path", () => {
    const ctx = buildCardWithSlots();
    assert.ok(ctx.bodyDef.targetStablePath);
    assert.equal(slotTargetPath(ctx.bodyDef), ctx.bodyDef.targetStablePath);
    assert.equal(ctx.bodyDef.defaultSlotContent?.rootChildIds.length, 1);
  });

  it("instance exposes slot properties in debug info", () => {
    const ctx = buildCardWithSlots();
    const resolved = resolveComponentInstance(ctx.nodes, ctx.childOrder, ctx.cardInstRootId, {
      force: true,
    });
    const slots = collectSlotDebugInfo(resolved.nodes, resolved.childOrder, ctx.cardInstRootId);
    assert.equal(slots.length, 3);
    assert.ok(slots.every((s) => s.active));
  });

  it("replace slot content with text", () => {
    const ctx = buildCardWithSlots();
    const snapshot = buildSlotTextContentSnapshot("Custom Body");
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      snapshot,
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const bodyContainer = findSlotContainerInInstance(
      resolved.nodes,
      resolved.nodes[ctx.cardInstRootId]!,
      ctx.cardInstRootId,
      slotTargetPath(ctx.bodyDef),
    )!;
    const texts = childTexts(bodyContainer, resolved.nodes, resolved.childOrder);
    assert.ok(texts.some((t) => t.content === "Custom Body"));
  });

  it("replace slot content with component instance", () => {
    const ctx = buildCardWithSlots();
    let badgeNodes: Record<string, EditorNode> = {
      "badge-master": frame("badge-master", { name: "Badge", width: 80, height: 24 }),
      "badge-label": text("badge-label", "badge-master", "NEW"),
    };
    let badgeOrder: Record<string, string[]> = {
      [ROOT]: ["badge-master"],
      "badge-master": ["badge-label"],
    };
    badgeNodes = markNodeAsComponent(badgeNodes, badgeOrder, "badge-master");
    const allNodes = { ...ctx.masterNodes, ...badgeNodes };
    const allOrder = {
      ...ctx.masterChildOrder,
      [ROOT]: [...(ctx.masterChildOrder[ROOT] ?? []), "badge-master"],
    };
    const snapshot = buildSlotInstanceContentSnapshot(allNodes, allOrder, "badge-master")!;
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.headerDef.key,
      snapshot,
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const headerContainer = findSlotContainerInInstance(
      resolved.nodes,
      resolved.nodes[ctx.cardInstRootId]!,
      ctx.cardInstRootId,
      slotTargetPath(ctx.headerDef),
    )!;
    const nested = collectSubtreeIds(headerContainer, resolved.childOrder).find(
      (id) => resolved.nodes[id]?.sourceComponentId,
    );
    assert.ok(nested, "header slot should contain component instance");
  });

  it("slot content participates in auto layout relayout keys", () => {
    const ctx = buildCardWithSlots();
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      buildSlotTextContentSnapshot("Much longer body content for layout"),
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const keys = collectInstanceRelayoutKeys(resolved.nodes, resolved.childOrder, ctx.cardInstRootId);
    assert.ok(keys.includes(ctx.cardInstRootId));
  });

  it("reset slot restores default content", () => {
    const ctx = buildCardWithSlots();
    let nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      buildSlotTextContentSnapshot("Temporary"),
    )!;
    nodes = buildResetSlotContentResult(nodes, ctx.cardInstRootId, ctx.bodyDef.key)!;
    const overrideMap = readInstanceOverrideMap(nodes[ctx.cardInstRootId]!);
    assert.equal(isSlotPropertyOverridden(ctx.bodyDef, overrideMap), false);
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const bodyContainer = findSlotContainerInInstance(
      resolved.nodes,
      resolved.nodes[ctx.cardInstRootId]!,
      ctx.cardInstRootId,
      slotTargetPath(ctx.bodyDef),
    )!;
    const texts = childTexts(bodyContainer, resolved.nodes, resolved.childOrder);
    assert.ok(texts.some((t) => t.content === "Default Body"));
  });

  it("detach preserves slot content", () => {
    const ctx = buildCardWithSlots();
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      buildSlotTextContentSnapshot("Detached Body"),
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const detached = detachInstanceTree(resolved.nodes, resolved.childOrder, ctx.cardInstRootId);
    assert.ok(detached);
    const texts = collectSubtreeIds(ctx.cardInstRootId, resolved.childOrder)
      .map((id) => detached![id])
      .filter((n) => n?.type === "text");
    assert.ok(texts.some((t) => t?.content === "Detached Body"));
  });

  it("variant switch preserves slot content when path matches", () => {
    const ctx = buildCardWithSlots();
    let nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      buildSlotTextContentSnapshot("Variant Body"),
    )!;
    const bodyPath = slotTargetPath(ctx.bodyDef);
    let overrideMap = readInstanceOverrideMap(nodes[ctx.cardInstRootId]!);
    overrideMap = writeSlotContentOverride(overrideMap, bodyPath, readSlotContentOverride(overrideMap, bodyPath)!);
    nodes = {
      ...nodes,
      [ctx.cardInstRootId]: writeInstanceOverrideState(nodes[ctx.cardInstRootId]!, overrideMap),
    };
    nodes = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true }).nodes;

    const compactMasterId = "card-compact";
    nodes = {
      ...nodes,
      ...ctx.masterNodes,
      [compactMasterId]: frame(compactMasterId, {
        name: "Card/Compact",
        width: 200,
        layoutMode: "vertical",
        layoutSizingVertical: "hug",
      }),
      "compact-body-slot": frame("compact-body-slot", { name: "Body", height: 40, parentId: compactMasterId }),
      "compact-body-default": text("compact-body-default", "compact-body-slot", "Compact Default"),
    };
    const childOrder = {
      ...ctx.masterChildOrder,
      [ROOT]: [...(ctx.masterChildOrder[ROOT] ?? []), compactMasterId],
      [compactMasterId]: ["compact-body-slot"],
      "compact-body-slot": ["compact-body-default"],
    };
    nodes = markNodeAsComponent(nodes, childOrder, compactMasterId);
    const compactStableIds = assignStableLayerIds(nodes, childOrder, compactMasterId);
    compactStableIds["compact-body-slot"] = ctx.bodyDef.targetStableLayerId;
    const compactBodyDefRaw = buildSlotPropertyForContainer(
      nodes,
      childOrder,
      compactMasterId,
      "compact-body-slot",
      "Body",
    )!;
    const compactBodyDef = {
      ...compactBodyDefRaw,
      key: ctx.bodyDef.key,
      targetStablePath: ctx.bodyDef.targetStablePath,
      targetStableLayerId: ctx.bodyDef.targetStableLayerId,
    };
    nodes = {
      ...nodes,
      [compactMasterId]: {
        ...nodes[compactMasterId]!,
        componentPropertyDefs: [compactBodyDef],
        componentLayerStableIds: compactStableIds,
        variantGroupId: nodes[ctx.cardMasterId]!.variantGroupId,
        variantProperties: { Variant: "Compact" },
      },
      [ctx.cardMasterId]: {
        ...nodes[ctx.cardMasterId]!,
        variantProperties: { Variant: "Default" },
      },
    };

    const variantResult = buildSetInstanceVariantResult(nodes, ctx.childOrder, ctx.cardInstRootId, {
      Variant: "Compact",
    })!;
    const instRootId = variantResult.newRootId;
    const resolved = resolveComponentInstance(
      variantResult.nodes,
      variantResult.childOrder,
      instRootId,
      { force: true },
    );
    const resolvedOverrideMap = readInstanceOverrideMap(resolved.nodes[instRootId]!);
    const compactPath = slotTargetPath(compactBodyDef);
    assert.ok(
      readSlotContentOverride(resolvedOverrideMap, compactPath),
      "slot override should persist when path matches",
    );
  });

  it("variant switch safely handles missing slot path", () => {
    const ctx = buildCardWithSlots();
    let overrideMap = readInstanceOverrideMap(ctx.nodes[ctx.cardInstRootId]!);
    overrideMap = writeSlotContentOverride(
      overrideMap,
      "missing-slot-path",
      buildSlotTextContentSnapshot("Orphan"),
    );
    const pruned = pruneIncompatibleSlotOverrides(
      ctx.masterNodes,
      ctx.cardMasterId,
      overrideMap,
      ctx.masterNodes[ctx.cardMasterId]!.componentPropertyDefs ?? [],
    );
    assert.equal(readSlotContentOverride(pruned.overrideMap, "missing-slot-path"), undefined);
  });

  it("empty slot works when allowEmpty=true", () => {
    const ctx = buildCardWithSlots();
    const emptySnapshot = { version: 1 as const, nodes: {}, childOrder: {}, rootChildIds: [] };
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.footerDef.key,
      emptySnapshot,
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const footerContainer = findSlotContainerInInstance(
      resolved.nodes,
      resolved.nodes[ctx.cardInstRootId]!,
      ctx.cardInstRootId,
      slotTargetPath(ctx.footerDef),
    )!;
    const kids = resolved.childOrder[footerContainer] ?? [];
    assert.equal(kids.length, 0);
  });

  it("applySlotProperties is idempotent", () => {
    const ctx = buildCardWithSlots();
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      buildSlotTextContentSnapshot("Stable"),
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const first = applySlotProperties(resolved.nodes, resolved.childOrder, ctx.cardInstRootId);
    const second = applySlotProperties(first.nodes, first.childOrder, ctx.cardInstRootId);
    assert.equal(second.appliedSlots.length, 0);
  });

  it("computeSlotTargetPath is deterministic", () => {
    const ctx = buildCardWithSlots();
    const path = computeSlotTargetPath(ctx.masterNodes, ctx.cardMasterId, ctx.bodySlotId);
    assert.ok(path);
    const instContainer = findSlotContainerInInstance(
      ctx.nodes,
      ctx.nodes[ctx.cardInstRootId]!,
      ctx.cardInstRootId,
      path!,
    );
    assert.ok(instContainer);
  });

  it("hidden slot content does not affect layout visibility flag", () => {
    const ctx = buildCardWithSlots();
    const hiddenSnapshot = buildSlotTextContentSnapshot("Hidden");
    hiddenSnapshot.nodes[hiddenSnapshot.rootChildIds[0]!] = {
      ...hiddenSnapshot.nodes[hiddenSnapshot.rootChildIds[0]!]!,
      visible: false,
    };
    const nodes = buildSetSlotContentResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.cardInstRootId,
      ctx.bodyDef.key,
      hiddenSnapshot,
    )!;
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.cardInstRootId, { force: true });
    const bodyContainer = findSlotContainerInInstance(
      resolved.nodes,
      resolved.nodes[ctx.cardInstRootId]!,
      ctx.cardInstRootId,
      slotTargetPath(ctx.bodyDef),
    )!;
    const textNode = childTexts(bodyContainer, resolved.nodes, resolved.childOrder)[0];
    assert.equal(textNode?.visible, false);
  });
});

function childTexts(
  containerId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode[] {
  return (childOrder[containerId] ?? [])
    .flatMap((cid) => collectSubtreeIds(cid, childOrder))
    .map((id) => nodes[id])
    .filter((n): n is EditorNode => n?.type === "text");
}
