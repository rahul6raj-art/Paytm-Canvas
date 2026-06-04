import type { BooleanRenderModel } from "@/lib/booleanGeometry";
import { svgSafeId } from "@/lib/svgMarkupCore";
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

/** SVG defs + paths for boolean preview (canvas and code export). */
export function svgInnerMarkupFromBooleanRender(
  render: BooleanRenderModel,
  groupId: string,
  fillAttr: string,
  idPrefix: string,
  strokeAttrs = "",
  fillOpacity = 1,
): string {
  const safe = svgSafeId(groupId);
  const pa = pathAttrs(fillAttr, strokeAttrs, fillOpacity);

  if (render.op === "union") {
    return render.pathDs
      .map((d) => `<path d="${escapeSvgPathD(d)}" ${pa}/>`)
      .join("");
  }

  if (render.op === "subtract") {
    const maskId = `${idPrefix}-sub-${safe}`;
    const baseD = escapeSvgPathD(render.baseD);
    const subtractD = escapeSvgPathD(render.subtractD);
    return `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse"><path d="${baseD}" fill="white"/><path d="${subtractD}" fill="black"/></mask></defs><path d="${baseD}" ${pa} mask="url(#${maskId})"/>`;
  }

  if (render.op === "intersect") {
    const clipIds = render.pathDs.map((_, i) => `${idPrefix}-int-${safe}-${i}`);
    const defs = render.pathDs
      .map((d, i) => {
        const clipId = clipIds[i]!;
        return `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${escapeSvgPathD(d)}"/></clipPath>`;
      })
      .join("");
    const fillD = escapeSvgPathD(render.pathDs[0]!);
    let inner = `<path d="${fillD}" ${pa}/>`;
    for (let i = render.pathDs.length - 1; i >= 0; i--) {
      inner = `<g clip-path="url(#${clipIds[i]})">${inner}</g>`;
    }
    return `<defs>${defs}</defs>${inner}`;
  }

  if (render.op === "exclude") {
    const parts: string[] = [];
    render.pathDs.forEach((d, i) => {
      const maskId = `${idPrefix}-exc-${safe}-${i}`;
      const whiteD = escapeSvgPathD(d);
      const blackPaths = render.pathDs
        .filter((_, j) => j !== i)
        .map((other) => `<path d="${escapeSvgPathD(other)}" fill="black"/>`)
        .join("");
      parts.push(
        `<mask id="${maskId}" maskUnits="userSpaceOnUse"><path d="${whiteD}" fill="white"/>${blackPaths}</mask>`,
        `<path d="${whiteD}" ${pa} mask="url(#${maskId})"/>`,
      );
    });
    return `<defs>${parts.filter((p) => p.startsWith("<mask")).join("")}</defs>${parts.filter((p) => p.startsWith("<path")).join("")}`;
  }

  return "";
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
