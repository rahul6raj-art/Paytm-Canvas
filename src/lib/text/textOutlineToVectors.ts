import type * as opentype from "opentype.js";
import { effectiveFillType } from "@/lib/fillGradient";
import { resolveSolidFillCss } from "@/lib/gradient/cssPaint";
import { outlineStroke, type OutlineStrokeResult } from "@/lib/outlineStroke";
import { resolveStrokeSpec, strokeSpecIsVisible } from "@/lib/strokeSpec";
import { convertSvgPathToVector } from "@/lib/svgImport/convertSvgPathToVector";
import { identityMatrix } from "@/lib/transformMath";
import type { EditorFontAsset } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import { runTextLayoutPipeline } from "@/lib/text/pipeline/textMeasurement";
import { getTextMeasureContext, measureStringWidth, buildFontString } from "@/lib/text/textMeasure";
import { textNodeAsFillPaint } from "@/lib/text/textFillPaint";
import { loadOpentypeFontForTextNode } from "@/lib/text/textOutlineFonts";

export type TextOutlineVectorGroup = {
  group: EditorNode;
  vectors: EditorNode[];
};

function pathNodeFromOutlineResult(
  result: OutlineStrokeResult,
  id: string,
): EditorNode | null {
  const pathD = result.pathD?.trim();
  if (!pathD) return null;
  const converted = convertSvgPathToVector(
    pathD,
    identityMatrix(),
    identityMatrix(),
    result.fillRule ?? "nonzero",
  );
  if (!converted || converted.width <= 0 || converted.height <= 0) return null;

  return {
    id,
    parentId: null,
    type: "path",
    name: "Vector",
    x: converted.x,
    y: converted.y,
    width: converted.width,
    height: converted.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    pathPoints: converted.pathPoints,
    pathClosed: converted.pathClosed,
    pathFillRule: converted.pathFillRule ?? result.fillRule ?? "nonzero",
    flattenedPathData: converted.flattenedPathData,
    fill: result.fill ?? "#111111",
    fillEnabled: true,
    fillOpacity: result.fillOpacity ?? 1,
    fillType: result.fillType ?? "solid",
    fillGradient: result.fillGradient,
    strokeWidth: 0,
    strokeEnabled: false,
  } as EditorNode;
}

function pathNodeFromOutlinePathD(
  pathD: string,
  id: string,
  paint: ReturnType<typeof textNodeAsFillPaint>,
  opacity: number,
): EditorNode | null {
  if (!pathD.trim()) return null;
  const converted = convertSvgPathToVector(
    pathD,
    identityMatrix(),
    identityMatrix(),
    "evenodd",
  );
  if (!converted || converted.width <= 0 || converted.height <= 0) return null;

  const fill = resolveSolidFillCss(paint) || "#111111";

  return {
    id,
    parentId: null,
    type: "path",
    name: "Vector",
    x: converted.x,
    y: converted.y,
    width: converted.width,
    height: converted.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    pathPoints: converted.pathPoints,
    pathClosed: converted.pathClosed,
    pathFillRule: converted.pathFillRule ?? "evenodd",
    flattenedPathData: converted.flattenedPathData,
    fill,
    fillEnabled: paint.fillEnabled !== false,
    fillOpacity: paint.fillOpacity ?? opacity,
    fillType: paint.fillType ?? "solid",
    fillGradient: paint.fillGradient,
    strokeWidth: 0,
    strokeEnabled: false,
  } as EditorNode;
}

function pathNodeFromOutlinePath(
  otPath: opentype.Path,
  id: string,
  paint: ReturnType<typeof textNodeAsFillPaint>,
  opacity: number,
): EditorNode | null {
  return pathNodeFromOutlinePathD(otPath.toPathData(2), id, paint, opacity);
}

function outlineGlyphVector(
  font: opentype.Font,
  ch: string,
  anchorX: number,
  baselineY: number,
  outlineFontSize: number,
  id: string,
  paint: ReturnType<typeof textNodeAsFillPaint>,
  opacity: number,
): EditorNode | null {
  try {
    const otPath = font.charToGlyph(ch).getPath(anchorX, baselineY, outlineFontSize);
    return pathNodeFromOutlinePath(otPath, id, paint, opacity);
  } catch {
    return null;
  }
}

function shouldOutlineCharacter(char: string): boolean {
  return char.length > 0 && !/^\s$/u.test(char);
}

/** Convert a text layer into a group of per-glyph vector paths (Figma-style outline). */
export async function convertTextToOutlineVectorGroup(
  textNode: EditorNode,
  fontAssets: Record<string, EditorFontAsset>,
  createId: (prefix: string) => string,
): Promise<TextOutlineVectorGroup | null> {
  if (textNode.type !== "text" || typeof document === "undefined") return null;

  const pipeline = runTextLayoutPipeline(textNode);
  if (!pipeline) return null;

  const font = await loadOpentypeFontForTextNode(textNode, fontAssets);
  const typo = resolveTextTypo(textNode);
  const outlineFontSize = typo.fontSize;
  const paint = textNodeAsFillPaint(textNode);
  const hasFill = textNode.fillEnabled !== false && Boolean((textNode.content ?? "").trim());
  const strokeSpec = resolveStrokeSpec(textNode);
  const hasStroke = strokeSpecIsVisible(strokeSpec);
  if (!hasFill && !hasStroke) return null;

  const caretByIndex = new Map(
    pipeline.prepared.canonical.caretStops.map((stop) => [stop.index, stop]),
  );

  const caretX = (index: number, fallback: number) => caretByIndex.get(index)?.x ?? fallback;

  const vectors: EditorNode[] = [];
  const measureCtx = getTextMeasureContext();
  measureCtx.font = buildFontString(typo);

  for (const line of pipeline.paint.lines) {
    const vectorsBeforeLine = vectors.length;

    if (line.glyphs.length > 0) {
      for (const glyph of line.glyphs) {
        if (!shouldOutlineCharacter(glyph.char)) continue;
        const vector = outlineGlyphVector(
          font,
          glyph.char,
          caretX(glyph.index, glyph.x),
          line.baseline,
          outlineFontSize,
          createId("path"),
          hasFill
            ? paint
            : {
                ...paint,
                fill: strokeSpec.color,
                fillEnabled: true,
                fillType: effectiveFillType(textNode) === "gradient" ? "gradient" : "solid",
              },
          hasFill ? (textNode.fillOpacity ?? 1) * (textNode.opacity ?? 1) : strokeSpec.opacity,
        );
        if (vector) vectors.push(vector);
      }
    }

    if (vectors.length > vectorsBeforeLine) continue;

    for (let i = 0; i < line.text.length; i++) {
      const ch = line.text[i]!;
      if (!shouldOutlineCharacter(ch)) {
        continue;
      }
      const cx =
        caretX(line.startIndex + i, line.x +
          measureStringWidth(measureCtx, line.text.slice(0, i), typo.letterSpacing));
      const vector = outlineGlyphVector(
        font,
        ch,
        cx,
        line.baseline,
        outlineFontSize,
        createId("path"),
        hasFill ? paint : { ...paint, fill: strokeSpec.color, fillEnabled: true },
        hasFill ? (textNode.fillOpacity ?? 1) * (textNode.opacity ?? 1) : strokeSpec.opacity,
      );
      if (vector) vectors.push(vector);
    }
  }

  if (vectors.length === 0) return null;

  if (hasFill && hasStroke) {
    const strokeOutline = outlineStroke(textNode);
    const strokeVector = strokeOutline
      ? pathNodeFromOutlineResult(strokeOutline, createId("path"))
      : null;
    if (strokeVector) vectors.push(strokeVector);
  }

  const groupId = createId("group");
  const groupName = (textNode.content ?? "").trim() || textNode.name;
  const group: EditorNode = {
    ...textNode,
    id: groupId,
    type: "group",
    name: groupName,
    content: undefined,
    textColor: undefined,
    fontFamily: undefined,
    fontSize: undefined,
    fontWeight: undefined,
    lineHeight: undefined,
    letterSpacing: undefined,
    textAlign: undefined,
    verticalAlign: undefined,
    textResizeMode: undefined,
    fillEnabled: false,
    fill: undefined,
    strokeWidth: 0,
    strokeEnabled: false,
  };

  for (const vector of vectors) {
    vector.parentId = groupId;
  }

  group.x = textNode.x;
  group.y = textNode.y;
  group.width = Math.max(1, textNode.width);
  group.height = Math.max(1, textNode.height);

  return { group, vectors };
}
