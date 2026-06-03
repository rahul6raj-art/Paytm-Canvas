import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import { legacyEffectShadowAppend, resolveEffectBoxShadow, resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { fillPaintCss, svgFillPaint } from "@/lib/fillGradient";
import { pathOutlineD } from "@/lib/shapes/shapeToPath";
import type { NodeEffect } from "@/lib/nodeEffects";
import { buildNodeEffectRenderStyle, effectColorToRgba } from "@/lib/nodeEffects";
import {
  getNodeCornerRadii,
  isUniformCornerRadii,
  roundedRectPathD,
  uniformCornerRadiusForRect,
} from "@/lib/cornerRadius";
import { strokeAttrsForSvgMarkup } from "@/lib/stroke";
import type { EditorNode, ImageFitMode } from "@/stores/useEditorStore";

export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function svgSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function resolveImageDataUrl(
  node: EditorNode,
  assets?: Record<string, EditorAsset>,
): string | undefined {
  if (node.type !== "image") return undefined;
  const raw = node.imageSrc ?? (node.assetId ? assets?.[node.assetId]?.dataUrl : undefined);
  if (!raw) return undefined;
  if (raw.startsWith("data:image/")) return raw;
  return undefined;
}

export function svgRectLike(
  n: EditorNode,
  opts?: {
    filterRef?: string;
    strokeOverride?: string;
    strokeWidthOverride?: number;
    nodeId?: string;
    registerGradient?: (id: string, markup: string) => void;
  },
): string {
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  let fill: string;
  if (opts?.registerGradient && opts.nodeId) {
    fill = svgFillPaint(n, {
      gradientId: `pc-grad-${svgSafeId(opts.nodeId)}`,
      width: w,
      height: h,
      registerGradient: opts.registerGradient,
    });
  } else {
    fill = fillPaintCss(n);
  }
  const fillAttr = fill.startsWith("url(") ? fill : escXml(fill);
  const sw = opts?.strokeWidthOverride ?? n.strokeWidth ?? 0;
  const sc = opts?.strokeOverride ?? n.strokeColor ?? "none";
  const filter = opts?.filterRef ? ` filter="url(#${opts.filterRef})"` : "";
  const strokeExtra = sw > 0 ? ` ${strokeAttrsForSvgMarkup(n)}` : "";
  if (n.type === "ellipse") {
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fillAttr}" stroke="${sw > 0 ? escXml(sc) : "none"}" stroke-width="${sw}"${strokeExtra}${filter} />`;
  }
  if (n.type === "rectangle" || n.type === "frame" || n.type === "group") {
    if (n.type === "frame" || n.type === "rectangle") {
      const radii = getNodeCornerRadii(n);
      if (!isUniformCornerRadii(radii)) {
        const d = roundedRectPathD(w, h, radii);
        return `<path d="${d}" fill="${fillAttr}" stroke="${sw > 0 ? escXml(sc) : "none"}" stroke-width="${sw}"${strokeExtra}${filter} />`;
      }
      const rad = uniformCornerRadiusForRect(n, w, h);
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rad}" fill="${fillAttr}" stroke="${sw > 0 ? escXml(sc) : "none"}" stroke-width="${sw}"${strokeExtra}${filter} />`;
    }
    return `<rect x="0" y="0" width="${w}" height="${h}" fill="${fillAttr}" stroke="${sw > 0 ? escXml(sc) : "none"}" stroke-width="${sw}"${strokeExtra}${filter} />`;
  }
  return "";
}

export function svgLine(n: EditorNode): string {
  const lw = n.strokeWidth ?? 2;
  const lc = n.strokeColor ?? "#0f172a";
  const y = n.height / 2;
  const strokeExtra = lw > 0 ? ` ${strokeAttrsForSvgMarkup(n)}` : "";
  return `<line x1="0" y1="${y}" x2="${n.width}" y2="${y}" stroke="${escXml(lc)}" stroke-width="${lw}"${strokeExtra} />`;
}

export function svgTextMarkup(n: EditorNode): string {
  const color = escXml(n.textColor ?? n.fill ?? "#111111");
  const ff = escXml(n.fontFamily ?? "Inter, system-ui, sans-serif");
  const fs = n.fontSize ?? 13;
  const fw = n.fontWeight ?? 500;
  const lh = n.lineHeight ?? 1.25;
  const lineHeightPx = fs * lh;
  const ls = n.letterSpacing != null ? ` letter-spacing="${n.letterSpacing}"` : "";
  const raw = n.content ?? "";
  const lines = raw.split("\n");
  if (lines.length <= 1) {
    return `<text x="0" y="${fs}" fill="${color}" font-family="${ff}" font-size="${fs}" font-weight="${fw}" dominant-baseline="text-before-edge"${ls}>${escXml(raw)}</text>`;
  }
  const tspans = lines
    .map((line, i) =>
      i === 0
        ? `<tspan x="0">${escXml(line)}</tspan>`
        : `<tspan x="0" dy="${lineHeightPx}">${escXml(line)}</tspan>`,
    )
    .join("");
  return `<text x="0" y="${fs}" fill="${color}" font-family="${ff}" font-size="${fs}" font-weight="${fw}" dominant-baseline="text-before-edge"${ls}>${tspans}</text>`;
}

function imageFitSvg(
  fit: ImageFitMode,
  w: number,
  h: number,
): { preserveAspectRatio: string; clipId?: string } {
  if (fit === "fit") return { preserveAspectRatio: "xMidYMid meet" };
  if (fit === "crop") return { preserveAspectRatio: "xMidYMid slice" };
  return { preserveAspectRatio: "none" };
}

export function svgImageMarkup(
  node: EditorNode,
  resolved: EditorNode,
  assets: Record<string, EditorAsset> | undefined,
  clipRegister: (id: string, markup: string) => void,
): string {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const href = resolveImageDataUrl(node, assets);
  const op = (resolved.opacity ?? 1) * (resolved.fillOpacity ?? 1);
  if (!href) {
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="#334155"/><text x="8" y="18" fill="#e2e8f0" font-size="11" font-family="system-ui,sans-serif">Image</text>`;
  }
  const fit = node.imageFitMode ?? "fill";
  const { preserveAspectRatio } = imageFitSvg(fit, w, h);
  const img = `<image href="${escXml(href)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${preserveAspectRatio}" opacity="${op}" />`;
  if (fit === "crop") {
    const clipId = `pc-imgclip-${svgSafeId(node.id)}`;
    clipRegister(clipId, `<rect x="0" y="0" width="${w}" height="${h}" />`);
    return `<g clip-path="url(#${clipId})">${img}</g>`;
  }
  return img;
}

export type SvgFilterRegistry = {
  defs: string[];
  register: (nodeId: string, effects: NodeEffect[] | undefined, legacyShadow?: string) => string | undefined;
};

export function createSvgFilterRegistry(): SvgFilterRegistry {
  const defs: string[] = [];
  return {
    defs,
    register(nodeId, effects, legacyShadow) {
      const visible = (effects ?? []).filter((e) => e.visible);
      const hasLegacy = Boolean(legacyShadow?.trim());
      if (visible.length === 0 && !hasLegacy) return undefined;

      const fid = `pc-filter-${svgSafeId(nodeId)}`;
      const parts: string[] = [];

      for (const e of visible) {
        if (e.type === "drop-shadow") {
          const dx = e.x ?? 0;
          const dy = e.y ?? 0;
          const std = Math.max(0, (e.blur ?? 0) / 2);
          const rgba = effectColorToRgba(e.color, e.opacity ?? 1);
          parts.push(
            `<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${std}" flood-color="${escXml(rgba)}" flood-opacity="1" />`,
          );
        } else if (e.type === "layer-blur") {
          const std = Math.max(0, (e.blur ?? 0) / 2);
          parts.push(`<feGaussianBlur stdDeviation="${std}" />`);
        }
      }

      if (parts.length === 0 && hasLegacy) {
        parts.push(`<feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.08" />`);
      }

      if (parts.length === 0) return undefined;

      defs.push(
        `<filter id="${fid}" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB">${parts.join("")}</filter>`,
      );
      return fid;
    },
  };
}

export function registerClipRect(
  defs: string[],
  clipId: string,
  w: number,
  h: number,
  node?: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
): void {
  const width = Math.max(1, w);
  const height = Math.max(1, h);
  if (node) {
    const radii = getNodeCornerRadii(node);
    if (!isUniformCornerRadii(radii)) {
      const d = roundedRectPathD(width, height, radii);
      defs.push(`<clipPath id="${clipId}"><path d="${d}" /></clipPath>`);
      return;
    }
    const rx = uniformCornerRadiusForRect(node, width, height);
    defs.push(
      `<clipPath id="${clipId}"><rect x="0" y="0" width="${width}" height="${height}" rx="${rx}" /></clipPath>`,
    );
    return;
  }
  defs.push(`<clipPath id="${clipId}"><rect x="0" y="0" width="${width}" height="${height}" /></clipPath>`);
}

export function registerRootArtboardShadow(defs: string[], nodeId: string): string {
  const fid = `pc-artboard-shadow-${svgSafeId(nodeId)}`;
  defs.push(
    `<filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">` +
      `<feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.06"/>` +
      `<feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.04"/>` +
      `</filter>`,
  );
  return fid;
}

export function resolveNodeForMarkup(
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
): EditorNode {
  return resolveNodeWithDesignTokens(node, designTokens);
}

export function collectNodeEffects(
  node: EditorNode,
  resolved: EditorNode,
  designTokens: Record<string, DesignToken>,
): { effects: NodeEffect[] | undefined; legacyShadow?: string } {
  const hasRich = !!(resolved.effects && resolved.effects.length > 0);
  const legacy = hasRich
    ? legacyEffectShadowAppend(node, designTokens)
    : resolveEffectBoxShadow(node, designTokens);
  const merged = hasRich ? resolved.effects : undefined;
  if (!hasRich && legacy) {
    return { effects: undefined, legacyShadow: legacy };
  }
  const er = buildNodeEffectRenderStyle(merged, legacy);
  return { effects: merged, legacyShadow: er.boxShadow };
}

export function svgPathMarkup(
  resolved: EditorNode,
  opts?: {
    filterRef?: string;
    nodeId?: string;
    registerGradient?: (id: string, markup: string) => void;
  },
): string {
  const d = resolved.flattenedPathData ?? pathOutlineD(resolved);
  const w = Math.max(1, resolved.width);
  const h = Math.max(1, resolved.height);
  let f = "none";
  if (resolved.pathClosed && resolved.fillEnabled !== false) {
    if (opts?.registerGradient && opts.nodeId) {
      f = svgFillPaint(resolved, {
        gradientId: `pc-grad-${svgSafeId(opts.nodeId)}`,
        width: w,
        height: h,
        registerGradient: opts.registerGradient,
      });
    } else {
      f = fillPaintCss(resolved);
    }
  }
  const sc = escXml(resolved.strokeColor ?? "#0f172a");
  const sw = resolved.strokeWidth ?? 2;
  const fillAttr = f === "transparent" || f === "none" ? "none" : f.startsWith("url(") ? f : escXml(f);
  const filter = opts?.filterRef ? ` filter="url(#${opts.filterRef})"` : "";
  const strokeExtra = sw > 0 ? ` ${strokeAttrsForSvgMarkup(resolved)}` : "";
  return `<path d="${escXml(d)}" fill="${fillAttr}" stroke="${sc}" stroke-width="${sw}"${strokeExtra}${filter} />`;
}
