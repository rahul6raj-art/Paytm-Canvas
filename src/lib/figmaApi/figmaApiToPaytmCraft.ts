import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { applyDeepAutoLayoutAll } from "@/lib/autoLayout";
import { newComponentId } from "@/lib/componentModel";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import type { EditorAsset, PaytmCraftDocument } from "@/lib/documentPersistence";
import type { EditorNode, NodeKind } from "@/stores/useEditorStore";
import { newPathPointId, normalizePathNode, type PathPoint } from "@/lib/pathGeometry";
import type { FigmaApiNode } from "@/lib/figmaApi/figmaApiTypes";
import {
  effectsFromApi,
  gradientFromPaints,
  imageRefFromPaints,
  solidFromPaints,
} from "@/lib/figmaApi/figmaPaintUtils";
import { autoLayoutFromFigmaNode, constraintsFromFigma } from "@/lib/figmaApi/figmaLayoutUtils";

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

type ImportCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  imageRefs: Set<string>;
  figmaToEditor: Map<string, string>;
  componentMasters: Map<string, string>;
  seq: number;
};

export type FigmaApiImportResult =
  | { ok: true; document: PaytmCraftDocument }
  | { ok: false; error: string };

function nextId(ctx: ImportCtx, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}-${ctx.seq}`;
}

function editorId(ctx: ImportCtx, figmaId: string): string {
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

function bbox(node: FigmaApiNode): { x: number; y: number; w: number; h: number } {
  const b = node.absoluteBoundingBox;
  return {
    x: b?.x ?? 0,
    y: b?.y ?? 0,
    w: Math.max(1, b?.width ?? 1),
    h: Math.max(1, b?.height ?? 1),
  };
}

function relativeBox(
  node: FigmaApiNode,
  parentBox: { x: number; y: number } | null,
): { x: number; y: number; w: number; h: number } {
  const b = bbox(node);
  if (!parentBox) return { x: 0, y: 0, w: b.w, h: b.h };
  return { x: b.x - parentBox.x, y: b.y - parentBox.y, w: b.w, h: b.h };
}

function cornerRadius(node: FigmaApiNode): number | undefined {
  if (node.cornerRadius != null) return node.cornerRadius;
  const r = node.rectangleCornerRadii;
  if (r?.length) return Math.max(...r);
  return undefined;
}

function strokeFromNode(node: FigmaApiNode): Partial<EditorNode> {
  const solid = solidFromPaints(node.strokes);
  const weight = node.strokeWeight ?? 0;
  if (!solid.fill && weight <= 0) return {};
  return {
    strokeColor: solid.fill ?? "#000000",
    strokeWidth: weight,
  };
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

function convertNode(
  node: FigmaApiNode,
  ctx: ImportCtx,
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

  const { x, y, w, h } = relativeBox(node, parentBox);
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
    ...strokeFromNode(node),
    ...autoLayoutFromFigmaNode(node),
    ...constraintsFromFigma(node),
    cornerRadius: cornerRadius(node),
    opacity: node.opacity,
    effects: effectsFromApi(node.effects as unknown[] | undefined),
    clipChildren: node.clipsContent !== false && (kind === "frame" || kind === "group"),
  };

  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    const cmpId = newComponentId();
    base.isComponent = true;
    base.componentId = cmpId;
    ctx.componentMasters.set(node.id, id);
  }

  if (node.type === "INSTANCE" && node.componentId) {
    const master = ctx.componentMasters.get(node.componentId);
    if (master) base.sourceComponentId = master;
    else base.sourceComponentId = `figma-${node.componentId.replace(/:/g, "-")}`;
  }

  if (imageRef) {
    ctx.imageRefs.add(imageRef);
    base.type = "image";
    base.imageFitMode = "fill";
    base.assetId = `pending-${imageRef}`;
    base.imageSrc = "";
  }

  if (base.type === "text") {
    base.content = node.characters ?? "";
    const st = node.style;
    base.fontFamily = st?.fontFamily ? `"${st.fontFamily}", system-ui, sans-serif` : undefined;
    base.fontSize = st?.fontSize ?? 14;
    base.fontWeight = st?.fontWeight ?? 400;
    base.lineHeight = st?.lineHeightPx && st.fontSize ? st.lineHeightPx / st.fontSize : undefined;
    base.letterSpacing = st?.letterSpacing;
    base.textColor = solid.fill ?? "#111111";
    base.textAlign =
      st?.textAlignHorizontal === "CENTER"
        ? "center"
        : st?.textAlignHorizontal === "RIGHT"
          ? "right"
          : "left";
    base.textResizeMode =
      base.layoutSizingHorizontal === "hug" ? "auto-width" : "auto-height";
  }

  if (base.type === "path") {
    const svg =
      node.fillGeometry?.[0]?.path ?? node.strokeGeometry?.[0]?.path;
    if (svg) {
      const pts = svgPathToPathPoints(svg);
      if (pts.length >= 2) {
        base.pathPoints = pts;
        base.pathClosed = /z/i.test(svg);
        const normalized = normalizePathNode(base);
        ctx.nodes[id] = normalized;
        appendChild(ctx, parentId, id);
        walkChildren(node, ctx, id, bbox(node));
        return normalized;
      }
    }
    base.type = "rectangle";
    delete base.pathPoints;
  }

  ctx.nodes[id] = base;
  appendChild(ctx, parentId, id);
  walkChildren(node, ctx, id, bbox(node));
  return base;
}

function appendChild(ctx: ImportCtx, parentId: string | null, childId: string): void {
  const key = parentId ?? EDITOR_ROOT_KEY;
  const list = ctx.childOrder[key] ?? [];
  if (!list.includes(childId)) ctx.childOrder[key] = [...list, childId];
}

function walkChildren(
  node: FigmaApiNode,
  ctx: ImportCtx,
  parentId: string | null,
  parentBox: { x: number; y: number } | null,
): void {
  for (const child of node.children ?? []) {
    convertNode(child, ctx, parentId, parentBox);
  }
}

/** Index component node ids before conversion so instances can link masters. */
function indexComponentNodes(node: FigmaApiNode, ctx: ImportCtx): void {
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    ctx.componentMasters.set(node.id, editorId(ctx, node.id));
  }
  for (const c of node.children ?? []) indexComponentNodes(c, ctx);
}

export function applyFigmaImageUrls(
  nodes: Record<string, EditorNode>,
  assets: Record<string, EditorAsset>,
  urlByRef: Record<string, string>,
): void {
  for (const node of Object.values(nodes)) {
    if (node.type !== "image" || !node.assetId?.startsWith("pending-")) continue;
    const ref = node.assetId.slice("pending-".length);
    const url = urlByRef[ref];
    if (!url) continue;
    const assetId = `figma-img-${ref.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
    assets[assetId] = {
      id: assetId,
      name: node.name || "Image",
      mimeType: "image/png",
      dataUrl: url,
      createdAt: new Date().toISOString(),
    };
    node.assetId = assetId;
    node.imageSrc = url;
  }
}

export function convertFigmaApiToPaytmCraft(
  root: FigmaApiNode,
  fileName: string,
  imageUrlByRef: Record<string, string> = {},
): FigmaApiImportResult {
  try {
    const ctx: ImportCtx = {
      nodes: {},
      childOrder: { [EDITOR_ROOT_KEY]: [] },
      assets: {},
      imageRefs: new Set(),
      figmaToEditor: new Map(),
      componentMasters: new Map(),
      seq: 0,
    };

    indexComponentNodes(root, ctx);
    const rootBox = bbox(root);
    const converted = convertNode(root, ctx, null, null);
    if (!converted && (ctx.childOrder[EDITOR_ROOT_KEY]?.length ?? 0) === 0) {
      walkChildren(root, ctx, null, rootBox);
    }

    applyFigmaImageUrls(ctx.nodes, ctx.assets, imageUrlByRef);

    applyDeepAutoLayoutAll(ctx.nodes as Record<string, import("@/lib/autoLayout").LayoutNode>, ctx.childOrder);

    const doc: PaytmCraftDocument = {
      version: 1,
      name: fileName,
      savedAt: new Date().toISOString(),
      nodes: ctx.nodes,
      childOrder: ctx.childOrder,
      assets: ctx.assets,
      designTokens: {},
      selectedIds: converted ? [converted.id] : ctx.childOrder[EDITOR_ROOT_KEY]?.slice(0, 1) ?? [],
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
