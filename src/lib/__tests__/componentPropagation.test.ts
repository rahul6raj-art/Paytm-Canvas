import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { markNodeAsComponent } from "@/lib/componentModel";
import { assignStableLayerIds } from "@/lib/components/stableIds";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import {
  beginComponentUpdateTransaction,
  endComponentUpdateTransaction,
  recordMasterMutation,
} from "@/lib/components/componentUpdateTransaction";
import {
  commitComponentUpdateTransaction,
  commitMasterLayerMutation,
} from "@/lib/components/componentPropagation";
import { propagateMasterLayerToInstances } from "@/lib/components/propagate";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import { resolveComponentInstance, isInstanceStale } from "@/lib/components/resolveComponentInstance";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { mergeInstanceOverrides } from "@/lib/componentModel";

function frame(id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: partial.name ?? "Frame",
    x: 0,
    y: 0,
    width: 120,
    height: 48,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: "horizontal",
    layoutGap: 8,
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    ...partial,
  };
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
  };
}

function buildButtonMaster() {
  const masterId = "master-btn";
  const labelId = "master-label";
  let nodes: Record<string, EditorNode> = {
    [masterId]: frame(masterId, { name: "Button", fill: "#0066ff", fillEnabled: true }),
    [labelId]: text(labelId, masterId, "Click me"),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [masterId],
    [masterId]: [labelId],
  };
  nodes = markNodeAsComponent(nodes, childOrder, masterId);
  return { masterId, labelId, nodes, childOrder };
}

describe("master propagation", () => {
  it("edit main text updates instance text", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 200, 0)!;
    let allNodes = {
      ...inst.nodes,
      [labelId]: { ...inst.nodes[labelId]!, content: "Save" },
    };

    const result = commitMasterLayerMutation(allNodes, inst.childOrder, labelId, ["content"]);
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(
      result.nodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;

    assert.equal(result.nodes[instanceLabelId]!.content, "Save");
    assert.equal(result.masterVersions[masterId], 2);
  });

  it("edit main fill updates instance fill", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    let allNodes = {
      ...inst.nodes,
      [masterId]: { ...inst.nodes[masterId]!, fill: "#00ff00" },
    };

    const result = commitMasterLayerMutation(allNodes, inst.childOrder, masterId, ["fill"]);
    assert.equal(result.nodes[inst.newRootId]!.fill, "#00ff00");
  });

  it("edit main visibility updates instance visibility", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    let allNodes = {
      ...inst.nodes,
      [labelId]: { ...inst.nodes[labelId]!, visible: false },
    };

    const result = commitMasterLayerMutation(allNodes, inst.childOrder, labelId, ["visible"]);
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(
      result.nodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;
    assert.equal(result.nodes[instanceLabelId]!.visible, false);
  });

  it("edit main padding updates instance layout fields", () => {
    const { masterId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    let allNodes = {
      ...inst.nodes,
      [masterId]: { ...inst.nodes[masterId]!, paddingTop: 16, layoutGap: 12 },
    };

    const result = commitMasterLayerMutation(allNodes, inst.childOrder, masterId, [
      "paddingTop",
      "layoutGap",
    ]);
    assert.equal(result.nodes[inst.newRootId]!.paddingTop, 16);
    assert.equal(result.nodes[inst.newRootId]!.layoutGap, 12);
    assert.ok(result.relayoutKeys.has(inst.newRootId));
  });
});

describe("override preservation during propagation", () => {
  it("instance text override survives main text update", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    let allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Custom" } },
      },
      [labelId]: { ...inst.nodes[labelId]!, content: "Master text" },
    };

    const result = commitMasterLayerMutation(allNodes, inst.childOrder, labelId, ["content"]);
    const instanceLabelId = Object.entries(
      result.nodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;
    assert.equal(mergeInstanceOverrides(result.nodes[instanceLabelId]!, result.nodes).content, "Custom");
  });

  it("reset override then receives latest main value on resolve", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    let allNodes = {
      ...inst.nodes,
      [inst.newRootId]: writeEmptyOverrides(inst.nodes[inst.newRootId]!, labelStable, "Old override"),
      [labelId]: { ...inst.nodes[labelId]!, content: "Fresh master" },
    };

    allNodes = {
      ...allNodes,
      [inst.newRootId]: {
        ...allNodes[inst.newRootId]!,
        instanceOverridesByStableId: {},
        instanceOverrides: {},
      },
    };

    const resolved = resolveComponentInstance(allNodes, inst.childOrder, inst.newRootId, { force: true });
    const instanceLabelId = Object.entries(
      resolved.nodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;
    assert.equal(resolved.nodes[instanceLabelId]!.content, "Fresh master");
  });
});

function writeEmptyOverrides(root: EditorNode, stableId: string, content: string): EditorNode {
  return {
    ...root,
    instanceOverridesByStableId: { [stableId]: { content } },
  };
}

describe("nested component cascade", () => {
  it("propagates icon master edits into icon instance nested in button master", () => {
    const iconMasterId = "icon-master";
    const iconLabelId = "icon-label";
    let iconNodes: Record<string, EditorNode> = {
      [iconMasterId]: frame(iconMasterId, { name: "Icon", width: 24, height: 24 }),
      [iconLabelId]: text(iconLabelId, iconMasterId, "★"),
    };
    const iconOrder: Record<string, string[]> = {
      [ROOT]: [iconMasterId],
      [iconMasterId]: [iconLabelId],
    };
    iconNodes = markNodeAsComponent(iconNodes, iconOrder, iconMasterId);

    const buttonMasterId = "button-master";
    let nodes: Record<string, EditorNode> = {
      ...iconNodes,
      [buttonMasterId]: frame(buttonMasterId, { name: "Button" }),
    };
    let childOrder: Record<string, string[]> = {
      ...iconOrder,
      [ROOT]: [iconMasterId, buttonMasterId],
      [buttonMasterId]: [],
    };

    const iconInstInButton = buildInstanceFromMaster(
      nodes,
      childOrder,
      iconMasterId,
      buttonMasterId,
      0,
      0,
    )!;
    nodes = iconInstInButton.nodes;
    childOrder = {
      ...childOrder,
      ...iconInstInButton.childOrder,
      [buttonMasterId]: [iconInstInButton.newRootId],
    };

    const iconLabelStable = nodes[iconMasterId]!.componentLayerStableIds![iconLabelId]!;
    nodes = {
      ...nodes,
      [iconLabelId]: { ...nodes[iconLabelId]!, content: "✦" },
    };

    const iconInstRootBefore = nodes[iconInstInButton.newRootId]!;
    assert.equal(iconInstRootBefore.sourceComponentId, iconMasterId);
    assert.equal(iconInstRootBefore.componentId, nodes[iconMasterId]!.componentId);
    assert.ok(Object.values(iconInstRootBefore.instanceStableIdMap ?? {}).includes(iconLabelStable));

    const propagated = propagateMasterLayerToInstances(nodes, iconLabelId, ["content"]);
    const iconInstLabelId = Object.entries(
      propagated[iconInstInButton.newRootId]?.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === iconLabelStable)?.[0];
    assert.equal(propagated[iconInstLabelId!]?.content, "✦");

    const result = commitMasterLayerMutation(propagated, childOrder, iconLabelId, ["content"]);
  });

  it("nested icon change updates button instance on canvas", () => {
    const iconMasterId = "icon-master";
    const iconLabelId = "icon-label";
    let iconNodes: Record<string, EditorNode> = {
      [iconMasterId]: frame(iconMasterId, { name: "Icon", width: 24, height: 24 }),
      [iconLabelId]: text(iconLabelId, iconMasterId, "★"),
    };
    const iconOrder: Record<string, string[]> = {
      [ROOT]: [iconMasterId],
      [iconMasterId]: [iconLabelId],
    };
    iconNodes = markNodeAsComponent(iconNodes, iconOrder, iconMasterId);

    const buttonMasterId = "button-master";
    const buttonLabelId = "button-label";
    let nodes: Record<string, EditorNode> = {
      ...iconNodes,
      [buttonMasterId]: frame(buttonMasterId, { name: "Button" }),
      [buttonLabelId]: text(buttonLabelId, buttonMasterId, "Buy"),
    };
    let childOrder: Record<string, string[]> = {
      ...iconOrder,
      [ROOT]: [iconMasterId, buttonMasterId],
      [buttonMasterId]: [buttonLabelId],
    };
    const iconInstInButton = buildInstanceFromMaster(
      nodes,
      childOrder,
      iconMasterId,
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
    nodes = buttonInst.nodes;
    childOrder = buttonInst.childOrder;

    const iconLabelStable = nodes[iconMasterId]!.componentLayerStableIds![iconLabelId]!;
    nodes = {
      ...nodes,
      [iconLabelId]: { ...nodes[iconLabelId]!, content: "✦" },
    };

    const result = commitMasterLayerMutation(nodes, childOrder, iconLabelId, ["content"]);
    assert.equal(result.masterVersions[iconMasterId], 2);
    assert.ok(result.masterVersions[buttonMasterId] >= 2, "button master should cascade version bump");

    const iconInstRoot = iconInstInButton.newRootId;
    const iconInstLabelId = Object.entries(
      result.nodes[iconInstRoot]?.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === iconLabelStable)?.[0];
    assert.ok(iconInstLabelId, "icon instance label mapping should exist");
    assert.equal(result.nodes[iconInstLabelId!]?.content, "✦", "icon instance in button master updates");

    const buttonInstanceNodes = collectSubtreeIds(buttonInst.newRootId, result.childOrder);
    const iconContentInButtonInstance = buttonInstanceNodes.some(
      (id) => result.nodes[id]?.content === "✦",
    );
    assert.ok(iconContentInButtonInstance, "nested icon content should propagate into button instance");
  });

  it("override on nested icon inside button instance survives nested component update", () => {
    const iconMasterId = "icon-master";
    const iconLabelId = "icon-label";
    let iconNodes: Record<string, EditorNode> = {
      [iconMasterId]: frame(iconMasterId, { name: "Icon", width: 24, height: 24 }),
      [iconLabelId]: text(iconLabelId, iconMasterId, "★"),
    };
    const iconOrder: Record<string, string[]> = {
      [ROOT]: [iconMasterId],
      [iconMasterId]: [iconLabelId],
    };
    iconNodes = markNodeAsComponent(iconNodes, iconOrder, iconMasterId);

    const buttonMasterId = "button-master";
    const buttonLabelId = "button-label";
    let nodes: Record<string, EditorNode> = {
      ...iconNodes,
      [buttonMasterId]: frame(buttonMasterId, { name: "Button" }),
      [buttonLabelId]: text(buttonLabelId, buttonMasterId, "Buy"),
    };
    let childOrder: Record<string, string[]> = {
      ...iconOrder,
      [ROOT]: [iconMasterId, buttonMasterId],
      [buttonMasterId]: [buttonLabelId],
    };
    const iconInstInButton = buildInstanceFromMaster(
      nodes,
      childOrder,
      iconMasterId,
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
    nodes = buttonInst.nodes;
    childOrder = buttonInst.childOrder;

    const iconLabelStable = nodes[iconMasterId]!.componentLayerStableIds![iconLabelId]!;
    const iconLabelStableInButton = Object.entries(
      nodes[buttonMasterId]!.componentLayerStableIds ?? {},
    ).find(([nid]) => nodes[nid]?.parentId === iconInstInButton.newRootId)?.[1]!;

    nodes = {
      ...nodes,
      [buttonInst.newRootId]: {
        ...nodes[buttonInst.newRootId]!,
        instanceOverridesByStableId: {
          [iconLabelStableInButton]: { content: "Custom icon" },
        },
      },
      [iconLabelId]: { ...nodes[iconLabelId]!, content: "✦" },
    };

    const result = commitMasterLayerMutation(nodes, childOrder, iconLabelId, ["content"]);
    const buttonInstanceNodes = collectSubtreeIds(buttonInst.newRootId, result.childOrder);
    const nestedLabelId = buttonInstanceNodes.find(
      (id) => result.nodes[id]?.type === "text" && result.nodes[id]?.parentId !== buttonInst.newRootId,
    );
    assert.equal(
      mergeInstanceOverrides(result.nodes[nestedLabelId!]!, result.nodes).content,
      "Custom icon",
    );
    assert.equal(result.nodes[iconInstInButton.newRootId] ? readNestedIconLabel(result, iconInstInButton.newRootId, iconLabelStable, childOrder) : null, "✦");
  });
});

function readNestedIconLabel(
  result: { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> },
  iconInstRootId: string,
  iconLabelStable: string,
  childOrder: Record<string, string[]>,
): string | null {
  const labelId = Object.entries(result.nodes[iconInstRootId]?.instanceStableIdMap ?? {}).find(
    ([, sid]) => sid === iconLabelStable,
  )?.[0];
  return labelId ? (result.nodes[labelId]?.content ?? null) : null;
}

function collectParentChain(nodes: Record<string, EditorNode>, nodeId: string): string[] {
  const chain: string[] = [];
  let cur: string | null = nodeId;
  while (cur) {
    chain.push(cur);
    cur = nodes[cur]?.parentId ?? null;
  }
  return chain;
}

describe("component update transaction", () => {
  it("batches multiple master edits into one propagation", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    let allNodes = {
      ...inst.nodes,
      [masterId]: { ...inst.nodes[masterId]!, fill: "#111111", paddingTop: 20 },
      [labelId]: { ...inst.nodes[labelId]!, content: "Batch" },
    };

    beginComponentUpdateTransaction("batch");
    recordMasterMutation(masterId, masterId, allNodes[masterId]!.componentLayerStableIds![masterId]!, [
      "fill",
      "paddingTop",
    ]);
    recordMasterMutation(masterId, labelId, allNodes[masterId]!.componentLayerStableIds![labelId]!, [
      "content",
    ]);
    const tx = endComponentUpdateTransaction()!;
    const result = commitComponentUpdateTransaction(allNodes, inst.childOrder, tx);

    assert.equal(result.masterVersions[masterId], 2);
    assert.equal(result.nodes[inst.newRootId]!.fill, "#111111");
    assert.equal(result.nodes[inst.newRootId]!.paddingTop, 20);
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(
      result.nodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;
    assert.equal(result.nodes[instanceLabelId]!.content, "Batch");
  });
});

describe("instance versioning", () => {
  it("marks instance stale after master version bump", () => {
    const { masterId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    assert.equal(isInstanceStale(inst.nodes, inst.newRootId), false);

    const bumped = commitMasterLayerMutation(
      { ...inst.nodes, [masterId]: { ...inst.nodes[masterId]!, fill: "#222" } },
      inst.childOrder,
      masterId,
      ["fill"],
    );
    assert.equal(isInstanceStale(bumped.nodes, inst.newRootId), false);
    assert.equal(bumped.nodes[inst.newRootId]!.componentVersionAtInsert, 2);
  });

  it("resolve cache hit skips work when version matches", () => {
    const { masterId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const resolved = resolveComponentInstance(inst.nodes, inst.childOrder, inst.newRootId);
    assert.equal(resolved.cacheStatus, "hit");

    const again = resolveComponentInstance(resolved.nodes, resolved.childOrder, inst.newRootId);
    assert.equal(again.cacheStatus, "hit");
  });
});

describe("structure sync", () => {
  it("add layer to main appears in instance after resolve", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const badgeId = "master-badge";
    const badgeStable = `layer-badge-${Date.now()}`;
    let allNodes = {
      ...inst.nodes,
      [badgeId]: text(badgeId, masterId, "NEW"),
      [masterId]: {
        ...inst.nodes[masterId]!,
        componentVersion: 2,
        componentLayerStableIds: {
          ...(inst.nodes[masterId]!.componentLayerStableIds ?? {}),
          [badgeId]: badgeStable,
        },
      },
    };
    const order = { ...inst.childOrder, [masterId]: [labelId, badgeId] };
    const result = commitMasterLayerMutation(allNodes, order, badgeId, ["content"], {
      structural: true,
    });
    const hasBadge = Object.values(result.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).includes(
      badgeStable,
    );
    assert.equal(hasBadge, true);
  });
});
