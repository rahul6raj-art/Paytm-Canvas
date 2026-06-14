import type { EditorAsset } from "@/lib/documentPersistence";
import type { EditorNode, ImageFitMode } from "@/stores/useEditorStore";
import type { DesignToken } from "@/lib/designTokens";
import {
  legacyEffectShadowAppend,
  resolveEffectBoxShadow,
  resolveNodeWithDesignTokens,
} from "@/lib/designTokens";
import { buildNodeEffectRenderStyle, firstVisibleDropShadowFilter } from "@/lib/nodeEffects";
import { fillCss, normalizeHex } from "@/lib/color";
import { effectiveFillType } from "@/lib/fillGradient";
import { paintGradientFillInBox, resolveSolidFillCss } from "@/lib/canvasGradientPaint";
import { pathToSvgD } from "@/lib/pathGeometry";
import { buildLayerCssTransform, composeSvgTransform, wrapSvgNodeRotation } from "@/lib/transformMath";
import {
  collectNodeEffects,
  createSvgFilterRegistry,
  escXml,
  registerClipRect,
  resolveImageDataUrl,
  resolveNodeForMarkup,
  svgImageMarkup,
  svgLine,
  svgPathMarkup,
  svgRectLike,
  svgSafeId,
  svgTextMarkup,
  wrapSvgNodeFilter,
} from "@/lib/svgMarkupCore";
import { shouldClipChildren, clipExportCssProperties } from "@/lib/clipChildren";
import {
  buildBooleanRenderForGroup,
  buildMaskClipPathDForGroup,
  isBooleanGroup,
} from "@/lib/booleanGeometry";
import {
  booleanRenderFillAttr,
  svgInnerMarkupFromBooleanRender,
} from "@/lib/codeExport/booleanRenderSvg";
import { ellipseArcExportStyle } from "@/lib/shapes/ellipseArcExport";
import {
  clampCornerRadii,
  cornerRadiiMax,
  cornerRadiiToCss,
  getNodeCornerRadii,
  isUniformCornerRadii,
  roundedRectPathD,
} from "@/lib/cornerRadius";
import type { LayoutMode } from "@/lib/autoLayout";
import { buildSinglePageJpegPdf, jpegDataUrlToBytes } from "@/lib/pdfExport";

export function nearestAncestorFrameId(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): string | null {
  let p: string | null = nodes[nodeId]?.parentId ?? null;
  while (p) {
    const n = nodes[p];
    if (n?.type === "frame") return p;
    p = n.parentId;
  }
  return null;
}

export type SaveFileDialogType = {
  description: string;
  mimeType: string;
  extension: string;
};

function ensureFilenameExtension(filename: string, extension: string): string {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const lower = filename.toLowerCase();
  if (lower.endsWith(ext)) return filename;
  const base = filename.replace(/\.[^./\\]+$/, "");
  return `${base}${ext}`;
}

function triggerBrowserDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isSaveDialogAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Open the native save dialog when supported; otherwise download to the default folder. */
export async function saveBlobWithDialog(
  blob: Blob,
  suggestedName: string,
  fileType: SaveFileDialogType,
): Promise<boolean> {
  const filename = ensureFilenameExtension(suggestedName, fileType.extension);
  const picker = typeof window !== "undefined" ? window.showSaveFilePicker : undefined;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: fileType.description,
            accept: { [fileType.mimeType]: [fileType.extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (isSaveDialogAbort(err)) return false;
      throw err;
    }
  }
  triggerBrowserDownload(filename, blob);
  return true;
}

/** Save text via native save dialog when supported. */
export async function saveTextWithDialog(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8",
  fileType?: SaveFileDialogType,
): Promise<boolean> {
  const blob = new Blob([content], { type: mimeType });
  const ext = fileType?.extension ?? (filename.includes(".") ? `.${filename.split(".").pop()}` : ".txt");
  const mime = fileType?.mimeType ?? mimeType.split(";")[0] ?? "text/plain";
  return saveBlobWithDialog(blob, filename, {
    description: fileType?.description ?? "Text file",
    mimeType: mime,
    extension: ext,
  });
}

/** @deprecated Use saveTextWithDialog */
export async function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8",
): Promise<boolean> {
  const ext = filename.includes(".") ? `.${filename.split(".").pop()}` : ".txt";
  return saveTextWithDialog(filename, content, mimeType, {
    description: "Text file",
    mimeType: mimeType.split(";")[0] ?? "text/plain",
    extension: ext,
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function canvasObjectFit(
  mode: ImageFitMode,
  iw: number,
  ih: number,
  bw: number,
  bh: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  if (iw <= 0 || ih <= 0) {
    return { sx: 0, sy: 0, sw: 1, sh: 1, dx: 0, dy: 0, dw: bw, dh: bh };
  }
  const fit = mode ?? "fill";
  if (fit === "fill") {
    return { sx: 0, sy: 0, sw: iw, sh: ih, dx: 0, dy: 0, dw: bw, dh: bh };
  }
  const s = fit === "fit" ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
  const dw = iw * s;
  const dh = ih * s;
  const dx = (bw - dw) / 2;
  const dy = (bh - dh) / 2;
  const sw = iw;
  const sh = ih;
  const sx = 0;
  const sy = 0;
  return { sx, sy, sw, sh, dx, dy, dw, dh };
}

function addRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  const ext = ctx as unknown as { roundRect?: (a: number, b: number, c: number, d: number, e: number) => void };
  if (typeof ext.roundRect === "function") {
    ext.roundRect.call(ctx, x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function addNodeRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
  if (cornerRadiiMax(radii) <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (isUniformCornerRadii(radii)) {
    addRoundedRectPath(ctx, x, y, w, h, radii[0]!);
    return;
  }
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radii);
    return;
  }
  const p = new Path2D(roundedRectPathD(w, h, radii));
  const ctxWithPath = ctx as CanvasRenderingContext2D & { addPath?: (path: Path2D) => void };
  ctx.save();
  ctx.translate(x, y);
  if (typeof ctxWithPath.addPath === "function") {
    ctxWithPath.addPath(p);
  } else {
    addRoundedRectPath(ctx, 0, 0, w, h, cornerRadiiMax(radii));
  }
  ctx.restore();
}

function px(n: number): string {
  return `${Math.round(n * 100) / 100}px`;
}

function cssCommentToken(label: string, tokenName: string): string {
  const safe = tokenName.replace(/\*\//g, "* /");
  return `/* ${label}: ${safe} */`;
}

/** Plain CSS for the node (parent-relative box). Resolves linked design tokens when `designTokens` is provided. */
export function nodeToCss(node: EditorNode, designTokens?: Record<string, DesignToken>): string {
  const tokens = designTokens ?? {};
  const resolved = resolveNodeWithDesignTokens(node, tokens);
  const tokenName = (id?: string) => {
    if (!id) return null;
    const t = tokens[id];
    return t?.name?.trim() ? t.name : null;
  };

  const lines: string[] = [];
  lines.push(`width: ${px(node.width)};`);
  lines.push(`height: ${px(node.height)};`);
  const transform = buildLayerCssTransform(node);
  if (transform) {
    lines.push(`transform: ${transform};`);
    lines.push(`transform-origin: center center;`);
  }

  if (node.type === "text") {
    const typoNm = tokenName(node.textStyleTokenId);
    if (typoNm) lines.push(cssCommentToken("typography", typoNm));
    const fillNm = tokenName(node.fillTokenId);
    if (fillNm) lines.push(cssCommentToken("text color", fillNm));
    const color = resolved.textColor ?? resolved.fill ?? "#0f172a";
    lines.push(`color: ${color};`);
    lines.push(`font-family: ${resolved.fontFamily ?? "Inter, system-ui, sans-serif"};`);
    lines.push(`font-size: ${px(resolved.fontSize ?? 13)};`);
    lines.push(`font-weight: ${resolved.fontWeight ?? 500};`);
    lines.push(`line-height: ${resolved.lineHeight ?? 1.25};`);
    if (resolved.letterSpacing != null) lines.push(`letter-spacing: ${px(resolved.letterSpacing)};`);
    lines.push(`white-space: pre-wrap;`);
  } else if (node.type === "image") {
    lines.push(`background: #334155;`);
    lines.push(`object-fit: cover;`);
  } else {
    const fillNm = tokenName(node.fillTokenId);
    if (fillNm) lines.push(cssCommentToken("fill", fillNm));
    const bg = fillCss(resolved.fill, resolved.fillOpacity, resolved.fillEnabled);
    if (bg !== "transparent") lines.push(`background: ${bg};`);
  }

  const sw = node.strokeWidth ?? 0;
  const sc = node.strokeColor;
  if (sw > 0 && sc) {
    lines.push(`border: ${px(sw)} solid ${sc};`);
    lines.push(`box-sizing: border-box;`);
  } else if (node.type === "frame") {
    lines.push(`border: 1px solid #e5e5e5;`);
  }

  if (node.type === "ellipse") {
    const arcCss = ellipseArcExportStyle(node);
    if (arcCss.clipPath) {
      lines.push(`clip-path: ${arcCss.clipPath};`);
      lines.push(`overflow: hidden;`);
    } else if (arcCss.borderRadius) {
      lines.push(`border-radius: 50%;`);
    } else if ((node.cornerRadius ?? 0) > 0) {
      lines.push(`border-radius: 9999px;`);
    }
  } else if (node.type === "rectangle" || node.type === "frame") {
    const radii = getNodeCornerRadii(node);
    if (cornerRadiiMax(radii) > 0) {
      const css = cornerRadiiToCss(radii);
      lines.push(
        typeof css === "number"
          ? `border-radius: ${px(css)};`
          : `border-radius: ${css};`,
      );
    }
  }

  const layoutMode: LayoutMode = node.layoutMode ?? "none";
  if ((node.type === "frame" || node.type === "group") && layoutMode !== "none") {
    lines.push(`display: flex;`);
    lines.push(`flex-direction: ${layoutMode === "horizontal" ? "row" : "column"};`);
    const g = node.layoutGap ?? 0;
    if (g > 0) lines.push(`gap: ${px(g)};`);
    const pt = node.paddingTop ?? 0;
    const pr = node.paddingRight ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft ?? 0;
    if (pt || pr || pb || pl) {
      lines.push(`padding: ${px(pt)} ${px(pr)} ${px(pb)} ${px(pl)};`);
    }
    const pa = node.primaryAxisAlign ?? "start";
    const ca = node.counterAxisAlign ?? "start";
    const jc =
      pa === "space-between"
        ? "space-between"
        : pa === "center"
          ? "center"
          : pa === "end"
            ? "flex-end"
            : "flex-start";
    const ai =
      ca === "center" ? "center" : ca === "end" ? "flex-end" : ca === "stretch" ? "stretch" : "flex-start";
    lines.push(`justify-content: ${jc};`);
    lines.push(`align-items: ${ai};`);
  }

  if (node.type === "frame" || node.type === "group") {
    for (const [key, value] of Object.entries(clipExportCssProperties(node))) {
      lines.push(`${key}: ${value};`);
    }
  }

  const op = resolved.opacity ?? 1;
  if (op < 0.999) lines.push(`opacity: ${Math.round(op * 1000) / 1000};`);

  const hasRichEff = !!(resolved.effects && resolved.effects.length > 0);
  const tokenLeg = hasRichEff ? legacyEffectShadowAppend(node, tokens) : resolveEffectBoxShadow(node, tokens);
  const er = buildNodeEffectRenderStyle(hasRichEff ? resolved.effects : undefined, tokenLeg);
  if (er.boxShadow) {
    const effectNm = tokenName(node.effectTokenId);
    if (effectNm) lines.push(cssCommentToken("effect", effectNm));
    lines.push(`box-shadow: ${er.boxShadow};`);
  }
  if (er.filter) lines.push(`filter: ${er.filter};`);
  if (er.backdropFilter) lines.push(`backdrop-filter: ${er.backdropFilter};`);

  return lines.join("\n");
}

/** Best-effort Tailwind arbitrary-value string. */
export function nodeToTailwind(node: EditorNode, designTokens?: Record<string, DesignToken>): string {
  const resolved = designTokens ? resolveNodeWithDesignTokens(node, designTokens) : node;
  const parts: string[] = [];
  parts.push(`w-[${Math.round(node.width)}px]`);
  parts.push(`h-[${Math.round(node.height)}px]`);

  if (node.rotation) parts.push(`rotate-[${node.rotation}deg]`);

  const op = resolved.opacity ?? 1;
  if (op < 0.999) parts.push(`opacity-[${Math.round(op * 100) / 100}]`);

  const tokMap = designTokens ?? {};
  const hasRichEff = !!(resolved.effects && resolved.effects.length > 0);
  const twLeg = hasRichEff ? legacyEffectShadowAppend(node, tokMap) : resolveEffectBoxShadow(node, tokMap);
  const erTw = buildNodeEffectRenderStyle(hasRichEff ? resolved.effects : undefined, twLeg);
  if (erTw.filter) {
    const m = erTw.filter.match(/blur\(([^)]+)\)/);
    if (m) parts.push(`blur-[${m[1].trim()}]`);
  }

  if (node.type === "image") {
    parts.push("bg-slate-700", "object-cover");
  } else if (node.type === "text") {
    const col = resolved.textColor ?? resolved.fill;
    const n = col ? normalizeHex(col) : null;
    if (n) parts.push(`text-[${n}]`);
    parts.push(`text-[${Math.round(resolved.fontSize ?? 13)}px]`);
    const fw = resolved.fontWeight ?? 500;
    if (fw <= 400) parts.push("font-normal");
    else if (fw <= 500) parts.push("font-medium");
    else if (fw <= 600) parts.push("font-semibold");
    else parts.push("font-bold");
    if (resolved.lineHeight != null) parts.push(`leading-[${resolved.lineHeight}]`);
    if (resolved.letterSpacing != null) parts.push(`tracking-[${resolved.letterSpacing}px]`);
  } else {
    const bg = node.fill;
    if (node.fillEnabled !== false && bg) {
      const n = normalizeHex(bg);
      if (n && (node.fillOpacity ?? 1) >= 0.99) parts.push(`bg-[${n}]`);
      else if (bg) parts.push(`bg-[${fillCss(node.fill, node.fillOpacity, node.fillEnabled)}]`);
    }
  }

  const sw = node.strokeWidth ?? 0;
  const sc = node.strokeColor;
  if (sw > 0 && sc) {
    const hn = normalizeHex(sc);
    parts.push("border", "border-solid");
    if (hn) parts.push(`border-[${hn}]`);
    else parts.push(`border-[${sc}]`);
    parts.push(`border-[${Math.round(sw)}px]`);
  } else if (node.type === "frame") {
    parts.push("border", "border-solid", "border-[#e5e5e5]");
  }

  if (node.type === "ellipse" && (node.cornerRadius ?? 0) > 0) {
    parts.push("rounded-full");
  } else if (node.type === "rectangle" || node.type === "frame") {
    const radii = getNodeCornerRadii(node);
    if (cornerRadiiMax(radii) > 0) {
      const css = cornerRadiiToCss(radii);
      if (typeof css === "number") {
        parts.push(`rounded-[${Math.round(css)}px]`);
      } else {
        parts.push(`rounded-[${css.replace(/\s+/g, "_")}]`);
      }
    }
  }

  const layoutMode: LayoutMode = node.layoutMode ?? "none";
  if ((node.type === "frame" || node.type === "group") && layoutMode !== "none") {
    parts.push("flex", layoutMode === "horizontal" ? "flex-row" : "flex-col");
    const g = node.layoutGap ?? 0;
    if (g > 0) parts.push(`gap-[${Math.round(g)}px]`);
    const pt = node.paddingTop ?? 0;
    const pr = node.paddingRight ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft ?? 0;
    if (pt === pr && pr === pb && pb === pl && pt > 0) parts.push(`p-[${Math.round(pt)}px]`);
    else if (pt || pr || pb || pl) {
      parts.push(`pt-[${Math.round(pt)}px]`, `pr-[${Math.round(pr)}px]`, `pb-[${Math.round(pb)}px]`, `pl-[${Math.round(pl)}px]`);
    }
  }

  return parts.join(" ");
}

/** SVG group markup for a node in its local coordinate system (no outer &lt;svg&gt; wrapper). */
export function nodeToSvgGroupMarkup(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  assets?: Record<string, EditorAsset>,
  designTokens?: Record<string, DesignToken>,
): string {
  const tokens = designTokens ?? {};
  const resolved = resolveNodeForMarkup(node, tokens);
  const kids = childOrder[node.id] ?? [];
  const filters = createSvgFilterRegistry();
  const { effects, legacyShadow } = collectNodeEffects(node, resolved, tokens);
  const filterRef = filters.register(node.id, effects, legacyShadow);
  const clipDefs: string[] = [];
  const registerGradient = (id: string, markup: string) => {
    clipDefs.push(markup);
  };
  const shapeOpts = { filterRef, nodeId: node.id, registerGradient };

  let inner = "";
  if (node.type === "rectangle" || node.type === "ellipse") {
    inner = svgRectLike(resolved, shapeOpts);
  } else if (node.type === "line" || node.type === "arrow") {
    inner = svgLine(node);
  } else if (node.type === "path") {
    inner = svgPathMarkup(resolved, shapeOpts);
  } else if (node.type === "text") {
    inner = svgTextMarkup(resolved);
  } else if (node.type === "frame" || node.type === "group") {
    if (isBooleanGroup(node)) {
      const flowKids = kids.filter((cid) => {
        const c = nodes[cid];
        return c && c.visible && !c.locked;
      });
      const op = node.booleanOperation ?? "union";
      const render = buildBooleanRenderForGroup(node.id, flowKids, nodes, op, childOrder);
      if (render) {
        const fill = fillCss(node.fill, node.fillOpacity, node.fillEnabled);
        inner = wrapSvgNodeFilter(
          svgInnerMarkupFromBooleanRender(
            render,
            node.id,
            booleanRenderFillAttr(fill),
            "pc-bool-inspect",
          ),
          filterRef,
        );
      }
    } else if (node.maskId) {
      const clipId = `pc-mask-${svgSafeId(node.id)}`;
      const clip = buildMaskClipPathDForGroup(node.id, node.maskId, nodes, childOrder);
      if (clip) {
        const ruleAttr =
          clip.clipRule === "evenodd" ? ` clip-rule="evenodd"` : ` clip-rule="nonzero"`;
        clipDefs.push(
          `<clipPath id="${clipId}"><path d="${escXml(clip.clipD)}"${ruleAttr} /></clipPath>`,
        );
      }
      let clipped = "";
      for (const cid of kids) {
        if (cid === node.maskId) continue;
        const c = nodes[cid];
        if (!c?.visible) continue;
        const childMarkup = nodeToSvgGroupMarkup(c, nodes, childOrder, assets, designTokens);
        clipped += `<g transform="${composeSvgTransform(c)}">${childMarkup}</g>`;
      }
      inner = wrapSvgNodeFilter(
        clip ? `<g clip-path="url(#${clipId})">${clipped}</g>` : clipped,
        filterRef,
      );
    } else {
      const shell = !node.isBooleanGroup ? svgRectLike(resolved, shapeOpts) : "";
      let childrenMarkup = "";
      for (const cid of kids) {
        const c = nodes[cid];
        if (!c?.visible) continue;
        const childMarkup = nodeToSvgGroupMarkup(c, nodes, childOrder, assets, designTokens);
        childrenMarkup += `<g transform="${composeSvgTransform(c)}">${childMarkup}</g>`;
      }
      const clip = shouldClipChildren(node);
      if (clip) {
        const clipId = `pc-clip-inspect-${svgSafeId(node.id)}`;
        registerClipRect(clipDefs, clipId, node.width, node.height, node);
        inner = `${shell}<g clip-path="url(#${clipId})">${childrenMarkup}</g>`;
      } else {
        inner = `${shell}${childrenMarkup}`;
      }
    }
  } else if (node.type === "image") {
    inner = svgImageMarkup(node, resolved, assets, (id, markup) => {
      clipDefs.push(`<clipPath id="${id}">${markup}</clipPath>`);
    });
  }

  const layerOp = resolved.opacity ?? 1;
  const wrapped = layerOp < 0.999 ? `<g opacity="${layerOp}">${inner}</g>` : inner;
  const defsPrefix = [...clipDefs, ...filters.defs].length
    ? `<defs>${[...clipDefs, ...filters.defs].join("")}</defs>`
    : "";
  return `${defsPrefix}${wrapped}`;
}

/** SVG snippet for a single node in its local coordinate system (root at 0,0). */
export function nodeToSvg(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  assets?: Record<string, EditorAsset>,
  designTokens?: Record<string, DesignToken>,
): string {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const inner = nodeToSvgGroupMarkup(node, nodes, childOrder, assets, designTokens);
  const rotated = wrapSvgNodeRotation(inner, node);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rotated}</svg>`;
}

async function renderNodeToCanvas(
  ctx: CanvasRenderingContext2D,
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  ox: number,
  oy: number,
  assets?: Record<string, EditorAsset>,
  designTokens?: Record<string, DesignToken>,
) {
  ctx.save();
  ctx.translate(ox, oy);
  const drawNode = designTokens ? resolveNodeWithDesignTokens(node, designTokens) : node;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * (drawNode.opacity ?? 1);

  const fill = resolveSolidFillCss(drawNode);
  const useGradientFill =
    drawNode.fillEnabled !== false && effectiveFillType(drawNode) === "gradient";
  const sw = drawNode.strokeWidth ?? 0;
  const sc = drawNode.strokeColor ?? "#000";

  const paintShapeFill = (w: number, h: number) => {
    if (drawNode.fillEnabled === false) return;
    if (useGradientFill && paintGradientFillInBox(ctx, drawNode, w, h)) return;
    if (fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };

  if (drawNode.type === "rectangle" || drawNode.type === "frame" || drawNode.type === "group") {
    ctx.beginPath();
    if (drawNode.type === "group") {
      ctx.rect(0, 0, drawNode.width, drawNode.height);
    } else {
      addNodeRoundedRectPath(ctx, drawNode, 0, 0, drawNode.width, drawNode.height);
    }
    if (useGradientFill) {
      ctx.save();
      ctx.clip();
      paintShapeFill(drawNode.width, drawNode.height);
      ctx.restore();
    } else {
      paintShapeFill(drawNode.width, drawNode.height);
    }
    if (sw > 0 && sc) {
      ctx.strokeStyle = sc;
      ctx.lineWidth = sw;
      ctx.stroke();
    } else if (drawNode.type === "frame") {
      ctx.strokeStyle = "#e5e5e5";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (drawNode.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(drawNode.width / 2, drawNode.height / 2, drawNode.width / 2, drawNode.height / 2, 0, 0, Math.PI * 2);
    if (useGradientFill) {
      ctx.save();
      ctx.clip();
      paintShapeFill(drawNode.width, drawNode.height);
      ctx.restore();
    } else {
      paintShapeFill(drawNode.width, drawNode.height);
    }
    if (sw > 0 && sc) {
      ctx.strokeStyle = sc;
      ctx.lineWidth = sw;
      ctx.stroke();
    }
  } else if (drawNode.type === "line" || drawNode.type === "arrow") {
    const lw = drawNode.strokeWidth ?? 2;
    ctx.strokeStyle = sc;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, drawNode.height / 2);
    ctx.lineTo(drawNode.width, drawNode.height / 2);
    ctx.stroke();
  } else if (drawNode.type === "path") {
    const d = pathToSvgD(drawNode.pathPoints ?? [], drawNode.pathClosed ?? false);
    if (d) {
      const p = new Path2D(d);
      if (drawNode.pathClosed && drawNode.fillEnabled !== false) {
        ctx.save();
        ctx.clip(p);
        paintShapeFill(drawNode.width, drawNode.height);
        ctx.restore();
      }
      ctx.strokeStyle = sc;
      ctx.lineWidth = sw > 0 ? sw : 2;
      ctx.stroke(p);
    }
  } else if (drawNode.type === "text") {
    const color = drawNode.textColor ?? drawNode.fill ?? "#111";
    ctx.fillStyle = color;
    ctx.font = `${drawNode.fontWeight ?? 500} ${drawNode.fontSize ?? 13}px ${drawNode.fontFamily ?? "sans-serif"}`;
    ctx.textBaseline = "top";
    ctx.fillText(drawNode.content ?? "", 0, 0);
  } else if (drawNode.type === "image") {
    const href = resolveImageDataUrl(drawNode, assets);
    if (href) {
      const img = await loadHtmlImage(href);
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const r = canvasObjectFit(drawNode.imageFitMode ?? "fill", img.naturalWidth, img.naturalHeight, drawNode.width, drawNode.height);
        ctx.save();
        const aImg = ctx.globalAlpha;
        ctx.globalAlpha = aImg * (drawNode.fillOpacity ?? 1);
        ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        ctx.restore();
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, drawNode.width, drawNode.height);
      }
    } else {
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, drawNode.width, drawNode.height);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, drawNode.width - 1, drawNode.height - 1);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px system-ui,sans-serif";
      ctx.fillText("Image", 6, 16);
    }
  }

  if (drawNode.type === "frame" || drawNode.type === "group") {
    ctx.save();
    if (drawNode.type === "frame") {
      ctx.beginPath();
      addNodeRoundedRectPath(ctx, drawNode, 0, 0, drawNode.width, drawNode.height);
      ctx.clip();
    }
    for (const cid of childOrder[drawNode.id] ?? []) {
      const c = nodes[cid];
      if (!c?.visible) continue;
      await renderNodeToCanvas(ctx, c, nodes, childOrder, c.x, c.y, assets, designTokens);
    }
    ctx.restore();
  }

  ctx.restore();
}

/** Supported PNG export density multipliers (Figma-style). */
export const PNG_EXPORT_SCALES = [1, 1.5, 2, 3, 4] as const;
export type PngExportScale = (typeof PNG_EXPORT_SCALES)[number];

export const PNG_EXPORT_SCALE_OPTIONS = PNG_EXPORT_SCALES.map((scale) => ({
  value: String(scale),
  label: scale === 1 ? "1×" : `${scale}×`,
}));

export function pngExportFilename(baseName: string, scale: number): string {
  const stem = baseName.replace(/\.png$/i, "");
  if (scale === 1) return `${stem}.png`;
  return `${stem}@${scale}x.png`;
}

export async function renderNodeExportCanvas(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  assets?: Record<string, EditorAsset>,
  designTokens?: Record<string, DesignToken>,
  scale = 1,
): Promise<HTMLCanvasElement | null> {
  const exportScale = Math.max(0.25, scale);
  const logicalW = Math.max(1, Math.ceil(node.width));
  const logicalH = Math.max(1, Math.ceil(node.height));
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.ceil(logicalW * exportScale));
  const h = Math.max(1, Math.ceil(logicalH * exportScale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(exportScale, exportScale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, logicalW, logicalH);
  await renderNodeToCanvas(ctx, node, nodes, childOrder, 0, 0, assets, designTokens);
  return canvas;
}

export async function downloadNodePng(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  filename: string,
  assets?: Record<string, EditorAsset>,
  designTokens?: Record<string, DesignToken>,
  scale = 1,
): Promise<void> {
  const canvas = await renderNodeExportCanvas(node, nodes, childOrder, assets, designTokens, scale);
  if (!canvas) return;
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("PNG export failed"));
          return;
        }
        try {
          await saveBlobWithDialog(blob, filename, {
            description: "PNG image",
            mimeType: "image/png",
            extension: ".png",
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      "image/png",
      1,
    );
  });
}

export async function downloadNodePdf(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  filename: string,
  assets?: Record<string, EditorAsset>,
  designTokens?: Record<string, DesignToken>,
): Promise<void> {
  const canvas = await renderNodeExportCanvas(node, nodes, childOrder, assets, designTokens);
  if (!canvas) return;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const jpeg = jpegDataUrlToBytes(dataUrl);
  if (!jpeg) throw new Error("PDF export failed");
  const pdf = buildSinglePageJpegPdf(jpeg, canvas.width, canvas.height);
  const blob = new Blob([pdf], { type: "application/pdf" });
  await saveBlobWithDialog(blob, filename, {
    description: "PDF document",
    mimeType: "application/pdf",
    extension: ".pdf",
  });
}
