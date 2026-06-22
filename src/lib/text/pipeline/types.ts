import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextAdvancedStyle } from "../textAdvancedStyle";
import type { TextAlign, TextResizeMode } from "../textNodeModel";
import type {
  CanonicalTextLayout,
  TextLayoutForRender,
} from "../canonicalTextLayout";

/** OpenType-style font metrics in px at the resolved font size. */
export type TextFontMetrics = {
  ascender: number;
  descender: number;
  capHeight: number;
  xHeight: number;
  lineGap: number;
  /** Distance from line box top to alphabetic baseline. */
  baselineOffset: number;
  /** Resolved line height in px (independent of em-box centering hacks). */
  lineHeightPx: number;
};

export type LineHeightUnit = "auto" | "px" | "percent";

export type TextLayoutInput = {
  nodeId: string;
  content: string;
  width: number;
  height: number;
  typo: ResolvedTextTypo;
  style: TextAdvancedStyle;
  textAlign: TextAlign;
  textResizeMode: TextResizeMode;
  lineHeightUnit?: LineHeightUnit;
};

export type ShapedGlyphPaint = {
  char: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  glyphId: number;
};

export type ShapedLinePaint = {
  text: string;
  startIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  glyphs: ShapedGlyphPaint[];
};

export type TextPaintPlan = {
  lines: ShapedLinePaint[];
  metrics: TextFontMetrics;
  innerW: number;
  innerH: number;
  blockOffsetY: number;
  overflow: boolean;
};

export type TextPipelineResult = {
  prepared: TextLayoutForRender;
  paint: TextPaintPlan;
  canonical: CanonicalTextLayout;
};
