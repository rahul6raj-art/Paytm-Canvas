import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import { markNodeAsComponent, detachInstanceTree } from "@/lib/componentModel";
import { assignStableLayerIds } from "@/lib/components/stableIds";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import { commitMasterLayerMutation } from "@/lib/components/componentPropagation";
import { applyMasterComponentDocumentChanges } from "@/lib/components/componentMasterMutation";
import {
  resolveComponentInstance,
  isInstanceStale,
} from "@/lib/components/resolveComponentInstance";
import { resolveNodeForDisplay } from "@/lib/components/resolveForDisplay";

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

describe("live instance resolution", () => {
  it("resolveNodeForDisplay applies stable-id overrides", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(inst.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0]!;

    let allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Override" } },
      },
    };

    const displayed = resolveNodeForDisplay(allNodes, inst.childOrder, instanceLabelId);
    assert.equal(displayed?.content, "Override");
  });

  it("marks instance stale when master version bumps", () => {
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

  it("repeated resolve produces stable output", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const allNodes = {
      ...inst.nodes,
      [labelId]: { ...inst.nodes[labelId]!, content: "Stable" },
    };
    const first = resolveComponentInstance(allNodes, inst.childOrder, inst.newRootId, { force: true });
    const second = resolveComponentInstance(first.nodes, first.childOrder, inst.newRootId);
    assert.equal(second.cacheStatus, "hit");
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    const labelId1 = Object.entries(first.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0]!;
    const labelId2 = Object.entries(second.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0]!;
    assert.equal(first.nodes[labelId1]?.content, second.nodes[labelId2]?.content);
  });
});

describe("structural master changes via document mutation hook", () => {
  it("adding layer to main appears in instance", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const badgeId = "master-badge";
    let allNodes = {
      ...inst.nodes,
      [badgeId]: text(badgeId, masterId, "NEW"),
    };
    const order = { ...inst.childOrder, [masterId]: [labelId, badgeId] };

    const refresh = new Set<string>();
    const result = applyMasterComponentDocumentChanges(allNodes, order, refresh, {
      addedNodeIds: [badgeId],
      changedNodeIds: [badgeId],
      structural: true,
      reason: "add-layer",
    });

    const badgeStable = result.nodes[masterId]!.componentLayerStableIds![badgeId];
    assert.ok(badgeStable, "new layer gets stable id");
    const hasBadge = Object.values(result.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).includes(
      badgeStable,
    );
    assert.equal(hasBadge, true);
  });

  it("removing layer from main removes from instance", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    let allNodes = { ...inst.nodes };
    delete allNodes[labelId];
    const order = { ...inst.childOrder, [masterId]: [] };

    const refresh = new Set<string>();
    const result = applyMasterComponentDocumentChanges(allNodes, order, refresh, {
      removedNodeIds: [labelId],
      structural: true,
      reason: "remove-layer",
    });

    const instanceLabelId = Object.entries(
      result.nodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0];
    assert.equal(instanceLabelId, undefined);
  });

  it("reordering main children updates instance child order", () => {
    const masterId = "master-btn";
    const labelA = "label-a";
    const labelB = "label-b";
    let nodes: Record<string, EditorNode> = {
      [masterId]: frame(masterId, { name: "Button" }),
      [labelA]: text(labelA, masterId, "A"),
      [labelB]: text(labelB, masterId, "B"),
    };
    let childOrder: Record<string, string[]> = {
      [ROOT]: [masterId],
      [masterId]: [labelA, labelB],
    };
    nodes = markNodeAsComponent(nodes, childOrder, masterId);
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const order = { ...inst.childOrder, [masterId]: [labelB, labelA] };

    const refresh = new Set<string>();
    const result = applyMasterComponentDocumentChanges(
      { ...inst.nodes, [masterId]: inst.nodes[masterId]! },
      order,
      refresh,
      { changedNodeIds: [masterId], structural: true, reason: "reorder" },
    );

    const instKids = result.childOrder[inst.newRootId] ?? [];
    assert.equal(instKids.length, 2);
    const stableB = nodes[masterId]!.componentLayerStableIds![labelB]!;
    const instB = Object.entries(result.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === stableB,
    )?.[0];
    assert.equal(instKids[0], instB);
  });
});

describe("detach and reset", () => {
  it("detach preserves resolved appearance with overrides", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    let allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Detached text", fill: "#ff0000" } },
      },
    };
    const resolved = resolveComponentInstance(allNodes, inst.childOrder, inst.newRootId, {
      force: true,
    });
    const detached = detachInstanceTree(resolved.nodes, resolved.childOrder, inst.newRootId);
    assert.ok(detached);
    const instanceLabelId = Object.entries(inst.nodes[inst.newRootId]!.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0]!;
    const after = detached![instanceLabelId]!;
    assert.equal(after.content, "Detached text");
    assert.equal(after.sourceComponentId, undefined);
  });

  it("reset override then resolve receives latest main value", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    let allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Old override" } },
      },
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

describe("auto layout after master change", () => {
  it("master padding change marks instance layout dirty", () => {
    const { masterId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const result = commitMasterLayerMutation(
      { ...inst.nodes, [masterId]: { ...inst.nodes[masterId]!, paddingTop: 24 } },
      inst.childOrder,
      masterId,
      ["paddingTop"],
    );
    assert.ok(result.relayoutKeys.has(inst.newRootId));
    assert.equal(result.nodes[inst.newRootId]!.paddingTop, 24);
  });
});
