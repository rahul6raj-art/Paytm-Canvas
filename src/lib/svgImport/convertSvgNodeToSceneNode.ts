import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { reconcileHierarchyLight } from "@/lib/editorGraph";
import type { NodeEffect } from "@/lib/nodeEffects";
import { applyPendingSvgEffects, type PendingSvgEffect } from "@/lib/svgImport/applySvgEffects";
import { convertSvgTextElement } from "@/lib/svgImport/convertSvgText";
import { fitSvgImportGroupBounds } from "@/lib/svgImport/fitGroupBounds";
import { SVG_IMPORT_NODE_HARD_CAP, svgImportNodeLimitMessage } from "@/lib/svgImport/importLimits";
import { dashFromSvgStrokeDasharray } from "@/lib/svgImport/parseDashArray";
import type { EditorAsset } from "@/lib/documentPersistence";
import { convertSvgPathToVector } from "@/lib/svgImport/convertSvgPathToVector";
import { parseFilterBlurEffect } from "@/lib/svgImport/parseFilters";
import { patternFillOpacity, solidColorPatternDataUrl } from "@/lib/svgImport/parsePatterns";
import { parseTransformList } from "@/lib/svgImport/parseTransform";
import type { SvgElement } from "@/lib/svgImport/parseSvg";
import {
  parseInlineStyle,
  resolvePaint,
  SVG_DEFAULT_PAINT,
  type PaintState,
} from "@/lib/svgImport/parseStyles";
import { collectCssFromSvg, collectDefs, type DefsRegistry } from "@/lib/svgImport/resolveDefs";
import type { SvgImportDiagnostics } from "@/lib/svgImport/svgImportDiagnostics";
import { warnDiag, warnUnsupportedElement } from "@/lib/svgImport/svgImportDiagnostics";
import { readSvgEffectRef } from "@/lib/svgImport/svgUrlRefs";
import {
  invertMatrixSafe,
  parseLength,
  parseViewBox,
  viewBoxRootMatrix,
} from "@/lib/svgImport/svgMatrix";
import {
  applyMatrixToPoint,
  getMatrixRotationDegrees,
  identityMatrix,
  multiplyMatrix,
  translateMatrix,
  type Matrix2D,
} from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

export type SvgImportResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  rootId: string;
  diagnostics: SvgImportDiagnostics;
};

type ImportCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  seq: number;
  defs: DefsRegistry;
  css: Map<string, Record<string, string>>;
  diag: SvgImportDiagnostics;
  pendingEffects: PendingSvgEffect[];
  rootMatrix: Matrix2D;
};

const GROUP_TAGS = new Set(["g", "a", "svg"]);
const RENDER_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "image",
  "use",
]);

function nextId(ctx: ImportCtx, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}-${ctx.seq}-${Math.random().toString(36).slice(2, 7)}`;
}

function appendChild(ctx: ImportCtx, parentId: string, childId: string): void {
  const list = ctx.childOrder[parentId] ?? [];
  if (!list.includes(childId)) ctx.childOrder[parentId] = [...list, childId];
}

function layerName(el: SvgElement, fallback: string): string {
  return el.getAttr("id") || el.getAttr("data-name") || fallback;
}

function isHidden(el: SvgElement): boolean {
  const style = parseInlineStyle(el.getAttr("style"));
  const display = style.display ?? el.getAttr("display");
  const visibility = style.visibility ?? el.getAttr("visibility");
  return display === "none" || visibility === "hidden";
}

function noteClipOrMask(ctx: ImportCtx, hostId: string, el: SvgElement): void {
  const clipId = readSvgEffectRef(el, "clip-path", "clip-path");
  const maskId = readSvgEffectRef(el, "mask", "mask");
  if (clipId) ctx.pendingEffects.push({ hostId, defId: clipId, kind: "clip" });
  if (maskId) ctx.pendingEffects.push({ hostId, defId: maskId, kind: "mask" });
}

function resolveFilterEffects(el: SvgElement, ctx: ImportCtx): NodeEffect[] | undefined {
  const style = parseInlineStyle(el.getAttr("style"));
  const filterRef = readSvgEffectRef(el, "filter", "filter") ?? style.filter;
  if (!filterRef) return undefined;
  const entry = ctx.defs.filters.get(filterRef);
  if (!entry) {
    warnDiag(ctx.diag, `filter references unknown id: ${filterRef}`);
    return undefined;
  }
  if (entry.blur) return [entry.blur];
  const blur = parseFilterBlurEffect(entry.el);
  return blur ? [blur] : undefined;
}

function elementTransformMatrix(el: SvgElement, diag: SvgImportDiagnostics): Matrix2D {
  const raw = el.getAttr("transform");
  const m = parseTransformList(raw, diag.warnings);
  if (raw && m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0) {
    diag.failedTransforms.push(raw);
  }
  return m;
}

function matrixToPlacement(
  m: Matrix2D,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number; rotation: number } {
  const corners = [
    applyMatrixToPoint(m, { x, y }),
    applyMatrixToPoint(m, { x: x + w, y }),
    applyMatrixToPoint(m, { x: x + w, y: y + h }),
    applyMatrixToPoint(m, { x, y: y + h }),
  ];
  const minX = Math.min(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxX = Math.max(...corners.map((c) => c.x));
  const maxY = Math.max(...corners.map((c) => c.y));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    rotation: getMatrixRotationDegrees(m),
  };
}

/** Map world-space geometry into the immediate parent's local coordinate system. */
function worldToParentLocal(
  worldMatrix: Matrix2D,
  placementParentWorldM: Matrix2D,
  geomX: number,
  geomY: number,
  geomW: number,
  geomH: number,
): { x: number; y: number; width: number; height: number; rotation: number } {
  const placement = matrixToPlacement(worldMatrix, geomX, geomY, geomW, geomH);
  const parentInv = invertMatrixSafe(placementParentWorldM);
  const localOrigin = applyMatrixToPoint(parentInv, { x: placement.x, y: placement.y });
  return {
    x: localOrigin.x,
    y: localOrigin.y,
    width: placement.width,
    height: placement.height,
    rotation: placement.rotation,
  };
}

function resolveGradientUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^url\(#([^)]+)\)$/i);
  return m?.[1] ?? null;
}

function resolveGradientFill(
  _el: SvgElement,
  _ctx: ImportCtx,
  _targetShape: { width: number; height: number },
  _attr: "fill" | "stroke" = "fill",
): EditorNode["fillGradient"] | undefined {
  return undefined;
}

function resolvePatternFillAsset(
  el: SvgElement,
  ctx: ImportCtx,
): { assetId: string; dataUrl: string } | undefined {
  const style = parseInlineStyle(el.getAttr("style"));
  const fill = el.getAttr("fill") ?? style.fill;
  const id = resolveGradientUrl(fill);
  if (!id) return undefined;
  const pattern = ctx.defs.patterns.get(id);
  if (!pattern) return undefined;
  const opacity = patternFillOpacity(el);
  const dataUrl = solidColorPatternDataUrl(pattern.fallbackColor, opacity);
  const assetId = nextId(ctx, "svg-pattern");
  ctx.assets[assetId] = {
    id: assetId,
    name: `Pattern ${id}`,
    mimeType: "image/png",
    dataUrl,
    createdAt: new Date().toISOString(),
    width: pattern.width,
    height: pattern.height,
  };
  return { assetId, dataUrl };
}

function applyStrokeAndDash(node: EditorNode, paint: PaintState): void {
  const dash = dashFromSvgStrokeDasharray(paint.strokeDasharray);
  if (dash) {
    if (dash.strokeStyle) node.strokeStyle = dash.strokeStyle;
    if (dash.strokeDashLength != null) node.strokeDashLength = dash.strokeDashLength;
    if (dash.strokeDashGap != null) node.strokeDashGap = dash.strokeDashGap;
  }
}

function baseNode(
  id: string,
  parentId: string,
  type: EditorNode["type"],
  name: string,
  placement: { x: number; y: number; width: number; height: number; rotation: number },
  paint: PaintState,
): EditorNode {
  const node: EditorNode = {
    id,
    parentId,
    type,
    name,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    rotation: placement.rotation,
    visible: true,
    locked: false,
    expanded: true,
    fill: paint.fill,
    fillEnabled: paint.fillEnabled,
    fillOpacity: paint.fillOpacity,
    strokeColor: paint.stroke,
    strokeWidth: paint.strokeWidth,
    strokeEnabled: paint.strokeEnabled,
    strokeOpacity: paint.strokeOpacity,
    strokeLinecap: paint.strokeLinecap,
    strokeLinejoin: paint.strokeLinejoin,
    opacity: paint.opacity,
  };
  if (paint.fillType === "gradient" && paint.fillGradient) {
    node.fillType = "gradient";
    node.fillGradient = paint.fillGradient;
  }
  if (paint.fillRule === "evenodd") node.pathFillRule = "evenodd";
  applyStrokeAndDash(node, paint);
  return node;
}

function finalizeNode(
  node: EditorNode,
  el: SvgElement,
  ctx: ImportCtx,
  hostId: string,
  shapeSize?: { width: number; height: number },
): EditorNode {
  const effects = resolveFilterEffects(el, ctx);
  if (effects?.length) node.effects = effects;

  const pattern = resolvePatternFillAsset(el, ctx);
  if (pattern) {
    node.fillPatternAssetId = pattern.assetId;
    node.fillType = "pattern";
    node.fillEnabled = true;
  }

  if (shapeSize) {
    const strokeGrad = resolveGradientFill(el, ctx, shapeSize, "stroke");
    if (strokeGrad) {
      node.strokeType = "gradient";
      node.strokeGradient = strokeGrad;
      node.strokeEnabled = paintStrokeEnabled(el, ctx);
    }
  }

  noteClipOrMask(ctx, hostId, el);
  return node;
}

function paintStrokeEnabled(el: SvgElement, _ctx: ImportCtx): boolean {
  const style = parseInlineStyle(el.getAttr("style"));
  const strokeAttr = el.getAttr("stroke") ?? style.stroke;
  if (!strokeAttr || strokeAttr === "none") return false;
  if (/^url\(/i.test(strokeAttr.trim())) return false;
  return true;
}

function polylineAttrToPathD(raw: string, closed: boolean): string | null {
  const nums = raw
    .trim()
    .split(/[\s,]+/)
    .map((v) => parseFloat(v))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 4) return null;
  let d = `M ${nums[0]} ${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) {
    d += ` L ${nums[i]} ${nums[i + 1]}`;
  }
  if (closed) d += " Z";
  return d;
}

function createPathNode(
  ctx: ImportCtx,
  parentId: string,
  accumWorldM: Matrix2D,
  placementParentWorldM: Matrix2D,
  name: string,
  pathD: string,
  el: SvgElement,
  paintIn: PaintState,
): string | null {
  const fillRule = resolvePaint(el, paintIn, ctx.css, undefined).fillRule;
  const localized = convertSvgPathToVector(
    pathD,
    accumWorldM,
    placementParentWorldM,
    fillRule,
    ctx.diag.warnings,
  );
  if (!localized) {
    warnDiag(ctx.diag, `Failed to convert path: ${name}`);
    return null;
  }
  const paint = resolvePaint(
    el,
    paintIn,
    ctx.css,
    resolveGradientFill(el, ctx, { width: localized.width, height: localized.height }),
  );
  const id = nextId(ctx, "svg-path");
  const node = baseNode(
    id,
    parentId,
    "path",
    name,
    {
      x: localized.x,
      y: localized.y,
      width: localized.width,
      height: localized.height,
      rotation: 0,
    },
    paint,
  );
  node.pathPoints = localized.pathPoints;
  node.pathClosed = localized.pathClosed;
  if (localized.pathFillRule) node.pathFillRule = localized.pathFillRule;
  if (localized.flattenedPathData) node.flattenedPathData = localized.flattenedPathData;
  ctx.nodes[id] = finalizeNode(node, el, ctx, id, {
    width: localized.width,
    height: localized.height,
  });
  appendChild(ctx, parentId, id);
  return id;
}

function convertShape(
  el: SvgElement,
  parentId: string,
  accumWorldM: Matrix2D,
  placementParentWorldM: Matrix2D,
  paintIn: PaintState,
  ctx: ImportCtx,
): void {
  if (isHidden(el)) return;
  const localM = elementTransformMatrix(el, ctx.diag);
  const worldM = multiplyMatrix(accumWorldM, localM);
  const tag = el.tagLower;

  const paintForShape = (width: number, height: number) =>
    resolvePaint(
      el,
      paintIn,
      ctx.css,
      resolveGradientFill(el, ctx, { width, height }),
    );

  if (tag === "rect") {
    const rw = parseLength(el.getAttr("width"));
    const rh = parseLength(el.getAttr("height"));
    if (rw <= 0 || rh <= 0) return;
    const rx = parseLength(el.getAttr("x"));
    const ry = parseLength(el.getAttr("y"));
    const placement = worldToParentLocal(worldM, placementParentWorldM, rx, ry, rw, rh);
    const paint = paintForShape(rw, rh);
    const id = nextId(ctx, "svg-rect");
    const node = baseNode(id, parentId, "rectangle", layerName(el, "Rectangle"), placement, paint);
    const corner = parseLength(el.getAttr("rx")) || parseLength(el.getAttr("ry"));
    if (corner > 0) node.cornerRadius = corner;
    ctx.nodes[id] = finalizeNode(node, el, ctx, id, { width: rw, height: rh });
    appendChild(ctx, parentId, id);
    return;
  }

  if (tag === "circle") {
    const r = parseLength(el.getAttr("r"));
    if (r <= 0) return;
    const cx = parseLength(el.getAttr("cx"));
    const cy = parseLength(el.getAttr("cy"));
    const placement = worldToParentLocal(worldM, placementParentWorldM, cx - r, cy - r, r * 2, r * 2);
    const paint = paintForShape(r * 2, r * 2);
    const id = nextId(ctx, "svg-circle");
    ctx.nodes[id] = finalizeNode(
      baseNode(id, parentId, "ellipse", layerName(el, "Ellipse"), placement, paint),
      el,
      ctx,
      id,
      { width: r * 2, height: r * 2 },
    );
    appendChild(ctx, parentId, id);
    return;
  }

  if (tag === "ellipse") {
    const rx = parseLength(el.getAttr("rx"));
    const ry = parseLength(el.getAttr("ry"));
    if (rx <= 0 || ry <= 0) return;
    const cx = parseLength(el.getAttr("cx"));
    const cy = parseLength(el.getAttr("cy"));
    const placement = worldToParentLocal(worldM, placementParentWorldM, cx - rx, cy - ry, rx * 2, ry * 2);
    const paint = paintForShape(rx * 2, ry * 2);
    const id = nextId(ctx, "svg-ellipse");
    ctx.nodes[id] = finalizeNode(
      baseNode(id, parentId, "ellipse", layerName(el, "Ellipse"), placement, paint),
      el,
      ctx,
      id,
      { width: rx * 2, height: ry * 2 },
    );
    appendChild(ctx, parentId, id);
    return;
  }

  if (tag === "line") {
    const x1 = parseLength(el.getAttr("x1"));
    const y1 = parseLength(el.getAttr("y1"));
    const x2 = parseLength(el.getAttr("x2"));
    const y2 = parseLength(el.getAttr("y2"));
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const lw = Math.max(1, Math.abs(x2 - x1));
    const lh = Math.max(1, Math.abs(y2 - y1));
    const placement = worldToParentLocal(worldM, placementParentWorldM, minX, minY, lw, lh);
    const paint = paintForShape(lw, lh);
    const id = nextId(ctx, "svg-line");
    const node = baseNode(id, parentId, "line", layerName(el, "Line"), placement, paint);
    const p1 = applyMatrixToPoint(worldM, { x: x1, y: y1 });
    const p2 = applyMatrixToPoint(worldM, { x: x2, y: y2 });
    const parentInv = invertMatrixSafe(placementParentWorldM);
    const l1 = applyMatrixToPoint(parentInv, p1);
    const l2 = applyMatrixToPoint(parentInv, p2);
    node.lineX1 = l1.x;
    node.lineY1 = l1.y;
    node.lineX2 = l2.x;
    node.lineY2 = l2.y;
    ctx.nodes[id] = finalizeNode(node, el, ctx, id, { width: lw, height: lh });
    appendChild(ctx, parentId, id);
    return;
  }

  if (tag === "polyline" || tag === "polygon") {
    const raw = el.getAttr("points");
    if (!raw) return;
    const pathD = polylineAttrToPathD(raw, tag === "polygon");
    if (!pathD) return;
    createPathNode(ctx, parentId, worldM, placementParentWorldM, layerName(el, tag === "polygon" ? "Polygon" : "Polyline"), pathD, el, paintIn);
    return;
  }

  if (tag === "path") {
    const d = el.getAttr("d");
    if (!d) return;
    createPathNode(ctx, parentId, worldM, placementParentWorldM, layerName(el, "Vector"), d, el, paintIn);
    return;
  }

  if (tag === "text") {
    const paint = paintForShape(100, 24);
    convertSvgTextElement(el, parentId, worldM, placementParentWorldM, paint, ctx, {
      nextId,
      appendChild,
      baseNode,
      worldToParentLocal,
      layerName,
    });
    return;
  }

  if (tag === "image") {
    const href = el.getAttr("href") ?? el.getAttr("xlink:href");
    if (!href) return;
    const iw = parseLength(el.getAttr("width"), 100);
    const ih = parseLength(el.getAttr("height"), 100);
    const ix = parseLength(el.getAttr("x"));
    const iy = parseLength(el.getAttr("y"));
    const placement = worldToParentLocal(worldM, placementParentWorldM, ix, iy, iw, ih);
    const paint = paintForShape(iw, ih);
    const assetId = nextId(ctx, "svg-asset");
    ctx.assets[assetId] = {
      id: assetId,
      name: layerName(el, "Image"),
      mimeType: href.startsWith("data:") ? href.slice(5, href.indexOf(";")) : "image/png",
      dataUrl: href.startsWith("data:") ? href : href,
      createdAt: new Date().toISOString(),
      width: iw,
      height: ih,
    };
    const id = nextId(ctx, "svg-image");
    const node = baseNode(id, parentId, "image", layerName(el, "Image"), placement, paint);
    node.assetId = assetId;
    node.imageSrc = ctx.assets[assetId]!.dataUrl;
    node.imageFitMode = "fill";
    ctx.nodes[id] = finalizeNode(node, el, ctx, id, { width: iw, height: ih });
    appendChild(ctx, parentId, id);
    return;
  }

  if (tag === "use") {
    const href = el.getAttr("href") ?? el.getAttr("xlink:href");
    const refId = href?.startsWith("#") ? href.slice(1) : href;
    if (!refId) return;
    const ref = ctx.defs.elements.get(refId) ?? ctx.defs.symbols.get(refId);
    if (!ref) {
      warnDiag(ctx.diag, `<use> references unknown id: ${refId}`);
      return;
    }
    const ux = parseLength(el.getAttr("x"));
    const uy = parseLength(el.getAttr("y"));
    const useM = multiplyMatrix(worldM, translateMatrix(ux, uy));
    expandUseReference(ref, parentId, useM, placementParentWorldM, paintIn, ctx);
  }
}

function expandUseReference(
  ref: SvgElement,
  parentId: string,
  useM: Matrix2D,
  placementParentWorldM: Matrix2D,
  paintIn: PaintState,
  ctx: ImportCtx,
): void {
  const tag = ref.tagLower;
  if (tag === "symbol" || GROUP_TAGS.has(tag)) {
    for (const child of ref.childElements()) {
      convertElement(child, parentId, useM, placementParentWorldM, paintIn, ctx);
    }
    return;
  }
  if (RENDER_TAGS.has(tag) && tag !== "use") {
    convertShape(ref, parentId, useM, placementParentWorldM, paintIn, ctx);
    return;
  }
  warnDiag(ctx.diag, `<use> references unsupported element: ${ref.tag}`);
}

function convertGroup(
  el: SvgElement,
  parentId: string,
  accumWorldM: Matrix2D,
  placementParentWorldM: Matrix2D,
  paintIn: PaintState,
  ctx: ImportCtx,
  opts?: { forceFrame?: boolean },
): string | null {
  if (isHidden(el)) return null;
  const paint = resolvePaint(el, paintIn, ctx.css);
  const localM = elementTransformMatrix(el, ctx.diag);
  const groupWorldM = multiplyMatrix(accumWorldM, localM);
  const groupPlacement = worldToParentLocal(groupWorldM, placementParentWorldM, 0, 0, 1, 1);
  const id = nextId(ctx, opts?.forceFrame ? "svg-frame" : "svg-group");
  const type = opts?.forceFrame ? "frame" : "group";
  const node = baseNode(
    id,
    parentId,
    type,
    layerName(el, opts?.forceFrame ? "SVG" : "Group"),
    { ...groupPlacement, width: 1, height: 1 },
    paint,
  );
  ctx.nodes[id] = node;
  appendChild(ctx, parentId, id);
  noteClipOrMask(ctx, id, el);

  for (const child of el.childElements()) {
    const tag = child.tagLower;
    if (tag === "defs" || tag === "style" || tag === "metadata" || tag === "title" || tag === "desc") continue;
    convertElement(child, id, groupWorldM, groupWorldM, paint, ctx);
  }
  return id;
}

function convertElement(
  el: SvgElement,
  parentId: string,
  accumWorldM: Matrix2D,
  placementParentWorldM: Matrix2D,
  paintIn: PaintState,
  ctx: ImportCtx,
): void {
  const tag = el.tagLower;
  if (tag === "defs" || tag === "style" || tag === "metadata" || tag === "title" || tag === "desc") return;
  if (GROUP_TAGS.has(tag)) {
    convertGroup(el, parentId, accumWorldM, placementParentWorldM, paintIn, ctx);
    return;
  }
  if (!RENDER_TAGS.has(tag)) {
    warnUnsupportedElement(ctx.diag, tag);
    return;
  }
  convertShape(el, parentId, accumWorldM, placementParentWorldM, paintIn, ctx);
}

export function convertSvgToSceneGraph(
  svg: SvgElement,
  fileName = "Imported SVG",
  diag?: SvgImportDiagnostics,
): SvgImportResult | null {
  const viewBox = parseViewBox(svg.getAttr("viewBox"));
  const viewportW = viewBox.width || parseLength(svg.getAttr("width"), 100);
  const viewportH = viewBox.height || parseLength(svg.getAttr("height"), 100);
  if (viewportW <= 0 || viewportH <= 0) return null;

  const diagnostics = diag ?? {
    warnings: [],
    unsupportedElements: [],
    unsupportedAttributes: [],
    unsupportedPathCommands: [],
    failedTransforms: [],
  };

  const ctx: ImportCtx = {
    nodes: {},
    childOrder: { [EDITOR_ROOT_KEY]: [] },
    assets: {},
    seq: 0,
    defs: collectDefs(svg, diagnostics),
    css: collectCssFromSvg(svg),
    diag: diagnostics,
    pendingEffects: [],
    rootMatrix: identityMatrix(),
  };

  const rootId = nextId(ctx, "svg-root");
  const baseName = fileName.replace(/\.[^.]+$/, "") || "Imported SVG";
  const rootNode: EditorNode = {
    id: rootId,
    parentId: null,
    type: "frame",
    name: baseName,
    x: 0,
    y: 0,
    width: Math.max(1, viewportW),
    height: Math.max(1, viewportH),
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
    clipChildren: false,
  };
  ctx.nodes[rootId] = rootNode;
  ctx.childOrder[rootId] = [];

  ctx.rootMatrix = viewBoxRootMatrix(
    viewBox.width > 0 ? viewBox : { minX: 0, minY: 0, width: viewportW, height: viewportH },
    viewportW,
    viewportH,
    svg.getAttr("preserveAspectRatio"),
  );

  for (const child of svg.childElements()) {
    const tag = child.tagLower;
    if (tag === "defs" || tag === "style" || tag === "metadata" || tag === "title" || tag === "desc") continue;
    convertElement(child, rootId, ctx.rootMatrix, ctx.rootMatrix, SVG_DEFAULT_PAINT, ctx);
  }

  if ((ctx.childOrder[rootId] ?? []).length === 0) return null;

  const nodeCount = Object.keys(ctx.nodes).length;
  if (nodeCount > SVG_IMPORT_NODE_HARD_CAP) {
    warnDiag(
      diagnostics,
      svgImportNodeLimitMessage(nodeCount) ?? `SVG exceeds ${SVG_IMPORT_NODE_HARD_CAP} layer limit.`,
    );
    return null;
  }
  const warnMsg = svgImportNodeLimitMessage(nodeCount);
  if (warnMsg && nodeCount <= SVG_IMPORT_NODE_HARD_CAP) {
    warnDiag(diagnostics, warnMsg);
  }

  ctx.nodes = fitSvgImportGroupBounds(ctx.nodes, ctx.childOrder, rootId);

  const applied = applyPendingSvgEffects(
    ctx.nodes,
    ctx.childOrder,
    ctx.defs,
    diagnostics,
    ctx.pendingEffects,
    ctx.rootMatrix,
  );
  ctx.nodes = applied.nodes;
  ctx.childOrder = applied.childOrder;

  diagnostics.boundsComparison = {
    viewBox: viewBox.width > 0 ? viewBox : { minX: 0, minY: 0, width: viewportW, height: viewportH },
    imported: { x: 0, y: 0, width: viewportW, height: viewportH },
  };

  const repaired = reconcileHierarchyLight(ctx.nodes, ctx.childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    assets: ctx.assets,
    rootId,
    diagnostics,
  };
}
