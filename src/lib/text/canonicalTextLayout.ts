import type { EditorNode } from "@/stores/useEditorStore";
import { getActiveCraftEngine } from "@/engine/craftEngineRegistry";
import { readCraftEngine } from "@/engine/craftEngineMutation";
import {
  prepareTextForDisplay,
  textAdvancedStyleFromNode,
  verticalTrimInsetPx,
  type TextAdvancedStyle,
} from "./textAdvancedStyle";
import {
  layoutText,
  lineTopY,
  measureStringWidthForTypo,
  type TextLayout,
  type TextLine,
} from "./textMeasure";
import {
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  availableWrapWidthForNode,
  nodeForTextLayout,
  normalizeTextResizeMode,
  textInnerHeight,
  textInnerWidth,
  textTypoFromModel,
  toTextNodeModel,
  type TextAlign,
} from "./textNodeModel";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { textBlockContentHeight } from "./textBaseline";
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
  /** Layout debug metadata (shown in ?textDebug=1 overlay). */
  debug: TextLayoutDebugInfo;
};

export type TextLayoutDebugInfo = {
  cacheKey: string;
  wrapEnabled: boolean;
  availableWidth: number;
  lineWidths: number[];
};

type LayoutCacheEntry = {
  key: string;
  value: CanonicalTextLayout;
};

const layoutCache = new Map<string, CanonicalTextLayout>();
const LAYOUT_CACHE_MAX = 512;

function layoutCacheKey(node: EditorNode, displayText: string, style: TextAdvancedStyle): string {
  const layoutNode = nodeForTextLayout(node, displayText);
  return [
    layoutNode.id,
    displayText,
    layoutNode.width,
    layoutNode.height,
    layoutNode.fontFamily ?? "",
    layoutNode.fontSize ?? "",
    layoutNode.fontWeight ?? "",
    layoutNode.lineHeight ?? "",
    layoutNode.letterSpacing ?? "",
    layoutNode.textAlign ?? "",
    layoutNode.verticalAlign ?? "",
    layoutNode.textResizeMode ?? "",
    layoutNode.autoResize ?? "",
    style.paragraphSpacing,
    style.textCase,
    style.verticalTrim,
    style.textTruncate,
    style.textDecoration,
  ].join("|");
}

function cacheHitIsValid(
  node: EditorNode,
  cached: CanonicalTextLayout,
  cacheKey: string,
): boolean {
  const layoutNode = nodeForTextLayout(node);
  const mode = layoutNode.textResizeMode ?? "auto-width";
  const expectedInnerW = textInnerWidth(Math.max(1, layoutNode.width));
  if (mode === "auto-width") {
    // Auto-width uses content width for innerW; reject stale entries after explicit box resizes.
    if (Math.abs(cached.innerW - expectedInnerW) <= 0.5) return true;
    if (cached.innerW <= expectedInnerW + 0.5) return true;
    if (typeof console !== "undefined") {
      console.warn("[text-layout] stale auto-width cache hit; recomputing", {
        nodeId: node.id,
        cacheKey,
        nodeWidth: layoutNode.width,
        cachedInnerW: cached.innerW,
        expectedInnerW,
      });
    }
    return false;
  }
  if (Math.abs(cached.innerW - expectedInnerW) <= 0.5) return true;
  if (typeof console !== "undefined") {
    console.warn("[text-layout] stale layout cache hit; recomputing", {
      nodeId: node.id,
      cacheKey,
      nodeWidth: layoutNode.width,
      cachedInnerW: cached.innerW,
      expectedInnerW,
      textResizeMode: mode,
      autoResize: layoutNode.autoResize,
    });
  }
  return false;
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
  const layoutNode = nodeForTextLayout(node, displayText);
  const payload = {
    node: {
      ...layoutNode,
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

function isWebImportedNode(node: EditorNode): boolean {
  return node.id.startsWith("web-") || Boolean(node.codeClassName);
}

function shouldUseWasmCanonicalLayout(node: EditorNode): boolean {
  if (isWebImportedNode(node)) return false;
  const engine = getActiveCraftEngine();
  if (!engine?.layoutTextNode) return false;
  return readCraftEngine(() => Boolean(engine.layoutTextNode), false);
}

function wasmLayout(
  node: EditorNode,
  displayText: string,
  style: TextAdvancedStyle,
  typo: ResolvedTextTypo,
): CanonicalTextLayout | null {
  const engine = getActiveCraftEngine();
  if (!engine?.layoutTextNode) return null;
  const json = readCraftEngine(
    () => engine.layoutTextNode(buildLayoutRequest(node, displayText, style, typo)),
    null,
  );
  if (!json) return null;
  try {
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
  const mode = normalizeTextResizeMode(node);
  const contentHeight = textBlockContentHeight(layout, typo, mode);
  const blockOffsetY = verticalContentOffsetY(contentHeight, innerH, node.verticalAlign);
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
    height: contentHeight,
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
  return measureStringWidthForTypo(text, typo);
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

function alignCanonicalBlockOffset(
  node: EditorNode,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  canonical: CanonicalTextLayout,
): CanonicalTextLayout {
  const mode = normalizeTextResizeMode(node);
  const contentHeight = textBlockContentHeight(layout, typo, mode);
  const blockOffsetY = verticalContentOffsetY(contentHeight, canonical.innerH, node.verticalAlign);
  const deltaY = blockOffsetY - canonical.blockOffsetY;
  if (Math.abs(deltaY) < 0.01 && Math.abs(canonical.height - contentHeight) < 0.01) {
    return canonical;
  }
  return {
    ...canonical,
    blockOffsetY,
    height: contentHeight,
    lines: canonical.lines.map((line) => ({
      ...line,
      y: line.y + deltaY,
      segments: line.segments.map((seg) => ({ ...seg, y: seg.y + deltaY })),
    })),
    caretStops: canonical.caretStops.map((stop) => ({ ...stop, y: stop.y + deltaY })),
  };
}

/** Canonical text layout — WASM rustybuzz when engine is ready, JS measureText bootstrap otherwise. */
export function layoutTextCanonical(
  node: EditorNode,
  opts?: { bypassCache?: boolean; forceWasm?: boolean },
): CanonicalTextLayout | null {
  const layoutNode = nodeForTextLayout(node);
  const model = toTextNodeModel(layoutNode, false);
  if (!model) return null;

  const typo = textTypoFromModel(model);
  const style = textAdvancedStyleFromNode(layoutNode);
  const displayText = prepareTextForDisplay(model.text, style);
  const innerW = textInnerWidth(model.width);
  const innerH = textInnerHeight(model.height);
  const wrapWidth = availableWrapWidthForNode(layoutNode);
  const effectiveWrap =
    wrapWidth === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(1, wrapWidth);

  const cacheKey = layoutCacheKey(layoutNode, displayText, style);
  if (!opts?.bypassCache) {
    const cached = layoutCache.get(cacheKey);
    if (cached && cacheHitIsValid(layoutNode, cached, cacheKey)) return cached;
    if (cached) layoutCache.delete(cacheKey);
  }

  const wasm = (opts?.forceWasm || shouldUseWasmCanonicalLayout(layoutNode))
    ? wasmLayout(layoutNode, displayText, style, typo)
    : null;
  const raw = wasm ?? fallbackLayout(layoutNode, displayText, style, typo, innerW, innerH, effectiveWrap);
  const layout = canonicalToTextLayout(raw);
  const canonical = alignCanonicalBlockOffset(layoutNode, layout, typo, raw);

  recordFontResolution(layoutNode.id, canonical.font);
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
  const layoutNode = nodeForTextLayout(node);
  const model = toTextNodeModel(layoutNode, false);
  if (!model) return null;

  const typo = textTypoFromModel(model);
  const style = textAdvancedStyleFromNode(layoutNode);
  const canonical = layoutTextCanonical(layoutNode);
  if (!canonical) return null;

  let layout = canonicalToTextLayout(canonical);
  layout = applyTruncateFromCanonical(layout, typo, style, canonical.innerH, canonical.innerW);

  const wrapWidth = availableWrapWidthForNode(layoutNode);
  const cacheKey = layoutCacheKey(layoutNode, prepareTextForDisplay(model.text, style), style);

  return {
    layout,
    canonical,
    typo,
    textAlign: model.textAlign,
    innerW: canonical.innerW,
    innerH: canonical.innerH,
    blockOffsetY: canonical.blockOffsetY,
    style,
    debug: {
      cacheKey,
      wrapEnabled: wrapWidth !== Number.POSITIVE_INFINITY,
      availableWidth:
        wrapWidth === Number.POSITIVE_INFINITY ? layout.width : wrapWidth,
      lineWidths: layout.lines.map((line) => line.width),
    },
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
  while (
    truncated.length > 0 &&
    measureStringWidthForTypo(truncated + ellipsis, typo) > boxInnerWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  lines[maxLines - 1] = {
    ...last,
    text: truncated + ellipsis,
    width: measureStringWidthForTypo(truncated + ellipsis, typo),
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
