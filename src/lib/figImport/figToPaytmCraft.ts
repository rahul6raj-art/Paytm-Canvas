import {
  extractRenderableGradientFill,
  nodeId,
  parseFig,
  resolveVectorNodePaths,
  type FigDocument,
  type FigNode,
  type FigPaint,
} from "openfig-core";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { newPathPointId, normalizePathNode, type PathPoint } from "@/lib/pathGeometry";
import type { EditorAsset, PaytmCraftDocument } from "@/lib/documentPersistence";
import type { EditorNode, NodeKind } from "@/stores/useEditorStore";
import type { CrossAxisAlign, LayoutFields, PrimaryAxisAlign } from "@/lib/autoLayout";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { DEFAULT_GRADIENT_TRANSFORM, newGradientStopId, type FillGradient } from "@/lib/fillGradient";
import { newNodeEffectId, type NodeEffect } from "@/lib/nodeEffects";
import {
  applyFigBooleanToNode,
  finalizeFigContainer,
  frameClipChildrenFromFig,
} from "@/lib/figImport/figMaskImport";

const ROOT = EDITOR_ROOT_KEY;

/** Figma containers we descend through without creating an editor node. */
const PASS_THROUGH_TYPES = new Set(["SECTION", "DOCUMENT"]);

const SKIP_TYPES = new Set([
  "CANVAS",
  "SLICE",
  "WIDGET",
  "CODE_BLOCK",
  "CONNECTOR",
  "STICKY",
  "SHAPE_WITH_TEXT",
]);

type FigColor = { r: number; g: number; b: number; a?: number };

type ImportCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  idMap: Map<string, string>;
  variableColors: Map<string, FigColor>;
  seq: number;
};

export type FigImportResult =
  | { ok: true; document: PaytmCraftDocument }
  | { ok: false; error: string };

function nextId(ctx: ImportCtx, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}-${ctx.seq}`;
}

function paytmId(ctx: ImportCtx, figKey: string): string {
  const hit = ctx.idMap.get(figKey);
  if (hit) return hit;
  const id = `fig-${figKey.replace(/:/g, "-")}`;
  ctx.idMap.set(figKey, id);
  return id;
}

function rgbaToHex(c: FigColor): string {
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  return hex;
}

function guidKey(guid?: { sessionID?: number; localID?: number }): string | null {
  if (guid?.sessionID == null || guid?.localID == null) return null;
  return `${guid.sessionID}:${guid.localID}`;
}

/** Resolve Figma variable nodes to guid → color for alias paints. */
function buildVariableColorMap(fig: FigDocument): Map<string, FigColor> {
  const map = new Map<string, FigColor>();
  for (const node of fig.nodes) {
    if (node.type !== "VARIABLE" || node.variableResolvedType !== "COLOR") continue;
    const key = nodeId(node);
    if (!key) continue;
    const entries = node.variableDataValues?.entries;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const cv = entry?.variableData?.value?.colorValue as FigColor | undefined;
      if (cv) {
        map.set(key, cv);
        break;
      }
    }
  }
  return map;
}

function normalizeFigColor(c: FigColor): FigColor {
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? 1 };
}

function resolveFigColor(
  color: FigColor | undefined,
  colorVar: unknown,
  variableColors: Map<string, FigColor>,
): FigColor | undefined {
  if (color && (color.a ?? 1) > 0) return normalizeFigColor(color);
  if (!colorVar || typeof colorVar !== "object") return color;

  const cv = colorVar as {
    value?: {
      alias?: { guid?: { sessionID?: number; localID?: number } };
      colorValue?: FigColor;
    };
    variableData?: { value?: { colorValue?: FigColor } };
  };

  const aliasKey = guidKey(cv.value?.alias?.guid);
  if (aliasKey) {
    const resolved = variableColors.get(aliasKey);
    if (resolved) return normalizeFigColor(resolved);
  }

  const direct = cv.value?.colorValue ?? cv.variableData?.value?.colorValue;
  return direct ? normalizeFigColor(direct) : color ? normalizeFigColor(color) : undefined;
}

function resolvePaintList(paints: FigPaint[] | undefined, variableColors: Map<string, FigColor>): FigPaint[] | undefined {
  if (!paints?.length) return paints;
  return paints.map((paint) => {
    if (paint.visible === false) return paint;
    const resolved = resolveFigColor(paint.color, (paint as { colorVar?: unknown }).colorVar, variableColors);
    let next = resolved ? ({ ...paint, color: resolved as FigPaint["color"] } as FigPaint) : paint;
    if (Array.isArray(paint.stops)) {
      const stops = paint.stops.map((stop) => {
        const stopColor = resolveFigColor(
          stop.color,
          (stop as { colorVar?: unknown }).colorVar,
          variableColors,
        );
        if (!stopColor) return stop;
        return { ...stop, color: stopColor as FigPaint["color"] };
      }) as FigPaint["stops"];
      next = { ...next, stops };
    }
    return next;
  });
}

function inferCanvasBackground(fig: FigDocument, rootFrameFills: string[]): string {
  const metaBg = fig.meta?.client_meta?.background_color as FigColor | undefined;
  if (metaBg) return rgbaToHex(metaBg);
  const darkRoot = rootFrameFills.find((hex) => {
    const h = hex.replace("#", "");
    if (h.length < 6) return false;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b < 0.35;
  });
  if (darkRoot) return darkRoot;
  if (rootFrameFills[0]) return rootFrameFills[0];
  return DEFAULT_CANVAS_BACKGROUND;
}

function hashToHex(hash: Uint8Array | string): string {
  if (typeof hash === "string") return hash.replace(/[^a-f0-9]/gi, "").toLowerCase();
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function mimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function imageBytesForPaint(
  doc: FigDocument,
  paint: FigPaint,
): { bytes: Uint8Array; name: string } | null {
  const hash = paint.image?.hash ?? paint.imageThumbnail?.hash;
  if (!hash) return null;
  const hex = hashToHex(hash);
  for (const [filename, bytes] of doc.images) {
    if (filename.includes(hex)) return { bytes, name: filename };
  }
  return null;
}

function registerImageAsset(
  doc: FigDocument,
  paint: FigPaint,
  ctx: ImportCtx,
): { assetId: string; imageSrc: string } | null {
  const hit = imageBytesForPaint(doc, paint);
  if (!hit) return null;
  const dataUrl = bytesToDataUrl(hit.bytes, mimeFromFilename(hit.name));
  const assetId = nextId(ctx, "asset");
  ctx.assets[assetId] = {
    id: assetId,
    name: hit.name,
    mimeType: mimeFromFilename(hit.name),
    dataUrl,
    createdAt: new Date().toISOString(),
  };
  return { assetId, imageSrc: dataUrl };
}

function rotationDeg(t?: { m00: number; m01: number; m10: number; m11: number }): number {
  if (!t) return 0;
  const deg = (Math.atan2(t.m10, t.m00) * 180) / Math.PI;
  return Math.abs(deg) < 0.01 ? 0 : Math.round(deg * 100) / 100;
}

function figFontWeight(style?: string): number {
  const s = (style ?? "").toLowerCase();
  if (s.includes("black") || s.includes("heavy")) return 900;
  if (s.includes("extrabold") || s.includes("ultra")) return 800;
  if (s.includes("bold")) return 700;
  if (s.includes("semibold") || s.includes("demi")) return 600;
  if (s.includes("medium")) return 500;
  if (s.includes("light") || s.includes("thin")) return 300;
  return 400;
}

function solidFill(paints?: FigPaint[]): { fill?: string; fillOpacity?: number } {
  const p = paints?.find((x) => x.visible !== false && x.type === "SOLID" && x.color);
  if (!p?.color) return {};
  return {
    fill: rgbaToHex(p.color),
    fillOpacity: p.opacity ?? p.color.a ?? 1,
  };
}

function gradientFill(paints?: FigPaint[]): {
  fillType?: "gradient";
  fillGradient?: FillGradient;
} {
  const g = extractRenderableGradientFill(paints);
  if (!g) return {};
  const stops = g.stops.map((s) => ({
    id: newGradientStopId(),
    position: Math.max(0, Math.min(100, s.position * 100)),
    color: rgbaToHex(s.color),
  }));
  if (stops.length < 2) return {};
  return {
    fillType: "gradient",
    fillGradient: {
      kind: g.type === "radial" ? "radial" : "linear",
      transform: { ...DEFAULT_GRADIENT_TRANSFORM, rotation: g.type === "linear" ? 180 : 0 },
      stops,
    },
  };
}

function strokeFromNode(
  node: FigNode,
  variableColors: Map<string, FigColor>,
): Pick<EditorNode, "strokeColor" | "strokeWidth" | "strokeStyle"> {
  const strokes = resolvePaintList(node.strokePaints, variableColors);
  const stroke = strokes?.find((x) => x.visible !== false && x.type === "SOLID" && x.color);
  const width = node.strokeWeight ?? 0;
  if (!stroke?.color || width <= 0) return {};
  return {
    strokeColor: rgbaToHex(stroke.color),
    strokeWidth: width,
    strokeStyle: "solid",
  };
}

function hasImageFill(paints?: FigPaint[]): FigPaint | null {
  return paints?.find((x) => x.visible !== false && x.type === "IMAGE") ?? null;
}

function mapPrimaryAxisAlign(raw: string | undefined): PrimaryAxisAlign {
  switch (raw) {
    case "CENTER":
      return "center";
    case "MAX":
    case "END":
      return "end";
    case "SPACE_BETWEEN":
    case "SPACE_EVENLY":
      return "space-between";
    default:
      return "start";
  }
}

function mapCounterAxisAlign(raw: string | undefined): CrossAxisAlign {
  switch (raw) {
    case "CENTER":
      return "center";
    case "MAX":
    case "END":
      return "end";
    case "STRETCH":
      return "stretch";
    default:
      return "start";
  }
}

/** Map Figma auto-layout (stack) fields to Paytm Craft layout properties. */
function autoLayoutFromFigNode(node: FigNode): LayoutFields {
  const stackMode = node.stackMode;
  if (!stackMode || stackMode === "NONE" || stackMode === "GRID") {
    return { layoutMode: "none" };
  }

  const n = node as FigNode & {
    stackSpacing?: number;
    stackVerticalPadding?: number;
    stackHorizontalPadding?: number;
    stackPaddingBottom?: number;
    stackPaddingRight?: number;
    stackPrimaryAlignItems?: string;
    stackCounterAlignItems?: string;
  };

  const padTop = n.stackVerticalPadding ?? 0;
  const padBottom = n.stackPaddingBottom ?? n.stackVerticalPadding ?? 0;
  const padLeft = n.stackHorizontalPadding ?? 0;
  const padRight = n.stackPaddingRight ?? n.stackHorizontalPadding ?? 0;

  return {
    layoutMode: stackMode === "HORIZONTAL" ? "horizontal" : "vertical",
    layoutGap: Math.max(0, n.stackSpacing ?? 0),
    paddingTop: padTop,
    paddingRight: padRight,
    paddingBottom: padBottom,
    paddingLeft: padLeft,
    primaryAxisAlign: mapPrimaryAxisAlign(n.stackPrimaryAlignItems),
    counterAxisAlign: mapCounterAxisAlign(n.stackCounterAlignItems),
  };
}

function figBlurRadius(radius: number | undefined): number {
  const r = radius ?? 0;
  if (r <= 0) return 0;
  // Figma stores a smaller kernel sigma for light blurs; scale to approximate CSS px.
  return r < 16 ? Math.max(1, Math.round(r * 4)) : Math.round(r);
}

function effectsFromFigNode(
  node: FigNode,
  variableColors: Map<string, FigColor>,
): NodeEffect[] | undefined {
  const raw = node.effects;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const out: NodeEffect[] = [];
  for (const e of raw) {
    if (e.visible === false) continue;
    const type = String(e.type ?? "");

    if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
      const color = resolveFigColor(
        e.color as FigColor | undefined,
        (e as { colorVar?: unknown }).colorVar,
        variableColors,
      );
      const opacity = e.opacity ?? color?.a ?? 0.25;
      out.push({
        id: newNodeEffectId(),
        type: type === "INNER_SHADOW" ? "inner-shadow" : "drop-shadow",
        visible: true,
        x: e.offset?.x ?? 0,
        y: e.offset?.y ?? 0,
        blur: Math.max(0, e.radius ?? 0),
        spread: e.spread ?? 0,
        color: color ? rgbaToHex(color) : "#000000",
        opacity,
      });
      continue;
    }

    if (type === "FOREGROUND_BLUR" || type === "BACKGROUND_BLUR") {
      const blur = figBlurRadius(e.radius);
      if (blur <= 0) continue;
      out.push({
        id: newNodeEffectId(),
        type: type === "BACKGROUND_BLUR" ? "background-blur" : "layer-blur",
        visible: true,
        blur,
      });
    }
  }

  return out.length > 0 ? out : undefined;
}

function mapNodeKind(node: FigNode): NodeKind | null {
  switch (node.type) {
    case "FRAME": {
      const hasAutoLayout = node.stackMode && node.stackMode !== "NONE";
      if (node.resizeToFit && !hasAutoLayout) return "group";
      return "frame";
    }
    case "GROUP":
      return "group";
    case "RECTANGLE":
    case "ROUNDED_RECTANGLE":
      return "rectangle";
    case "ELLIPSE":
      return "ellipse";
    case "LINE":
      return "line";
    case "TEXT":
      return "text";
    case "VECTOR":
      return "path";
    case "BOOLEAN_OPERATION":
      return "group";
    case "INSTANCE":
    case "COMPONENT":
    case "COMPONENT_SET":
    case "SYMBOL":
      return "frame";
    default:
      return null;
  }
}

function isImportableNode(node: FigNode): boolean {
  if (node.phase === "REMOVED") return false;
  if (SKIP_TYPES.has(node.type)) return false;
  if (node.type === "CANVAS" && /internal only/i.test(node.name)) return false;
  return mapNodeKind(node) !== null;
}

function appendChild(ctx: ImportCtx, parentKey: string, childId: string): void {
  const list = ctx.childOrder[parentKey] ?? [];
  if (!list.includes(childId)) ctx.childOrder[parentKey] = [...list, childId];
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
    } else if (c === "H") {
      const x = readNum() + (rel ? cx : 0);
      cx = x;
      points.push({ id: newPathPointId(), x, y: cy });
    } else if (c === "V") {
      const y = readNum() + (rel ? cy : 0);
      cy = y;
      points.push({ id: newPathPointId(), x: cx, y });
    } else if (c === "C") {
      const c1x = readNum() + (rel ? cx : 0);
      const c1y = readNum() + (rel ? cy : 0);
      const c2x = readNum() + (rel ? cx : 0);
      const c2y = readNum() + (rel ? cy : 0);
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      const prev = points[points.length - 1];
      if (prev) {
        prev.handleOut = { x: c1x - prev.x, y: c1y - prev.y };
      }
      points.push({
        id: newPathPointId(),
        x,
        y,
        handleIn: prev ? { x: c2x - x, y: c2y - y } : undefined,
      });
      cx = x;
      cy = y;
    } else if (c === "Z") {
      cx = startX;
      cy = startY;
    }
  }
  return points;
}

function convertFigNode(
  node: FigNode,
  doc: FigDocument,
  ctx: ImportCtx,
  paytmParentId: string | null,
): EditorNode | null {
  const figKey = nodeId(node);
  if (!figKey || !isImportableNode(node)) return null;

  const kind = mapNodeKind(node);
  if (!kind) return null;

  const w = Math.max(1, node.size?.x ?? 1);
  const h = Math.max(1, node.size?.y ?? 1);
  const x = node.transform?.m02 ?? 0;
  const y = node.transform?.m12 ?? 0;
  const id = paytmId(ctx, figKey);
  const resolvedFills = resolvePaintList(node.fillPaints, ctx.variableColors);
  const imagePaint = hasImageFill(resolvedFills);
  const solid = solidFill(resolvedFills);
  const gradient = gradientFill(resolvedFills);

  const base: EditorNode = {
    id,
    parentId: paytmParentId,
    type: kind,
    name: node.name || node.type,
    x,
    y,
    width: w,
    height: h,
    rotation: rotationDeg(node.transform),
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: Boolean(solid.fill || gradient.fillType || imagePaint),
    ...solid,
    ...gradient,
    ...strokeFromNode(node, ctx.variableColors),
    ...autoLayoutFromFigNode(node),
    cornerRadius: node.cornerRadius,
    opacity: node.opacity,
    effects: effectsFromFigNode(node, ctx.variableColors),
  };

  if (kind === "frame") {
    base.clipChildren = frameClipChildrenFromFig(node);
  }

  applyFigBooleanToNode(node, base);

  if (imagePaint) {
    const img = registerImageAsset(doc, imagePaint, ctx);
    if (img) {
      base.type = "image";
      base.assetId = img.assetId;
      base.imageSrc = img.imageSrc;
      base.imageName = base.name;
      base.imageMimeType = ctx.assets[img.assetId]?.mimeType;
      base.imageFitMode = "fill";
    }
  }

  if (base.type === "text") {
    base.content = node.textData?.characters ?? "";
    base.textColor = base.fill ?? "#111111";
    base.fontFamily = node.fontName?.family
      ? `"${node.fontName.family}", system-ui, sans-serif`
      : undefined;
    base.fontSize = node.fontSize ?? 13;
    base.fontWeight = figFontWeight(node.fontName?.style);
    base.textAlign =
      node.textAlignHorizontal === "CENTER"
        ? "center"
        : node.textAlignHorizontal === "RIGHT"
          ? "right"
          : "left";
    base.textResizeMode = "auto-height";
  }

  if (base.type === "path" && node.type === "VECTOR") {
    try {
      const paths = resolveVectorNodePaths(doc, node);
      const svg = paths.fill[0]?.svgPath ?? paths.stroke[0]?.svgPath;
      if (svg) {
        const pts = svgPathToPathPoints(svg);
        if (pts.length >= 2) {
          base.pathPoints = pts;
          base.pathClosed = /z/i.test(svg);
          const normalized = normalizePathNode(base);
          ctx.nodes[id] = normalized;
          const parentKey = paytmParentId ?? ROOT;
          appendChild(ctx, parentKey, id);
          return normalized;
        }
      }
    } catch {
      /* fall through to bbox rectangle */
    }
    base.type = "rectangle";
    delete base.pathPoints;
    delete base.pathClosed;
  }

  ctx.nodes[id] = base;
  const parentKey = paytmParentId ?? ROOT;
  appendChild(ctx, parentKey, id);
  return base;
}

function walkFigTree(
  figParentId: string,
  paytmParentId: string | null,
  doc: FigDocument,
  ctx: ImportCtx,
): void {
  const children = doc.childrenMap.get(figParentId) ?? [];
  for (const child of children) {
    const figKey = nodeId(child);
    if (!figKey || child.phase === "REMOVED") continue;

    if (PASS_THROUGH_TYPES.has(child.type)) {
      walkFigTree(figKey, paytmParentId, doc, ctx);
      continue;
    }

    if (!isImportableNode(child)) continue;
    const converted = convertFigNode(child, doc, ctx, paytmParentId);
    if (!converted) continue;
    walkFigTree(figKey, converted.id, doc, ctx);
    if (converted.type === "frame" || converted.type === "group") {
      finalizeFigContainer(figKey, converted.id, doc, ctx, isImportableNode);
    }
  }

  if (paytmParentId) {
    const parentNode = ctx.nodes[paytmParentId];
    if (parentNode && (parentNode.type === "frame" || parentNode.type === "group")) {
      finalizeFigContainer(figParentId, paytmParentId, doc, ctx, isImportableNode);
    }
  }
}

function pageCanvases(doc: FigDocument): FigNode[] {
  return doc.nodes.filter(
    (n) =>
      n.type === "CANVAS" &&
      n.phase !== "REMOVED" &&
      !/internal only/i.test(n.name),
  );
}

export function convertFigBytesToPaytmCraft(
  bytes: Uint8Array,
  fileName: string,
): FigImportResult {
  try {
    const fig = parseFig(bytes);
    const canvases = pageCanvases(fig);
    if (canvases.length === 0) {
      return { ok: false, error: "No Figma pages found in this file." };
    }

    const baseName = fileName.replace(/\.fig$/i, "").trim() || "Imported Figma";
    const pages: NonNullable<PaytmCraftDocument["pages"]> = [];
    const mergedAssets: Record<string, EditorAsset> = {};
    const variableColors = buildVariableColorMap(fig);
    const rootFrameFills: string[] = [];
    let pageIndex = 0;

    for (const canvas of canvases) {
      const canvasId = nodeId(canvas);
      if (!canvasId) continue;

      const ctx: ImportCtx = {
        nodes: {},
        childOrder: { [ROOT]: [] },
        assets: {},
        idMap: new Map(),
        variableColors,
        seq: pageIndex * 10_000,
      };

      walkFigTree(canvasId, null, fig, ctx);

      if ((ctx.childOrder[ROOT] ?? []).length === 0) continue;

      Object.assign(mergedAssets, ctx.assets);

      for (const rid of ctx.childOrder[ROOT] ?? []) {
        const fill = ctx.nodes[rid]?.fill;
        if (fill) rootFrameFills.push(fill);
      }

      const pageId = `page-fig-${pageIndex}`;
      pageIndex += 1;
      const canvasBackground = inferCanvasBackground(fig, rootFrameFills);
      pages.push({
        id: pageId,
        name: canvas.name || `Page ${pageIndex}`,
        nodes: ctx.nodes,
        childOrder: ctx.childOrder,
        selectedIds: [],
        canvas: {
          zoom: 0.55,
          panX: 40,
          panY: 24,
          showGrid: false,
          backgroundColor: canvasBackground,
        },
      });
    }

    if (!pages.length) {
      return { ok: false, error: "No importable layers found in this Figma file." };
    }

    const first = pages[0]!;

    const document: PaytmCraftDocument = {
      version: 1,
      name: (fig.meta?.file_name as string) || (fig.meta?.name as string) || baseName,
      savedAt: new Date().toISOString(),
      nodes: first.nodes,
      childOrder: first.childOrder,
      pages,
      activePageId: first.id,
      assets: mergedAssets,
      designTokens: {},
      selectedIds: [],
      canvas: first.canvas,
    };

    return { ok: true, document };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not parse .fig file.",
    };
  }
}
