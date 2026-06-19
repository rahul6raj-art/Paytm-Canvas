import { fillCss, normalizeHex } from "@/lib/color";
import { fillPaintCss } from "@/lib/fillGradient";
import {
  legacyEffectShadowAppend,
  resolveEffectBoxShadow,
  resolveNodeWithDesignTokens,
  type DesignToken,
} from "@/lib/designTokens";
import { buildNodeEffectRenderStyle } from "@/lib/nodeEffects";
import { shouldClipChildren, clipExportCssProperties } from "@/lib/clipChildren";
import { cornerRadiiMax, cornerRadiiToCss, getNodeCornerRadii } from "@/lib/cornerRadius";
import { layerBlendCanvasStyle } from "@/lib/layerBlendMode";
import { ellipseArcExportStyle } from "@/lib/shapes/ellipseArcExport";
import {
  booleanGroupExportStyle,
  maskGroupExportStyle,
} from "@/lib/codeExport/compositeShapeExport";
import { isBooleanGroup, isMaskGroup } from "@/lib/booleanGeometry";
import { strokeSidesToReactStyle } from "@/lib/strokeAlign";
import { buildLayerCssTransform } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";
import { isPhoneShellBottomChrome } from "@/lib/webImport/phoneShellBottomChrome";

export type ReactStyleRecord = Record<string, string | number>;

export type CodeStyleOptions = {
  /** Screen frame root in code: (0,0) origin, no canvas x/y on the frame */
  isFrameRoot?: boolean;
  nodes?: Record<string, EditorNode>;
  childOrder?: Record<string, string[]>;
};

export function nodeToReactStyle(
  node: EditorNode,
  designTokens?: Record<string, DesignToken>,
  codeOpts?: CodeStyleOptions,
): ReactStyleRecord {
  const resolved = designTokens ? resolveNodeWithDesignTokens(node, designTokens) : node;
  const style: ReactStyleRecord = {
    position: "absolute",
    left: Math.round(node.x * 100) / 100,
    top: Math.round(node.y * 100) / 100,
    width: Math.round(node.width * 100) / 100,
    height: Math.round(node.height * 100) / 100,
    boxSizing: "border-box",
  };

  const transform = buildLayerCssTransform(node);
  if (transform) {
    style.transform = transform;
    style.transformOrigin = "center center";
  }

  const op = resolved.opacity ?? 1;
  if (op < 0.999) style.opacity = Math.round(op * 1000) / 1000;

  const blend = layerBlendCanvasStyle(node);
  if (blend.mixBlendMode) style.mixBlendMode = blend.mixBlendMode;
  if (blend.isolation) style.isolation = blend.isolation;

  if (node.type === "text") {
    const fontSize = resolved.fontSize ?? 14;
    const lhFactor = resolved.lineHeight ?? 1.25;
    style.color = resolved.textColor ?? resolved.fill ?? "#111111";
    style.fontFamily = resolved.fontFamily ?? "Inter, system-ui, sans-serif";
    style.fontSize = fontSize;
    style.fontWeight = resolved.fontWeight ?? 500;
    // Pixel line-height matches canvas text layout and prevents bleed into adjacent layers.
    style.lineHeight = `${Math.round(fontSize * lhFactor * 100) / 100}px`;
    if (resolved.letterSpacing) style.letterSpacing = resolved.letterSpacing;
    style.whiteSpace = "pre-wrap";
    style.margin = 0;
    style.padding = "2px 4px";
    style.overflow = "hidden";
    style.display = "block";
    return style;
  }

  if (node.type === "image") {
    style.background = "#334155";
    style.overflow = "hidden";
    return style;
  }

  const compositeGroup = isBooleanGroup(node) || isMaskGroup(node);

  if (!compositeGroup) {
    const bg = fillPaintCss(resolved);
    if (bg !== "transparent") style.background = bg;
  }

  const sw = node.strokeWidth ?? 0;
  const sc = node.strokeColor;
  if (!compositeGroup && sw > 0 && sc && node.strokeEnabled !== false) {
    Object.assign(style, strokeSidesToReactStyle(node));
  } else if (node.type === "frame") {
    style.border = "1px solid #e5e5e5";
  }

  if (node.type === "ellipse") {
    Object.assign(style, ellipseArcExportStyle(node));
  } else if (node.type === "rectangle" || node.type === "frame") {
    const radii = getNodeCornerRadii(node);
    if (cornerRadiiMax(radii) > 0) {
      style.borderRadius = cornerRadiiToCss(radii);
    }
  }

  const layoutMode = node.layoutMode ?? "none";
  if ((node.type === "frame" || node.type === "group") && layoutMode !== "none") {
    style.display = "flex";
    style.flexDirection = layoutMode === "horizontal" ? "row" : "column";
    const g = node.layoutGap ?? 0;
    if (g > 0) style.gap = g;
    const pt = node.paddingTop ?? 0;
    const pr = node.paddingRight ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft ?? 0;
    if (pt || pr || pb || pl) style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    const pa = node.primaryAxisAlign ?? "start";
    const ca = node.counterAxisAlign ?? "start";
    style.justifyContent =
      pa === "space-between"
        ? "space-between"
        : pa === "center"
          ? "center"
          : pa === "end"
            ? "flex-end"
            : "flex-start";
    style.alignItems =
      ca === "center" ? "center" : ca === "end" ? "flex-end" : ca === "stretch" ? "stretch" : "flex-start";
    delete style.position;
    delete style.left;
    delete style.top;
  }

  if (node.type === "frame" || node.type === "group") {
    style.position = layoutMode !== "none" ? "relative" : "absolute";
    if (layoutMode === "none") {
      style.left = Math.round(node.x * 100) / 100;
      style.top = Math.round(node.y * 100) / 100;
    }
    style.overflow = shouldClipChildren(node) ? "hidden" : "visible";
    Object.assign(style, clipExportCssProperties(node));
    const nodes = codeOpts?.nodes;
    const childOrder = codeOpts?.childOrder;
    if (nodes && childOrder) {
      Object.assign(style, booleanGroupExportStyle(node, nodes, childOrder));
      Object.assign(style, maskGroupExportStyle(node, nodes, childOrder));
    }
  }

  const tokens = designTokens ?? {};
  const hasRichEff = !!(resolved.effects && resolved.effects.length > 0);
  const tokenLeg = hasRichEff ? legacyEffectShadowAppend(node, tokens) : resolveEffectBoxShadow(node, tokens);
  const er = buildNodeEffectRenderStyle(hasRichEff ? resolved.effects : undefined, tokenLeg);
  if (er.boxShadow) style.boxShadow = er.boxShadow;
  if (er.filter) style.filter = er.filter;

  if (codeOpts?.isFrameRoot) {
    delete style.left;
    delete style.top;
    style.position = "relative";
  }

  if (isPhoneShellBottomChrome(node.codeClassName, node.codeJsxTag)) {
    delete style.position;
    delete style.left;
    delete style.top;
    delete style.width;
    delete style.height;
  }

  return style;
}

export function styleToLiteral(style: ReactStyleRecord): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === "") continue;
    const v = typeof value === "number" ? value : JSON.stringify(value);
    parts.push(`${key}: ${v}`);
  }
  return `{ ${parts.join(", ")} }`;
}

export function sanitizeComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, " ");
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "GeneratedScreen";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
