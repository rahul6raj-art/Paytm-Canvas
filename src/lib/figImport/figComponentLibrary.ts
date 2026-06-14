import { nodeId, type FigDocument, type FigNode } from "openfig-core";
import { newComponentId } from "@/lib/componentModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { sortedFigChildren } from "@/lib/figImport/figNodeGeometry";
import type { ImportCtx } from "@/lib/figImport/figImportTypes";

const LIBRARY_FRAME_X = -32000;
const LIBRARY_FRAME_Y = 0;

function guidKey(guid?: { sessionID?: number; localID?: number }): string | null {
  if (guid?.sessionID == null || guid?.localID == null) return null;
  return `${guid.sessionID}:${guid.localID}`;
}

function isComponentDefinition(node: FigNode): boolean {
  return (
    node.type === "SYMBOL" ||
    node.type === "COMPONENT" ||
    (node.type === "FRAME" && Boolean((node as FigNode & { isPublishable?: boolean }).isPublishable))
  );
}

function internalCanvas(fig: FigDocument): FigNode | undefined {
  return fig.nodes.find(
    (n) => n.type === "CANVAS" && n.phase !== "REMOVED" && /internal only/i.test(n.name),
  );
}

type LibraryWalk = {
  walkFigTree: (
    figParentId: string,
    paytmParentId: string | null,
    doc: FigDocument,
    ctx: ImportCtx,
    instanceForOverrides?: FigNode | null,
  ) => void;
  convertFigNode: (
    node: FigNode,
    doc: FigDocument,
    ctx: ImportCtx,
    paytmParentId: string | null,
    instanceForOverrides?: FigNode | null,
  ) => import("@/stores/useEditorStore").EditorNode | null;
  nextId: (ctx: ImportCtx, prefix: string) => string;
  appendChild: (ctx: ImportCtx, parentKey: string, childId: string) => void;
  finalizeContainer?: (
    figKey: string,
    paytmParentId: string,
    doc: FigDocument,
    ctx: ImportCtx,
  ) => void;
};

/**
 * Import SYMBOL/COMPONENT masters from Figma's internal library canvas into a hidden
 * off-canvas frame so the Components panel and instance linking work after .fig import.
 */
export function importFigmaComponentLibrary(
  fig: FigDocument,
  ctx: ImportCtx,
  walk: LibraryWalk,
): void {
  const canvas = internalCanvas(fig);
  if (!canvas) return;

  const canvasKey = nodeId(canvas);
  if (!canvasKey) return;

  const containerId = walk.nextId(ctx, "fig-lib");
  ctx.nodes[containerId] = {
    id: containerId,
    parentId: null,
    type: "frame",
    name: "— Figma components —",
    x: LIBRARY_FRAME_X,
    y: LIBRARY_FRAME_Y,
    width: 1,
    height: 1,
    rotation: 0,
    visible: false,
    locked: true,
    expanded: false,
    fillEnabled: false,
    clipChildren: true,
  };
  /** Keep masters off the visible canvas — only in this internal subtree for instance linking. */
  ctx.childOrder[containerId] = [];

  const visitMaster = (node: FigNode, parentPaytmId: string) => {
    if (!isComponentDefinition(node) || node.phase === "REMOVED") return;
    const key = nodeId(node);
    if (!key) return;

    const masterId = ctx.idMap.get(key) ?? `fig-${key.replace(/:/g, "-")}`;
    ctx.idMap.set(key, masterId);
    ctx.componentMasters.set(key, masterId);

    const converted = walk.convertFigNode(node, fig, ctx, parentPaytmId);
    if (!converted) return;

    const cmpId = newComponentId();
    const master: typeof converted = {
      ...converted,
      id: masterId,
      isComponent: true,
      componentId: cmpId,
    };
    ctx.nodes[masterId] = master;
    walk.walkFigTree(key, masterId, fig, ctx, null);
    walk.finalizeContainer?.(key, masterId, fig, ctx);
    ctx.hydratedSymbols.add(key);

    const variantProps = (node as FigNode & { variantProperties?: Record<string, string> }).variantProperties;
    if (variantProps && Object.keys(variantProps).length > 0) {
      ctx.nodes[masterId] = {
        ...ctx.nodes[masterId]!,
        variantProperties: { ...variantProps },
      };
    }
  };

  const collectMasters = (figParentId: string, paytmParentId: string) => {
    for (const child of sortedFigChildren(fig, figParentId)) {
      const childKey = nodeId(child);
      if (!childKey || child.phase === "REMOVED") continue;

      if (isComponentDefinition(child)) {
        visitMaster(child, paytmParentId);
        continue;
      }

      if (child.type === "FRAME" || child.type === "GROUP" || child.type === "COMPONENT_SET") {
        const converted = walk.convertFigNode(child, fig, ctx, paytmParentId);
        if (!converted) continue;
        collectMasters(childKey, converted.id);
      }
    }
  };

  collectMasters(canvasKey, containerId);
}

export function symbolRootKey(instance: FigNode): string | null {
  const symbolID = (instance as FigNode & { symbolData?: { symbolID?: { sessionID?: number; localID?: number } } })
    .symbolData?.symbolID;
  return guidKey(symbolID);
}
