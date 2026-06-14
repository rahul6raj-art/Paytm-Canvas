import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { ImportCtx } from "@/lib/figImport/figImportTypes";
import {
  hydrateSymbolMasterSync,
  importFigInstanceFromMaster,
  removeImportedNode,
} from "@/lib/figImport/figInstanceImport";
import type { EditorNode } from "@/stores/useEditorStore";
import type { FigDocument, FigNode } from "openfig-core";

const ROOT = EDITOR_ROOT_KEY;

function emptyFigDoc(): FigDocument {
  return {
    nodeMap: new Map<string, FigNode>(),
    childrenMap: new Map<string, FigNode[]>(),
  } as FigDocument;
}

function makeCtx(): ImportCtx {
  return {
    nodes: {},
    childOrder: { [ROOT]: [] },
    assets: {},
    idMap: new Map(),
    variableColors: new Map(),
    vectorPathsCache: new Map(),
    componentMasters: new Map(),
    tokensByVariableKey: new Map(),
    styleKeyToTokenId: new Map(),
    hydratedSymbols: new Set(),
    importNodesProcessed: 0,
    seq: 0,
  };
}

function frame(id: string, parentId: string | null, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
    ...extra,
  };
}

describe("fig instance import", () => {
  it("clones hydrated master subtree onto canvas with sourceComponentId", () => {
    const ctx = makeCtx();
    const masterId = "fig-master";
    const symId = "1:99";
    ctx.componentMasters.set(symId, masterId);
    ctx.nodes[masterId] = frame(masterId, null, {
      isComponent: true,
      componentId: "cmp-master",
      name: "Button",
    });
    ctx.childOrder[masterId] = ["fig-text-child"];
    ctx.nodes["fig-text-child"] = {
      id: "fig-text-child",
      parentId: masterId,
      type: "text",
      name: "Label",
      x: 8,
      y: 12,
      width: 40,
      height: 16,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: false,
      fillEnabled: true,
      fill: "#111111",
      text: "Click me",
      fontSize: 14,
    };

    const placeholderId = "fig-instance-shell";
    const placement = frame(placeholderId, null, {
      name: "Button instance",
      x: 200,
      y: 40,
      width: 100,
      height: 50,
    });
    ctx.nodes[placeholderId] = placement;
    ctx.childOrder[ROOT] = [placeholderId];

    removeImportedNode(ctx, placeholderId, null);

    const doc = emptyFigDoc();
    const instanceRootId = importFigInstanceFromMaster(ctx, {
      masterId,
      paytmParentId: null,
      placement,
      overrides: {},
      figInstanceKey: "2:10",
      doc,
      isImportable: () => true,
    });

    assert.ok(instanceRootId);
    assert.notEqual(instanceRootId, masterId);
    const instanceRoot = ctx.nodes[instanceRootId!]!;
    assert.equal(instanceRoot.sourceComponentId, masterId);
    assert.equal(instanceRoot.x, 200);
    assert.equal(instanceRoot.y, 40);
    const instanceKids = ctx.childOrder[instanceRootId!] ?? [];
    assert.equal(instanceKids.length, 1);
    const clonedText = ctx.nodes[instanceKids[0]!]!;
    assert.equal(clonedText.type, "text");
    assert.equal(clonedText.text, "Click me");
    assert.equal(clonedText.parentId, instanceRootId);
    assert.ok(ctx.childOrder[ROOT]?.includes(instanceRootId!));
    assert.equal(ctx.childOrder[masterId]?.length, 1);
  });

  it("hydrates symbol master children once via walk callback", () => {
    const ctx = makeCtx();
    const symId = "3:1";
    const masterId = "fig-sym";
    ctx.componentMasters.set(symId, masterId);
    ctx.nodes[masterId] = frame(masterId, null, { isComponent: true, componentId: "cmp-1" });
    ctx.childOrder[masterId] = [];

    const doc = emptyFigDoc();
    doc.nodeMap.set(symId, { type: "SYMBOL", name: "Icon", phase: "CREATED" } as FigNode);

    let walked = false;
    hydrateSymbolMasterSync(
      symId,
      masterId,
      doc,
      ctx,
      (_figParent, paytmParent) => {
        walked = true;
        assert.equal(paytmParent, masterId);
        const childId = "fig-rect";
        ctx.nodes[childId] = {
          id: childId,
          parentId: masterId,
          type: "rectangle",
          name: "Dot",
          x: 0,
          y: 0,
          width: 8,
          height: 8,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: false,
          fillEnabled: true,
          fill: "#ff0000",
        };
        ctx.childOrder[masterId] = [childId];
      },
      () => true,
    );

    assert.equal(walked, true);
    assert.ok(ctx.hydratedSymbols.has(symId));
    assert.equal(ctx.childOrder[masterId]?.length, 1);
  });
});
