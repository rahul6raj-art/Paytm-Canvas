import type { EditorNode } from "@/stores/useEditorStore";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { resolveLineHeightPxFromNode } from "@/lib/text/lineHeight";
import { prepareTextForDisplay, textAdvancedStyleFromNode, type TextAdvancedStyle } from "@/lib/text/textAdvancedStyle";
import type {
  CanonicalCaretStop,
  CanonicalTextLayout,
} from "@/lib/text/canonicalTextLayout";
import {
  MIN_TEXT_BOX,
  nodeForTextLayout,
  normalizeTextResizeMode,
  textInnerHeight,
  textInnerWidth,
  textTypoFromModel,
  toTextNodeModel,
  textResizePatch,
} from "@/lib/text/textNodeModel";
import { textBlockContentHeight } from "@/lib/text/textBaseline";
import { layoutText, type TextLayout } from "@/lib/text/textMeasure";
import type { BrowserCaptureTextLayout } from "@/lib/craftBridge/bridgeParityTypes";

/** One CSS line box height for bridge capture clamping (drops half-leading padding). */
export function bridgeCaptureLineCapPx(
  node: Pick<EditorNode, "fontSize" | "lineHeight" | "lineHeightUnit" | "fontWeight" | "fontFamily">,
): number {
  const linePx = resolveLineHeightPxFromNode(node);
  return Math.ceil(linePx * 1.05);
}

/** True when copy wraps inside the captured box (CSS wrap, not an explicit newline). */
export function bridgeTextWrapsAtCapturedWidth(node: EditorNode, content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || trimmed.includes("\n")) return trimmed.includes("\n");
  if (node.browserTextLayout?.lines && node.browserTextLayout.lines.length > 1) return true;

  const boxW = Math.max(MIN_TEXT_BOX, node.width ?? MIN_TEXT_BOX);
  const typo = textTypoFromModel({
    fontFamily: node.fontFamily ?? "Inter",
    fontSize: node.fontSize ?? 12,
    fontWeight: node.fontWeight ?? 400,
    lineHeight: node.lineHeight,
    lineHeightUnit: node.lineHeightUnit,
    lineHeightPx: node.lineHeightPx,
    letterSpacing: node.letterSpacing ?? 0,
    color: node.textColor ?? node.fill ?? "#111111",
  });
  const style = textAdvancedStyleFromNode(node);
  const layout = layoutText(
    prepareTextForDisplay(trimmed, style),
    textInnerWidth(boxW),
    typo,
    style,
  );
  return layout.lines.length > 1;
}

function layoutFromCaptureLines(
  capture: BrowserCaptureTextLayout,
  lineHeightPx: number,
): TextLayout {
  const lines = capture.lines.map((line, i) => ({
    text: line.text,
    width: line.width,
    startIndex: line.startIndex,
    paragraphStart: i === 0 || line.text.trim().length === 0,
  }));
  let paragraphGaps = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.paragraphStart) paragraphGaps++;
  }
  const height =
    capture.lines.length > 0
      ? Math.max(
          ...capture.lines.map((l) => l.y + l.height),
          lineHeightPx,
        )
      : lineHeightPx;
  return {
    lines,
    width: Math.max(...capture.lines.map((l) => l.x + l.width), 1),
    height,
    lineHeightPx,
    paragraphGaps,
  };
}

/** Build canonical layout from Playwright-captured line/glyph geometry. */
export function canonicalFromBrowserCapture(
  node: EditorNode,
  capture: BrowserCaptureTextLayout,
  typo: ResolvedTextTypo,
  style: TextAdvancedStyle,
): CanonicalTextLayout | null {
  const layoutNode = nodeForTextLayout(node);
  const model = toTextNodeModel(layoutNode, false);
  if (!model || capture.lines.length === 0) return null;

  const mode = normalizeTextResizeMode(layoutNode.textResizeMode, layoutNode.autoResize);
  const innerW = textInnerWidth(model.width);
  const innerH = textInnerHeight(model.height, mode);
  // Capture coords are already element-local ink boxes — no Craft TEXT_BOX_PAD_Y inset.
  const padY = 0;
  const displayText = prepareTextForDisplay(model.text, style);
  const fontSize = typo.fontSize;
  const lineHeightPx =
    capture.lines.length > 0
      ? Math.max(...capture.lines.map((l) => l.height), fontSize * 1.2)
      : fontSize * 1.2;

  const glyphByIndex = new Map((capture.glyphs ?? []).map((g) => [g.index, g]));

  const lines = capture.lines.map((line, lineIndex) => {
    const lineGlyphs = (capture.glyphs ?? []).filter(
      (g) => g.index >= line.startIndex && g.index < line.startIndex + line.text.length,
    );
    const segments =
      lineGlyphs.length > 0
        ? lineGlyphs.map((g) => ({
            text: displayText[g.index] ?? capture.content[g.index] ?? "",
            x: g.x,
            y: g.y + padY,
          }))
        : [{ text: line.text, x: line.x, y: line.y + padY }];

    return {
      text: line.text,
      startIndex: line.startIndex,
      width: line.width,
      paragraphStart: lineIndex === 0,
      x: line.x,
      y: line.y + padY,
      segments,
    };
  });

  const lineBoxes = capture.lines.map((line) => ({
    top: line.y + padY,
    height: line.height,
    baseline:
      line.baselineY != null
        ? line.baselineY + padY
        : line.y + padY + line.height * 0.82,
    width: line.width,
  }));

  const layout = layoutFromCaptureLines(capture, lineHeightPx);
  const contentHeight = textBlockContentHeight(layout, typo, mode);

  const caretStops: CanonicalCaretStop[] = [];
  for (const line of lines) {
    for (let i = 0; i <= line.text.length; i++) {
      const before = line.text.slice(0, i);
      const glyph = glyphByIndex.get(line.startIndex + i);
      caretStops.push({
        index: line.startIndex + i,
        x: glyph?.x ?? line.x,
        y: line.y,
      });
    }
  }

  const glyphs = (capture.glyphs ?? []).map((g) => ({
    index: g.index,
    x: g.x,
    y: g.y + padY,
    width: g.width,
    height: g.height,
    glyphId: g.index,
  }));

  return {
    source: "fallback",
    browserPaint: true,
    lines,
    width: layout.width,
    height: layout.height,
    lineHeightPx,
    firstLineAscent: lineHeightPx * 0.78,
    firstLineDescent: lineHeightPx * 0.22,
    paragraphSpacing: 0,
    verticalTrimTop: 0,
    innerW,
    innerH,
    blockOffsetY: 0,
    nodeWidth: model.width,
    nodeHeight: model.height,
    lineBoxes,
    caretStops,
    glyphs,
    font: {
      requestedFamily: typo.fontFamily,
      resolvedFamily: typo.fontFamily,
      fallbackUsed: false,
      missing: false,
    },
    rtl: false,
  };
}

/** Ink width from Playwright line boxes — prefer over Craft font remeasure on bridge push. */
export function bridgeCapturedInkWidth(
  node: Pick<EditorNode, "width" | "browserTextLayout">,
): number {
  const capture = node.browserTextLayout;
  if (capture?.lines?.length) {
    return Math.max(MIN_TEXT_BOX, Math.ceil(tightBoundsFromBrowserTextLayout(capture).width));
  }
  return Math.max(MIN_TEXT_BOX, Math.ceil(node.width ?? MIN_TEXT_BOX));
}

export function tightBoundsFromBrowserTextLayout(capture: BrowserCaptureTextLayout): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of capture.lines) {
    minX = Math.min(minX, line.x);
    minY = Math.min(minY, line.y);
    maxX = Math.max(maxX, line.x + line.width);
    maxY = Math.max(maxY, line.y + line.height);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 1, height: 1 };
  }
  return {
    minX,
    minY,
    width: Math.max(1, Math.ceil(maxX - minX)),
    height: Math.max(1, Math.ceil(maxY - minY)),
  };
}

export function rebaseBrowserTextLayout(
  capture: BrowserCaptureTextLayout,
  dx: number,
  dy: number,
): BrowserCaptureTextLayout {
  return {
    ...capture,
    lines: capture.lines.map((line) => ({
      ...line,
      x: line.x - dx,
      y: line.y - dy,
    })),
    glyphs: capture.glyphs?.map((g) => ({
      ...g,
      x: g.x - dx,
      y: g.y - dy,
    })),
  };
}

/** Shrink a text node to browser line ink bounds (drops CSS line-height padding). */
export function applyTightBoundsFromBrowserCapture(node: EditorNode): EditorNode {
  const capture = node.browserTextLayout;
  if (node.type !== "text" || !capture?.lines?.length) return node;

  const { minX, minY, width, height } = tightBoundsFromBrowserTextLayout(capture);
  if (width < 2 || height < 2) return node;

  const boxW = node.width ?? width;
  const boxH = node.height ?? height;
  const inkBottom = minY + height;
  const inkRight = minX + width;
  const lineCap = bridgeCaptureLineCapPx(node);
  const singleLine = capture.lines.length === 1;
  const inkHeight = singleLine ? Math.min(height, lineCap) : height;

  const fixedPatch = {
    layoutPositioning: "absolute" as const,
    layoutSizingHorizontal: "fixed" as const,
    layoutSizingVertical: "fixed" as const,
    verticalAlign: "middle" as const,
    ...textResizePatch("fixed"),
  };

  // Layout coords can exceed the captured DOM box (parent-row capture, half-leading).
  // Keep Playwright x/y but rebase glyphs into the local box so canvas paint is not clipped.
  if (inkBottom > boxH + 2 || inkRight > boxW + 2 || minY < -1 || minX < -1) {
    const rebased = rebaseBrowserTextLayout(capture, minX, minY);
    const rebasedH = singleLine ? Math.min(height, lineCap) : height;
    return {
      ...node,
      ...fixedPatch,
      width,
      height: Math.ceil(rebasedH),
      browserTextLayout: rebased,
    };
  }

  // Move the box origin to ink top-left; cap single-line height to one line box.
  return {
    ...node,
    x: node.x + minX,
    y: node.y + minY,
    width,
    height: inkHeight,
    browserTextLayout: rebaseBrowserTextLayout(capture, minX, minY),
    ...fixedPatch,
  };
}

export function hasBrowserTextLayout(
  node: EditorNode,
): node is EditorNode & { browserTextLayout: BrowserCaptureTextLayout } {
  return Boolean(node.browserTextLayout?.lines?.length);
}

/** True when live node content still matches the Playwright capture (safe to paint captured glyphs). */
export function browserCaptureMatchesNodeContent(
  node: EditorNode,
  capture: BrowserCaptureTextLayout,
  style: TextAdvancedStyle,
): boolean {
  const displayText = prepareTextForDisplay(node.content ?? "", style);
  const captureText = prepareTextForDisplay(capture.content, style);
  return displayText === captureText;
}

/** Fallback layout height when only browser lines exist (no WASM). */
export function browserCaptureFallbackLayout(
  node: EditorNode,
  capture: BrowserCaptureTextLayout,
  typo: ResolvedTextTypo,
): TextLayout {
  const fontSize = typo.fontSize;
  const lineHeightPx = Math.max(
    ...capture.lines.map((l) => l.height),
    fontSize * 1.2,
  );
  return layoutFromCaptureLines(capture, lineHeightPx);
}
