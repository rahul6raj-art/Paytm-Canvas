import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { detachInstanceTree, markNodeAsComponent, mergeInstanceOverrides } from "@/lib/componentModel";
import { assignStableLayerIds } from "@/lib/components/stableIds";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import { commitMasterLayerMutation } from "@/lib/components/componentPropagation";
import {
  applyInstanceInteractionTrigger,
  buildApplyInteractiveVariantResult,
} from "@/lib/components/componentInteractiveActions";
import {
  defaultComponentInteraction,
  effectiveVariantValuesForInstance,
  syncInteractionsToVariantGroup,
} from "@/lib/components/componentInteractions";
import { combineComponentsAsVariants } from "@/lib/componentUx";
import { resolveComponentInstance, collectInstanceRelayoutKeys } from "@/lib/components/resolveComponentInstance";
import {
  formatNestedStablePath,
  findDeepestInteractiveInstanceRoot,
  isNestedStablePath,
  parseNestedStablePath,
} from "@/lib/components/stablePaths";
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

function buildIconMaster() {
  const iconMasterId = "icon-master";
  const iconLabelId = "icon-label";
  let nodes: Record<string, EditorNode> = {
    [iconMasterId]: frame(iconMasterId, { name: "Icon", width: 24, height: 24 }),
    [iconLabelId]: text(iconLabelId, iconMasterId, "★"),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [iconMasterId],
    [iconMasterId]: [iconLabelId],
  };
  nodes = markNodeAsComponent(nodes, childOrder, iconMasterId);
  return { iconMasterId, iconLabelId, nodes, childOrder };
}

function buildButtonWithNestedIcon() {
  const icon = buildIconMaster();
  let { nodes, childOrder } = icon;
  const buttonMasterId = "button-master";
  const buttonLabelId = "button-label";
  nodes = {
    ...nodes,
    [buttonMasterId]: frame(buttonMasterId, { name: "Button", layoutSizingHorizontal: "hug" }),
    [buttonLabelId]: text(buttonLabelId, buttonMasterId, "Buy"),
  };
  childOrder = {
    ...childOrder,
    [ROOT]: [icon.iconMasterId, buttonMasterId],
    [buttonMasterId]: [buttonLabelId],
  };
  const iconInstInButton = buildInstanceFromMaster(
    nodes,
    childOrder,
    icon.iconMasterId,
    buttonMasterId,
    0,
    0,
  )!;
  nodes = iconInstInButton.nodes;
  childOrder = {
    ...childOrder,
    ...iconInstInButton.childOrder,
    [buttonMasterId]: [iconInstInButton.newRootId, buttonLabelId],
  };
  nodes = {
    ...nodes,
    [buttonMasterId]: {
      ...nodes[buttonMasterId]!,
      componentLayerStableIds: assignStableLayerIds(nodes, childOrder, buttonMasterId),
    },
  };
  nodes = markNodeAsComponent(nodes, childOrder, buttonMasterId);
  const buttonInst = buildInstanceFromMaster(nodes, childOrder, buttonMasterId, null, 100, 0)!;
  return {
    ...icon,
    buttonMasterId,
    buttonLabelId,
    iconInstInButtonId: iconInstInButton.newRootId,
    buttonInstRootId: buttonInst.newRootId,
    nodes: buttonInst.nodes,
    childOrder: buttonInst.childOrder,
    masterNodes: nodes,
    masterChildOrder: childOrder,
  };
}

describe("nested component instances", () => {
  it("stable path format is deterministic", () => {
    const path = formatNestedStablePath("button-root", "icon-slot", "icon-shape");
    assert.equal(path, "button-root/icon-slot::icon-shape");
    assert.ok(isNestedStablePath(path));
    assert.deepEqual(parseNestedStablePath(path), {
      parentLayerStableId: "button-root",
      nestedSlotStableId: "icon-slot",
      nestedLayerStableId: "icon-shape",
    });
  });

  it("resolved parent instance preserves nested instance identity and stable maps", () => {
    const ctx = buildButtonWithNestedIcon();
    const resolved = resolveComponentInstance(ctx.nodes, ctx.childOrder, ctx.buttonInstRootId, {
      force: true,
    });
    const nestedRoots = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).filter(
      (id) =>
        resolved.nodes[id]?.sourceComponentId &&
        id !== ctx.buttonInstRootId,
    );
    assert.equal(nestedRoots.length, 1, "one nested icon instance");
    const nestedRoot = resolved.nodes[nestedRoots[0]!]!;
    assert.equal(nestedRoot.componentId, ctx.nodes[ctx.iconMasterId]!.componentId);
    assert.ok(
      Object.keys(nestedRoot.instanceStableIdMap ?? {}).length > 1,
      "nested instance should have stable-id map",
    );
    const iconLabelStable = ctx.masterNodes[ctx.iconMasterId]!.componentLayerStableIds![
      ctx.iconLabelId
    ]!;
    const mapped = Object.values(nestedRoot.instanceStableIdMap ?? {}).includes(iconLabelStable);
    assert.ok(mapped, "nested map should reference icon master stable ids");
  });

  it("parent override on nested icon survives master update", () => {
    const ctx = buildButtonWithNestedIcon();
    const iconLabelStableInButton = Object.entries(
      ctx.masterNodes[ctx.buttonMasterId]!.componentLayerStableIds ?? {},
    ).find(([nid]) => ctx.masterNodes[nid]?.parentId === ctx.iconInstInButtonId)?.[1]!;

    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        instanceOverridesByStableId: {
          [iconLabelStableInButton]: { content: "Custom icon" },
        },
      },
      [ctx.iconLabelId]: { ...ctx.nodes[ctx.iconLabelId]!, content: "✦" },
    };

    const result = commitMasterLayerMutation(nodes, ctx.childOrder, ctx.iconLabelId, ["content"]);
    const buttonInstanceNodes = collectSubtreeIds(ctx.buttonInstRootId, result.childOrder);
    const nestedLabelId = buttonInstanceNodes.find(
      (id) => result.nodes[id]?.type === "text" && result.nodes[id]?.parentId !== ctx.buttonInstRootId,
    );
    assert.equal(
      mergeInstanceOverrides(result.nodes[nestedLabelId!]!, result.nodes).content,
      "Custom icon",
    );
  });

  it("nested path override applies to nested layer", () => {
    const ctx = buildButtonWithNestedIcon();
    const iconSlotStable = Object.entries(ctx.nodes[ctx.buttonInstRootId]!.instanceStableIdMap ?? {}).find(
      ([nid]) => nid !== ctx.buttonInstRootId,
    )?.[1]!;
    const iconLabelStable = ctx.masterNodes[ctx.iconMasterId]!.componentLayerStableIds![ctx.iconLabelId]!;
    const parentRootStable =
      ctx.masterNodes[ctx.buttonMasterId]!.componentLayerStableIds![ctx.buttonMasterId]!;
    const fullPath = formatNestedStablePath(parentRootStable, iconSlotStable, iconLabelStable);

    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        instanceOverridesByStableId: {
          [fullPath]: { content: "Path override" },
        },
      },
    };
    const resolved = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const nestedLabel = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder).find(
      (id) => resolved.nodes[id]?.type === "text" && resolved.nodes[id]?.parentId !== ctx.buttonInstRootId,
    );
    assert.equal(resolved.nodes[nestedLabel!]?.content, "Path override");
  });

  it("icon master update cascades to button instance on canvas", () => {
    const ctx = buildButtonWithNestedIcon();
    let nodes = {
      ...ctx.nodes,
      [ctx.iconLabelId]: { ...ctx.nodes[ctx.iconLabelId]!, content: "✦" },
    };
    const result = commitMasterLayerMutation(nodes, ctx.childOrder, ctx.iconLabelId, ["content"]);
    const buttonInstanceNodes = collectSubtreeIds(ctx.buttonInstRootId, result.childOrder);
    assert.ok(
      buttonInstanceNodes.some((id) => result.nodes[id]?.content === "✦"),
      "nested icon content should propagate into button instance",
    );
  });

  it("nested interactive instance responds without mutating selectedVariantProperties", () => {
    const iconDefault = "icon-default";
    const iconHover = "icon-hover";
    const iconLabelDefault = "icon-lbl-default";
    const iconLabelHover = "icon-lbl-hover";
    let nodes: Record<string, EditorNode> = {
      [iconDefault]: frame(iconDefault, { name: "Icon/Default", fill: "#111", fillEnabled: true }),
      [iconLabelDefault]: text(iconLabelDefault, iconDefault, "★"),
      [iconHover]: frame(iconHover, { name: "Icon/Hover", x: 40, fill: "#333", fillEnabled: true }),
      [iconLabelHover]: text(iconLabelHover, iconHover, "★"),
    };
    let childOrder: Record<string, string[]> = {
      [ROOT]: [iconDefault, iconHover],
      [iconDefault]: [iconLabelDefault],
      [iconHover]: [iconLabelHover],
    };
    for (const id of [iconDefault, iconHover]) nodes = markNodeAsComponent(nodes, childOrder, id);
    const combined = combineComponentsAsVariants(nodes, childOrder, [iconDefault, iconHover])!;
    nodes = combined.nodes;
    const vg = nodes[iconDefault]!.variantGroupId!;
    nodes = syncInteractionsToVariantGroup(nodes, vg, [
      defaultComponentInteraction({ Variant: "Default" }, "ON_MOUSE_ENTER", { Variant: "Hover" }),
      defaultComponentInteraction({ Variant: "Hover" }, "ON_MOUSE_LEAVE", { Variant: "Default" }),
    ]);

    const cardMasterId = "card-master";
    const iconInst = buildInstanceFromMaster(nodes, childOrder, iconDefault, cardMasterId, 0, 0)!;
    nodes = {
      ...iconInst.nodes,
      [cardMasterId]: frame(cardMasterId, { name: "Card" }),
    };
    childOrder = {
      ...childOrder,
      ...iconInst.childOrder,
      [ROOT]: [iconDefault, iconHover, cardMasterId],
      [cardMasterId]: [iconInst.newRootId],
    };
    nodes = {
      ...nodes,
      [cardMasterId]: {
        ...nodes[cardMasterId]!,
        componentLayerStableIds: assignStableLayerIds(nodes, childOrder, cardMasterId),
      },
    };
    nodes = markNodeAsComponent(nodes, childOrder, cardMasterId);
    const cardInst = buildInstanceFromMaster(nodes, childOrder, cardMasterId, null, 0, 0)!;

    const nestedIconRoot = collectSubtreeIds(cardInst.newRootId, cardInst.childOrder).find(
      (id) => cardInst.nodes[id]?.sourceComponentId && id !== cardInst.newRootId,
    )!;
    const nestedLabelId = collectSubtreeIds(nestedIconRoot, cardInst.childOrder).find(
      (id) => cardInst.nodes[id]?.type === "text",
    )!;

    const deepest = findDeepestInteractiveInstanceRoot(cardInst.nodes, nestedLabelId);
    assert.ok(deepest, "pointer hit should resolve to an interactive nested instance");
    assert.equal(
      cardInst.nodes[deepest!]?.componentId,
      cardInst.nodes[nestedIconRoot]?.componentId,
      "deepest interactive target should be the nested icon instance",
    );

    const hover = applyInstanceInteractionTrigger(
      cardInst.nodes,
      cardInst.childOrder,
      nestedIconRoot,
      "ON_MOUSE_ENTER",
    );
    assert.ok(hover?.applied);
    const nestedAfter = hover!.nodes[hover!.newRootId]!;
    assert.equal(effectiveVariantValuesForInstance(nestedAfter).Variant, "Hover");
    assert.equal(nestedAfter.selectedVariantProperties?.Variant, "Default");
    assert.notEqual(nestedAfter.fill, cardInst.nodes[nestedIconRoot]?.fill);
  });

  it("layout invalidation includes parent instance when nested content changes", () => {
    const ctx = buildButtonWithNestedIcon();
    const resolved = resolveComponentInstance(ctx.nodes, ctx.childOrder, ctx.buttonInstRootId, {
      force: true,
    });
    const keys = collectInstanceRelayoutKeys(resolved.nodes, resolved.childOrder, ctx.buttonInstRootId);
    assert.ok(keys.includes(ctx.buttonInstRootId));
  });

  it("detach preserves nested appearance and removes instance links", () => {
    const ctx = buildButtonWithNestedIcon();
    const resolved = resolveComponentInstance(ctx.nodes, ctx.childOrder, ctx.buttonInstRootId, {
      force: true,
    });
    const detached = detachInstanceTree(resolved.nodes, resolved.childOrder, ctx.buttonInstRootId);
    assert.ok(detached);
    for (const id of collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder)) {
      const n = detached![id]!;
      assert.equal(n.sourceComponentId, undefined);
      assert.equal(n.instanceStableIdMap, undefined);
    }
    const texts = collectSubtreeIds(ctx.buttonInstRootId, resolved.childOrder)
      .map((id) => detached![id])
      .filter((n) => n?.type === "text");
    assert.ok(texts.length >= 2, "button label + icon label preserved");
  });

  it("reset nested override restores nested master value", () => {
    const ctx = buildButtonWithNestedIcon();
    const iconLabelStableInButton = Object.entries(
      ctx.masterNodes[ctx.buttonMasterId]!.componentLayerStableIds ?? {},
    ).find(([nid]) => ctx.masterNodes[nid]?.parentId === ctx.iconInstInButtonId)?.[1]!;

    let nodes = {
      ...ctx.nodes,
      [ctx.buttonInstRootId]: {
        ...ctx.nodes[ctx.buttonInstRootId]!,
        instanceOverridesByStableId: {
          [iconLabelStableInButton]: { content: "Custom icon" },
        },
      },
    };
    const withOverride = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, {
      force: true,
    });
    nodes = {
      ...withOverride.nodes,
      [ctx.buttonInstRootId]: {
        ...withOverride.nodes[ctx.buttonInstRootId]!,
        instanceOverridesByStableId: {},
      },
    };
    const reset = resolveComponentInstance(nodes, ctx.childOrder, ctx.buttonInstRootId, { force: true });
    const nestedLabel = collectSubtreeIds(ctx.buttonInstRootId, reset.childOrder).find(
      (id) => reset.nodes[id]?.type === "text" && reset.nodes[id]?.parentId !== ctx.buttonInstRootId,
    );
    assert.equal(reset.nodes[nestedLabel!]?.content, "★");
  });

  it("runtime interactive state does not mutate selectedVariantProperties", () => {
    const ctx = buildButtonWithNestedIcon();
    const result = buildApplyInteractiveVariantResult(
      ctx.nodes,
      ctx.childOrder,
      ctx.buttonInstRootId,
      { State: "Hover" },
    );
    assert.ok(result);
    const root = result!.nodes[result!.newRootId]!;
    assert.equal(root.selectedVariantProperties?.State, undefined);
    assert.equal(root.currentInteractiveVariantValues?.State, "Hover");
  });
});
