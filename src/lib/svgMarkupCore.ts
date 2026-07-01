import type { EditorAsset } from "@/lib/documentPersistence";
import type { CanvasColorMode, DesignToken } from "@/lib/designTokens";
import { legacyEffectShadowAppend, resolveEffectBoxShadow, resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { effectiveFillType, effectiveStrokeType, fillPaintCss, svgFillPaint } from "@/lib/fillGradient";
import { resolveShapeFillAttr, resolveShapeStrokeAttr } from "@/lib/gradient/svgSceneFill";
import { textFillNeedsMask, textNodeAsFillPaint } from "@/lib/text/textFillPaint";
import { DEFAULT_SHAPE_STROKE } from "@/lib/shapes/shapeModel";
import {
  effectiveEllipseArc,
  ellipseArcPathD,
  hasEllipseArcInnerHole,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";
import { resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import type { NodeEffect } from "@/lib/nodeEffects";
import { buildNodeEffectRenderStyle, effectColorToRgba } from "@/lib/nodeEffects";
import {
  clampCornerRadii,
  cornerRadiiMax,
  getNodeCornerRadii,
  roundedRectPathD,
  roundedRectPathDForNode,
} from "@/lib/cornerRadius";
import {
  resolveSvgStrokeLayers,
  strokeAttrsForSvgMarkup,
  strokeIsVisible,
  svgNativeLinecap,
  svgStrokePresentationFromNode,
} from "@/lib/stroke";
import {
  arrowHeadToStrokeEndpoint,
  arrowMarkerScale,
  resolveArrowEndKind,
  resolveArrowStartKind,
} from "@/lib/shapes/arrowGeometry";
import { lineLocalRenderPoints } from "@/lib/shapes/lineGeometry";
import {
  centerlineStrokeLinecap,
  openPathStrokeViewport,
  resolveStrokeEndPoint,
  resolveStrokeStartPoint,
  strokeEndpointMarkerDefs,
  strokeMarkerRefs,
} from "@/lib/strokeEndpoints";
import {
  shouldUseAlignedPathStroke,
  shouldUseFilledStrokeRingForNode,
  shouldUseOutlinedOpenPathStroke,
  strokeRingLayersBeforeFill,
} from "@/lib/strokeAlign";
import { filledStrokeOutlineFromPathD, outlineStroke, type OutlineStrokeResult } from "@/lib/outlineStroke";
import {
  shouldRenderSvgPerSideStroke,
  svgPerSideStrokeBeforeFill,
  svgPerSideStrokeMarkup,
} from "@/lib/svgPerSideStroke";
import { textLayoutForEditorNode, type TextLayoutForRender } from "@/lib/text/canonicalTextLayout";
import { svgTextTspanY } from "@/lib/text/textBaseline";
import { resolveTextLayerStroke } from "@/lib/text/textLayerStroke";
import {
  SVG_TEXT_DOMINANT_BASELINE,
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  type TextAlign,
} from "@/lib/text/textNodeModel";
import {
  getTextMeasureContext,
  lineOffsetX,
  lineTopY,
  measureStringWidth,
} from "@/lib/text/textMeasure";
import {
  strikethroughDecorationY,
  textDecorationStrokeWidth,
  underlineDecorationY,
  type TextDecorationMode,
} from "@/lib/text/textAdvancedStyle";
import type { ResolvedTextTypo } from "@/lib/textTypography";
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

/** Native SVG stroke attrs (solid rgba or gradient/image/video url) on a closed fill path. */
function nativeClosedShapeStrokeAttr(
  node: EditorNode,
  opts: {
    showStroke: boolean;
    strokeWidth: number;
    strokeExtra: string;
    fallbackColor: string;
    nodeId?: string;
    width: number;
    height: number;
    registerGradient?: (id: string, markup: string) => void;
    renderScale?: number;
    assets?: Record<string, EditorAsset>;
  },
): { strokeAttr: string; underlayMarkup: string } {
  if (!opts.showStroke) {
    return { strokeAttr: ' stroke="none"', underlayMarkup: "" };
  }
  let strokePaint = escXml(opts.fallbackColor);
  let underlayMarkup = "";
  if (opts.registerGradient && opts.nodeId) {
    const strokeLayers = resolveSvgStrokeLayers(node, {
      gradientId: `pc-sg-${svgSafeId(opts.nodeId)}`,
      width: opts.width,
      height: opts.height,
      registerGradient: opts.registerGradient,
      renderScale: opts.renderScale,
      assets: opts.assets,
    });
    if (strokeLayers.strokePaint !== "none") {
      strokePaint = strokeLayers.strokePaint.startsWith("url(")
        ? strokeLayers.strokePaint
        : escXml(strokeLayers.strokePaint);
    }
    underlayMarkup = strokeLayers.underlayMarkup;
  }
  return {
    strokeAttr: ` stroke="${strokePaint}" stroke-width="${opts.strokeWidth}"${opts.strokeExtra}`,
    underlayMarkup,
  };
}

/** Filled outline ring for gradient/image/video strokes (matches canvas React path). */
function svgGradientOutlineStrokeMarkup(
  n: EditorNode,
  opts: {
    nodeId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
    renderScale?: number;
    assets?: Record<string, EditorAsset>;
    filter: string;
  },
): { markup: string; underlay: string } | null {
  if (effectiveStrokeType(n) !== "gradient") return null;
  const fillPathD = resolvePathOutlineD(n, opts.nodeId);
  const closed = n.type === "polygon" ? true : (n.pathClosed ?? true);
  if (!shouldUseFilledStrokeRingForNode(n, { closed, showStroke: true })) return null;
  const outlined =
    filledStrokeOutlineFromPathD(n, fillPathD, closed) ?? outlineStroke(n);
  if (!outlined?.pathD) return null;
  const stroke = resolveShapeStrokeAttr({
    node: n,
    width: opts.width,
    height: opts.height,
    nodeId: `pc-sg-${svgSafeId(opts.nodeId)}`,
    registerGradient: opts.registerGradient,
    renderScale: opts.renderScale,
    assets: opts.assets,
  });
  const outlinePaint = outlined as OutlineStrokeResult;
  const strokeFill =
    stroke.strokeAttr !== "none"
      ? stroke.strokeAttr.startsWith("url(")
        ? stroke.strokeAttr
        : escXml(stroke.strokeAttr)
      : escXml(
          effectColorToRgba(
            outlinePaint.fill ?? n.strokeColor ?? DEFAULT_SHAPE_STROKE,
            outlinePaint.fillOpacity ?? n.strokeOpacity ?? 1,
          ),
        );
  const fillRuleAttr =
    outlined.fillRule && outlined.fillRule !== "nonzero"
      ? ` fill-rule="${outlined.fillRule}"`
      : "";
  return {
    markup: `<path d="${escXml(outlined.pathD)}" fill="${strokeFill}" stroke="none"${fillRuleAttr}${opts.filter} />`,
    underlay: stroke.underlayMarkup,
  };
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
    renderScale?: number;
    assets?: Record<string, EditorAsset>;
  },
): string {
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  let fillAttr: string;
  let underlay = "";
  let strokeUnderlay = "";
  if (opts?.registerGradient && opts.nodeId) {
    const resolved = resolveShapeFillAttr({
      node: n,
      width: w,
      height: h,
      nodeId: `pc-grad-${svgSafeId(opts.nodeId)}`,
      registerGradient: opts.registerGradient,
      renderScale: opts.renderScale,
      assets: opts.assets,
    });
    fillAttr = resolved.fillAttr;
    underlay = resolved.underlayMarkup;
  } else {
    fillAttr = escXml(fillPaintCss(n));
  }
  if (fillAttr !== "none" && !fillAttr.startsWith("url(")) {
    fillAttr = escXml(fillAttr);
  }
  const sw = opts?.strokeWidthOverride ?? n.strokeWidth ?? 0;
  const sc = opts?.strokeOverride ?? n.strokeColor ?? "none";
  const filter = opts?.filterRef ? ` filter="url(#${opts.filterRef})"` : "";
  const showStroke = strokeIsVisible(n) && sw > 0;
  const strokeExtra = showStroke ? ` ${strokeAttrsForSvgMarkup(n)}` : "";
  const nodeId = opts?.nodeId ?? n.id;
  const filterAttr = opts?.filterRef ? ` filter="url(#${opts.filterRef})"` : "";
  let nativeStrokeUnderlay = "";

  const gradientOutlineStroke =
    showStroke && opts?.registerGradient && !opts?.strokeOverride
      ? svgGradientOutlineStrokeMarkup(n, {
          nodeId,
          width: w,
          height: h,
          registerGradient: opts.registerGradient,
          renderScale: opts.renderScale,
          assets: opts.assets,
          filter,
        })
      : null;
  if (gradientOutlineStroke) strokeUnderlay = gradientOutlineStroke.underlay;

  const alignedStrokeMarkup = (): string | null => {
    if (gradientOutlineStroke) return gradientOutlineStroke.markup;
    if (!showStroke || !shouldUseAlignedPathStroke(n, true)) return null;
    const outlined = outlineStroke(n);
    if (!outlined?.pathD) return null;
    const strokeFill = escXml(
      effectColorToRgba(outlined.fill ?? sc, outlined.fillOpacity ?? n.strokeOpacity ?? 1),
    );
    const fillRuleAttr =
      outlined.fillRule && outlined.fillRule !== "nonzero"
        ? ` fill-rule="${outlined.fillRule}"`
        : "";
    return `<path d="${escXml(outlined.pathD)}" fill="${strokeFill}" stroke="none"${fillRuleAttr}${filter} />`;
  };

  const shape = (() => {
    if (n.type === "ellipse") {
      const arc = effectiveEllipseArc(n);
      const useArcPath =
        !isFullEllipseArc(arc.sweepDeg) || hasEllipseArcInnerHole(arc.innerRadiusRatio);
      const alignedStroke = alignedStrokeMarkup();
      if (useArcPath) {
        const d = escXml(
          ellipseArcPathD(w, h, arc.startDeg, arc.sweepDeg, arc.innerRadiusRatio),
        );
        const fillRuleAttr =
          hasEllipseArcInnerHole(arc.innerRadiusRatio) && isFullEllipseArc(arc.sweepDeg)
            ? ' fill-rule="evenodd"'
            : "";
        const nativeStroke = !alignedStroke
          ? nativeClosedShapeStrokeAttr(n, {
              showStroke,
              strokeWidth: sw,
              strokeExtra,
              fallbackColor: sc,
              nodeId,
              width: w,
              height: h,
              registerGradient: opts?.registerGradient,
              renderScale: opts?.renderScale,
              assets: opts?.assets,
            })
          : null;
        if (nativeStroke) nativeStrokeUnderlay += nativeStroke.underlayMarkup;
        const strokeAttr = nativeStroke?.strokeAttr ?? ' stroke="none"';
        const fillEl = `<path d="${d}" fill="${fillAttr}"${fillRuleAttr}${strokeAttr}${filter} />`;
        if (!alignedStroke) return fillEl;
        return svgPerSideStrokeBeforeFill(n.strokePosition)
          ? `${alignedStroke}${fillEl}`
          : `${fillEl}${alignedStroke}`;
      }
      const nativeStroke = !alignedStroke
        ? nativeClosedShapeStrokeAttr(n, {
            showStroke,
            strokeWidth: sw,
            strokeExtra,
            fallbackColor: sc,
            nodeId,
            width: w,
            height: h,
            registerGradient: opts?.registerGradient,
            renderScale: opts?.renderScale,
            assets: opts?.assets,
          })
        : null;
      if (nativeStroke) nativeStrokeUnderlay += nativeStroke.underlayMarkup;
      const strokeAttr = nativeStroke?.strokeAttr ?? ' stroke="none"';
      const fillEl = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fillAttr}"${strokeAttr}${filter} />`;
      if (!alignedStroke) return fillEl;
      return svgPerSideStrokeBeforeFill(n.strokePosition)
        ? `${alignedStroke}${fillEl}`
        : `${fillEl}${alignedStroke}`;
    }
    if (n.type === "rectangle" || n.type === "frame" || n.type === "group") {
      if (n.type === "frame" || n.type === "rectangle") {
        const radii = clampCornerRadii(getNodeCornerRadii(n), w, h);
        const pathD = roundedRectPathDForNode(n, w, h);
        let perSideMarkup: string | null | undefined;
        if (showStroke && shouldRenderSvgPerSideStroke(n) && !perSideMarkup) {
          perSideMarkup = svgPerSideStrokeMarkup(n, {
            nodeId,
            width: w,
            height: h,
            clipPathD: pathD,
            strokeColor: sc,
            strokeAttrs: strokeExtra.trim(),
            filterAttr: opts?.filterRef ? ` filter="url(#${opts.filterRef})"` : "",
            registerGradient: opts?.registerGradient,
            assets: opts?.assets,
            renderScale: opts?.renderScale,
          });
        }
        const usePerSide = Boolean(perSideMarkup);
        const alignedStroke =
          !usePerSide && (gradientOutlineStroke || shouldUseAlignedPathStroke(n, true))
            ? alignedStrokeMarkup()
            : null;
        const nativeStroke =
          showStroke && !usePerSide && !alignedStroke
            ? nativeClosedShapeStrokeAttr(n, {
                showStroke,
                strokeWidth: sw,
                strokeExtra,
                fallbackColor: sc,
                nodeId,
                width: w,
                height: h,
                registerGradient: opts?.registerGradient,
                renderScale: opts?.renderScale,
                assets: opts?.assets,
              })
            : null;
        if (nativeStroke) nativeStrokeUnderlay += nativeStroke.underlayMarkup;
        const strokeAttr =
          showStroke && !usePerSide && !alignedStroke
            ? nativeStroke!.strokeAttr
            : ' stroke="none"';
        const fillEl =
          cornerRadiiMax(radii) <= 0
            ? `<rect x="0" y="0" width="${w}" height="${h}" fill="${fillAttr}"${strokeAttr}${filter} />`
            : `<path d="${escXml(pathD)}" fill="${fillAttr}"${strokeAttr}${filter} />`;
        if (!usePerSide && !alignedStroke) return fillEl;
        if (alignedStroke) {
          return svgPerSideStrokeBeforeFill(n.strokePosition)
            ? `${alignedStroke}${fillEl}`
            : `${fillEl}${alignedStroke}`;
        }
        if (!perSideMarkup) return fillEl;
        if (svgPerSideStrokeBeforeFill(n.strokePosition)) {
          return `${perSideMarkup}${fillEl}`;
        }
        return `${fillEl}${perSideMarkup}`;
      }
      const nativeStroke = nativeClosedShapeStrokeAttr(n, {
        showStroke,
        strokeWidth: sw,
        strokeExtra,
        fallbackColor: sc,
        nodeId,
        width: w,
        height: h,
        registerGradient: opts?.registerGradient,
        renderScale: opts?.renderScale,
        assets: opts?.assets,
      });
      nativeStrokeUnderlay += nativeStroke.underlayMarkup;
      return `<rect x="0" y="0" width="${w}" height="${h}" fill="${fillAttr}"${nativeStroke.strokeAttr}${filter} />`;
    }
    return "";
  })();
  const combinedUnderlay = `${underlay}${strokeUnderlay}${nativeStrokeUnderlay}`;
  return combinedUnderlay ? `${combinedUnderlay}${shape}` : shape;
}

/** SVG markup for line/arrow layers (endpoint coords, caps, arrow markers). */
export function svgLine(n: EditorNode, nodeId?: string): string {
  const lw = n.strokeWidth ?? 2;
  if (!strokeIsVisible(n) || lw <= 0) return "";

  const lc = escXml(n.strokeColor ?? DEFAULT_SHAPE_STROKE);
  const pts = lineLocalRenderPoints(n);
  const start =
    n.type === "arrow"
      ? arrowHeadToStrokeEndpoint(resolveArrowStartKind(n))
      : resolveStrokeStartPoint(n);
  const end =
    n.type === "arrow"
      ? arrowHeadToStrokeEndpoint(resolveArrowEndKind(n))
      : resolveStrokeEndPoint(n);
  const lineCap =
    n.type === "arrow"
      ? svgNativeLinecap(n.strokeLinecap ?? "butt")
      : centerlineStrokeLinecap(start, end);

  const vp = openPathStrokeViewport(n.width, n.height, lw, start, end);
  const prefix = nodeId ? `pc-stroke-${svgSafeId(nodeId)}` : "pc-stroke-anon";
  const markerOpts = n.type === "arrow" ? { markerScale: arrowMarkerScale(n) } : undefined;
  const markers = strokeEndpointMarkerDefs(
    prefix,
    start,
    end,
    n.strokeColor ?? DEFAULT_SHAPE_STROKE,
    lw,
    markerOpts,
  );
  const markerRefs = strokeMarkerRefs(start, end, prefix);
  const pres = svgStrokePresentationFromNode(n);
  const dashAttr = pres.strokeDasharray ? ` stroke-dasharray="${pres.strokeDasharray}"` : "";
  const joinAttrs = `stroke-linejoin="${pres.strokeLinejoin}" stroke-miterlimit="${pres.strokeMiterlimit}"`;
  const markerStart = markerRefs.markerStart ? ` marker-start="${markerRefs.markerStart}"` : "";
  const markerEnd = markerRefs.markerEnd ? ` marker-end="${markerRefs.markerEnd}"` : "";

  const x1 = pts.x1 - vp.offsetLeft;
  const y1 = pts.y1 - vp.offsetTop;
  const x2 = pts.x2 - vp.offsetLeft;
  const y2 = pts.y2 - vp.offsetTop;
  const tx =
    vp.offsetLeft !== 0 || vp.offsetTop !== 0
      ? ` transform="translate(${vp.offsetLeft} ${vp.offsetTop})"`
      : "";
  const defs = markers ? `<defs>${markers}</defs>` : "";

  return `<g${tx}>${defs}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="${lineCap}" ${joinAttrs}${dashAttr}${markerStart}${markerEnd} /></g>`;
}

function svgTextDecorationAttr(_decoration: TextDecorationMode): string {
  return "";
}

/** Explicit SVG lines — `text-decoration` on `<tspan>` is unreliable across browsers. */
function svgTextDecorationMarkup(
  prepared: TextLayoutForRender,
  typo: ResolvedTextTypo,
  decoration: TextDecorationMode,
  strokePaint: string,
): string {
  if (decoration === "none") return "";
  const { layout, canonical, textAlign, innerW, blockOffsetY } = prepared;
  const strokeW = textDecorationStrokeWidth(typo.fontSize);
  const parts: string[] = [];

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    if (!line.text) continue;
    const isLast = i === layout.lines.length - 1;
    const canonicalLine = canonical.lines[i];
    const y = canonicalLine?.y ?? lineTopY(layout, i) + TEXT_BOX_PAD_Y + blockOffsetY;
    const x =
      canonicalLine?.x ??
      lineOffsetX(line.width, innerW, textAlign, {
        isLastLine: isLast,
        fullLineText: line.text,
        letterSpacing: typo.letterSpacing,
      }) + TEXT_BOX_PAD_X;
    const width = line.width;

    if (decoration === "underline") {
      const uy = underlineDecorationY(y, typo.fontSize, typo.lineHeight);
      parts.push(
        `<line x1="${x}" y1="${uy}" x2="${x + width}" y2="${uy}" stroke="${strokePaint}" stroke-width="${strokeW}" />`,
      );
    }
    if (decoration === "strikethrough") {
      const sy = strikethroughDecorationY(y, typo.fontSize, typo.lineHeight);
      parts.push(
        `<line x1="${x}" y1="${sy}" x2="${x + width}" y2="${sy}" stroke="${strokePaint}" stroke-width="${strokeW}" />`,
      );
    }
  }

  return parts.join("");
}

function svgJustifiedLineTspans(
  text: string,
  x: number,
  y: number,
  boxWidth: number,
  typo: ResolvedTextTypo,
  decorationAttr = "",
): string {
  const words = text.split(/(\s+)/);
  const wordCount = words.filter((w) => w && !/^\s+$/.test(w)).length;
  if (wordCount < 2) {
    return `<tspan x="${x}" y="${y}"${decorationAttr}>${escXml(text)}</tspan>`;
  }
  let total = 0;
  for (const w of words) {
    if (!/^\s+$/.test(w)) {
      total += measureStringWidth(getTextMeasureContext(), w, typo.letterSpacing);
    }
  }
  const spaceCount = Math.max(1, wordCount - 1);
  const extra = Math.max(0, boxWidth - total) / spaceCount;
  let cx = x;
  const parts: string[] = [];
  for (const token of words) {
    if (/^\s+$/.test(token)) {
      cx += extra;
      continue;
    }
    parts.push(`<tspan x="${cx}" y="${y}"${decorationAttr}>${escXml(token)}</tspan>`);
    cx += measureStringWidth(getTextMeasureContext(), token, typo.letterSpacing);
  }
  return parts.join("");
}

export type SvgTextMarkupOpts = {
  nodeId?: string;
  registerGradient?: (id: string, markup: string) => void;
  renderScale?: number;
  assets?: Record<string, EditorAsset>;
};

export function svgTextMarkup(n: EditorNode, opts?: SvgTextMarkupOpts): string {
  const prepared = textLayoutForEditorNode(n);
  if (!prepared) return "";

  const { layout, canonical, typo, textAlign, innerW, blockOffsetY, style } = prepared;
  const ff = escXml(typo.fontFamily);
  const fontSize =
    style.textCase === "small-caps" ? Math.max(1, typo.fontSize * 0.82) : typo.fontSize;
  const ls =
    canonical.source === "wasm" || typo.letterSpacing == null || typo.letterSpacing === 0
      ? ""
      : ` letter-spacing="${typo.letterSpacing}"`;
  const decorationAttr = svgTextDecorationAttr(style.textDecoration);
  const markupTypo =
    style.textCase === "small-caps"
      ? { ...typo, fontSize: Math.max(1, typo.fontSize * 0.82) }
      : typo;
  const browserPaint = canonical.browserPaint === true;
  const dominantBaseline = browserPaint ? "text-before-edge" : SVG_TEXT_DOMINANT_BASELINE;
  const toSvgY = (lineBoxTopY: number) =>
    browserPaint ? lineBoxTopY : svgTextTspanY(lineBoxTopY, markupTypo, layout.lineHeightPx);

  const tspans: string[] = [];
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const canonicalLine = canonical.lines[i];
    const isLast = i === layout.lines.length - 1;
    const canvasLineY = canonicalLine?.y ?? lineTopY(layout, i) + TEXT_BOX_PAD_Y + blockOffsetY;
    const y = toSvgY(canvasLineY);

    if (canonicalLine && canonicalLine.segments.length > 1) {
      for (const segment of canonicalLine.segments) {
        tspans.push(
          `<tspan x="${segment.x}" y="${toSvgY(segment.y)}"${decorationAttr}>${escXml(segment.text)}</tspan>`,
        );
      }
      continue;
    }

    if (textAlign === "justify" && !isLast && !canonicalLine) {
      const x = TEXT_BOX_PAD_X;
      tspans.push(svgJustifiedLineTspans(line.text, x, y, innerW, typo, decorationAttr));
      continue;
    }

    const x =
      canonicalLine?.x ??
      lineOffsetX(line.width, innerW, textAlign, {
        isLastLine: isLast,
        fullLineText: line.text,
        letterSpacing: typo.letterSpacing,
      }) + TEXT_BOX_PAD_X;
    tspans.push(`<tspan x="${x}" y="${y}"${decorationAttr}>${escXml(line.text)}</tspan>`);
  }

  const tspansMarkup = tspans.join("");
  const layerStroke = resolveTextLayerStroke(n);
  const strokeAttrs = layerStroke
    ? ` stroke="${escXml(layerStroke.color)}" stroke-width="${layerStroke.spec.width}" paint-order="stroke fill" ${layerStroke.svgExtraAttrs}`
    : "";
  const textAttrs = `font-family="${ff}" font-size="${fontSize}" font-weight="${typo.fontWeight}" dominant-baseline="${dominantBaseline}"${ls}${strokeAttrs}`;
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  const fillNode = textNodeAsFillPaint(n);

  if (!opts?.registerGradient || !opts.nodeId) {
    const color = escXml(
      n.fillEnabled === false ? "none" : fillPaintCss(fillNode, opts?.assets) || typo.color,
    );
    const decorations = svgTextDecorationMarkup(prepared, typo, style.textDecoration, color);
    return `<text fill="${color}" ${textAttrs}>${tspansMarkup}</text>${decorations}`;
  }

  const gradId = `pc-text-${svgSafeId(opts.nodeId)}`;
  const resolved = resolveShapeFillAttr({
    node: fillNode,
    width: w,
    height: h,
    nodeId: gradId,
    registerGradient: opts.registerGradient,
    renderScale: opts.renderScale,
    assets: opts.assets,
  });

  let fillAttr = resolved.fillAttr;
  if (fillAttr !== "none" && !fillAttr.startsWith("url(")) {
    fillAttr = escXml(fillAttr);
  }

  const fillKind = effectiveFillType(fillNode);
  const strokePaint =
    fillAttr !== "none" && fillAttr.startsWith("url(") ? fillAttr : escXml(fillPaintCss(fillNode, opts?.assets) || typo.color);
  const decorations = svgTextDecorationMarkup(prepared, typo, style.textDecoration, strokePaint);

  if (textFillNeedsMask(fillKind, resolved.fillAttr, resolved.underlayMarkup)) {
    const maskId = `${gradId}-mask`;
    opts.registerGradient(
      maskId,
      `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">` +
        `<rect x="0" y="0" width="${w}" height="${h}" fill="black"/>` +
        `<text ${textAttrs} fill="white">${tspansMarkup}</text></mask>`,
    );
    const fillContent =
      resolved.underlayMarkup ||
      `<rect x="0" y="0" width="${w}" height="${h}" fill="${fillAttr}"/>`;
    return `<g mask="url(#${maskId})">${fillContent}</g>${decorations}`;
  }

  return `${resolved.underlayMarkup}<text fill="${fillAttr}" ${textAttrs}>${tspansMarkup}</text>${decorations}`;
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

/** Wrap scene markup in an SVG filter group when the node has layer effects. */
export function wrapSvgNodeFilter(markup: string, filterRef?: string): string {
  if (!filterRef || !markup) return markup;
  return `<g filter="url(#${filterRef})">${markup}</g>`;
}

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
        } else if (e.type === "inner-shadow") {
          const dx = e.x ?? 0;
          const dy = e.y ?? 0;
          const std = Math.max(0, (e.blur ?? 0) / 2);
          const rgba = effectColorToRgba(e.color, e.opacity ?? 1);
          parts.push(
            `<feOffset dx="${dx}" dy="${dy}" in="SourceAlpha" result="pc-inner-offset-${svgSafeId(nodeId)}" />`,
            `<feGaussianBlur in="pc-inner-offset-${svgSafeId(nodeId)}" stdDeviation="${std}" result="pc-inner-blur-${svgSafeId(nodeId)}" />`,
            `<feComposite in="pc-inner-blur-${svgSafeId(nodeId)}" in2="SourceAlpha" operator="out" result="pc-inner-inverse-${svgSafeId(nodeId)}" />`,
            `<feFlood flood-color="${escXml(rgba)}" flood-opacity="1" result="pc-inner-color-${svgSafeId(nodeId)}" />`,
            `<feComposite in="pc-inner-color-${svgSafeId(nodeId)}" in2="pc-inner-inverse-${svgSafeId(nodeId)}" operator="in" result="pc-inner-shadow-${svgSafeId(nodeId)}" />`,
            `<feComposite in="pc-inner-shadow-${svgSafeId(nodeId)}" in2="SourceGraphic" operator="over" />`,
          );
        } else if (e.type === "background-blur") {
          const std = Math.max(0, (e.blur ?? 0) / 2);
          parts.push(`<feGaussianBlur in="BackgroundImage" stdDeviation="${std}" result="bgBlur" />`);
          parts.push(`<feBlend in="SourceGraphic" in2="bgBlur" mode="normal" />`);
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
  bleed = 0,
): void {
  const x = -bleed;
  const y = -bleed;
  const width = Math.max(1, w + bleed * 2);
  const height = Math.max(1, h + bleed * 2);
  if (node && bleed <= 0) {
    const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
    if (cornerRadiiMax(radii) <= 0) {
      defs.push(`<clipPath id="${clipId}"><rect x="0" y="0" width="${width}" height="${height}" /></clipPath>`);
      return;
    }
    const d = roundedRectPathD(w, h, radii);
    defs.push(`<clipPath id="${clipId}"><path d="${d}" /></clipPath>`);
    return;
  }
  defs.push(
    `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" /></clipPath>`,
  );
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
  colorMode: CanvasColorMode = "light",
): EditorNode {
  return resolveNodeWithDesignTokens(node, designTokens, colorMode);
}

/** Scene render node — instance overrides + design tokens (matches inspector display). */
export function resolveSceneRenderNode(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  designTokens: Record<string, DesignToken>,
  colorMode: CanvasColorMode = "light",
  cssSources?: string[],
): EditorNode {
  return resolveNodeWithDesignTokens(
    mergeInstanceOverrides(node, nodes),
    designTokens,
    colorMode,
    cssSources,
  );
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
    fillRule?: "nonzero" | "evenodd";
    renderScale?: number;
    assets?: Record<string, EditorAsset>;
  },
): string {
  const d = resolvePathOutlineD(resolved, resolved.id);
  const w = Math.max(1, resolved.width);
  const h = Math.max(1, resolved.height);
  let fillAttr = "none";
  let underlay = "";
  if (resolved.fillEnabled !== false) {
    if (opts?.registerGradient && opts.nodeId) {
      const r = resolveShapeFillAttr({
        node: resolved,
        width: w,
        height: h,
        nodeId: `pc-grad-${svgSafeId(opts.nodeId)}`,
        registerGradient: opts.registerGradient,
        renderScale: opts.renderScale,
        assets: opts.assets,
      });
      fillAttr = r.fillAttr;
      underlay = r.underlayMarkup;
    } else {
      fillAttr = escXml(fillPaintCss(resolved));
    }
  }
  if (fillAttr !== "none" && fillAttr !== "transparent" && !fillAttr.startsWith("url(")) {
    fillAttr = escXml(fillAttr);
  }
  const sw = resolved.strokeWidth ?? 2;
  const filter = opts?.filterRef ? ` filter="url(#${opts.filterRef})"` : "";
  const showStroke = strokeIsVisible(resolved) && sw > 0;
  const strokeExtra = showStroke ? ` ${strokeAttrsForSvgMarkup(resolved)}` : "";
  const fillRuleAttr =
    (opts?.fillRule ?? resolved.pathFillRule) &&
    (opts?.fillRule ?? resolved.pathFillRule) !== "nonzero"
      ? ` fill-rule="${opts?.fillRule ?? resolved.pathFillRule}"`
      : "";

  const pathClosed = resolved.type === "polygon" ? true : (resolved.pathClosed ?? false);
  const gradientOutlineStroke =
    showStroke && opts?.registerGradient && opts.nodeId
      ? svgGradientOutlineStrokeMarkup(resolved, {
          nodeId: opts.nodeId,
          width: w,
          height: h,
          registerGradient: opts.registerGradient,
          renderScale: opts.renderScale,
          assets: opts.assets,
          filter,
        })
      : null;
  if (gradientOutlineStroke) {
    underlay += gradientOutlineStroke.underlay;
    const fillPath = `<path d="${escXml(d)}" fill="${fillAttr}" stroke="none"${fillRuleAttr}${filter} />`;
    if (strokeRingLayersBeforeFill(resolved.strokePosition)) {
      return `${underlay}${gradientOutlineStroke.markup}${fillPath}`;
    }
    return `${underlay}${fillPath}${gradientOutlineStroke.markup}`;
  }

  const closed = resolved.pathClosed ?? false;
  const openOutline =
    showStroke && shouldUseOutlinedOpenPathStroke(resolved, closed)
      ? outlineStroke(resolved)
      : null;
  if (openOutline?.pathD) {
    const strokeFill = escXml(
      effectColorToRgba(
        openOutline.fill,
        openOutline.fillOpacity ?? resolved.strokeOpacity ?? 1,
      ),
    );
    const outlineRule =
      openOutline.fillRule !== "nonzero" ? ` fill-rule="${openOutline.fillRule}"` : "";
    const fillPath = `<path d="${escXml(d)}" fill="${fillAttr}" stroke="none"${fillRuleAttr}${filter} />`;
    const strokePath = `<path d="${escXml(openOutline.pathD)}" fill="${strokeFill}" stroke="none"${outlineRule}${filter} />`;
    return underlay ? `${underlay}${fillPath}${strokePath}` : `${fillPath}${strokePath}`;
  }

  const alignedOutline =
    showStroke && shouldUseFilledStrokeRingForNode(resolved, { closed: pathClosed, showStroke: true })
      ? filledStrokeOutlineFromPathD(resolved, d, pathClosed)
      : null;
  if (alignedOutline?.pathD) {
    const strokeFill = escXml(
      effectColorToRgba(resolved.strokeColor ?? DEFAULT_SHAPE_STROKE, resolved.strokeOpacity ?? 1),
    );
    const outlineRule =
      alignedOutline.fillRule !== "nonzero" ? ` fill-rule="${alignedOutline.fillRule}"` : "";
    const fillPath = `<path d="${escXml(d)}" fill="${fillAttr}" stroke="none"${fillRuleAttr}${filter} />`;
    const strokePath = `<path d="${escXml(alignedOutline.pathD)}" fill="${strokeFill}" stroke="none"${outlineRule}${filter} />`;
    return underlay ? `${underlay}${fillPath}${strokePath}` : `${fillPath}${strokePath}`;
  }

  const nativeStroke = nativeClosedShapeStrokeAttr(resolved, {
    showStroke,
    strokeWidth: sw,
    strokeExtra,
    fallbackColor: resolved.strokeColor ?? DEFAULT_SHAPE_STROKE,
    nodeId: opts?.nodeId,
    width: w,
    height: h,
    registerGradient: opts?.registerGradient,
    renderScale: opts?.renderScale,
    assets: opts?.assets,
  });
  underlay += nativeStroke.underlayMarkup;
  const path = showStroke
    ? `<path d="${escXml(d)}" fill="${fillAttr}"${nativeStroke.strokeAttr}${fillRuleAttr}${filter} />`
    : `<path d="${escXml(d)}" fill="${fillAttr}" stroke="none"${fillRuleAttr}${filter} />`;
  return underlay ? `${underlay}${path}` : path;
}
