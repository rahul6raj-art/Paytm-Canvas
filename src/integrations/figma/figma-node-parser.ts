import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { applyDeepAutoLayoutAll } from "@/lib/autoLayout";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import type { EditorAsset, PaytmCraftDocument } from "@/lib/documentPersistence";
import { newPathPointId, normalizePathNode, type PathPoint } from "@/lib/pathGeometry";
import type { EditorNode, NodeKind } from "@/stores/useEditorStore";
import {
  applyFigmaComponentToNode,
  indexFigmaComponentNodes,
  type FigmaComponentIndexCtx,
} from "@/integrations/figma/figma-component-parser";
import { applyFigmaImageUrls } from "@/integrations/figma/figma-image-parser";
import { autoLayoutFromFigmaNode, constraintsFromFigma } from "@/integrations/figma/figma-layout-parser";
import {
  cornerRadiusFromFigmaNode,
  effectsFromApi,
  gradientFromPaints,
  imageRefFromPaints,
  solidFromPaints,
  strokeFromFigmaNode,
} from "@/integrations/figma/figma-style-parser";
import { applyFigmaTextToNode } from "@/integrations/figma/figma-text-parser";
import { figmaBoundingBox, figmaRelativeBox } from "@/integrations/figma/figma-transform-parser";
import type { FigmaApiImportResult, FigmaApiNode } from "@/integrations/figma/types";

const SKIP_TYPES = new Set([
  "DOCUMENT",
  "CANVAS",
  "SLICE",
  "CONNECTOR",
  "STICKY",
  "SHAPE_WITH_TEXT",
  "CODE_BLOCK",
  "WIDGET",
]);

const PASS_THROUGH = new Set(["SECTION"]);

export type FigmaNodeImportCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  imageRefs: Set<string>;
  figmaToEditor: Map<string, string>;
  componentMasters: Map<string, string>;
  seq: number;
};

function nextId(ctx: FigmaNodeImportCtx, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}-${ctx.seq}`;
}

function editorId(ctx: FigmaNodeImportCtx, figmaId: string): string {
  const hit = ctx.figmaToEditor.get(figmaId);
  if (hit) return hit;
  const id = `figma-${figmaId.replace(/:/g, "-")}`;
  ctx.figmaToEditor.set(figmaId, id);
  return id;
}

function mapNodeKind(node: FigmaApiNode): NodeKind | null {
  switch (node.type) {
    case "FRAME":
    case "COMPONENT":
    case "COMPONENT_SET":
    case "INSTANCE":
      return "frame";
    case "GROUP":
      return "group";
    case "RECTANGLE":
      return "rectangle";
    case "ELLIPSE":
      return "ellipse";
    case "LINE":
      return "line";
    case "TEXT":
      return "text";
    case "VECTOR":
    case "BOOLEAN_OPERATION":
    case "STAR":
    case "POLYGON":
      return "path";
    default:
      return null;
  }
}

function svgPathToPathPoints(svgPath: string): PathPoint[] {
  const tokens = svgPath.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens?.length) return [];
  const points: PathPoint[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const readNum = () => parseFloat(tokens[i++] ?? "0");
  while (i < tokens.length) {
    const cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    if (c === "M") {
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      cx = x;
      cy = y;
      startX = x;
      startY = y;
      points.push({ id: newPathPointId(), x, y });
    } else if (c === "L") {
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      cx = x;
      cy = y;
      points.push({ id: newPathPointId(), x, y });
    } else if (c === "Z") {
      cx = startX;
      cy = startY;
    }
  }
  return points;
}

function appendChild(ctx: FigmaNodeImportCtx, parentId: string | null, childId: string): void {
  const key = parentId ?? EDITOR_ROOT_KEY;
  const list = ctx.childOrder[key] ?? [];
  if (!list.includes(childId)) ctx.childOrder[key] = [...list, childId];
}

function walkChildren(
  node: FigmaApiNode,
  ctx: FigmaNodeImportCtx,
  parentId: string | null,
  parentBox: { x: number; y: number } | null,
): void {
  for (const child of node.children ?? []) {
    convertFigmaNode(child, ctx, parentId, parentBox);
  }
}

function convertFigmaNode(
  node: FigmaApiNode,
  ctx: FigmaNodeImportCtx,
  parentId: string | null,
  parentBox: { x: number; y: number } | null,
): EditorNode | null {
  if (node.visible === false) return null;
  if (SKIP_TYPES.has(node.type)) return null;
  if (PASS_THROUGH.has(node.type)) {
    walkChildren(node, ctx, parentId, parentBox);
    return null;
  }

  const kind = mapNodeKind(node);
  if (!kind) return null;

  const { x, y, w, h } = figmaRelativeBox(node, parentBox);
  const id = editorId(ctx, node.id);
  const solid = solidFromPaints(node.fills);
  const gradient = gradientFromPaints(node.fills);
  const imageRef = imageRefFromPaints(node.fills);

  const base: EditorNode = {
    id,
    parentId,
    type: kind,
    name: node.name || node.type,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: node.locked === true,
    expanded: true,
    fillEnabled: Boolean(solid.fill || gradient.fillType || imageRef),
    ...solid,
    ...gradient,
    ...strokeFromFigmaNode(node),
    ...autoLayoutFromFigmaNode(node),
    ...constraintsFromFigma(node),
    ...cornerRadiusFromFigmaNode(node),
    opacity: node.opacity,
    effects: effectsFromApi(node.effects as unknown[] | undefined),
    clipChildren: node.clipsContent !== false && (kind === "frame" || kind === "group"),
  };

  const componentCtx: FigmaComponentIndexCtx = {
    figmaToEditor: ctx.figmaToEditor,
    componentMasters: ctx.componentMasters,
    editorId: (fid) => editorId(ctx, fid),
  };
  applyFigmaComponentToNode(base, node, componentCtx);

  if (imageRef) {
    ctx.imageRefs.add(imageRef);
    base.type = "image";
    base.imageFitMode = "fill";
    base.assetId = `pending-${imageRef}`;
    base.imageSrc = "";
  }

  if (base.type === "text") {
    applyFigmaTextToNode(base, node);
  }

  if (base.type === "path") {
    const svg = node.fillGeometry?.[0]?.path ?? node.strokeGeometry?.[0]?.path;
    if (svg) {
      const pts = svgPathToPathPoints(svg);
      if (pts.length >= 2) {
        base.pathPoints = pts;
        base.pathClosed = /z/i.test(svg);
        const normalized = normalizePathNode(base);
        ctx.nodes[id] = normalized;
        appendChild(ctx, parentId, id);
        walkChildren(node, ctx, id, figmaBoundingBox(node));
        return normalized;
      }
    }
    base.type = "rectangle";
    delete base.pathPoints;
  }

  ctx.nodes[id] = base;
  appendChild(ctx, parentId, id);
  walkChildren(node, ctx, id, figmaBoundingBox(node));
  return base;
}

export function convertFigmaApiToPaytmCraft(
  root: FigmaApiNode,
  fileName: string,
  imageUrlByRef: Record<string, string> = {},
): FigmaApiImportResult {
  try {
    const ctx: FigmaNodeImportCtx = {
      nodes: {},
      childOrder: { [EDITOR_ROOT_KEY]: [] },
      assets: {},
      imageRefs: new Set(),
      figmaToEditor: new Map(),
      componentMasters: new Map(),
      seq: 0,
    };

    const componentCtx: FigmaComponentIndexCtx = {
      figmaToEditor: ctx.figmaToEditor,
      componentMasters: ctx.componentMasters,
      editorId: (fid) => editorId(ctx, fid),
    };
    indexFigmaComponentNodes(root, componentCtx);

    const rootBox = figmaBoundingBox(root);
    const converted = convertFigmaNode(root, ctx, null, null);
    if (!converted && (ctx.childOrder[EDITOR_ROOT_KEY]?.length ?? 0) === 0) {
      walkChildren(root, ctx, null, rootBox);
    }

    applyFigmaImageUrls(ctx.nodes, ctx.assets, imageUrlByRef);

    applyDeepAutoLayoutAll(
      ctx.nodes as Record<string, import("@/lib/autoLayout").LayoutNode>,
      ctx.childOrder,
    );

    const doc: PaytmCraftDocument = {
      version: 1,
      name: fileName,
      savedAt: new Date().toISOString(),
      nodes: ctx.nodes,
      childOrder: ctx.childOrder,
      assets: ctx.assets,
      designTokens: {},
      selectedIds: converted ? [converted.id] : (ctx.childOrder[EDITOR_ROOT_KEY]?.slice(0, 1) ?? []),
      canvas: {
        zoom: 0.5,
        panX: 48,
        panY: 32,
        showGrid: false,
        backgroundColor: DEFAULT_CANVAS_BACKGROUND,
      },
    };

    return { ok: true, document: doc };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Figma API import failed.",
    };
  }
}
