import {
  nodeId,
  parseFig,
  resolveVectorNodePaths,
  type FigDocument,
  type FigNode,
  type FigPaint,
  type ResolvedVectorNodePaths,
} from "openfig-core";
import { newComponentId } from "@/lib/componentModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { newPathPointId, normalizePathNode, type PathPoint } from "@/lib/pathGeometry";
import type { EditorAsset, PaytmCraftDocument } from "@/lib/documentPersistence";
import {
  designTokenTimestamp,
  newDesignTokenId,
  type DesignToken,
} from "@/lib/designTokens";
import type {
  ConstraintHorizontal,
  ConstraintVertical,
  EditorNode,
  LayoutSizingMode,
  NodeKind,
} from "@/stores/useEditorStore";
import type { LayoutPositioning } from "@/lib/layoutEngine/types";
import {
  resetImportYieldTick,
  yieldImportTick,
} from "@/lib/figImport/figImportRuntime";
import type { FigImportProgress } from "@/lib/figImport/figImportRuntime";
import { applyDeepAutoLayoutAll, type CrossAxisAlign, type LayoutFields, type LayoutNode, type PrimaryAxisAlign } from "@/lib/autoLayout";
import { DEFAULT_CANVAS_ZOOM, pickViewportRootIds, viewportForRootNodes } from "@/lib/canvasZoom";
import { CANVAS_FRAME_ORIGIN } from "@/lib/codeExport/frameRelativeExport";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import {
  dedupeChildOrderLists,
  reconcileChildOrderWithParents,
  syncParentIdsFromChildOrder,
} from "@/lib/editorGraph";
import {
  applyFigBooleanToNode,
  figContainerClipChildren,
  finalizeFigContainer,
} from "@/lib/figImport/figMaskImport";
import {
  figNodeVisible,
  figTextResizeMode,
  placementFromFigNode,
  sortedFigChildren,
} from "@/lib/figImport/figNodeGeometry";
import { textResizePatch } from "@/lib/text/textNodeModel";
import {
  blendModeFromFigNode,
  buildTokensByVariableKey,
  effectiveNodeFillPaints,
  effectsFromFigNode,
  figFontWeight,
  fillTokenIdForPaints,
  gradientFillFromPaints,
  imageFitFromPaint,
  imagePaintFromPaints,
  instanceOverridesFromSymbol,
  resolvePaintList,
  rgbaToHex,
  solidFillFromPaints,
  strokesFromFigNode,
  type FigColor,
} from "@/lib/figImport/figImportProperties";
import { figStyleOverrideTable } from "@/lib/figImport/figPaintCore";
import { pickCanvasScreenRoots } from "@/lib/figImport/figCanvasRoots";
import { importFigmaComponentLibrary, symbolRootKey } from "@/lib/figImport/figComponentLibrary";
import {
  hydrateSymbolMasterSync,
  importFigInstanceFromMaster,
  removeImportedNode,
} from "@/lib/figImport/figInstanceImport";
import type { FigImportFidelityCapture } from "@/lib/figImport/figFidelityTypes";
import { snapshotFromFigNode } from "@/lib/figImport/figSourceSnapshot";
import type { ImportCtx } from "@/lib/figImport/figImportTypes";

const ROOT = EDITOR_ROOT_KEY;

/** Figma containers we descend through without creating an editor node. */
const PASS_THROUGH_TYPES = new Set(["SECTION", "DOCUMENT"]);

function createImportCtx(
  base: Omit<ImportCtx, "hydratedSymbols" | "importNodesProcessed" | "onProgress" | "fidelityCaptures"> & {
    onProgress?: FigImportProgress;
  },
): ImportCtx {
  return {
    ...base,
    hydratedSymbols: new Set(),
    importNodesProcessed: 0,
    fidelityCaptures: new Map(),
  };
}

function tickImportProgress(ctx: ImportCtx, label: string): void {
  const count = (ctx.importNodesProcessed ?? 0) + 1;
  ctx.importNodesProcessed = count;
  if (count % 250 === 0) {
    ctx.onProgress?.(`${label} (${count.toLocaleString()} layers)…`);
  }
}

/** Expand a symbol master subtree once (shared by all instances). */
async function hydrateSymbolMasterAsync(
  symId: string,
  masterId: string,
  doc: FigDocument,
  ctx: ImportCtx,
  instanceForOverrides?: FigNode | null,
): Promise<void> {
  if (ctx.hydratedSymbols.has(symId)) return;
  const symNode = doc.nodeMap.get(symId);
  if (!symNode || symNode.type === "INSTANCE") {
    ctx.hydratedSymbols.add(symId);
    return;
  }
  if ((ctx.childOrder[masterId] ?? []).length === 0) {
    await walkFigTreeAsync(symId, masterId, doc, ctx, instanceForOverrides ?? null);
    finalizeFigContainer(symId, masterId, doc, ctx, isImportableNode);
  }
  ctx.hydratedSymbols.add(symId);
}

/** Skip embedding huge binaries as data URLs during import (keeps UI responsive). */
const MAX_EMBED_IMAGE_BYTES = 8 * 1024 * 1024;

const SKIP_TYPES = new Set([
  "CANVAS",
  "SLICE",
  "WIDGET",
  "CODE_BLOCK",
  "CONNECTOR",
  "STICKY",
  "SHAPE_WITH_TEXT",
]);

export type FigImportResult =
  | { ok: true; document: PaytmCraftDocument; figFidelityCaptures?: Record<string, FigImportFidelityCapture> }
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

function fillsForFigNode(node: FigNode, doc: FigDocument, ctx: ImportCtx): FigPaint[] | undefined {
  return effectiveNodeFillPaints(node, () => {
    const paths = cachedVectorPaths(doc, node, ctx);
    if (!paths) return undefined;
    for (const path of [...paths.fill, ...paths.stroke]) {
      if (path.paints?.length) return path.paints;
    }
    return undefined;
  });
}

const DETACHED_STYLE_GUID = 4_294_967_295;

function isDetachedTextStyle(node: FigNode): boolean {
  const ext = node as FigNode & { styleIdForText?: { guid?: { sessionID?: number; localID?: number } } };
  const g = ext.styleIdForText?.guid;
  return g?.sessionID === DETACHED_STYLE_GUID && g?.localID === DETACHED_STYLE_GUID;
}

/** Apply named text style fields when the node only references styleIdForText. */
function mergeTextStyleFromLibrary(doc: FigDocument, node: FigNode): FigNode {
  if (isDetachedTextStyle(node)) return node;
  const ext = node as FigNode & { styleIdForText?: { guid?: { sessionID?: number; localID?: number } } };
  const styleKey = guidKey(ext.styleIdForText?.guid);
  if (!styleKey) return node;
  const styleNode = doc.nodeMap.get(styleKey);
  if (!styleNode || styleNode.type !== "TEXT") return node;

  return {
    ...node,
    fontName: node.fontName ?? styleNode.fontName,
    fontSize: node.fontSize ?? styleNode.fontSize,
    fillPaints: node.fillPaints?.length ? node.fillPaints : styleNode.fillPaints,
    lineHeight: (node as { lineHeight?: unknown }).lineHeight ?? (styleNode as { lineHeight?: unknown }).lineHeight,
    letterSpacing:
      (node as { letterSpacing?: unknown }).letterSpacing ??
      (styleNode as { letterSpacing?: unknown }).letterSpacing,
    textAlignHorizontal: node.textAlignHorizontal ?? styleNode.textAlignHorizontal,
  };
}

function applySymbolOverrides(node: FigNode, instance: FigNode): FigNode {
  const overrides = (instance as FigNode & { symbolData?: { symbolOverrides?: unknown[] } }).symbolData
    ?.symbolOverrides;
  if (!Array.isArray(overrides) || overrides.length === 0) return node;

  const nodeKey = guidKey(node.guid);
  if (!nodeKey) return node;

  let merged: FigNode = { ...node };
  for (const raw of overrides) {
    const ov = raw as {
      guidPath?: { guids?: { sessionID?: number; localID?: number }[] };
      textData?: { characters?: string };
      fillPaints?: FigPaint[];
      strokePaints?: FigPaint[];
      name?: string;
      fontName?: FigNode["fontName"];
      fontSize?: number;
    };
    const path = ov.guidPath?.guids;
    if (!path?.length) continue;
    const last = path[path.length - 1]!;
    if (guidKey(last) !== nodeKey) continue;

    if (ov.name) merged = { ...merged, name: ov.name };
    if (ov.fillPaints) merged = { ...merged, fillPaints: ov.fillPaints };
    if (ov.strokePaints) merged = { ...merged, strokePaints: ov.strokePaints };
    if (ov.fontName) merged = { ...merged, fontName: ov.fontName };
    if (ov.fontSize != null) merged = { ...merged, fontSize: ov.fontSize };
    if (ov.textData?.characters != null && merged.textData) {
      const chars = ov.textData.characters === "" ? " " : ov.textData.characters;
      merged = { ...merged, textData: { ...merged.textData, characters: chars } };
    }
  }
  return merged;
}

function figDisplayName(node: FigNode): string {
  const trimmed = (node.name ?? "").trim();
  if (trimmed) return trimmed;
  const key = guidKey(node.guid);
  const suffix = key ? key.split(":")[1] ?? key : "";
  switch (node.type) {
    case "FRAME":
      return "Frame";
    case "TEXT":
      return "Text";
    case "RECTANGLE":
    case "ROUNDED_RECTANGLE":
      return "Rectangle";
    case "ELLIPSE":
      return "Ellipse";
    case "VECTOR":
      return "Vector";
    case "INSTANCE":
      return "Instance";
    default:
      return suffix ? `${node.type} ${suffix}` : node.type;
  }
}

function figLineHeightMultiplier(node: FigNode): number | undefined {
  const lh = (node as { lineHeight?: { value?: number; units?: string } }).lineHeight;
  if (lh?.value == null) return undefined;
  const units = (lh.units ?? "RAW").toUpperCase();
  if (units === "PIXELS" && node.fontSize) return lh.value / node.fontSize;
  if (units === "PERCENT") return lh.value / 100;
  return lh.value;
}

function figLetterSpacingPx(node: FigNode): number | undefined {
  const tracking = (node as { textTracking?: number }).textTracking;
  if (tracking != null && node.fontSize) return node.fontSize * tracking;
  const ls = (node as { letterSpacing?: { value?: number; units?: string } }).letterSpacing;
  if (ls?.value == null) return undefined;
  const units = (ls.units ?? "PERCENT").toUpperCase();
  const size = node.fontSize ?? 13;
  if (units === "PIXELS") return ls.value;
  return (size * ls.value) / 100;
}

function dominantTextFillFromRuns(
  node: FigNode,
  variableColors: Map<string, FigColor>,
): { fill?: string; fillOpacity?: number } {
  const charIds = (node.textData as { characterStyleIDs?: number[] } | undefined)
    ?.characterStyleIDs;
  const table = figStyleOverrideTable(node);
  if (!charIds?.length || !table.length) return {};

  const dominantId = charIds.find((id) => id !== 0) ?? 0;
  if (!dominantId) return {};

  const override = table.find((e) => e.styleID === dominantId);
  if (!override?.fillPaints?.length) return {};

  const resolved = resolvePaintList(override.fillPaints, variableColors);
  return solidFillFromPaints(resolved);
}

function textFieldsFromFigNode(
  node: FigNode,
  doc: FigDocument,
  variableColors: Map<string, FigColor>,
  defaultFill?: string,
  styleKeyToTokenId?: Map<string, string>,
): Pick<
  EditorNode,
  | "content"
  | "textColor"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing"
  | "textAlign"
  | "textResizeMode"
  | "textStyleTokenId"
> {
  const styled = mergeTextStyleFromLibrary(doc, node);
  const runFill = dominantTextFillFromRuns(styled, variableColors);
  const styleKey = guidKeyFromFig(
    (styled as FigNode & { styleIdForText?: { guid?: { sessionID?: number; localID?: number } } })
      .styleIdForText?.guid,
  );
  const textStyleTokenId =
    styleKey && styleKeyToTokenId?.has(styleKey) ? styleKeyToTokenId.get(styleKey) : undefined;

  let fontName = styled.fontName;
  let fontSize = styled.fontSize;
  let fontWeight = figFontWeight(fontName?.style);

  const charIds = (styled.textData as { characterStyleIDs?: number[] } | undefined)
    ?.characterStyleIDs;
  const table = figStyleOverrideTable(styled);
  if (charIds?.length && table.length) {
    const dominantId = charIds.find((id) => id !== 0) ?? 0;
    if (dominantId) {
      const ov = table.find((e) => e.styleID === dominantId);
      if (ov?.fontName) {
        fontName = ov.fontName;
        fontWeight = figFontWeight(ov.fontName.style);
      }
      if (ov?.fontSize != null) fontSize = ov.fontSize;
    }
  }

  const textResizeMode = figTextResizeMode(styled) ?? "auto-height";

  return {
    content: styled.textData?.characters ?? "",
    textColor: runFill.fill ?? defaultFill ?? "#111111",
    fontFamily: fontName?.family ? `"${fontName.family}", system-ui, sans-serif` : undefined,
    fontSize: fontSize ?? 13,
    fontWeight,
    lineHeight: figLineHeightMultiplier(styled),
    letterSpacing: figLetterSpacingPx(styled),
    textAlign:
      styled.textAlignHorizontal === "CENTER"
        ? "center"
        : styled.textAlignHorizontal === "RIGHT"
          ? "right"
          : "left",
    ...textResizePatch(textResizeMode),
    ...(textStyleTokenId ? { textStyleTokenId } : {}),
  };
}

function buildDesignTokensFromFig(fig: FigDocument): {
  tokens: Record<string, DesignToken>;
  tokensByVariableKey: Map<string, string>;
} {
  const tokens: Record<string, DesignToken> = {};
  const tokensByVariableKey = new Map<string, string>();
  const now = designTokenTimestamp();

  for (const node of fig.nodes) {
    if (node.type !== "VARIABLE") continue;
    const key = nodeId(node);
    if (!key) continue;

    const name = (node.name ?? "").trim() || key;

    if (node.variableResolvedType === "COLOR") {
      const entries = node.variableDataValues?.entries;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const cv = entry?.variableData?.value?.colorValue as FigColor | undefined;
        if (!cv) continue;
        const id = newDesignTokenId("fig-color");
        tokens[id] = {
          id,
          name,
          type: "color",
          value: { hex: rgbaToHex(cv), opacity: cv.a ?? 1 },
          createdAt: now,
          updatedAt: now,
        };
        tokensByVariableKey.set(key, id);
        break;
      }
      continue;
    }

    if (node.variableResolvedType === "FLOAT") {
      const entries = node.variableDataValues?.entries;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const num = entry?.variableData?.value?.numValue as number | undefined;
        if (num == null) continue;
        const id = newDesignTokenId("fig-spacing");
        tokens[id] = {
          id,
          name,
          type: "spacing",
          value: { value: num },
          createdAt: now,
          updatedAt: now,
        };
        tokensByVariableKey.set(key, id);
        break;
      }
    }
  }

  return { tokens, tokensByVariableKey };
}

function guidKeyFromFig(guid?: { sessionID?: number; localID?: number }): string | null {
  if (guid?.sessionID == null || guid?.localID == null) return null;
  return `${guid.sessionID}:${guid.localID}`;
}

function buildTextStyleTokensFromFig(fig: FigDocument): {
  tokens: Record<string, DesignToken>;
  styleKeyToTokenId: Map<string, string>;
} {
  const tokens: Record<string, DesignToken> = {};
  const styleKeyToTokenId = new Map<string, string>();
  const styleKeys = new Set<string>();
  const now = designTokenTimestamp();

  for (const node of fig.nodes) {
    const ext = node as FigNode & { styleIdForText?: { guid?: { sessionID?: number; localID?: number } } };
    const key = guidKeyFromFig(ext.styleIdForText?.guid);
    if (key) styleKeys.add(key);
  }

  for (const styleKey of styleKeys) {
    const styleNode = fig.nodeMap.get(styleKey);
    if (!styleNode || styleNode.type !== "TEXT") continue;
    const id = newDesignTokenId("fig-text");
    tokens[id] = {
      id,
      name: (styleNode.name ?? "").trim() || styleKey,
      type: "typography",
      value: {
        fontFamily: styleNode.fontName?.family ?? "Inter",
        fontSize: styleNode.fontSize ?? 16,
        fontWeight: figFontWeight(styleNode.fontName?.style) ?? 400,
        lineHeight: figLineHeightMultiplier(styleNode) ?? 1.2,
        letterSpacing: figLetterSpacingPx(styleNode) ?? 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    styleKeyToTokenId.set(styleKey, id);
  }

  return { tokens, styleKeyToTokenId };
}

function mergeDesignTokens(
  ...groups: Record<string, DesignToken>[]
): Record<string, DesignToken> {
  return Object.assign({}, ...groups);
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
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function cachedVectorPaths(doc: FigDocument, node: FigNode, ctx: ImportCtx): ResolvedVectorNodePaths | null {
  const key = nodeId(node);
  if (!key) return null;
  const hit = ctx.vectorPathsCache.get(key);
  if (hit) return hit;
  try {
    const paths = resolveVectorNodePaths(doc, node);
    ctx.vectorPathsCache.set(key, paths);
    return paths;
  } catch {
    return null;
  }
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
  if (hit.bytes.length > MAX_EMBED_IMAGE_BYTES) return null;
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

function mapFigSizingMode(raw: string | undefined): LayoutSizingMode | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "RESIZE_TO_FIT" || v === "AUTO" || v === "HUG" || v === "MIN") return "hug";
  if (v === "FILL" || v === "STRETCH" || v === "MAX") return "fill";
  if (v === "FIXED") return "fixed";
  return undefined;
}

function mapFigConstraintH(raw: string | undefined): ConstraintHorizontal | undefined {
  switch (raw?.toUpperCase()) {
    case "MIN":
    case "LEFT":
      return "left";
    case "MAX":
    case "RIGHT":
      return "right";
    case "CENTER":
      return "center";
    case "STRETCH":
    case "LEFT_RIGHT":
      return "left-right";
    case "SCALE":
      return "scale";
    default:
      return undefined;
  }
}

function mapFigConstraintV(raw: string | undefined): ConstraintVertical | undefined {
  switch (raw?.toUpperCase()) {
    case "MIN":
    case "TOP":
      return "top";
    case "MAX":
    case "BOTTOM":
      return "bottom";
    case "CENTER":
      return "center";
    case "STRETCH":
    case "TOP_BOTTOM":
      return "top-bottom";
    case "SCALE":
      return "scale";
    default:
      return undefined;
  }
}

function constraintsFromFigNode(node: FigNode): Pick<
  EditorNode,
  "constraintsHorizontal" | "constraintsVertical"
> {
  const ext = node as FigNode & {
    horizontalConstraint?: string;
    verticalConstraint?: string;
  };
  return {
    constraintsHorizontal: mapFigConstraintH(ext.horizontalConstraint),
    constraintsVertical: mapFigConstraintV(ext.verticalConstraint),
  };
}

function cornerRadiusFromFigNode(node: FigNode): Pick<EditorNode, "cornerRadius" | "cornerRadii"> {
  const ext = node as FigNode & { rectangleCornerRadii?: number[] };
  const corners = ext.rectangleCornerRadii;
  if (corners?.length === 4) {
    const [tl, tr, br, bl] = corners;
    if (tl === tr && tr === br && br === bl) return { cornerRadius: tl };
    return { cornerRadii: [tl, tr, br, bl] };
  }
  if (node.cornerRadius != null) return { cornerRadius: node.cornerRadius };
  return {};
}

/** Map Figma auto-layout (stack) fields to Paytm Craft layout properties. */
function autoLayoutFromFigNode(node: FigNode): LayoutFields & {
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
  layoutWrap?: boolean;
  layoutPositioning?: LayoutPositioning;
} {
  const stackMode = node.stackMode;
  const ext = node as FigNode & {
    stackSpacing?: number;
    stackVerticalPadding?: number;
    stackHorizontalPadding?: number;
    stackPaddingBottom?: number;
    stackPaddingRight?: number;
    stackPrimaryAlignItems?: string;
    stackCounterAlignItems?: string;
    stackPrimarySizing?: string;
    stackCounterSizing?: string;
    stackWrap?: boolean;
    stackPositioning?: string;
    stackChildPrimaryGrow?: number;
    stackChildCounterGrow?: number;
    stackChildAlignSelf?: string;
  };

  const layoutPositioning: LayoutPositioning | undefined =
    ext.stackPositioning?.toUpperCase() === "ABSOLUTE" ? "absolute" : undefined;

  if (!stackMode || stackMode === "NONE" || stackMode === "GRID") {
    const childSizing: {
      layoutSizingHorizontal?: LayoutSizingMode;
      layoutSizingVertical?: LayoutSizingMode;
    } = {};
    if (ext.stackChildPrimaryGrow === 1) {
      childSizing.layoutSizingHorizontal = "fill";
      childSizing.layoutSizingVertical = "fill";
    }
    if (ext.stackChildAlignSelf?.toUpperCase() === "STRETCH") {
      childSizing.layoutSizingHorizontal = "fill";
      childSizing.layoutSizingVertical = "fill";
    }
    return { layoutMode: "none", layoutPositioning, ...childSizing };
  }

  const padTop = ext.stackVerticalPadding ?? 0;
  const padBottom = ext.stackPaddingBottom ?? ext.stackVerticalPadding ?? 0;
  const padLeft = ext.stackHorizontalPadding ?? 0;
  const padRight = ext.stackPaddingRight ?? ext.stackHorizontalPadding ?? 0;

  const layoutMode = stackMode === "HORIZONTAL" ? "horizontal" : "vertical";
  const primarySizing = mapFigSizingMode(ext.stackPrimarySizing);
  const counterSizing = mapFigSizingMode(ext.stackCounterSizing);

  const fields: LayoutFields & {
    layoutSizingHorizontal?: LayoutSizingMode;
    layoutSizingVertical?: LayoutSizingMode;
    layoutWrap?: boolean;
    layoutPositioning?: LayoutPositioning;
  } = {
    layoutMode,
    layoutGap: Math.max(0, ext.stackSpacing ?? 0),
    paddingTop: padTop,
    paddingRight: padRight,
    paddingBottom: padBottom,
    paddingLeft: padLeft,
    primaryAxisAlign: mapPrimaryAxisAlign(ext.stackPrimaryAlignItems),
    counterAxisAlign: mapCounterAxisAlign(ext.stackCounterAlignItems),
    layoutWrap: ext.stackWrap === true,
    layoutPositioning,
  };

  if (layoutMode === "horizontal") {
    if (primarySizing) fields.layoutSizingHorizontal = primarySizing;
    if (counterSizing) fields.layoutSizingVertical = counterSizing;
  } else {
    if (primarySizing) fields.layoutSizingVertical = primarySizing;
    if (counterSizing) fields.layoutSizingHorizontal = counterSizing;
  }

  if (ext.stackChildPrimaryGrow === 1) {
    if (layoutMode === "horizontal") fields.layoutSizingHorizontal = "fill";
    else fields.layoutSizingVertical = "fill";
  }
  if (ext.stackChildCounterGrow === 1) {
    if (layoutMode === "horizontal") fields.layoutSizingVertical = "fill";
    else fields.layoutSizingHorizontal = "fill";
  }
  if (ext.stackChildAlignSelf?.toUpperCase() === "STRETCH") {
    if (layoutMode === "horizontal") fields.layoutSizingVertical = "fill";
    else fields.layoutSizingHorizontal = "fill";
  }

  return fields;
}

/** Move root frames to a visible canvas origin (fig files often use large internal coords). */
function normalizeFigRootFramesOnCanvas(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const roots = childOrder[ROOT] ?? [];
  if (roots.length === 0) return nodes;

  let minX = Infinity;
  let minY = Infinity;
  for (const id of roots) {
    const n = nodes[id];
    if (!n) continue;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  }
  if (!Number.isFinite(minX)) return nodes;

  const dx = CANVAS_FRAME_ORIGIN.x - minX;
  const dy = CANVAS_FRAME_ORIGIN.y - minY;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return nodes;

  const out = { ...nodes };
  for (const id of roots) {
    const n = out[id];
    if (!n) continue;
    out[id] = { ...n, x: n.x + dx, y: n.y + dy };
  }
  return out;
}

/**
 * Align parentId/childOrder, then run auto-layout on stack frames (matches Figma API import).
 * Figma absolute transforms seed the tree; layout reflow applies only to auto-layout containers.
 */
function finalizeFigPageImport(ctx: ImportCtx): void {
  ctx.childOrder = reconcileChildOrderWithParents(ctx.nodes, ctx.childOrder);
  ctx.nodes = syncParentIdsFromChildOrder(ctx.nodes, ctx.childOrder);
  ctx.childOrder = dedupeChildOrderLists(ctx.nodes, ctx.childOrder);
  ctx.nodes = normalizeFigRootFramesOnCanvas(ctx.nodes, ctx.childOrder);
  ctx.nodes = applyDeepAutoLayoutAll(
    ctx.nodes as Record<string, LayoutNode>,
    ctx.childOrder,
  ) as ImportCtx["nodes"];
}

/** Run auto-layout after import on idle time (import skips this for responsiveness). */
export function applyFigDocumentPostImportLayout(doc: PaytmCraftDocument): PaytmCraftDocument {
  if (!doc.pages?.length) {
    const nodes = applyDeepAutoLayoutAll(
      doc.nodes as Record<string, LayoutNode>,
      doc.childOrder,
    ) as PaytmCraftDocument["nodes"];
    return { ...doc, nodes };
  }

  const pages = doc.pages.map((page) => ({
    ...page,
    nodes: applyDeepAutoLayoutAll(
      page.nodes as Record<string, LayoutNode>,
      page.childOrder,
    ) as typeof page.nodes,
  }));

  const active = pages.find((p) => p.id === doc.activePageId) ?? pages[0]!;
  return {
    ...doc,
    pages,
    nodes: active.nodes,
    childOrder: active.childOrder,
  };
}

function mapNodeKind(node: FigNode): NodeKind | null {
  switch (node.type) {
    case "FRAME": {
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
    case "STAR":
    case "POLYGON":
      return "path";
    case "BOOLEAN_OPERATION":
    case "BOOLEAN_GROUP":
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
  if (!figNodeVisible(node)) return false;
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

function captureFidelitySnapshot(
  source: FigNode,
  doc: FigDocument,
  ctx: ImportCtx,
  editorId: string,
): void {
  const snap = snapshotFromFigNode(source, doc, ctx);
  if (!snap) return;
  ctx.fidelityCaptures?.set(editorId, {
    figma: snap,
    importedAt: new Date().toISOString(),
  });
}

function convertFigNode(
  node: FigNode,
  doc: FigDocument,
  ctx: ImportCtx,
  paytmParentId: string | null,
  instanceForOverrides?: FigNode | null,
): EditorNode | null {
  const source = instanceForOverrides ? applySymbolOverrides(node, instanceForOverrides) : node;
  const figKey = nodeId(source);
  if (!figKey || !isImportableNode(source)) return null;

  const kind = mapNodeKind(source);
  if (!kind) return null;

  const placement = placementFromFigNode(source);
  const id = paytmId(ctx, figKey);
  const rawFills = fillsForFigNode(source, doc, ctx);
  const resolvedFills = resolvePaintList(rawFills, ctx.variableColors);
  const imagePaint = imagePaintFromPaints(resolvedFills);
  const solid = solidFillFromPaints(resolvedFills);
  const gradient = gradientFillFromPaints(resolvedFills, placement.width, placement.height);
  const fillTokenId = fillTokenIdForPaints(rawFills, ctx.tokensByVariableKey);

  const ext = source as FigNode & { locked?: boolean; textAlignVertical?: string };
  const base: EditorNode = {
    id,
    parentId: paytmParentId,
    type: kind,
    name: figDisplayName(source),
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    rotation: placement.rotation,
    flipHorizontal: placement.flipHorizontal,
    flipVertical: placement.flipVertical,
    visible: true,
    locked: ext.locked === true,
    expanded: false,
    fillEnabled: Boolean(solid.fill || gradient.fillType || imagePaint),
    fillTokenId,
    ...solid,
    ...gradient,
    ...strokesFromFigNode(source, ctx.variableColors),
    ...autoLayoutFromFigNode(source),
    ...constraintsFromFigNode(source),
    ...cornerRadiusFromFigNode(source),
    opacity: source.opacity,
    ...blendModeFromFigNode(source),
    effects: effectsFromFigNode(source, ctx.variableColors),
  };

  if (source.type === "COMPONENT" || source.type === "SYMBOL") {
    base.isComponent = true;
    base.componentId = newComponentId();
    ctx.componentMasters.set(figKey, id);
  }

  const clipChildren = figContainerClipChildren(source);
  if (clipChildren !== undefined) base.clipChildren = clipChildren;

  applyFigBooleanToNode(source, base);

  if (imagePaint) {
    const img = registerImageAsset(doc, imagePaint, ctx);
    if (img) {
      base.type = "image";
      base.assetId = img.assetId;
      base.imageSrc = img.imageSrc;
      base.imageName = base.name;
      base.imageMimeType = ctx.assets[img.assetId]?.mimeType;
      base.imageFitMode = imageFitFromPaint(imagePaint);
    }
  }

  if (base.type === "text") {
    Object.assign(base, textFieldsFromFigNode(source, doc, ctx.variableColors, base.fill, ctx.styleKeyToTokenId));
    const vAlign = ext.textAlignVertical?.toUpperCase();
    if (vAlign === "CENTER") base.verticalAlign = "middle";
    else if (vAlign === "BOTTOM") base.verticalAlign = "bottom";
    else base.verticalAlign = "top";
    if (!base.fill && base.textColor) {
      base.fill = base.textColor;
      base.fillEnabled = true;
    }
  }

  if (
    base.type === "path" &&
    (source.type === "VECTOR" || source.type === "STAR" || source.type === "POLYGON")
  ) {
    const paths = cachedVectorPaths(doc, source, ctx);
    if (paths) {
      const svg = paths.fill[0]?.svgPath ?? paths.stroke[0]?.svgPath;
      if (svg) {
        if (!solid.fill) {
          for (const path of paths.fill) {
            if (!path.paints?.length) continue;
            const pathFills = resolvePaintList(path.paints, ctx.variableColors);
            const pathSolid = solidFillFromPaints(pathFills);
            const pathGradient = gradientFillFromPaints(pathFills, placement.width, placement.height);
            if (pathSolid.fill) {
              base.fill = pathSolid.fill;
              base.fillOpacity = pathSolid.fillOpacity;
              base.fillEnabled = true;
              break;
            }
            if (pathGradient.fillType) {
              base.fillType = pathGradient.fillType;
              base.fillGradient = pathGradient.fillGradient;
              base.fillEnabled = true;
              break;
            }
          }
        }
        const pts = svgPathToPathPoints(svg);
        if (pts.length >= 2) {
          base.pathPoints = pts;
          base.pathClosed = /z/i.test(svg);
          const normalized = normalizePathNode(base);
          ctx.nodes[id] = normalized;
          const parentKey = paytmParentId ?? ROOT;
          appendChild(ctx, parentKey, id);
          captureFidelitySnapshot(source, doc, ctx, id);
          return normalized;
        }
      }
    }
    base.type = "rectangle";
    delete base.pathPoints;
    delete base.pathClosed;
  }

  ctx.nodes[id] = base;
  const parentKey = paytmParentId ?? ROOT;
  appendChild(ctx, parentKey, id);
  captureFidelitySnapshot(source, doc, ctx, id);
  return base;
}

function importCanvasScreenRoots(
  fig: FigDocument,
  canvasFigId: string,
  ctx: ImportCtx,
  screenRoots: FigNode[],
): void {
  for (const node of screenRoots) {
    const figKey = nodeId(node);
    if (!figKey) continue;

    if (PASS_THROUGH_TYPES.has(node.type)) {
      walkFigTree(figKey, null, fig, ctx);
      continue;
    }

    const converted = convertFigNode(node, fig, ctx, null);
    if (!converted) continue;
    walkFigTree(figKey, converted.id, fig, ctx);
    if (converted.type === "frame" || converted.type === "group") {
      finalizeFigContainer(figKey, converted.id, fig, ctx, isImportableNode);
    }
  }
}

/** Import only chosen top-level screen frames (not every page child / component). */
async function importCanvasScreenRootsAsync(
  fig: FigDocument,
  canvasFigId: string,
  ctx: ImportCtx,
  screenRoots: FigNode[],
): Promise<void> {
  for (const node of screenRoots) {
    await yieldImportTick();
    const figKey = nodeId(node);
    if (!figKey) continue;

    if (PASS_THROUGH_TYPES.has(node.type)) {
      await walkFigTreeAsync(figKey, null, fig, ctx);
      continue;
    }

    const converted = convertFigNode(node, fig, ctx, null);
    if (!converted) continue;
    await walkFigTreeAsync(figKey, converted.id, fig, ctx);
    if (converted.type === "frame" || converted.type === "group") {
      finalizeFigContainer(figKey, converted.id, fig, ctx, isImportableNode);
    }
  }
}

async function walkFigTreeAsync(
  figParentId: string,
  paytmParentId: string | null,
  doc: FigDocument,
  ctx: ImportCtx,
  instanceForOverrides?: FigNode | null,
): Promise<void> {
  for (const child of sortedFigChildren(doc, figParentId)) {
    await yieldImportTick();
    tickImportProgress(ctx, "Importing screen");
    const figKey = nodeId(child);
    if (!figKey || child.phase === "REMOVED") continue;

    if (PASS_THROUGH_TYPES.has(child.type)) {
      await walkFigTreeAsync(figKey, paytmParentId, doc, ctx, instanceForOverrides);
      continue;
    }

    if (!isImportableNode(child)) continue;

    if (child.type === "INSTANCE") {
      const converted = convertFigNode(child, doc, ctx, paytmParentId);
      if (!converted) continue;

      const symId = symbolRootKey(child);
      const masterId = symId ? ctx.componentMasters.get(symId) : undefined;
      const overrides = instanceOverridesFromSymbol(child, ctx.idMap, ctx.variableColors);

      if (symId && masterId) {
        await hydrateSymbolMasterAsync(symId, masterId, doc, ctx, null);
        removeImportedNode(ctx, converted.id, paytmParentId);
        importFigInstanceFromMaster(ctx, {
          masterId,
          paytmParentId,
          placement: converted,
          overrides,
          figInstanceKey: figKey,
          doc,
          isImportable: isImportableNode,
        });
        continue;
      }

      const instanceNode: EditorNode = {
        ...ctx.nodes[converted.id]!,
        ...(Object.keys(overrides).length > 0 ? { instanceOverrides: overrides } : {}),
      };
      ctx.nodes[converted.id] = instanceNode;

      if (symId) {
        const symNode = doc.nodeMap.get(symId);
        if (symNode && isImportableNode(symNode) && symNode.type !== "INSTANCE") {
          const symRoot = convertFigNode(
            applySymbolOverrides(symNode, child),
            doc,
            ctx,
            converted.id,
            child,
          );
          const contentParentId = symRoot?.id ?? converted.id;
          await walkFigTreeAsync(symId, contentParentId, doc, ctx, child);
        } else {
          await walkFigTreeAsync(figKey, converted.id, doc, ctx, child);
        }
      } else {
        await walkFigTreeAsync(figKey, converted.id, doc, ctx, child);
      }
      if (converted.type === "frame" || converted.type === "group") {
        finalizeFigContainer(figKey, converted.id, doc, ctx, isImportableNode);
      }
      continue;
    }

    const converted = convertFigNode(child, doc, ctx, paytmParentId, instanceForOverrides);
    if (!converted) continue;
    await walkFigTreeAsync(figKey, converted.id, doc, ctx, instanceForOverrides);
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

function walkFigTree(
  figParentId: string,
  paytmParentId: string | null,
  doc: FigDocument,
  ctx: ImportCtx,
  instanceForOverrides?: FigNode | null,
): void {
  for (const child of sortedFigChildren(doc, figParentId)) {
    const figKey = nodeId(child);
    if (!figKey || child.phase === "REMOVED") continue;

    if (PASS_THROUGH_TYPES.has(child.type)) {
      walkFigTree(figKey, paytmParentId, doc, ctx, instanceForOverrides);
      continue;
    }

    if (!isImportableNode(child)) continue;

    if (child.type === "INSTANCE") {
      const converted = convertFigNode(child, doc, ctx, paytmParentId);
      if (!converted) continue;

      const symId = symbolRootKey(child);
      const masterId = symId ? ctx.componentMasters.get(symId) : undefined;
      const overrides = instanceOverridesFromSymbol(child, ctx.idMap, ctx.variableColors);

      if (symId && masterId) {
        hydrateSymbolMasterSync(symId, masterId, doc, ctx, walkFigTree, isImportableNode);
        removeImportedNode(ctx, converted.id, paytmParentId);
        importFigInstanceFromMaster(ctx, {
          masterId,
          paytmParentId,
          placement: converted,
          overrides,
          figInstanceKey: figKey,
          doc,
          isImportable: isImportableNode,
        });
        continue;
      }

      const instanceNode: EditorNode = {
        ...ctx.nodes[converted.id]!,
        ...(Object.keys(overrides).length > 0 ? { instanceOverrides: overrides } : {}),
      };
      ctx.nodes[converted.id] = instanceNode;

      let contentParentId = converted.id;
      if (symId) {
        const symNode = doc.nodeMap.get(symId);
        if (symNode && isImportableNode(symNode) && symNode.type !== "INSTANCE") {
          const symRoot = convertFigNode(
            applySymbolOverrides(symNode, child),
            doc,
            ctx,
            converted.id,
            child,
          );
          if (symRoot) contentParentId = symRoot.id;
        }
        walkFigTree(symId, contentParentId, doc, ctx, child);
      } else {
        walkFigTree(figKey, converted.id, doc, ctx, child);
      }
      if (converted.type === "frame" || converted.type === "group") {
        finalizeFigContainer(figKey, converted.id, doc, ctx, isImportableNode);
      }
      continue;
    }

    const converted = convertFigNode(child, doc, ctx, paytmParentId, instanceForOverrides);
    if (!converted) continue;
    walkFigTree(figKey, converted.id, doc, ctx, instanceForOverrides);
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

export async function convertFigBytesToPaytmCraftAsync(
  bytes: Uint8Array,
  fileName: string,
  onProgress?: FigImportProgress,
): Promise<FigImportResult> {
  resetImportYieldTick();
  onProgress?.("Decoding Figma document…");
  return convertFigBytesToPaytmCraft(bytes, fileName);
}

/** Synchronous import (worker thread only). */
export function convertFigBytesToPaytmCraft(
  bytes: Uint8Array,
  fileName: string,
): FigImportResult {
  try {
    const fig = parseFig(bytes);
    return buildPaytmCraftFromFigSync(fig, fileName);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not parse .fig file.",
    };
  }
}

async function buildPaytmCraftFromFig(
  fig: FigDocument,
  fileName: string,
  onProgress?: FigImportProgress,
): Promise<FigImportResult> {
  try {
    const canvases = pageCanvases(fig);
    if (canvases.length === 0) {
      return { ok: false, error: "No Figma pages found in this file." };
    }

    const baseName = fileName.replace(/\.fig$/i, "").trim() || "Imported Figma";
    const figDocumentName =
      ((fig.meta?.file_name as string) || (fig.meta?.name as string) || "").trim() || undefined;
    const pages: NonNullable<PaytmCraftDocument["pages"]> = [];
    const mergedAssets: Record<string, EditorAsset> = {};
    const variableColors = buildVariableColorMap(fig);
    const variableTokens = buildDesignTokensFromFig(fig);
    const textStyleTokens = buildTextStyleTokensFromFig(fig);
    const designTokens = mergeDesignTokens(variableTokens.tokens, textStyleTokens.tokens);
    const tokensByVariableKey = buildTokensByVariableKey(variableTokens.tokensByVariableKey);
    const rootFrameFills: string[] = [];
    let pageIndex = 0;
    const mergedFidelityCaptures = new Map<string, FigImportFidelityCapture>();

    for (const canvas of canvases) {
      const canvasId = nodeId(canvas);
      if (!canvasId) continue;

      const ctx = createImportCtx({
        nodes: {},
        childOrder: { [ROOT]: [] },
        assets: {},
        idMap: new Map(),
        variableColors,
        vectorPathsCache: new Map(),
        componentMasters: new Map(),
        tokensByVariableKey,
        styleKeyToTokenId: textStyleTokens.styleKeyToTokenId,
        seq: pageIndex * 10_000,
        onProgress,
      });

      onProgress?.(`Importing page: ${canvas.name || `Page ${pageIndex + 1}`}…`);
      await yieldImportTick(1);

      onProgress?.("Indexing components…");
      await yieldImportTick(1);
      importFigmaComponentLibrary(fig, ctx, {
        walkFigTree,
        convertFigNode,
        nextId,
        appendChild,
        finalizeContainer: (figKey, paytmId) =>
          finalizeFigContainer(figKey, paytmId, fig, ctx, isImportableNode),
      });

      const screenRoots = pickCanvasScreenRoots(fig, canvasId, {
        fileName,
        figDocumentName,
        pageName: canvas.name,
      });
      if (screenRoots.length === 0) continue;

      const screenLabel = screenRoots[0]?.name?.trim() || baseName;
      onProgress?.(`Importing screen: ${screenLabel}…`);

      await importCanvasScreenRootsAsync(fig, canvasId, ctx, screenRoots);
      finalizeFigPageImport(ctx);
      await yieldImportTick(1);

      if ((ctx.childOrder[ROOT] ?? []).length === 0) continue;

      for (const [kid, cap] of ctx.fidelityCaptures ?? []) {
        mergedFidelityCaptures.set(kid, cap);
      }

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
          zoom: DEFAULT_CANVAS_ZOOM,
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
    const rootIds = first.childOrder[ROOT] ?? [];
    const fitRootIds = pickViewportRootIds(first.nodes, rootIds);
    const viewport = viewportForRootNodes(first.nodes, rootIds, 1200, 800, { fit: "primary" });
    const firstCanvas = first.canvas ?? {
      zoom: DEFAULT_CANVAS_ZOOM,
      panX: 40,
      panY: 24,
      showGrid: false,
    };

    const document: PaytmCraftDocument = {
      version: 1,
      name: (fig.meta?.file_name as string) || (fig.meta?.name as string) || baseName,
      savedAt: new Date().toISOString(),
      nodes: first.nodes,
      childOrder: first.childOrder,
      pages,
      activePageId: first.id,
      assets: mergedAssets,
      designTokens,
      selectedIds: fitRootIds.slice(0, 1),
      canvas: {
        ...firstCanvas,
        zoom: viewport?.zoom ?? firstCanvas.zoom,
        panX: viewport?.pan.x ?? firstCanvas.panX,
        panY: viewport?.pan.y ?? firstCanvas.panY,
        showGrid: firstCanvas.showGrid ?? false,
      },
    };

    if (viewport) {
      for (const page of pages) {
        const pageCanvas = page.canvas ?? {
          zoom: DEFAULT_CANVAS_ZOOM,
          panX: 40,
          panY: 24,
          showGrid: false,
        };
        page.canvas = {
          ...pageCanvas,
          zoom: viewport.zoom,
          panX: viewport.pan.x,
          panY: viewport.pan.y,
          showGrid: pageCanvas.showGrid ?? false,
        };
      }
    }

    onProgress?.("Finalizing canvas…");
    const figFidelityCaptures = mergedFidelityCaptures.size
      ? Object.fromEntries(mergedFidelityCaptures)
      : undefined;
    return { ok: true, document, figFidelityCaptures };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not import Figma layers.",
    };
  }
}

function buildPaytmCraftFromFigSync(fig: FigDocument, fileName: string): FigImportResult {
  try {
    const canvases = pageCanvases(fig);
    if (canvases.length === 0) {
      return { ok: false, error: "No Figma pages found in this file." };
    }

    const baseName = fileName.replace(/\.fig$/i, "").trim() || "Imported Figma";
    const figDocumentName =
      ((fig.meta?.file_name as string) || (fig.meta?.name as string) || "").trim() || undefined;
    const pages: NonNullable<PaytmCraftDocument["pages"]> = [];
    const mergedAssets: Record<string, EditorAsset> = {};
    const variableColors = buildVariableColorMap(fig);
    const variableTokens = buildDesignTokensFromFig(fig);
    const textStyleTokens = buildTextStyleTokensFromFig(fig);
    const designTokens = mergeDesignTokens(variableTokens.tokens, textStyleTokens.tokens);
    const tokensByVariableKey = buildTokensByVariableKey(variableTokens.tokensByVariableKey);
    const rootFrameFills: string[] = [];
    let pageIndex = 0;
    const mergedFidelityCaptures = new Map<string, FigImportFidelityCapture>();

    for (const canvas of canvases) {
      const canvasId = nodeId(canvas);
      if (!canvasId) continue;

      const ctx = createImportCtx({
        nodes: {},
        childOrder: { [ROOT]: [] },
        assets: {},
        idMap: new Map(),
        variableColors,
        vectorPathsCache: new Map(),
        componentMasters: new Map(),
        tokensByVariableKey,
        styleKeyToTokenId: textStyleTokens.styleKeyToTokenId,
        seq: pageIndex * 10_000,
      });

      importFigmaComponentLibrary(fig, ctx, {
        walkFigTree,
        convertFigNode,
        nextId,
        appendChild,
        finalizeContainer: (figKey, paytmId) =>
          finalizeFigContainer(figKey, paytmId, fig, ctx, isImportableNode),
      });

      const screenRoots = pickCanvasScreenRoots(fig, canvasId, {
        fileName,
        figDocumentName,
        pageName: canvas.name,
      });
      if (screenRoots.length === 0) continue;

      importCanvasScreenRoots(fig, canvasId, ctx, screenRoots);
      finalizeFigPageImport(ctx);

      if ((ctx.childOrder[ROOT] ?? []).length === 0) continue;

      for (const [kid, cap] of ctx.fidelityCaptures ?? []) {
        mergedFidelityCaptures.set(kid, cap);
      }

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
          zoom: DEFAULT_CANVAS_ZOOM,
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
    const rootIds = first.childOrder[ROOT] ?? [];
    const fitRootIds = pickViewportRootIds(first.nodes, rootIds);
    const viewport = viewportForRootNodes(first.nodes, rootIds, 1200, 800, { fit: "primary" });
    const firstCanvas = first.canvas ?? {
      zoom: DEFAULT_CANVAS_ZOOM,
      panX: 40,
      panY: 24,
      showGrid: false,
    };

    const document: PaytmCraftDocument = {
      version: 1,
      name: (fig.meta?.file_name as string) || (fig.meta?.name as string) || baseName,
      savedAt: new Date().toISOString(),
      nodes: first.nodes,
      childOrder: first.childOrder,
      pages,
      activePageId: first.id,
      assets: mergedAssets,
      designTokens,
      selectedIds: fitRootIds.slice(0, 1),
      canvas: {
        ...firstCanvas,
        zoom: viewport?.zoom ?? firstCanvas.zoom,
        panX: viewport?.pan.x ?? firstCanvas.panX,
        panY: viewport?.pan.y ?? firstCanvas.panY,
        showGrid: firstCanvas.showGrid ?? false,
      },
    };

    if (viewport) {
      for (const page of pages) {
        const pageCanvas = page.canvas ?? {
          zoom: DEFAULT_CANVAS_ZOOM,
          panX: 40,
          panY: 24,
          showGrid: false,
        };
        page.canvas = {
          ...pageCanvas,
          zoom: viewport.zoom,
          panX: viewport.pan.x,
          panY: viewport.pan.y,
          showGrid: pageCanvas.showGrid ?? false,
        };
      }
    }

    const figFidelityCaptures = mergedFidelityCaptures.size
      ? Object.fromEntries(mergedFidelityCaptures)
      : undefined;
    return { ok: true, document, figFidelityCaptures };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not import Figma layers.",
    };
  }
}

/** @internal Exported for unit tests only. */
export const __figImportTest = {
  applySymbolOverrides,
  figDisplayName,
  figLineHeightMultiplier,
  figLetterSpacingPx,
  dominantTextFillFromRuns,
  fillsForFigNode,
  resolvePaintList,
  solidFillFromPaints,
};
