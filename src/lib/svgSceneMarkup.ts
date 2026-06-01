import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { applyMatrixToPoint, composeSvgTransform, getNodeWorldMatrix, matrixToSvgTransform } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  collectNodeEffects,
  createSvgFilterRegistry,
  registerClipRect,
  registerRootArtboardShadow,
  resolveNodeForMarkup,
  svgImageMarkup,
  svgLine,
  svgPathMarkup,
  svgRectLike,
  svgSafeId,
  svgTextMarkup,
} from "@/lib/svgMarkupCore";
import { effectiveFillType, fillPaintCss } from "@/lib/fillGradient";

const SUPPORTED_TYPES = new Set([
  "frame",
  "group",
  "rectangle",
  "ellipse",
  "line",
  "path",
  "text",
  "image",
]);

export type SvgSceneBuildInput = {
  rootIds: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets?: Record<string, EditorAsset>;
  designTokens?: Record<string, DesignToken>;
};

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
};

function renderChildren(parentId: string, ctx: BuildCtx): string {
  const kids = ctx.childOrder[parentId] ?? [];
  let out = "";
  for (const cid of kids) {
    const c = ctx.nodes[cid];
    if (!c?.visible) continue;
    const inner = renderNode(cid, ctx);
    if (inner) out += `<g transform="${composeSvgTransform(c)}">${inner}</g>`;
  }
  return out;
}

function renderNode(nodeId: string, ctx: BuildCtx): string {
  const node = ctx.nodes[nodeId];
  if (!node?.visible) return "";
  if (!SUPPORTED_TYPES.has(node.type)) {
    ctx.warnings.push(`skipped:${node.type}:${nodeId}`);
    return "";
  }

  ctx.rendered += 1;
  const resolved = resolveNodeForMarkup(node, ctx.designTokens);
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const { effects, legacyShadow } = collectNodeEffects(node, resolved, ctx.designTokens);
  const filterRef = ctx.filterRegistry.register(nodeId, effects, legacyShadow);

  const wrapOpacity = (inner: string) => {
    const op = resolved.opacity ?? 1;
    return op < 0.999 ? `<g opacity="${op}">${inner}</g>` : inner;
  };

  const registerGradient = (id: string, markup: string) => {
    ctx.defs.push(markup);
  };
  const shapeOpts = { filterRef, nodeId, registerGradient };

  if (node.type === "rectangle" || node.type === "ellipse") {
    return wrapOpacity(svgRectLike(resolved, shapeOpts));
  }

  if (node.type === "line") {
    return wrapOpacity(svgLine(node));
  }

  if (node.type === "path") {
    return wrapOpacity(svgPathMarkup(resolved, shapeOpts));
  }

  if (node.type === "text") {
    return wrapOpacity(svgTextMarkup(resolved));
  }

  if (node.type === "image") {
    const clipDefs = ctx.defs;
    const clipRegister = (id: string, markup: string) => {
      clipDefs.push(`<clipPath id="${id}">${markup}</clipPath>`);
    };
    return wrapOpacity(svgImageMarkup(node, resolved, ctx.assets, clipRegister));
  }

  if (node.type === "group") {
    const stroke = "rgba(15,23,42,0.12)";
    const shell = svgRectLike(
      { ...resolved, fill: resolved.fill ?? "transparent", strokeColor: stroke, strokeWidth: 1 },
      { ...shapeOpts, strokeOverride: stroke, strokeWidthOverride: 1 },
    );
    return wrapOpacity(`${shell}${renderChildren(nodeId, ctx)}`);
  }

  if (node.type === "frame") {
    const isRoot = node.parentId == null;
    const r = node.cornerRadius ?? 0;
    const fillFallback = isRoot && resolved.fill == null && effectiveFillType(resolved) === "solid"
      ? "#ffffff"
      : undefined;

    const clipId = `pc-clip-${svgSafeId(nodeId)}`;
    registerClipRect(ctx.defs, clipId, w, h, r);

    let shellFilter = filterRef;
    if (isRoot && !shellFilter) {
      const shadowId = registerRootArtboardShadow(ctx.defs, nodeId);
      shellFilter = shadowId;
    }

    const stroke =
      isRoot
        ? undefined
        : resolved.strokeWidth && resolved.strokeColor
          ? resolved.strokeColor
          : CANVAS_VISUAL.frameBorder;
    const sw = isRoot ? 0 : (resolved.strokeWidth ?? 1);

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
    return wrapOpacity(
      `${shell}<g clip-path="url(#${clipId})">${children}</g>`,
    );
  }

  return "";
}

export function buildSvgScene(input: SvgSceneBuildInput): SvgSceneBuildResult {
  const ctx: BuildCtx = {
    defs: [],
    filterRegistry: createSvgFilterRegistry(),
    rendered: 0,
    warnings: [],
    nodes: input.nodes,
    childOrder: input.childOrder,
    assets: input.assets,
    designTokens: input.designTokens ?? {},
  };

  const bodyParts: string[] = [];
  const rootLabels: SvgRootLabel[] = [];

  for (const rid of input.rootIds) {
    const node = input.nodes[rid];
    if (!node?.visible) continue;
    const wm = getNodeWorldMatrix(rid, input.nodes);
    const rootTransform = wm ? matrixToSvgTransform(wm) : undefined;
    const inner = renderNode(rid, ctx);
    if (node.type !== "frame") {
      if (inner) {
        bodyParts.push(
          `<g transform="${rootTransform ?? ""}" data-node-id="${rid}">${inner}</g>`,
        );
      }
      continue;
    }

    if (inner) {
      bodyParts.push(
        `<g transform="${rootTransform ?? ""}" data-node-id="${rid}">${inner}</g>`,
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
