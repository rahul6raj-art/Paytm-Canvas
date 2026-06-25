import type opentype from "opentype.js";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { buildFontString, getTextMeasureContext } from "@/lib/text/textMeasure";

/** OpenType face weight for the embedded/uploaded file used during outline. */
export function outlineFaceWeight(fontWeight: number): number {
  return fontWeight >= 600 ? 700 : 400;
}

/** Sample em height without multi-char GSUB (Inter/Hg throws in opentype.js). */
export function opentypeSampleEmHeight(font: opentype.Font, size: number): number {
  try {
    const upper = font.charToGlyph("H").getPath(0, 0, size).getBoundingBox();
    const lower = font.charToGlyph("g").getPath(0, 0, size).getBoundingBox();
    const y1 = Math.min(upper.y1, lower.y1);
    const y2 = Math.max(upper.y2, lower.y2);
    return Math.max(0.001, y2 - y1);
  } catch {
    return size * 1.1;
  }
}

/** Ascender height in px for the outline TTF at `fontSize` (baseline at y=0). */
export function opentypeAscentPx(font: opentype.Font, fontSize: number): number {
  try {
    const bbox = font.charToGlyph("H").getPath(0, 0, fontSize).getBoundingBox();
    return Math.max(0.001, -bbox.y1);
  } catch {
    return fontSize * 0.88;
  }
}

/** Map canvas line-top y (`textBaseline: top`) to an opentype alphabetic baseline. */
export function opentypeBaselineFromCanvasLineTop(
  canvasLineTopY: number,
  font: opentype.Font,
  fontSize: number,
): number {
  return canvasLineTopY + opentypeAscentPx(font, fontSize);
}

/**
 * Match opentype outline size to canvas text metrics and compensate when the
 * browser renders a heavier weight (e.g. 500 Medium) than the Regular TTF.
 */
export function resolveOutlineFontSize(
  typo: ResolvedTextTypo,
  font: opentype.Font,
  faceWeight = outlineFaceWeight(typo.fontWeight),
): number {
  let size = typo.fontSize;

  if (typeof document !== "undefined") {
    const ctx = getTextMeasureContext();
    ctx.font = buildFontString(typo);
    const m = ctx.measureText("Hg");
    const canvasH =
      (m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? size * 0.88) +
      (m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? size * 0.22);
    const otH = opentypeSampleEmHeight(font, size);
    if (canvasH > 0 && otH > 0.001) {
      size *= canvasH / otH;
    }
  }

  const weightGap = Math.max(0, typo.fontWeight - faceWeight);
  if (weightGap > 0) {
    // Faux-bold compensation when canvas weight exceeds the outline TTF (e.g. 500 vs Regular 400).
    size *= 1 + (weightGap / 100) * 0.065;
  }

  return size;
}
