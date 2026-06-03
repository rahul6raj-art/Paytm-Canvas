import {
  extractRenderableGradientFill,
  resolveGradientGeometry,
  type FigNode,
  type FigPaint,
} from "openfig-core";
import type { InstanceOverridePatch } from "@/lib/componentModel";
import { DEFAULT_GRADIENT_TRANSFORM, newGradientStopId, type FillGradient } from "@/lib/fillGradient";
import { newNodeEffectId, type NodeEffect } from "@/lib/nodeEffects";
import type { EditorNode, ImageFitMode, StrokePosition } from "@/stores/useEditorStore";
import type { DesignToken } from "@/lib/designTokens";
import {
  figStyleOverrideTable,
  normalizePaintType,
  normalizePaints,
  type FigColor,
} from "@/lib/figImport/figPaintCore";

export { normalizePaints, normalizePaintType, type FigColor } from "@/lib/figImport/figPaintCore";

export function rgbaToHex(c: FigColor): string {
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function resolvePaintList(
  paints: FigPaint[] | undefined,
  variableColors: Map<string, FigColor>,
): FigPaint[] | undefined {
  const normalized = normalizePaints(paints);
  if (!normalized?.length) return normalized;
  return normalized.map((paint) => {
    if (paint.visible === false) return paint;
    const resolved = resolveFigColor(paint.color, (paint as { colorVar?: unknown }).colorVar, variableColors);
    let next = resolved ? ({ ...paint, color: resolved as FigPaint["color"] } as FigPaint) : paint;
    if (Array.isArray(paint.stops)) {
      const stops = paint.stops.map((stop) => {
        const stopColor = resolveFigColor(
          stop.color,
          (stop as { colorVar?: unknown }).colorVar,
          variableColors,
        );
        if (!stopColor) return stop;
        return { ...stop, color: stopColor as FigPaint["color"] };
      }) as FigPaint["stops"];
      next = { ...next, stops };
    }
    return next;
  });
}

function guidKey(guid?: { sessionID?: number; localID?: number }): string | null {
  if (guid?.sessionID == null || guid?.localID == null) return null;
  return `${guid.sessionID}:${guid.localID}`;
}

function normalizeFigColor(c: FigColor): FigColor {
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? 1 };
}

export function resolveFigColor(
  color: FigColor | undefined,
  colorVar: unknown,
  variableColors: Map<string, FigColor>,
): FigColor | undefined {
  if (color && (color.a ?? 1) > 0) return normalizeFigColor(color);
  if (!colorVar || typeof colorVar !== "object") return color;

  const cv = colorVar as {
    value?: {
      alias?: { guid?: { sessionID?: number; localID?: number } };
      colorValue?: FigColor;
    };
    variableData?: { value?: { colorValue?: FigColor } };
  };

  const aliasKey = guidKey(cv.value?.alias?.guid);
  if (aliasKey) {
    const resolved = variableColors.get(aliasKey);
    if (resolved) return normalizeFigColor(resolved);
  }

  const direct = cv.value?.colorValue ?? cv.variableData?.value?.colorValue;
  return direct ? normalizeFigColor(direct) : color ? normalizeFigColor(color) : undefined;
}

export function solidFillFromPaints(paints?: FigPaint[]): {
  fill?: string;
  fillOpacity?: number;
} {
  const normalized = normalizePaints(paints);
  const p = normalized?.find((x) => x.visible !== false && normalizePaintType(x.type) === "SOLID" && x.color);
  if (!p?.color) return {};
  return {
    fill: rgbaToHex(p.color),
    fillOpacity: p.opacity ?? p.color.a ?? 1,
  };
}

export function gradientFillFromPaints(
  paints: FigPaint[] | undefined,
  width: number,
  height: number,
): { fillType?: "gradient"; fillGradient?: FillGradient } {
  const g = extractRenderableGradientFill(normalizePaints(paints));
  if (!g) return {};
  const stops = g.stops.map((s) => ({
    id: newGradientStopId(),
    position: Math.max(0, Math.min(100, s.position * 100)),
    color: rgbaToHex(s.color),
  }));
  if (stops.length < 2) return {};

  let rotation = DEFAULT_GRADIENT_TRANSFORM.rotation;
  const geom = resolveGradientGeometry(g, Math.max(1, width), Math.max(1, height));
  if (geom?.type === "linear") {
    rotation =
      (Math.atan2(geom.end.y - geom.start.y, geom.end.x - geom.start.x) * 180) / Math.PI;
  } else if (geom?.type === "radial" && geom.angle != null) {
    rotation = geom.angle;
  }

  return {
    fillType: "gradient",
    fillGradient: {
      kind: g.type === "radial" ? "radial" : "linear",
      transform: { ...DEFAULT_GRADIENT_TRANSFORM, rotation },
      stops,
    },
  };
}

export function imagePaintFromPaints(paints?: FigPaint[]): FigPaint | null {
  const normalized = normalizePaints(paints);
  return normalized?.find((x) => x.visible !== false && normalizePaintType(x.type) === "IMAGE") ?? null;
}

export function imageFitFromPaint(paint: FigPaint): ImageFitMode {
  const mode = String((paint as { imageScaleMode?: string }).imageScaleMode ?? "").toUpperCase();
  if (mode === "FIT" || mode === "FILL") return "fit";
  if (mode === "TILE" || mode === "CROP") return "crop";
  return "fill";
}

function mapStrokeAlign(raw?: string): StrokePosition | undefined {
  switch (raw?.toUpperCase()) {
    case "INSIDE":
      return "inside";
    case "OUTSIDE":
      return "outside";
    case "CENTER":
      return "center";
    default:
      return undefined;
  }
}

export function strokesFromFigNode(
  node: FigNode,
  variableColors: Map<string, FigColor>,
): Pick<
  EditorNode,
  | "strokeColor"
  | "strokeWidth"
  | "strokeOpacity"
  | "strokeEnabled"
  | "strokeStyle"
  | "strokePosition"
  | "strokeDashLength"
  | "strokeDashGap"
> {
  const strokes = resolvePaintList(normalizePaints(node.strokePaints), variableColors);
  const stroke = strokes?.find((x) => x.visible !== false && normalizePaintType(x.type) === "SOLID" && x.color);
  const width = node.strokeWeight ?? 0;
  if (!stroke?.color || width <= 0) {
    return { strokeEnabled: false };
  }

  const ext = node as FigNode & {
    strokeDashes?: number[];
    strokeAlign?: string;
  };

  const dash = ext.strokeDashes;
  const hasDash = Array.isArray(dash) && dash.length >= 2;

  return {
    strokeColor: rgbaToHex(stroke.color),
    strokeWidth: width,
    strokeOpacity: stroke.opacity ?? stroke.color.a ?? 1,
    strokeEnabled: true,
    strokeStyle: hasDash ? "dashed" : "solid",
    strokePosition: mapStrokeAlign(ext.strokeAlign ?? node.strokeAlign),
    strokeDashLength: hasDash ? dash[0] : undefined,
    strokeDashGap: hasDash ? dash[1] : undefined,
  };
}

export function effectsFromFigNode(
  node: FigNode,
  variableColors: Map<string, FigColor>,
): NodeEffect[] | undefined {
  const raw = node.effects;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const out: NodeEffect[] = [];
  for (const e of raw) {
    if (e.visible === false) continue;
    const type = String(e.type ?? "");

    if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
      const color = resolveFigColor(
        e.color as FigColor | undefined,
        (e as { colorVar?: unknown }).colorVar,
        variableColors,
      );
      const opacity = e.opacity ?? color?.a ?? 0.25;
      out.push({
        id: newNodeEffectId(),
        type: type === "INNER_SHADOW" ? "inner-shadow" : "drop-shadow",
        visible: true,
        x: e.offset?.x ?? 0,
        y: e.offset?.y ?? 0,
        blur: Math.max(0, e.radius ?? 0),
        spread: e.spread ?? 0,
        color: color ? rgbaToHex(color) : "#000000",
        opacity,
      });
      continue;
    }

    if (type === "FOREGROUND_BLUR" || type === "BACKGROUND_BLUR") {
      const radius = e.radius ?? 0;
      const blur = radius < 16 ? Math.max(1, Math.round(radius * 4)) : Math.round(radius);
      if (blur <= 0) continue;
      out.push({
        id: newNodeEffectId(),
        type: type === "BACKGROUND_BLUR" ? "background-blur" : "layer-blur",
        visible: true,
        blur,
      });
    }
  }

  return out.length > 0 ? out : undefined;
}

export function fillTokenIdForPaints(
  paints: FigPaint[] | undefined,
  tokensByVariableKey: Map<string, string>,
): string | undefined {
  if (!paints?.length) return undefined;
  for (const paint of paints) {
    const cv = (paint as { colorVar?: unknown }).colorVar;
    if (!cv || typeof cv !== "object") continue;
    const alias = (cv as { value?: { alias?: { guid?: { sessionID?: number; localID?: number } } } })
      .value?.alias?.guid;
    const key = guidKey(alias);
    if (key && tokensByVariableKey.has(key)) return tokensByVariableKey.get(key);
  }
  return undefined;
}

export function buildTokensByVariableKey(
  tokens: Record<string, DesignToken>,
  variableColors: Map<string, FigColor>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [varKey, color] of variableColors) {
    const hex = rgbaToHex(color);
    for (const token of Object.values(tokens)) {
      if (token.type !== "color") continue;
      if (token.value.hex.toLowerCase() === hex.toLowerCase()) {
        map.set(varKey, token.id);
        break;
      }
    }
  }
  return map;
}

export function instanceOverridesFromSymbol(
  instance: FigNode,
  idMap: Map<string, string>,
  variableColors: Map<string, FigColor>,
): Record<string, InstanceOverridePatch> {
  const overrides = (instance as FigNode & { symbolData?: { symbolOverrides?: unknown[] } }).symbolData
    ?.symbolOverrides;
  if (!Array.isArray(overrides) || overrides.length === 0) return {};

  const out: Record<string, InstanceOverridePatch> = {};

  for (const raw of overrides) {
    const ov = raw as {
      guidPath?: { guids?: { sessionID?: number; localID?: number }[] };
      textData?: { characters?: string };
      fillPaints?: FigPaint[];
      strokePaints?: FigPaint[];
      fontName?: FigNode["fontName"];
      fontSize?: number;
      opacity?: number;
    };
    const path = ov.guidPath?.guids;
    if (!path?.length) continue;
    const last = path[path.length - 1]!;
    const figKey = guidKey(last);
    if (!figKey) continue;
    const paytmId = idMap.get(figKey);
    if (!paytmId) continue;

    const patch: InstanceOverridePatch = {};
    if (ov.textData?.characters != null) {
      patch.content = ov.textData.characters === "" ? " " : ov.textData.characters;
    }
    if (ov.fillPaints?.length) {
      const resolved = resolvePaintList(ov.fillPaints, variableColors);
      const solid = solidFillFromPaints(resolved);
      if (solid.fill) {
        patch.fill = solid.fill;
        patch.fillOpacity = solid.fillOpacity;
        patch.fillEnabled = true;
      }
    }
    if (ov.strokePaints?.length) {
      const resolved = resolvePaintList(ov.strokePaints, variableColors);
      const stroke = resolved?.find(
        (x) => x.visible !== false && normalizePaintType(x.type) === "SOLID" && x.color,
      );
      if (stroke?.color) {
        patch.strokeColor = rgbaToHex(stroke.color);
        patch.strokeEnabled = true;
      }
    }
    if (ov.fontName?.family) {
      patch.fontFamily = `"${ov.fontName.family}", system-ui, sans-serif`;
      patch.fontWeight = figFontWeight(ov.fontName.style);
    }
    if (ov.fontSize != null) patch.fontSize = ov.fontSize;
    if (ov.opacity != null) patch.opacity = ov.opacity;

    if (Object.keys(patch).length > 0) out[paytmId] = patch;
  }

  return out;
}

export function figFontWeight(style?: string): number {
  const s = (style ?? "").toLowerCase();
  if (s.includes("black") || s.includes("heavy")) return 900;
  if (s.includes("extrabold") || s.includes("ultra")) return 800;
  if (s.includes("bold")) return 700;
  if (s.includes("semibold") || s.includes("demi")) return 600;
  if (s.includes("medium")) return 500;
  if (s.includes("light") || s.includes("thin")) return 300;
  return 400;
}

export function resolveFillPaintsForStyle(node: FigNode, styleID: number): FigPaint[] | undefined {
  if (!styleID) return node.fillPaints;
  const override = figStyleOverrideTable(node).find((e) => e?.styleID === styleID);
  if (override && "fillPaints" in override && Array.isArray(override.fillPaints)) {
    return override.fillPaints;
  }
  return node.fillPaints;
}

export function effectiveNodeFillPaints(
  node: FigNode,
  getVectorPaints?: () => FigPaint[] | undefined,
): FigPaint[] | undefined {
  if (node.fillPaints?.length) return node.fillPaints;

  const fillGeom = (node as { fillGeometry?: { styleID?: number }[] }).fillGeometry;
  if (fillGeom?.length) {
    for (const geom of fillGeom) {
      const styleID = geom?.styleID ?? 0;
      const resolved = resolveFillPaintsForStyle(node, styleID);
      if (resolved?.length) return resolved;
    }
  }

  const vectorPaints = getVectorPaints?.();
  if (vectorPaints?.length) return vectorPaints;

  return node.fillPaints;
}
