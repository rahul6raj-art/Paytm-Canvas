import type { BooleanRenderModel } from "@/lib/booleanGeometry";
import { resolveShapeFillAttr } from "@/lib/gradient/svgSceneFill";
import { svgSafeId, wrapSvgNodeFilter } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

function escapeSvgPathD(d: string): string {
  return d.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** SVG/canvas path for a boolean composite preview. */
export function booleanClipperPathD(render: BooleanRenderModel): string | null {
  if (render.op === "clipper") return render.pathD;
  if (render.op === "subtract") return render.baseD;
  if ("pathDs" in render && render.pathDs.length > 0) return render.pathDs.join(" ");
  return null;
}

export function booleanClipperFillRule(render: BooleanRenderModel): "nonzero" | "evenodd" {
  if (render.op === "clipper") return render.fillRule;
  if (render.op === "subtract" || render.op === "exclude") return "evenodd";
  return "nonzero";
}

export function booleanStrokeAttrParts(node: EditorNode): string {
  const sw = node.strokeWidth ?? 0;
  if (sw <= 0 || !node.strokeColor) return "";
  const color = escapeHtmlAttr(node.strokeColor);
  return ` stroke="${color}" stroke-width="${sw}" vector-effect="non-scaling-stroke"`;
}

function pathAttrs(fillAttr: string, strokeAttrs: string, fillOpacity: number): string {
  const opacity =
    fillOpacity < 0.999 ? ` fill-opacity="${Math.round(fillOpacity * 1000) / 1000}"` : "";
  return `fill="${fillAttr}"${opacity}${strokeAttrs}`;
}

/** SVG path for boolean preview (canvas and code export) — Clipper2 result. */
export function svgInnerMarkupFromBooleanRender(
  render: BooleanRenderModel,
  _groupId: string,
  fillAttr: string,
  _idPrefix: string,
  strokeAttrs = "",
  fillOpacity = 1,
): string {
  const pathD = booleanClipperPathD(render);
  if (!pathD) return "";

  const d = escapeSvgPathD(pathD);
  const rule =
    booleanClipperFillRule(render) === "evenodd" ? ` fill-rule="evenodd"` : ` fill-rule="nonzero"`;
  const pa = pathAttrs(fillAttr, strokeAttrs, fillOpacity);
  return `<path d="${d}"${rule} ${pa}/>`;
}

export function booleanRenderSvgMarkup(
  render: BooleanRenderModel,
  groupId: string,
  width: number,
  height: number,
  fillAttr: string,
  idPrefix = "pc-bool",
  node?: EditorNode,
): string {
  const w = Math.max(1, Math.round(width * 100) / 100);
  const h = Math.max(1, Math.round(height * 100) / 100);
  const strokeAttrs = node ? booleanStrokeAttrParts(node) : "";
  const fillOpacity = node?.fillOpacity ?? 1;
  const inner = svgInnerMarkupFromBooleanRender(
    render,
    groupId,
    fillAttr,
    idPrefix,
    strokeAttrs,
    fillOpacity,
  );
  if (!inner) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block;position:absolute;inset:0;pointer-events:none" aria-hidden="true">${inner}</svg>`;
}

export function booleanRenderFillAttr(
  fill: string,
): string {
  return fill === "transparent" ? "none" : escapeHtmlAttr(fill);
}

/** Boolean composite markup for the native SVG scene renderer. */
export function booleanGroupSceneInnerMarkup(opts: {
  groupId: string;
  node: EditorNode;
  render: BooleanRenderModel;
  width: number;
  height: number;
  registerGradient: (id: string, markup: string) => void;
  renderScale?: number;
  filterRef?: string;
}): string {
  const { groupId, node, render, width, height, registerGradient, renderScale = 1, filterRef } =
    opts;
  const safe = svgSafeId(groupId);
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const { fillAttr: rawFill, underlayMarkup } = resolveShapeFillAttr({
    node,
    width: w,
    height: h,
    nodeId: `pc-bg-${safe}`,
    registerGradient,
    renderScale,
  });

  const fillAttr =
    rawFill === "none" || rawFill.startsWith("url(")
      ? rawFill
      : booleanRenderFillAttr(rawFill);

  const strokeAttrs = booleanStrokeAttrParts(node);
  const fillOpacity = node.fillOpacity ?? 1;
  const useCssPathsFill = rawFill === "none" && Boolean(underlayMarkup);
  const pathFillAttr = useCssPathsFill ? "none" : fillAttr;

  const pathD = booleanClipperPathD(render);

  let cssMaskAndUnderlay = "";
  if (useCssPathsFill && pathD) {
    const maskId = `pc-bgmask-${safe}`;
    const underlayWithMask = underlayMarkup.replace(
      "<foreignObject",
      `<foreignObject mask="url(#${maskId})"`,
    );
    cssMaskAndUnderlay =
      `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">` +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="black"/>` +
      `<path d="${escapeSvgPathD(pathD)}" fill="white"/></mask>` +
      underlayWithMask;
  }

  const inner = svgInnerMarkupFromBooleanRender(
    render,
    groupId,
    pathFillAttr,
    "pc-bool",
    strokeAttrs,
    fillOpacity,
  );

  return wrapSvgNodeFilter(`${cssMaskAndUnderlay}${inner}`, filterRef);
}
