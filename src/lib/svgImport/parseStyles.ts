import type { EditorNode } from "@/stores/useEditorStore";
import { parseLength } from "@/lib/svgImport/svgMatrix";

export type PaintState = {
  fill?: string;
  fillOpacity: number;
  fillEnabled: boolean;
  fillType?: "solid" | "gradient";
  fillGradient?: EditorNode["fillGradient"];
  stroke?: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeEnabled: boolean;
  strokeLinecap?: EditorNode["strokeLinecap"];
  strokeLinejoin?: EditorNode["strokeLinejoin"];
  strokeDasharray?: string;
  strokeDashoffset?: number;
  opacity: number;
  fillRule?: "nonzero" | "evenodd";
  clipRule?: "nonzero" | "evenodd";
};

export type CssClassRules = Record<string, string>;
export type CssSheet = Map<string, CssClassRules>;

export const SVG_DEFAULT_PAINT: PaintState = {
  fill: "#000000",
  fillOpacity: 1,
  fillEnabled: true,
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeEnabled: false,
  opacity: 1,
  fillRule: "nonzero",
};

export function parseInlineStyle(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

export function parseOpacity(value: string | undefined, fallback = 1): number {
  if (!value) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!v || v === "none" || v === "transparent") return undefined;
  if (/^url\(/i.test(v)) return undefined;
  if (v === "currentColor") return "#000000";
  return v;
}

export function parseStrokeLinecap(value: string | undefined): EditorNode["strokeLinecap"] | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "butt" || v === "round" || v === "square") return v;
  return undefined;
}

export function parseStrokeLinejoin(value: string | undefined): EditorNode["strokeLinejoin"] | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "miter" || v === "round" || v === "bevel") return v;
  return undefined;
}

export function parseFillRule(value: string | undefined): "nonzero" | "evenodd" | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "evenodd" || v === "nonzero") return v;
  return undefined;
}

export function parseCssClassRules(cssText: string): CssSheet {
  const out: CssSheet = new Map();
  const re = /([.#][a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cssText)) !== null) {
    const selector = match[1]!;
    const className = selector.startsWith(".") ? selector.slice(1) : selector;
    const block = match[2] ?? "";
    const rules: CssClassRules = {};
    for (const decl of block.split(";")) {
      const idx = decl.indexOf(":");
      if (idx < 0) continue;
      const key = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (key && value) rules[key] = value;
    }
    if (Object.keys(rules).length > 0) {
      out.set(className, { ...(out.get(className) ?? {}), ...rules });
    }
  }
  return out;
}

export function classPaint(classAttr: string | undefined, css: CssSheet): Partial<PaintState> {
  if (!classAttr) return {};
  const out: Partial<PaintState> = {};
  for (const token of classAttr.split(/\s+/)) {
    const rules = css.get(token);
    if (!rules) continue;
    applyRulesToPaint(out, rules);
  }
  return out;
}

function applyRulesToPaint(out: Partial<PaintState>, rules: CssClassRules): void {
  const fill = normalizeColor(rules.fill);
  const stroke = normalizeColor(rules.stroke);
  if (fill !== undefined) {
    out.fill = fill;
    out.fillEnabled = true;
  }
  if (stroke !== undefined) {
    out.stroke = stroke;
    out.strokeEnabled = true;
  }
  if (rules["stroke-width"]) out.strokeWidth = parseLength(rules["stroke-width"]);
  if (rules["stroke-linecap"]) out.strokeLinecap = parseStrokeLinecap(rules["stroke-linecap"]);
  if (rules["stroke-linejoin"]) out.strokeLinejoin = parseStrokeLinejoin(rules["stroke-linejoin"]);
  if (rules.opacity) out.opacity = parseOpacity(rules.opacity);
  if (rules["fill-opacity"]) out.fillOpacity = parseOpacity(rules["fill-opacity"]);
  if (rules["stroke-opacity"]) out.strokeOpacity = parseOpacity(rules["stroke-opacity"]);
  if (rules["fill-rule"]) out.fillRule = parseFillRule(rules["fill-rule"]);
}

export type SvgStyleElement = {
  getAttr(name: string): string | undefined;
};

export function resolvePaint(
  el: SvgStyleElement,
  inherited: PaintState,
  css: CssSheet,
  gradientFill?: EditorNode["fillGradient"],
): PaintState {
  const style = parseInlineStyle(el.getAttr("style"));
  const fromClass = classPaint(el.getAttr("class"), css);

  const fillAttr = el.getAttr("fill") ?? style.fill;
  let fill = normalizeColor(fillAttr) ?? fromClass.fill ?? inherited.fill;
  let fillEnabled = inherited.fillEnabled;
  if (fillAttr !== undefined) {
    fillEnabled = fillAttr !== "none";
    if (!fillEnabled) fill = undefined;
  } else if (fromClass.fill !== undefined) {
    fillEnabled = fromClass.fillEnabled ?? true;
  }

  const strokeAttr = el.getAttr("stroke") ?? style.stroke;
  let stroke = normalizeColor(strokeAttr) ?? fromClass.stroke ?? inherited.stroke;
  let strokeEnabled = inherited.strokeEnabled;
  if (strokeAttr !== undefined) {
    strokeEnabled = strokeAttr !== "none";
    if (!strokeEnabled) stroke = undefined;
  } else if (fromClass.stroke !== undefined) {
    strokeEnabled = fromClass.strokeEnabled ?? true;
  }

  const fillOpacity = parseOpacity(
    el.getAttr("fill-opacity") ?? style["fill-opacity"],
    fromClass.fillOpacity ?? inherited.fillOpacity,
  );
  const strokeOpacity = parseOpacity(
    el.getAttr("stroke-opacity") ?? style["stroke-opacity"],
    fromClass.strokeOpacity ?? inherited.strokeOpacity,
  );
  const strokeWidth = parseLength(
    el.getAttr("stroke-width") ?? style["stroke-width"],
    fromClass.strokeWidth ?? inherited.strokeWidth,
  );
  const opacity = parseOpacity(el.getAttr("opacity") ?? style.opacity, fromClass.opacity ?? inherited.opacity);

  const result: PaintState = {
    fill,
    fillOpacity: fillOpacity * opacity,
    fillEnabled: fillEnabled && Boolean(fill),
    stroke,
    strokeWidth,
    strokeOpacity: strokeOpacity * opacity,
    strokeEnabled: strokeEnabled && Boolean(stroke) && strokeWidth > 0,
    strokeLinecap:
      parseStrokeLinecap(el.getAttr("stroke-linecap") ?? style["stroke-linecap"]) ??
      fromClass.strokeLinecap ??
      inherited.strokeLinecap,
    strokeLinejoin:
      parseStrokeLinejoin(el.getAttr("stroke-linejoin") ?? style["stroke-linejoin"]) ??
      fromClass.strokeLinejoin ??
      inherited.strokeLinejoin,
    strokeDasharray: el.getAttr("stroke-dasharray") ?? style["stroke-dasharray"] ?? inherited.strokeDasharray,
    strokeDashoffset: parseLength(
      el.getAttr("stroke-dashoffset") ?? style["stroke-dashoffset"],
      inherited.strokeDashoffset ?? 0,
    ),
    opacity,
    fillRule:
      parseFillRule(el.getAttr("fill-rule") ?? style["fill-rule"]) ??
      fromClass.fillRule ??
      inherited.fillRule,
    clipRule: parseFillRule(el.getAttr("clip-rule") ?? style["clip-rule"]) ?? inherited.clipRule,
  };

  if (gradientFill) {
    result.fillType = "gradient";
    result.fillGradient = gradientFill;
    result.fillEnabled = true;
  }

  return result;
}
