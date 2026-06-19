import type { FigDocument, FigNode } from "openfig-core";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { cloneEditorSubtree, stripComponentFields } from "@/lib/componentModel";
import type { EditorNode } from "@/stores/useEditorStore";
import { finalizeFigContainer } from "@/lib/figImport/figMaskImport";
import type { ImportCtx } from "@/lib/figImport/figImportTypes";
import type { InstanceOverridePatch } from "@/lib/componentModel";

const ROOT = EDITOR_ROOT_KEY;

type WalkFigTree = (
  figParentId: string,
  paytmParentId: string | null,
  doc: FigDocument,
  ctx: ImportCtx,
  instanceForOverrides?: FigNode | null,
) => void;

/** Expand a symbol master subtree once into the library master (shared template). */
export function hydrateSymbolMasterSync(
  symId: string,
  masterId: string,
  doc: FigDocument,
  ctx: ImportCtx,
  walkFigTree: WalkFigTree,
  isImportable: (node: FigNode) => boolean,
  instanceForOverrides?: FigNode | null,
): void {
  if (ctx.hydratedSymbols.has(symId)) return;
  const symNode = doc.nodeMap.get(symId);
  if (!symNode || symNode.type === "INSTANCE") {
    ctx.hydratedSymbols.add(symId);
    return;
  }
  if ((ctx.childOrder[masterId] ?? []).length === 0) {
    walkFigTree(symId, masterId, doc, ctx, instanceForOverrides ?? null);
    finalizeFigContainer(symId, masterId, doc, ctx, isImportable);
  }
  ctx.hydratedSymbols.add(symId);
}

/** Place an instance by cloning the hydrated component master and applying overrides. */
export function importFigInstanceFromMaster(
  ctx: ImportCtx,
  opts: {
    masterId: string;
    paytmParentId: string | null;
    placement: EditorNode;
    overrides: Record<string, InstanceOverridePatch>;
    figInstanceKey: string;
    doc: FigDocument;
    isImportable: (node: FigNode) => boolean;
  },
): string | null {
  const parentKey = opts.paytmParentId ?? ROOT;
  const cloneResult = cloneEditorSubtree(
    ctx.nodes,
    ctx.childOrder,
    opts.masterId,
    opts.paytmParentId,
    parentKey,
    (root, idMap) => {
      const remapped: Record<string, InstanceOverridePatch> = {};
      for (const [oldId, patch] of Object.entries(opts.overrides)) {
        const mapped = idMap.get(oldId) ?? oldId;
        remapped[mapped] = patch;
      }
      return {
        ...root,
        x: opts.placement.x,
        y: opts.placement.y,
        width: opts.placement.width,
        height: opts.placement.height,
        rotation: opts.placement.rotation,
        ...(opts.placement.flipHorizontal ? { flipHorizontal: opts.placement.flipHorizontal } : {}),
        ...(opts.placement.flipVertical ? { flipVertical: opts.placement.flipVertical } : {}),
        name: opts.placement.name,
        visible: opts.placement.visible,
        locked: opts.placement.locked,
        opacity: opts.placement.opacity,
        effects: opts.placement.effects,
        sourceComponentId: opts.masterId,
        instanceOverrides: Object.keys(remapped).length > 0 ? remapped : undefined,
        isComponent: undefined,
        componentId: undefined,
        variantGroupId: undefined,
        variantProperties: undefined,
      };
    },
    (_old, fresh) => stripComponentFields(fresh),
  );
  if (!cloneResult) return null;
  ctx.nodes = cloneResult.nodes;
  ctx.childOrder = cloneResult.childOrder;
  finalizeFigContainer(
    opts.figInstanceKey,
    cloneResult.newRootId,
    opts.doc,
    ctx,
    opts.isImportable,
  );
  return cloneResult.newRootId;
}

export function removeImportedNode(
  ctx: ImportCtx,
  nodeId: string,
  parentId: string | null,
): void {
  const parentKey = parentId ?? ROOT;
  ctx.childOrder[parentKey] = (ctx.childOrder[parentKey] ?? []).filter((id) => id !== nodeId);
  delete ctx.nodes[nodeId];
}
