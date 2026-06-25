import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { markNodeAsComponent } from "@/lib/componentModel";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import {
  createBooleanProperty,
  createTextProperty,
  createInstanceSwapProperty,
} from "@/lib/components/properties";
import { detachInstanceTree } from "@/lib/componentModel";
import { recordInstanceOverrideForNode } from "@/lib/components/propagate";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";

function frame(id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: partial.name ?? id,
    x: 0,
    y: 0,
    width: 120,
    height: 48,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#0066ff",
    fillEnabled: true,
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

function iconMaster(id: string) {
  let nodes: Record<string, EditorNode> = {
    [id]: frame(id, { name: "Icon/Search", width: 24, height: 24 }),
  };
  const childOrder = { [ROOT]: [id] };
  nodes = markNodeAsComponent(nodes, childOrder, id);
  return { nodes, childOrder, masterId: id };
}

function buttonMaster() {
  const masterId = "btn";
  const labelId = "lbl";
  const iconInstId = "icon-inst";
  const icon = iconMaster("icon-search");
  let nodes: Record<string, EditorNode> = {
    ...icon.nodes,
    [masterId]: frame(masterId, { name: "Button/Primary" }),
    [labelId]: text(labelId, masterId, "Continue"),
    [iconInstId]: frame(iconInstId, {
      parentId: masterId,
      name: "Icon",
      width: 24,
      height: 24,
      sourceComponentId: "icon-search",
      componentId: icon.nodes["icon-search"]!.componentId,
    }),
  };
  const childOrder: Record<string, string[]> = {
    ...icon.childOrder,
    [ROOT]: [...icon.childOrder[ROOT]!, masterId],
    [masterId]: [labelId, iconInstId],
  };
  nodes = markNodeAsComponent(nodes, childOrder, masterId);
  return { masterId, labelId, iconInstId, nodes, childOrder };
}

describe("component UX flows (store)", () => {
  it("create component from selection via store", () => {
    const labelId = "t1";
    const frameId = "f1";
    useEditorStore.setState({
      nodes: {
        [frameId]: frame(frameId),
        [labelId]: text(labelId, frameId, "Hello"),
      },
      childOrder: { [ROOT]: [frameId], [frameId]: [labelId] },
      selectedIds: [frameId, labelId],
    });
    useEditorStore.getState().createComponentFromSelection();
    const st = useEditorStore.getState();
    const master = st.nodes[st.selectedIds[0]!]!;
    assert.equal(master.isComponent, true);
    assert.equal(st.leftTab, "components");
  });

  it("create instance and switch variant", () => {
    const { masterId, nodes, childOrder } = buttonMaster();
    useEditorStore.setState({ nodes, childOrder, selectedIds: [] });
    useEditorStore.getState().createInstance(masterId, 200, 100);
    const st = useEditorStore.getState();
    const instId = st.selectedIds[0]!;
    assert.ok(st.nodes[instId]?.sourceComponentId);

    useEditorStore.getState().combineAsVariants();
    // need 2 masters selected - skip combine here

    useEditorStore.getState().updateInstanceOverride(instId, Object.keys(st.nodes[instId]!.instanceStableIdMap ?? {}).find(
      (cid) => st.nodes[cid]?.type === "text",
    )!, { content: "Submit" });
    const after = useEditorStore.getState();
    const labelNodeId = Object.entries(after.nodes[instId]!.instanceStableIdMap ?? {}).find(
      ([cid]) => after.nodes[cid]?.type === "text",
    )?.[0];
    assert.ok(labelNodeId);
    assert.equal(after.nodes[labelNodeId!]?.content, "Submit");
    useEditorStore.getState().resetInstanceOverrides(instId);
    const reset = useEditorStore.getState();
    assert.notEqual(reset.nodes[labelNodeId!]?.content, "Submit");
  });

  it("combine as variants, expose properties, detach instance", () => {
    const a = frame("va", { name: "Chip/Default", x: 0 });
    const b = frame("vb", { name: "Chip/Large", x: 140 });
    let nodes: Record<string, EditorNode> = { va: a, vb: b };
    const childOrder = { [ROOT]: ["va", "vb"] };
    nodes = markNodeAsComponent(nodes, childOrder, "va");
    nodes = markNodeAsComponent(nodes, childOrder, "vb");
    useEditorStore.setState({ nodes, childOrder, selectedIds: ["va", "vb"] });
    useEditorStore.getState().combineAsVariants();
    const combined = useEditorStore.getState();
    assert.ok(combined.nodes.va!.variantGroupId);
    assert.equal(combined.nodes.va!.variantGroupId, combined.nodes.vb!.variantGroupId);

    const { masterId, labelId, nodes: btnNodes, childOrder: btnOrder } = buttonMaster();
    const labelStable = btnNodes[masterId]!.componentLayerStableIds![labelId]!;
    useEditorStore.setState({ nodes: btnNodes, childOrder: btnOrder, selectedIds: [masterId] });
    useEditorStore.getState().addComponentProperty(masterId, createTextProperty("label", "Label", labelStable, ""));
    useEditorStore.getState().addComponentProperty(
      masterId,
      createBooleanProperty("showIcon", "Show icon", labelStable, true),
    );
    useEditorStore.getState().createInstance(masterId, 0, 0);
    const instId = useEditorStore.getState().selectedIds[0]!;
    useEditorStore.getState().setComponentPropertyValue(instId, "label", "Go");
    assert.equal(useEditorStore.getState().nodes[instId]?.componentPropertyValues?.label, "Go");

    useEditorStore.getState().detachInstance(instId);
    const detached = useEditorStore.getState().nodes[instId];
    assert.equal(detached?.sourceComponentId, undefined);
  });

  it("create instance from component set via store", () => {
    const a = frame("va", { name: "Chip/Default", x: 0, width: 80, height: 32 });
    const b = frame("vb", { name: "Chip/Large", x: 140, width: 120, height: 40 });
    const rectA = {
      id: "ra",
      parentId: "va",
      type: "rectangle" as const,
      name: "bg",
      x: 0,
      y: 0,
      width: 80,
      height: 32,
      visible: true,
      locked: false,
      fill: "#333",
      fillEnabled: true,
    };
    const rectB = {
      id: "rb",
      parentId: "vb",
      type: "rectangle" as const,
      name: "bg",
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      visible: true,
      locked: false,
      fill: "#666",
      fillEnabled: true,
    };
    let nodes: Record<string, EditorNode> = { va: a, vb: b, ra: rectA, rb: rectB };
    const childOrder = { [ROOT]: ["va", "vb"], va: ["ra"], vb: ["rb"] };
    nodes = markNodeAsComponent(nodes, childOrder, "va");
    nodes = markNodeAsComponent(nodes, childOrder, "vb");
    useEditorStore.setState({ nodes, childOrder, selectedIds: ["va", "vb"] });
    useEditorStore.getState().combineAsVariants();
    const combined = useEditorStore.getState();
    useEditorStore.getState().createInstance("va", 400, 400);
    const st = useEditorStore.getState();
    const instId = st.selectedIds[0]!;
    const inst = st.nodes[instId]!;
    assert.ok(inst.sourceComponentId);
    assert.equal(inst.parentId ?? null, null, "canvas instance must not parent into component set");
    assert.equal((st.childOrder[instId] ?? []).length, 1);
    assert.equal(st.nodes[st.childOrder[instId]![0]!]?.type, "rectangle");
  });

  it("swap instance component", () => {
    const { masterId, nodes, childOrder } = buttonMaster();
    const alt = iconMaster("alt-icon");
    const allNodes = { ...nodes, ...alt.nodes };
    const allOrder = {
      ...childOrder,
      [ROOT]: [...childOrder[ROOT]!, ...alt.childOrder[ROOT]!],
    };
    useEditorStore.setState({ nodes: allNodes, childOrder: allOrder, selectedIds: [] });
    useEditorStore.getState().createInstance(masterId, 0, 0);
    const instId = useEditorStore.getState().selectedIds[0]!;
    useEditorStore.getState().swapInstanceComponent(instId, "alt-icon");
    const swappedId = useEditorStore.getState().selectedIds[0]!;
    const swapped = useEditorStore.getState().nodes[swappedId];
    assert.equal(swapped?.sourceComponentId, "alt-icon");
  });
});
