import type { EditorAsset } from "@/lib/documentPersistence";
import type { CanvasColorMode, DesignToken } from "@/lib/designTokens";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { getNodeWorldMatrixFromChildOrder, layerPanelChildIds, topLevelSelectedIds } from "@/lib/editorGraph";
import { applyMatrixToPoint, composeSvgTransform, matrixToSvgTransform } from "@/lib/transformMath";
import type { EllipseArcPreview } from "@/lib/shapes/ellipseArc";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  collectNodeEffects,
  createSvgFilterRegistry,
  escXml,
  registerClipRect,
  resolveSceneRenderNode,
  svgImageMarkup,
  svgLine,
  svgPathMarkup,
  svgRectLike,
  svgSafeId,
  svgTextMarkup,
  wrapSvgNodeFilter,
} from "@/lib/svgMarkupCore";
import { shouldClipChildren } from "@/lib/clipChildren";
import { normalizeTextResizeMode } from "@/lib/text/textNodeModel";
import {
  compositeEditModeForDrag,
  isCompositeHiddenOperand,
} from "@/lib/compositeSelection";
import { buildBooleanRenderForGroup, isBooleanGroup } from "@/lib/booleanGeometry";
import { isMaskGroup, renderMaskGroupSvg } from "@/lib/mask";
import { booleanGroupSceneInnerMarkup } from "@/lib/codeExport/booleanRenderSvg";
import { effectiveFillType, fillPaintCss } from "@/lib/fillGradient";
import { gradientRenderScale } from "@/lib/gradient/svgSceneFill";
import { svgLayerBlendStyleAttr } from "@/lib/layerBlendMode";
import { maxEffectBleedPad } from "@/lib/nodeEffects";

const SUPPORTED_TYPES = new Set([
  "frame",
  "group",
  "rectangle",
  "ellipse",
  "line",
  "arrow",
  "polygon",
  "path",
  "text",
  "image",
]);

export type SvgDragPreview = {
  dx: number;
  dy: number;
  movingIds: readonly string[];
};

export type SvgSceneBuildInput = {
  rootIds: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets?: Record<string, EditorAsset>;
  designTokens?: Record<string, DesignToken>;
  excludeNodeIds?: ReadonlySet<string>;
  dragPreview?: SvgDragPreview;
  /** Live ellipse arc drag preview (canvas handles). */
  ellipseArcPreview?: EllipseArcPreview;
  /** Boolean group in object-edit mode shows operand children instead of composite. */
  objectEditModeNodeId?: string | null;
  selectedIds?: readonly string[];
  /** Viewport zoom — boosts angular/diamond gradient raster resolution when > 1. */
  zoom?: number;
  /** Semantic color token preview mode for library-linked fills. */
  colorMode?: CanvasColorMode;
  /** Linked page + token CSS for class→var color binding. */
  cssSources?: string[];
};

function collectMovingSubtreeIds(
  movingIds: readonly string[],
  childOrder: Record<string, string[]>,
): Set<string> {
  const out = new Set<string>();
  const walk = (id: string) => {
    out.add(id);
    for (const cid of childOrder[id] ?? []) walk(cid);
  };
  for (const id of movingIds) walk(id);
  return out;
}

function mergeExcludeSets(
  a: ReadonlySet<string> | undefined,
  b: ReadonlySet<string>,
): ReadonlySet<string> {
  if (!a?.size) return b;
  const out = new Set(a);
  b.forEach((id) => out.add(id));
  return out;
}

export type SvgRootLabel = {
  id: string;
  x: number;
  y: number;
  name: string;
  selected: boolean;
};

export type SvgSceneBuildResult = {
  defs: string;
  body: string;
  renderedNodeCount: number;
  warnings: string[];
  rootLabels: SvgRootLabel[];
};

type BuildCtx = {
  defs: string[];
  filterRegistry: ReturnType<typeof createSvgFilterRegistry>;
  rendered: number;
  warnings: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets?: Record<string, EditorAsset>;
  designTokens: Record<string, DesignToken>;
  excludeNodeIds?: ReadonlySet<string>;
  renderScale: number;
  ellipseArcPreview?: EllipseArcPreview;
  objectEditModeNodeId?: string | null;
  selectedIds?: readonly string[];
  colorMode: CanvasColorMode;
  cssSources?: string[];
};

function maxEffectBleedInSubtree(nodeId: string, ctx: BuildCtx): number {
  const node = ctx.nodes[nodeId];
  if (!node) return 0;
  const resolved = resolveSceneRenderNode(
    node,
    ctx.nodes,
    ctx.designTokens,
    ctx.colorMode,
    ctx.cssSources,
  );
  let pad = maxEffectBleedPad(resolved.effects);
  for (const cid of ctx.childOrder[nodeId] ?? []) {
    pad = Math.max(pad, maxEffectBleedInSubtree(cid, ctx));
  }
  return pad;
}

function registerClipRectWithEffectBleed(
  ctx: BuildCtx,
  clipId: string,
  nodeId: string,
  w: number,
  h: number,
  node: EditorNode,
): void {
  const bleed = maxEffectBleedInSubtree(nodeId, ctx);
  registerClipRect(ctx.defs, clipId, w, h, node, bleed);
}

function renderChildren(parentId: string, ctx: BuildCtx): string {
  const kids = layerPanelChildIds(parentId, ctx.nodes, ctx.childOrder);
  let out = "";
  for (const cid of kids) {
    const c = ctx.nodes[cid];
    if (!c?.visible) continue;
    const inner = renderNode(cid, ctx);
    if (inner) {
      const blend = svgLayerBlendStyleAttr(c);
      out += `<g transform="${composeSvgTransform(c)}"${blend}>${inner}</g>`;
    }
  }
  return out;
}

function renderNode(nodeId: string, ctx: BuildCtx): string {
  if (ctx.excludeNodeIds?.has(nodeId)) return "";
  const node = ctx.nodes[nodeId];
  if (!node?.visible) return "";
  if (!SUPPORTED_TYPES.has(node.type)) {
    ctx.warnings.push(`skipped:${node.type}:${nodeId}`);
    return "";
  }

  ctx.rendered += 1;
  const resolved = resolveSceneRenderNode(
    node,
    ctx.nodes,
    ctx.designTokens,
    ctx.colorMode,
    ctx.cssSources,
  );
  let paintNode = resolved;
  if (node.type === "ellipse" && ctx.ellipseArcPreview?.nodeId === nodeId) {
    paintNode = {
      ...resolved,
      arcStartDeg: ctx.ellipseArcPreview.startDeg,
      arcSweepDeg: ctx.ellipseArcPreview.sweepDeg,
      arcInnerRadiusRatio: ctx.ellipseArcPreview.innerRadiusRatio,
    };
  }
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const { effects, legacyShadow } = collectNodeEffects(node, paintNode, ctx.designTokens);
  const filterRef = ctx.filterRegistry.register(nodeId, effects, legacyShadow);

  const wrapOpacity = (inner: string) => {
    const op = paintNode.opacity ?? 1;
    return op < 0.999 ? `<g opacity="${op}">${inner}</g>` : inner;
  };

  const registerGradient = (id: string, markup: string) => {
    ctx.defs.push(markup);
  };
  const shapeOpts = { filterRef, nodeId, registerGradient, renderScale: ctx.renderScale, assets: ctx.assets };

  if (node.type === "rectangle" || node.type === "ellipse") {
    return wrapOpacity(svgRectLike(paintNode, shapeOpts));
  }

  if (node.type === "line" || node.type === "arrow") {
    return wrapOpacity(svgLine(node, nodeId));
  }

  if (node.type === "path" || node.type === "polygon") {
    return wrapOpacity(
      svgPathMarkup(paintNode, { ...shapeOpts, fillRule: node.pathFillRule }),
    );
  }

  if (node.type === "text") {
    const markup = svgTextMarkup(paintNode, shapeOpts);
    const resizeMode = normalizeTextResizeMode(node.textResizeMode, node.autoResize);
    let wrapped = markup;
    if (resizeMode !== "auto-width") {
      const clipId = `pc-text-clip-${svgSafeId(nodeId)}`;
      registerClipRect(ctx.defs, clipId, w, h);
      wrapped = `<g clip-path="url(#${clipId})">${wrapped}</g>`;
    }
    wrapped = wrapSvgNodeFilter(wrapped, filterRef);
    return wrapOpacity(wrapped);
  }

  if (node.type === "image") {
    const clipDefs = ctx.defs;
    const clipRegister = (id: string, markup: string) => {
      clipDefs.push(`<clipPath id="${id}">${markup}</clipPath>`);
    };
    return wrapOpacity(svgImageMarkup(node, resolved, ctx.assets, clipRegister));
  }

  if (node.type === "group" && isMaskGroup(node)) {
    const masked = renderMaskGroupSvg({
      groupId: nodeId,
      node,
      nodes: ctx.nodes,
      childOrder: ctx.childOrder,
      objectEditModeNodeId: ctx.objectEditModeNodeId,
      selectedIds: ctx.selectedIds ? [...ctx.selectedIds] : undefined,
      registerDef: (markup) => ctx.defs.push(markup),
      renderChild: (cid) => renderNode(cid, ctx),
      filterRef,
    });
    if (masked) return wrapOpacity(masked.bodyMarkup);
    return wrapOpacity(renderChildren(nodeId, ctx));
  }

  if (node.type === "group" && isBooleanGroup(node)) {
    const childIds = layerPanelChildIds(nodeId, ctx.nodes, ctx.childOrder).filter((cid) => {
      const c = ctx.nodes[cid];
      return c?.visible && !c.locked;
    });
    const editing = ctx.objectEditModeNodeId === nodeId;
    if (editing) {
      return wrapOpacity(renderChildren(nodeId, ctx));
    }
    const op = node.booleanOperation ?? "union";
    const booleanRender = buildBooleanRenderForGroup(
      nodeId,
      childIds,
      ctx.nodes,
      op,
      ctx.childOrder,
    );
    if (booleanRender) {
      const composite = booleanGroupSceneInnerMarkup({
        groupId: nodeId,
        node: paintNode,
        render: booleanRender,
        width: w,
        height: h,
        registerGradient: (id, markup) => registerGradient(id, markup),
        renderScale: ctx.renderScale,
        filterRef,
      });
      return wrapOpacity(composite);
    }
    return wrapOpacity(renderChildren(nodeId, ctx));
  }

  if (node.type === "group") {
    const clip = shouldClipChildren(node);
    const children = renderChildren(nodeId, ctx);
    const hasOwnFill = node.fillEnabled && node.fill != null;
    const hasOwnStroke = Boolean(node.strokeWidth && node.strokeColor);
    if (!clip && !hasOwnFill && !hasOwnStroke) {
      return wrapOpacity(wrapSvgNodeFilter(children, filterRef));
    }

    const stroke = hasOwnStroke ? resolved.strokeColor! : "rgba(15,23,42,0.12)";
    const shell = svgRectLike(
      {
        ...resolved,
        fill: resolved.fill ?? "transparent",
        strokeColor: stroke,
        strokeWidth: hasOwnStroke ? resolved.strokeWidth : 1,
      },
      {
        ...shapeOpts,
        strokeOverride: stroke,
        strokeWidthOverride: hasOwnStroke ? resolved.strokeWidth : 1,
      },
    );
    if (!clip) return wrapOpacity(`${shell}${children}`);
    const clipId = `pc-clip-${svgSafeId(nodeId)}`;
    registerClipRectWithEffectBleed(ctx, clipId, nodeId, w, h, node);
    return wrapOpacity(`${shell}<g clip-path="url(#${clipId})">${children}</g>`);
  }

  if (node.type === "frame") {
    const isRoot = node.parentId == null;
    const fillFallback = isRoot && resolved.fill == null && effectiveFillType(resolved) === "solid"
      ? "#ffffff"
      : undefined;

    const clip = shouldClipChildren(node);
    const clipId = `pc-clip-${svgSafeId(nodeId)}`;
    if (clip) registerClipRectWithEffectBleed(ctx, clipId, nodeId, w, h, node);

    const shellFilter = filterRef;

    const stroke =
      isRoot
        ? resolved.strokeColor
        : resolved.strokeWidth && resolved.strokeColor
          ? resolved.strokeColor
          : CANVAS_VISUAL.frameBorder;
    const sw = isRoot ? (resolved.strokeWidth ?? 0) : (resolved.strokeWidth ?? 1);

    const shell = svgRectLike(
      {
        ...resolved,
        ...(fillFallback ? { fill: fillFallback, fillType: "solid" as const } : {}),
        strokeColor: stroke,
        strokeWidth: sw,
      },
      {
        ...shapeOpts,
        filterRef: shellFilter,
        strokeOverride: stroke,
        strokeWidthOverride: sw,
      },
    );

    const children = renderChildren(nodeId, ctx);
    const body = clip ? `<g clip-path="url(#${clipId})">${children}</g>` : children;
    const componentLabel =
      !isRoot &&
      node.codeJsxIntrinsic === false &&
      node.codeJsxTag &&
      /^[A-Z]/.test(node.codeJsxTag)
        ? `<text x="8" y="20" fill="#64748b" font-size="12" font-family="system-ui,sans-serif">${escXml(node.codeJsxTag)}</text>`
        : "";
    return wrapOpacity(`${shell}${componentLabel}${body}`);
  }

  return "";
}

export function buildSvgScene(input: SvgSceneBuildInput): SvgSceneBuildResult {
  const movingSubtree =
    input.dragPreview?.movingIds.length
      ? collectMovingSubtreeIds(input.dragPreview.movingIds, input.childOrder)
      : undefined;
  const excludeNodeIds = movingSubtree
    ? mergeExcludeSets(input.excludeNodeIds, movingSubtree)
    : input.excludeNodeIds;

  const effectiveObjectEditMode =
    compositeEditModeForDrag(
      input.dragPreview?.movingIds ?? [],
      input.nodes,
      input.objectEditModeNodeId,
    ) ?? input.objectEditModeNodeId ?? null;

  const ctx: BuildCtx = {
    defs: [],
    filterRegistry: createSvgFilterRegistry(),
    rendered: 0,
    warnings: [],
    nodes: input.nodes,
    childOrder: input.childOrder,
    assets: input.assets,
    designTokens: input.designTokens ?? {},
    excludeNodeIds,
    renderScale: gradientRenderScale(input.zoom ?? 1),
    ellipseArcPreview: input.ellipseArcPreview ?? null,
    objectEditModeNodeId: effectiveObjectEditMode,
    selectedIds: input.selectedIds,
    colorMode: input.colorMode ?? "light",
    cssSources: input.cssSources,
  };

  const bodyParts: string[] = [];
  const rootLabels: SvgRootLabel[] = [];

  for (const rid of input.rootIds) {
    const node = input.nodes[rid];
    if (!node?.visible) continue;
    const wm = getNodeWorldMatrixFromChildOrder(rid, input.nodes, input.childOrder);
    const rootTransform = wm ? matrixToSvgTransform(wm) : undefined;
    const inner = renderNode(rid, ctx);
    if (node.type !== "frame") {
      if (inner) {
        const blend = svgLayerBlendStyleAttr(node);
        bodyParts.push(
          `<g transform="${rootTransform ?? ""}" data-node-id="${rid}"${blend}>${inner}</g>`,
        );
      }
      continue;
    }

    if (inner) {
      const blend = svgLayerBlendStyleAttr(node);
      bodyParts.push(
        `<g transform="${rootTransform ?? ""}" data-node-id="${rid}"${blend}>${inner}</g>`,
      );
    }
    rootLabels.push({
      id: rid,
      x: wm ? applyMatrixToPoint(wm, { x: 0, y: 0 }).x : node.x,
      y: wm ? applyMatrixToPoint(wm, { x: 0, y: 0 }).y : node.y,
      name: node.name,
      selected: false,
    });
  }

  if (input.dragPreview?.movingIds.length) {
    const { dx, dy, movingIds } = input.dragPreview;
    const tops = topLevelSelectedIds([...movingIds], input.nodes);
    const overlayCtx: BuildCtx = {
      ...ctx,
      excludeNodeIds: input.excludeNodeIds,
    };
    for (const mid of tops) {
      if (
        isCompositeHiddenOperand(mid, input.nodes, {
          objectEditModeNodeId: effectiveObjectEditMode,
          selectedIds: input.selectedIds,
        })
      ) {
        continue;
      }
      const wm = getNodeWorldMatrixFromChildOrder(mid, input.nodes, input.childOrder);
      if (!wm) continue;
      const shifted = { ...wm, e: wm.e + dx, f: wm.f + dy };
      const inner = renderNode(mid, overlayCtx);
      if (inner) {
        const n = input.nodes[mid];
        const blend = n ? svgLayerBlendStyleAttr(n) : "";
        bodyParts.push(
          `<g transform="${matrixToSvgTransform(shifted)}" data-drag-preview data-node-id="${mid}"${blend}>${inner}</g>`,
        );
      }
    }
  }

  const allDefs = [...ctx.defs, ...ctx.filterRegistry.defs];
  return {
    defs: allDefs.join("\n"),
    body: bodyParts.join("\n"),
    renderedNodeCount: ctx.rendered,
    warnings: ctx.warnings,
    rootLabels,
  };
}

export function truncateArtboardLabel(name: string, maxLen = 48): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}
