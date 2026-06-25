import { applyMatrixToPathD } from "@/lib/mask/buildExactMaskPath";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { buildFontString, getTextMeasureContext } from "@/lib/text/textMeasure";
import { multiplyMatrix, scaleMatrix, translateMatrix } from "@/lib/transformMath";

export type CanvasGlyphInkBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Ink bounds for one glyph when canvas draws with `textBaseline: top` at `lineTopY`. */
export function measureCanvasGlyphInkBox(
  ch: string,
  anchorX: number,
  lineTopY: number,
  typo: ResolvedTextTypo,
): CanvasGlyphInkBox {
  const ctx = getTextMeasureContext();
  const prevBaseline = ctx.textBaseline;
  ctx.font = buildFontString(typo);
  ctx.textBaseline = "top";
  const sample = ch.length > 0 ? ch : " ";
  const m = ctx.measureText(sample);
  ctx.textBaseline = prevBaseline;

  const boxLeft = m.actualBoundingBoxLeft ?? 0;
  const boxRight = m.actualBoundingBoxRight ?? m.width;
  const ascent = m.actualBoundingBoxAscent ?? m.fontBoundingBoxAscent ?? typo.fontSize * 0.82;
  const descent = m.actualBoundingBoxDescent ?? m.fontBoundingBoxDescent ?? typo.fontSize * 0.22;

  return {
    left: anchorX + boxLeft,
    top: lineTopY - ascent,
    width: Math.max(0.01, boxRight - boxLeft),
    height: Math.max(0.01, ascent + descent),
  };
}

/** Scale + translate an opentype path so its bbox matches canvas ink at the layout anchor. */
export function fitOpentypePathDToCanvasInk(
  pathD: string,
  ink: CanvasGlyphInkBox,
  otBbox: { x1: number; y1: number; x2: number; y2: number },
): string | null {
  const otW = otBbox.x2 - otBbox.x1;
  const otH = otBbox.y2 - otBbox.y1;
  if (otW <= 0.001 || otH <= 0.001) return pathD;

  const sx = ink.width / otW;
  const sy = ink.height / otH;
  const scale = Math.min(sx, sy);
  const matrix = multiplyMatrix(
    translateMatrix(ink.left, ink.top),
    multiplyMatrix(
      scaleMatrix(scale, scale),
      translateMatrix(-otBbox.x1, -otBbox.y1),
    ),
  );
  return applyMatrixToPathD(pathD, matrix);
}
