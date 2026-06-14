import type { EditorNode } from "@/stores/useEditorStore";
import { getActiveCraftEngine } from "@/engine/craftEngineRegistry";
import {
  prepareTextForDisplay,
  textAdvancedStyleFromNode,
  verticalTrimInsetPx,
  type TextAdvancedStyle,
} from "./textAdvancedStyle";
import {
  buildFontString,
  getTextMeasureContext,
  layoutText,
  lineTopY,
  measureStringWidth,
  type TextLayout,
  type TextLine,
} from "./textMeasure";
import {
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  textInnerHeight,
  textInnerWidth,
  textTypoFromModel,
  toTextNodeModel,
  wrapWidthForResizeMode,
  type TextAlign,
} from "./textNodeModel";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { verticalContentOffsetY } from "./textVerticalAlign";
import { recordFontResolution } from "./textFontManager";

export type CanonicalLineSegment = {
  text: string;
  x: number;
  y: number;
};

export type CanonicalCaretStop = {
  index: number;
  x: number;
  y: number;
};

export type CanonicalGlyphBox = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  glyphId: number;
};

export type FontResolutionInfo = {
  requestedFamily: string;
  resolvedFamily: string;
  fallbackUsed: boolean;
  missing: boolean;
};

export type CanonicalTextLayout = {
  source: "wasm" | "fallback";
  lines: Array<{
    text: string;
    startIndex: number;
    width: number;
    paragraphStart: boolean;
    x: number;
    y: number;
    segments: CanonicalLineSegment[];
  }>;
  width: number;
  height: number;
  lineHeightPx: number;
  paragraphSpacing: number;
  verticalTrimTop: number;
  innerW: number;
  innerH: number;
  blockOffsetY: number;
  caretStops: CanonicalCaretStop[];
  glyphs: CanonicalGlyphBox[];
  font: FontResolutionInfo;
  rtl: boolean;
};

export type TextLayoutForRender = {
  layout: TextLayout;
  canonical: CanonicalTextLayout;
  typo: ResolvedTextTypo;
  textAlign: TextAlign;
  innerW: number;
  innerH: number;
  blockOffsetY: number;
  style: TextAdvancedStyle;
};

type LayoutCacheEntry = {
  key: string;
  value: CanonicalTextLayout;
};

const layoutCache = new Map<string, CanonicalTextLayout>();
const LAYOUT_CACHE_MAX = 512;

function layoutCacheKey(node: EditorNode, displayText: string, style: TextAdvancedStyle): string {
  return [
    node.id,
    displayText,
    node.width,
    node.height,
    node.fontFamily ?? "",
    node.fontSize ?? "",
    node.fontWeight ?? "",
    node.lineHeight ?? "",
    node.letterSpacing ?? "",
    node.textAlign ?? "",
    node.verticalAlign ?? "",
    node.textResizeMode ?? "",
    node.autoResize ?? "",
    style.paragraphSpacing,
    style.textCase,
    style.verticalTrim,
    style.textTruncate,
  ].join("|");
}

function pruneLayoutCache(): void {
  if (layoutCache.size <= LAYOUT_CACHE_MAX) return;
  const drop = layoutCache.size - LAYOUT_CACHE_MAX;
  const keys = [...layoutCache.keys()].slice(0, drop);
  for (const key of keys) layoutCache.delete(key);
}

function effectiveFontSize(typo: ResolvedTextTypo, style: TextAdvancedStyle): number {
  if (style.textCase === "small-caps") return Math.max(1, typo.fontSize * 0.82);
  return typo.fontSize;
}

function buildLayoutRequest(
  node: EditorNode,
  displayText: string,
  style: TextAdvancedStyle,
  typo: ResolvedTextTypo,
): string {
  const payload = {
    node: {
      ...node,
      content: displayText,
      fontSize: effectiveFontSize(typo, style),
      paragraphSpacing: style.paragraphSpacing,
    },
    displayContent: displayText,
    paragraphSpacing: style.paragraphSpacing,
    verticalTrimTop: verticalTrimInsetPx(typo.fontSize, style.verticalTrim),
    effectiveFontSize: effectiveFontSize(typo, style),
  };
  return JSON.stringify(payload);
}

function wasmLayout(
  node: EditorNode,
  displayText: string,
  style: TextAdvancedStyle,
  typo: ResolvedTextTypo,
): CanonicalTextLayout | null {
  const engine = getActiveCraftEngine();
  if (!engine?.layoutTextNode) return null;
  try {
    const json = engine.layoutTextNode(buildLayoutRequest(node, displayText, style, typo));
    const parsed = JSON.parse(json) as CanonicalTextLayout;
    if (!parsed?.lines) return null;
    return { ...parsed, source: "wasm" };
  } catch {
    return null;
  }
}

function fallbackLayout(
  node: EditorNode,
  displayText: string,
  style: TextAdvancedStyle,
  typo: ResolvedTextTypo,
  innerW: number,
  innerH: number,
  effectiveWrap: number,
): CanonicalTextLayout {
  const layout = layoutText(displayText, effectiveWrap, typo, style);
  const blockOffsetY = verticalContentOffsetY(layout.height, innerH, node.verticalAlign);
  const lines = layout.lines.map((line, i) => {
    const y = lineTopYFromLayout(layout, i) + TEXT_BOX_PAD_Y + blockOffsetY;
    const x =
      lineOffsetFromLayout(line, innerW, node.textAlign as TextAlign, i === layout.lines.length - 1) +
      TEXT_BOX_PAD_X;
    return {
      text: line.text,
      startIndex: line.startIndex,
      width: line.width,
      paragraphStart: line.paragraphStart,
      x,
      y,
      segments: [{ text: line.text, x, y }],
    };
  });

  const caretStops: CanonicalCaretStop[] = [];
  for (const line of lines) {
    for (let i = 0; i <= line.text.length; i++) {
      const before = line.text.slice(0, i);
      const relX = measureFallbackWidth(before, typo);
      caretStops.push({ index: line.startIndex + i, x: line.x + relX, y: line.y });
    }
  }

  return {
    source: "fallback",
    lines,
    width: layout.width,
    height: layout.height,
    lineHeightPx: layout.lineHeightPx,
    paragraphSpacing: layout.paragraphSpacing,
    verticalTrimTop: layout.verticalTrimTop,
    innerW,
    innerH,
    blockOffsetY,
    caretStops,
    glyphs: [],
    font: {
      requestedFamily: typo.fontFamily.split(",")[0]?.trim() ?? "sans-serif",
      resolvedFamily: typo.fontFamily.split(",")[0]?.trim() ?? "sans-serif",
      fallbackUsed: false,
      missing: false,
    },
    rtl: false,
  };
}

function lineTopYFromLayout(layout: TextLayout, lineIndex: number): number {
  return lineTopY(layout, lineIndex);
}

function lineOffsetFromLayout(
  line: TextLine,
  innerW: number,
  align: TextAlign,
  isLast: boolean,
): number {
  if (align === "justify" && !isLast) return 0;
  if (align === "center") return Math.max(0, (innerW - line.width) / 2);
  if (align === "right") return Math.max(0, innerW - line.width);
  return 0;
}

function measureFallbackWidth(text: string, typo: ResolvedTextTypo): number {
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  return measureStringWidth(ctx, text, typo.letterSpacing);
}

export function canonicalToTextLayout(canonical: CanonicalTextLayout): TextLayout {
  return {
    lines: canonical.lines.map((line) => ({
      text: line.text,
      startIndex: line.startIndex,
      width: line.width,
      paragraphStart: line.paragraphStart,
    })),
    width: canonical.width,
    height: canonical.height,
    lineHeightPx: canonical.lineHeightPx,
    paragraphSpacing: canonical.paragraphSpacing,
    verticalTrimTop: canonical.verticalTrimTop,
    source: canonical.source,
    caretStops: canonical.caretStops,
    linePositions: canonical.lines.map((line) => ({ x: line.x, y: line.y })),
    glyphs: canonical.glyphs,
    font: canonical.font,
  };
}

/** Canonical text layout — WASM rustybuzz when engine is ready, JS measureText bootstrap otherwise. */
export function layoutTextCanonical(
  node: EditorNode,
  opts?: { bypassCache?: boolean },
): CanonicalTextLayout | null {
  const model = toTextNodeModel(node, false);
  if (!model) return null;

  const typo = textTypoFromModel(model);
  const style = textAdvancedStyleFromNode(node);
  const displayText = prepareTextForDisplay(model.text, style);
  const innerW = textInnerWidth(model.width);
  const innerH = textInnerHeight(model.height);
  const wrapWidth = wrapWidthForResizeMode(model.width, model.textResizeMode);
  const effectiveWrap =
    wrapWidth === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.min(wrapWidth, innerW));

  const cacheKey = layoutCacheKey(node, displayText, style);
  if (!opts?.bypassCache) {
    const cached = layoutCache.get(cacheKey);
    if (cached) return cached;
  }

  const wasm = wasmLayout(node, displayText, style, typo);
  const canonical =
    wasm ??
    fallbackLayout(node, displayText, style, typo, innerW, innerH, effectiveWrap);

  recordFontResolution(node.id, canonical.font);
  layoutCache.set(cacheKey, canonical);
  pruneLayoutCache();
  return canonical;
}

export function clearCanonicalTextLayoutCache(nodeId?: string): void {
  if (!nodeId) {
    layoutCache.clear();
    return;
  }
  for (const key of layoutCache.keys()) {
    if (key.startsWith(`${nodeId}|`)) layoutCache.delete(key);
  }
}

/** Shared layout pipeline for SVG display, canvas editing, caret, and selection. */
export function textLayoutForEditorNode(node: EditorNode): TextLayoutForRender | null {
  const model = toTextNodeModel(node, false);
  if (!model) return null;

  const typo = textTypoFromModel(model);
  const style = textAdvancedStyleFromNode(node);
  const canonical = layoutTextCanonical(node);
  if (!canonical) return null;

  let layout = canonicalToTextLayout(canonical);
  layout = applyTruncateFromCanonical(layout, typo, style, canonical.innerH, canonical.innerW);

  return {
    layout,
    canonical,
    typo,
    textAlign: model.textAlign,
    innerW: canonical.innerW,
    innerH: canonical.innerH,
    blockOffsetY: canonical.blockOffsetY,
    style,
  };
}

function applyTruncateFromCanonical(
  layout: TextLayout,
  typo: ResolvedTextTypo,
  style: TextAdvancedStyle,
  maxHeight: number,
  boxInnerWidth: number,
): TextLayout {
  if (style.textTruncate !== "end" || !Number.isFinite(maxHeight)) return layout;

  let maxLines = 0;
  for (let i = 0; i < layout.lines.length; i++) {
    const bottom = lineTopY(layout, i) + layout.lineHeightPx;
    if (bottom > maxHeight + 0.01) break;
    maxLines = i + 1;
  }
  maxLines = Math.max(1, maxLines);

  if (layout.lines.length <= maxLines) return layout;

  const lines = layout.lines.slice(0, maxLines);
  const last = lines[maxLines - 1]!;
  let truncated = last.text;
  const ellipsis = "…";
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  while (
    truncated.length > 0 &&
    measureStringWidth(ctx, truncated + ellipsis, typo.letterSpacing) > boxInnerWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  lines[maxLines - 1] = {
    ...last,
    text: truncated + ellipsis,
    width: measureStringWidth(ctx, truncated + ellipsis, typo.letterSpacing),
  };

  let paragraphGaps = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.paragraphStart) paragraphGaps++;
  }
  const contentHeight =
    lines.length * layout.lineHeightPx +
    paragraphGaps * layout.paragraphSpacing -
    layout.verticalTrimTop * 2;

  return {
    ...layout,
    lines,
    height: Math.max(layout.lineHeightPx, contentHeight),
    width: Math.max(...lines.map((ln) => ln.width), 0),
  };
}

export function caretRectFromCanonical(
  index: number,
  canonical: CanonicalTextLayout,
  layout: TextLayout,
): { x: number; y: number; height: number } {
  if (canonical.caretStops.length === 0) {
    return { x: 0, y: 0, height: layout.lineHeightPx };
  }
  let best = canonical.caretStops[0]!;
  let bestDist = Math.abs(best.index - index);
  for (const stop of canonical.caretStops) {
    const dist = Math.abs(stop.index - index);
    if (dist < bestDist) {
      best = stop;
      bestDist = dist;
    }
    if (stop.index > index) break;
  }
  return { x: best.x, y: best.y, height: layout.lineHeightPx };
}
