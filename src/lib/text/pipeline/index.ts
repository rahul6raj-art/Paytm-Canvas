export type {
  TextFontMetrics,
  LineHeightUnit,
  TextLayoutInput,
  ShapedGlyphPaint,
  ShapedLinePaint,
  TextPaintPlan,
  TextPipelineResult,
} from "./types";

export {
  lineHeightUnitFromNode,
  resolveLineHeightPx,
  measureFontMetricsFromCanvas,
  resolveTextFontMetrics,
  opticalVerticalCenterOffset,
  clearFontMetricsCache,
} from "./fontMetrics";

export {
  markTextMeasurementDirty,
  clearTextMeasurementDirty,
  isTextMeasurementDirty,
  textLayoutInputFromNode,
  runTextLayoutPipeline,
  measureTextNodeLayout,
} from "./textMeasurement";

export {
  TEXT_WRAP_EPSILON,
  wrapWidthFits,
  breakLongToken,
  tokenizeParagraphForWrap,
  isWhitespaceToken,
} from "./textLineLayout";

export {
  buildTextPaintPlan,
  paintShapedGlyphsToContext,
  svgTspansFromPaintPlan,
} from "./textPaintFromLayout";
