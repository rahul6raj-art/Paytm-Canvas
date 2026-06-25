import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  markNodeAsComponent,
  mergeInstanceOverrides,
  detachInstanceTree,
  listComponentMasters,
} from "@/lib/componentModel";
import {
  buildInstanceFromMaster,
  buildResetInstanceOverridesResult,
  buildSetInstanceVariantResult,
  buildSwapInstanceComponentResult,
} from "@/lib/components/componentActions";
import {
  buildComponentFolderTree,
  componentDisplayName,
  flattenFolderTree,
} from "@/lib/components/folders";
import {
  applyComponentPropertyDefs,
  resolveInstanceSubtree,
} from "@/lib/components/resolveInstance";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import { commitMasterLayerMutation } from "@/lib/components/componentPropagation";
import {
  createBooleanProperty,
  createTextProperty,
} from "@/lib/components/properties";
import { buildComponentDebugInfo } from "@/lib/components/debug";

function frame(
  id: string,
  partial: Partial<EditorNode> & { name?: string } = {},
): EditorNode {
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
    [masterId]: frame(masterId, { name: "Button/Primary", fill: "#0066ff", fillEnabled: true }),
    [labelId]: text(labelId, masterId, "Click me"),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [masterId],
    [masterId]: [labelId],
  };
  nodes = markNodeAsComponent(nodes, childOrder, masterId);
  return { masterId, labelId, nodes, childOrder };
}

describe("component system core", () => {
  it("creates component with stable layer ids", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const master = nodes[masterId]!;
    assert.equal(master.isComponent, true);
    assert.ok(master.componentLayerStableIds?.[masterId]);
    assert.ok(master.componentLayerStableIds?.[labelId]);
    assert.equal(listComponentMasters(nodes).length, 1);
    void childOrder;
  });

  it("inserts linked instance with stable id map", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 200, 100);
    assert.ok(inst);
    const root = inst!.nodes[inst!.newRootId]!;
    assert.equal(root.sourceComponentId, masterId);
    assert.equal(root.componentId, nodes[masterId]!.componentId);
    assert.notEqual(root.id, masterId);
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId];
    const instanceLabelId = Object.entries(root.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0];
    assert.ok(instanceLabelId);
  });

  it("main component update propagates to instance layers", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    let allNodes = inst.nodes;
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(
      allNodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;

    allNodes = {
      ...allNodes,
      [labelId]: { ...allNodes[labelId]!, content: "Updated label" },
    };
    allNodes = commitMasterLayerMutation(allNodes, inst.childOrder, labelId, ["content"]).nodes;
    assert.equal(allNodes[instanceLabelId]!.content, "Updated label");
  });

  it("detach preserves overridden visual result", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    let allNodes = inst.nodes;
    const root = allNodes[inst.newRootId]!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(root.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0]!;

    allNodes = {
      ...allNodes,
      [inst.newRootId]: {
        ...root,
        instanceOverridesByStableId: {
          [labelStable]: { content: "Override text", fill: "#ff0000" },
        },
      },
    };
    const detached = detachInstanceTree(allNodes, inst.childOrder, inst.newRootId);
    assert.ok(detached);
    assert.equal(detached![instanceLabelId]!.content, "Override text");
    assert.equal(detached![inst.newRootId]!.sourceComponentId, undefined);
    assert.equal(detached![inst.newRootId]!.instanceDetached, true);
  });
});

describe("component overrides", () => {
  it("merges stable-id text and fill overrides", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const root = inst.nodes[inst.newRootId]!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    const instanceLabelId = Object.entries(root.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === labelStable,
    )?.[0]!;

    const withOverrides = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...root,
        instanceOverridesByStableId: {
          [labelStable]: { content: "Custom", visible: false },
        },
      },
    };
    const merged = mergeInstanceOverrides(withOverrides[instanceLabelId]!, withOverrides);
    assert.equal(merged.content, "Custom");
    assert.equal(merged.visible, false);
  });

  it("resets single override, layer overrides, and all overrides", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    const root = {
      ...inst.nodes[inst.newRootId]!,
      instanceOverridesByStableId: {
        [labelStable]: { content: "A", fill: "#111111" },
      },
    };

    const resetOne = buildResetInstanceOverridesResult(
      { ...inst.nodes, [inst.newRootId]: root },
      inst.newRootId,
      labelStable,
      "fill",
    );
    const mapOne = readInstanceOverrideMap(resetOne![inst.newRootId]!);
    assert.equal(mapOne[labelStable]?.content, "A");
    assert.equal(mapOne[labelStable]?.fill, undefined);

    const resetLayer = buildResetInstanceOverridesResult(
      { ...inst.nodes, [inst.newRootId]: root },
      inst.newRootId,
      labelStable,
    );
    assert.equal(Object.keys(readInstanceOverrideMap(resetLayer![inst.newRootId]!)).length, 0);

    const resetAll = buildResetInstanceOverridesResult(
      { ...inst.nodes, [inst.newRootId]: root },
      inst.newRootId,
    );
    assert.deepEqual(readInstanceOverrideMap(resetAll![inst.newRootId]!), {});
  });

  it("override survives main component update when path is overridden", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    let allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Instance copy" } },
      },
    };
    allNodes = {
      ...allNodes,
      [labelId]: { ...allNodes[labelId]!, content: "Master copy" },
    };
    allNodes = commitMasterLayerMutation(allNodes, inst.childOrder, labelId, ["content"]).nodes;
    const instanceLabelId = Object.entries(
      allNodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;
    assert.equal(mergeInstanceOverrides(allNodes[instanceLabelId]!, allNodes).content, "Instance copy");
  });
});

describe("component swap and variants", () => {
  it("swaps component and preserves compatible overrides", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const altMasterId = "master-alt";
    const altLabelId = "alt-label";
    let allNodes = {
      ...nodes,
      [altMasterId]: frame(altMasterId, { name: "Button/Secondary", fill: "#333333" }),
      [altLabelId]: text(altLabelId, altMasterId, "Alt"),
    };
    allNodes = markNodeAsComponent(allNodes, { ...childOrder, [altMasterId]: [altLabelId], [ROOT]: [masterId, altMasterId] }, altMasterId);
    const order = { ...childOrder, [ROOT]: [masterId, altMasterId], [altMasterId]: [altLabelId] };

    const inst = buildInstanceFromMaster(allNodes, order, masterId, null, 0, 0)!;
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Keep me" } },
      },
    };

    const altStable = allNodes[altMasterId]!.componentLayerStableIds![altLabelId]!;
    allNodes = {
      ...allNodes,
      [altMasterId]: {
        ...allNodes[altMasterId]!,
        componentLayerStableIds: {
          ...allNodes[altMasterId]!.componentLayerStableIds,
          [altLabelId]: labelStable,
        },
      },
    };
    void altStable;

    const swapped = buildSwapInstanceComponentResult(allNodes, inst.childOrder, inst.newRootId, altMasterId);
    assert.ok(swapped);
    const preserved = readInstanceOverrideMap(swapped!.nodes[swapped!.newRootId]!);
    assert.equal(preserved[labelStable]?.content, "Keep me");
  });

  it("switches variant and preserves compatible overrides", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const vg = nodes[masterId]!.variantGroupId!;
    const hoverId = "master-hover";
    const hoverLabelId = "hover-label";
    let allNodes = {
      ...nodes,
      [hoverId]: {
        ...frame(hoverId, { name: "Button/Primary · variant", variantGroupId: vg, variantProperties: { Variant: "Hover" } }),
      },
      [hoverLabelId]: text(hoverLabelId, hoverId, "Hover"),
    };
    allNodes = markNodeAsComponent(allNodes, { ...childOrder, [hoverId]: [hoverLabelId], [ROOT]: [masterId, hoverId] }, hoverId);
    const order = { ...childOrder, [ROOT]: [masterId, hoverId], [hoverId]: [hoverLabelId] };
    allNodes = {
      ...allNodes,
      [hoverId]: {
        ...allNodes[hoverId]!,
        componentLayerStableIds: {
          ...allNodes[masterId]!.componentLayerStableIds,
          [hoverId]: allNodes[masterId]!.componentLayerStableIds![masterId]!,
          [hoverLabelId]: allNodes[masterId]!.componentLayerStableIds![labelId]!,
        },
      },
    };

    const inst = buildInstanceFromMaster(allNodes, order, masterId, null, 0, 0)!;
    const labelStable = allNodes[masterId]!.componentLayerStableIds![labelId]!;
    allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        variantGroupId: vg,
        instanceOverridesByStableId: { [labelStable]: { content: "Stable override" } },
      },
    };

    const switched = buildSetInstanceVariantResult(allNodes, inst.childOrder, inst.newRootId, {
      Variant: "Hover",
    });
    assert.ok(switched);
    const preserved = readInstanceOverrideMap(switched!.nodes[switched!.newRootId]!);
    assert.equal(preserved[labelStable]?.content, "Stable override");
  });
});

describe("component properties", () => {
  it("boolean and text properties write stable overrides", () => {
    const { masterId, labelId, nodes: baseNodes, childOrder } = buildButtonMaster();
    const labelStable = baseNodes[masterId]!.componentLayerStableIds![labelId]!;
    const defs = [
      createBooleanProperty("showLabel", "Show label", labelStable, true),
      createTextProperty("label", "Label", labelStable, "Click me"),
    ];
    const nodes = {
      ...baseNodes,
      [masterId]: { ...baseNodes[masterId]!, componentPropertyDefs: defs },
    };
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const root = inst.nodes[inst.newRootId]!;
    const overrideMap = applyComponentPropertyDefs(
      root,
      { showLabel: false, label: "Buy now" },
      defs,
    );
    assert.equal(overrideMap[labelStable]?.visible, false);
    assert.equal(overrideMap[labelStable]?.content, "Buy now");
  });
});

describe("assets folder hierarchy", () => {
  it("builds slash naming folders and search-friendly display names", () => {
    const masters = [
      frame("a", { name: "Button/Primary", isComponent: true, componentId: "c1" }),
      frame("b", { name: "Button/Secondary", isComponent: true, componentId: "c2" }),
      frame("c", { name: "Card", isComponent: true, componentId: "c3" }),
    ];
    const tree = buildComponentFolderTree(masters);
    assert.equal(tree.children.length, 1);
    assert.equal(tree.children[0]!.name, "Button");
    assert.equal(tree.children[0]!.components.length, 2);
    assert.equal(tree.components.length, 1);
    assert.equal(flattenFolderTree(tree).length, 3);
    assert.equal(componentDisplayName("Button/Primary"), "Primary");
  });
});

describe("instance resolution", () => {
  it("resolves instance subtree with overrides applied", () => {
    const { masterId, labelId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const labelStable = nodes[masterId]!.componentLayerStableIds![labelId]!;
    const allNodes = {
      ...inst.nodes,
      [inst.newRootId]: {
        ...inst.nodes[inst.newRootId]!,
        instanceOverridesByStableId: { [labelStable]: { content: "Resolved" } },
      },
    };
    const resolved = resolveInstanceSubtree(allNodes, inst.childOrder, inst.newRootId);
    const instanceLabelId = Object.entries(
      allNodes[inst.newRootId]!.instanceStableIdMap ?? {},
    ).find(([, sid]) => sid === labelStable)?.[0]!;
    assert.equal(resolved.nodes[instanceLabelId]!.content, "Resolved");
    assert.ok(resolved.appliedOverrideCount >= 1);
  });

  it("debug info exposes override and match metadata", () => {
    const { masterId, nodes, childOrder } = buildButtonMaster();
    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 0, 0)!;
    const debug = buildComponentDebugInfo(inst.nodes, inst.childOrder, inst.newRootId);
    assert.ok(debug);
    assert.equal(debug!.masterNodeId, masterId);
    assert.equal(debug!.resolvedTreeSource, "master+overrides");
    assert.ok(debug!.matchedLayers.length >= 2);
  });
});
