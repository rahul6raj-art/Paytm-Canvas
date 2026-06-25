import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { markNodeAsComponent } from "@/lib/componentModel";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import {
  buildSlotPropertyForContainer,
  buildSlotTextContentSnapshot,
  findSlotContainerInInstance,
  slotTargetPath,
} from "@/lib/components/componentSlots";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";
import { pickDeepestVisibleNodeAtWorldPoint, worldRect } from "@/lib/tree";
import {
  buildSlotEditBreadcrumb,
  isDeletableDuringSlotEdit,
  isSlotShellLayer,
  resolveInstanceDropParentId,
  resolveSlotEditScope,
  slotDrillTargetForDoubleClick,
  slotSelectionTargetForClick,
} from "@/lib/slotEditScope";

function frame(id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: partial.parentId ?? null,
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
    width: 120,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fontSize: 14,
    fontFamily: "Inter",
  } as EditorNode;
}

function buildCardFixture() {
  const cardMasterId = "card-master";
  const headerSlotId = "header-slot";
  const bodySlotId = "body-slot";
  const bodyDefaultId = "body-default";

  let nodes: Record<string, EditorNode> = {
    [cardMasterId]: frame(cardMasterId, { name: "Card", width: 240, height: 120 }),
    [headerSlotId]: frame(headerSlotId, { name: "Header", height: 32, parentId: cardMasterId }),
    [bodySlotId]: frame(bodySlotId, { name: "Body", height: 48, parentId: cardMasterId }),
    [bodyDefaultId]: text(bodyDefaultId, bodySlotId, "Default Body"),
  };
  let childOrder: Record<string, string[]> = {
    [ROOT]: [cardMasterId],
    [cardMasterId]: [headerSlotId, bodySlotId],
    [bodySlotId]: [bodyDefaultId],
  };

  nodes = markNodeAsComponent(nodes, childOrder, cardMasterId);
  const bodyDef = buildSlotPropertyForContainer(nodes, childOrder, cardMasterId, bodySlotId, "Body")!;
  nodes = {
    ...nodes,
    [cardMasterId]: {
      ...nodes[cardMasterId]!,
      componentPropertyDefs: [bodyDef],
    },
  };

  const inst = buildInstanceFromMaster(nodes, childOrder, cardMasterId, null, 100, 100)!;
  const resolved = resolveComponentInstance(inst.nodes, inst.childOrder, inst.newRootId, { force: true });
  const bodyContainerId = findSlotContainerInInstance(
    resolved.nodes,
    resolved.nodes[inst.newRootId]!,
    inst.newRootId,
    slotTargetPath(bodyDef),
  )!;

  return {
    nodes: resolved.nodes,
    childOrder: resolved.childOrder,
    instRootId: inst.newRootId,
    bodyDef,
    bodyContainerId,
    bodyDefaultId,
  };
}

describe("slot edit canvas scope", () => {
  it("double-click slot region resolves drill target", () => {
    const ctx = buildCardFixture();
    const bodyTextId = ctx.childOrder[ctx.bodyContainerId]?.[0];
    assert.ok(bodyTextId);
    const rect = worldRect(bodyTextId, ctx.nodes);
    const drill = slotDrillTargetForDoubleClick(
      bodyTextId,
      rect.x + 4,
      rect.y + 4,
      ctx.nodes,
      ctx.childOrder,
      null,
      (x, y) => pickDeepestVisibleNodeAtWorldPoint(x, y, ctx.nodes, ctx.childOrder),
    );
    assert.ok(drill);
    assert.equal(drill!.scope.propertyKey, ctx.bodyDef.key);
    assert.equal(drill!.scope.instanceRootId, ctx.instRootId);
  });

  it("enter and exit slot edit mode without changes does not push history", () => {
    const ctx = buildCardFixture();
    useEditorStore.setState({
      nodes: ctx.nodes,
      childOrder: ctx.childOrder,
      selectedIds: [],
      activeSlotEdit: null,
      objectEditModeNodeId: null,
      historyPast: [],
      historyFuture: [],
    });

    useEditorStore.getState().enterSlotEditMode(ctx.instRootId, ctx.bodyDef.key);
    assert.ok(useEditorStore.getState().activeSlotEdit);
    assert.equal(useEditorStore.getState().objectEditModeNodeId, ctx.bodyContainerId);

    useEditorStore.getState().exitSlotEditMode(true);
    assert.equal(useEditorStore.getState().activeSlotEdit, null);
    assert.equal(useEditorStore.getState().historyPast.length, 0);
  });

  it("exit slot edit saves changed slot content on exit", () => {
    const ctx = buildCardFixture();
    useEditorStore.setState({
      nodes: ctx.nodes,
      childOrder: ctx.childOrder,
      selectedIds: [],
      activeSlotEdit: null,
      objectEditModeNodeId: null,
      historyPast: [],
      historyFuture: [],
    });

    useEditorStore.getState().enterSlotEditMode(ctx.instRootId, ctx.bodyDef.key);
    const labelId = useEditorStore.getState().childOrder[ctx.bodyContainerId]?.[0];
    assert.ok(labelId);
    const nodes = useEditorStore.getState().nodes;
    useEditorStore.setState({
      nodes: {
        ...nodes,
        [labelId]: { ...nodes[labelId]!, content: "Edited in session" },
      },
    });

    useEditorStore.getState().exitSlotEditMode(true);
    assert.equal(useEditorStore.getState().activeSlotEdit, null);

    const after = useEditorStore.getState().nodes;
    const bodyContainer = findSlotContainerInInstance(
      after,
      after[ctx.instRootId]!,
      ctx.instRootId,
      slotTargetPath(ctx.bodyDef),
    )!;
    const savedLabelId = useEditorStore.getState().childOrder[bodyContainer]?.[0];
    assert.equal(after[savedLabelId!]?.content, "Edited in session");
  });

  it("shell layers are locked during slot edit selection", () => {
    const ctx = buildCardFixture();
    useEditorStore.setState({
      nodes: ctx.nodes,
      childOrder: ctx.childOrder,
      activeSlotEdit: {
        instanceRootId: ctx.instRootId,
        propertyKey: ctx.bodyDef.key,
        containerId: ctx.bodyContainerId,
        baselineSignature: "",
        breadcrumb: [],
      },
      objectEditModeNodeId: ctx.bodyContainerId,
    });
    const edit = useEditorStore.getState().activeSlotEdit!;
    const headerContainerId = ctx.childOrder[ctx.instRootId]?.[0];
    assert.ok(headerContainerId);
    assert.equal(isSlotShellLayer(ctx.nodes, edit, ctx.instRootId), true);
    assert.equal(isSlotShellLayer(ctx.nodes, edit, headerContainerId!), true);
    assert.equal(
      slotSelectionTargetForClick(
        headerContainerId!,
        ctx.nodes,
        ctx.childOrder,
        edit,
        ctx.bodyContainerId,
        false,
      ),
      ctx.bodyContainerId,
    );
  });

  it("shell layers cannot be deleted during slot edit", () => {
    const ctx = buildCardFixture();
    const edit = {
      instanceRootId: ctx.instRootId,
      propertyKey: ctx.bodyDef.key,
      containerId: ctx.bodyContainerId,
      baselineSignature: "",
      breadcrumb: [],
    };
    const headerId = ctx.childOrder[ctx.instRootId]?.[0];
    assert.ok(headerId);
    assert.equal(isDeletableDuringSlotEdit(ctx.nodes, edit, headerId!), false);
    const bodyChild = ctx.childOrder[ctx.bodyContainerId]?.[0];
    assert.ok(bodyChild);
    assert.equal(isDeletableDuringSlotEdit(ctx.nodes, edit, bodyChild!), true);
  });

  it("component drop targets slot container bounds", () => {
    const ctx = buildCardFixture();
    const rect = worldRect(ctx.bodyContainerId, ctx.nodes);
    const worldX = rect.x + rect.width / 2;
    const worldY = rect.y + rect.height / 2;
    const parent = resolveInstanceDropParentId(
      ctx.nodes,
      ctx.childOrder,
      null,
      worldX,
      worldY,
      (x, y) => pickDeepestVisibleNodeAtWorldPoint(x, y, ctx.nodes, ctx.childOrder),
    );
    assert.equal(parent, ctx.bodyContainerId);
  });

  it("nested slot breadcrumb accumulates on drill", () => {
    const ctx = buildCardFixture();
    const scope = resolveSlotEditScope(
      ctx.nodes,
      ctx.childOrder,
      ctx.instRootId,
      ctx.bodyDef.key,
    )!;
    const first = buildSlotEditBreadcrumb(ctx.nodes, scope, []);
    assert.equal(first.length, 1);
    assert.match(first[0]!.label, /Card/);
    assert.match(first[0]!.label, /Body/);

    const nestedScope = {
      ...scope,
      label: "Icon",
      propertyKey: "icon-slot",
      containerId: "nested-icon-slot",
    };
    const nested = buildSlotEditBreadcrumb(ctx.nodes, nestedScope, first);
    assert.equal(nested.length, 2);
    assert.match(nested[1]!.label, /Icon/);
  });
});
