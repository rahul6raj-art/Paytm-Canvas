import { effectColorToRgba } from "@/lib/nodeEffects";
import type { EditorNode, StrokePosition } from "@/stores/useEditorStore";
import type { StrokeLinecap, StrokeLinejoin } from "@/lib/stroke";

/** Figma-like stroke descriptor (canonical model). */
export type StrokeAlign = "inside" | "center" | "outside";

export type StrokeSpec = {
  enabled: boolean;
  color: string;
  width: number;
  opacity: number;
  align: StrokeAlign;
  join: StrokeLinejoin;
  cap: StrokeLinecap;
  dashPattern: number[];
};

export const DEFAULT_STROKE_SPEC: StrokeSpec = {
  enabled: true,
  color: "#0f172a",
  width: 1,
  opacity: 1,
  align: "center",
  join: "miter",
  cap: "butt",
  dashPattern: [],
};

export type StrokeSpecNode = Pick<
  EditorNode,
  | "stroke"
  | "strokeColor"
  | "strokeType"
  | "strokeGradient"
  | "strokeWidth"
  | "strokeOpacity"
  | "strokeEnabled"
  | "strokePosition"
  | "strokeStyle"
  | "strokeDashLength"
  | "strokeDashGap"
  | "strokeLinecap"
  | "strokeLinejoin"
>;

function legacyDashPattern(node: StrokeSpecNode): number[] {
  const style = node.strokeStyle ?? "solid";
  if (style === "solid") return [];
  const w = Math.max(0.5, node.strokeWidth ?? 1);
  const dash =
    node.strokeDashLength ??
    (style === "dotted" ? w : style === "dashed" ? Math.max(2, w * 4) : 2);
  const gap =
    node.strokeDashGap ??
    (style === "dotted" ? w * 1.5 : style === "dashed" ? Math.max(2, w * 2) : 2);
  return dash > 0 || gap > 0 ? [dash, gap] : [];
}

function legacyCap(node: StrokeSpecNode): StrokeLinecap {
  if (node.strokeLinecap) return node.strokeLinecap;
  if (node.strokeStyle === "dotted") return "round";
  return "butt";
}

/** Build canonical stroke spec from nested `stroke` or legacy flat fields. */
export function resolveStrokeSpec(node: StrokeSpecNode): StrokeSpec {
  const nested = node.stroke;
  if (nested) {
    return {
      enabled: nested.enabled,
      color: nested.color ?? DEFAULT_STROKE_SPEC.color,
      width: Math.max(0, nested.width ?? 0),
      opacity: nested.opacity ?? 1,
      align: nested.align ?? "center",
      join: nested.join ?? "miter",
      cap: nested.cap ?? "butt",
      dashPattern: Array.isArray(nested.dashPattern) ? [...nested.dashPattern] : [],
    };
  }

  const width = Math.max(0, node.strokeWidth ?? 0);
  return {
    enabled: node.strokeEnabled !== false && width > 0,
    color: node.strokeColor ?? DEFAULT_STROKE_SPEC.color,
    width,
    opacity: node.strokeOpacity ?? 1,
    align: (node.strokePosition ?? "center") as StrokeAlign,
    join: node.strokeLinejoin ?? "miter",
    cap: legacyCap(node),
    dashPattern: legacyDashPattern(node),
  };
}

export function strokeSpecIsVisible(spec: StrokeSpec): boolean {
  return spec.enabled && spec.width > 0;
}

export function strokeSpecColorRgba(spec: StrokeSpec): string {
  return effectColorToRgba(spec.color, spec.opacity);
}

export function strokeSpecAlign(spec: StrokeSpec): StrokeAlign {
  return spec.align;
}

/** Legacy alias used across the codebase. */
export function strokeSpecPosition(spec: StrokeSpec): StrokePosition {
  return spec.align;
}

export function strokeSpecDashArray(spec: StrokeSpec): string | undefined {
  const p = spec.dashPattern;
  if (!p.length) return undefined;
  if (p.length === 1) return `${p[0]}`;
  return p.join(" ");
}

export function strokeSpecCanvasDash(spec: StrokeSpec): number[] {
  return spec.dashPattern.length ? [...spec.dashPattern] : [];
}

/** Sync nested stroke + legacy flat fields from a partial patch. */
export function mergeStrokeIntoNode(
  node: StrokeSpecNode,
  patch: Partial<
    Pick<
      EditorNode,
      | "stroke"
      | "strokeColor"
      | "strokeType"
      | "strokeGradient"
      | "strokeWidth"
      | "strokeOpacity"
      | "strokeEnabled"
      | "strokePosition"
      | "strokeStyle"
      | "strokeDashLength"
      | "strokeDashGap"
      | "strokeLinecap"
      | "strokeLinejoin"
    >
  >,
): Partial<EditorNode> {
  const base = resolveStrokeSpec(node);
  let next: StrokeSpec = { ...base };

  if (patch.stroke) {
    next = { ...next, ...patch.stroke };
  }
  if (patch.strokeColor != null) next.color = patch.strokeColor;
  if (patch.strokeWidth != null) next.width = Math.max(0, patch.strokeWidth);
  if (patch.strokeOpacity != null) next.opacity = patch.strokeOpacity;
  if (patch.strokeEnabled != null) next.enabled = patch.strokeEnabled;
  if (patch.strokePosition != null) next.align = patch.strokePosition;
  if (patch.strokeLinejoin != null) next.join = patch.strokeLinejoin;
  if (patch.strokeLinecap != null) next.cap = patch.strokeLinecap;

  if (patch.strokeStyle != null) {
    if (patch.strokeStyle === "solid") next.dashPattern = [];
    else if (patch.strokeDashLength != null || patch.strokeDashGap != null) {
      const dash = patch.strokeDashLength ?? next.dashPattern[0] ?? 2;
      const gap = patch.strokeDashGap ?? next.dashPattern[1] ?? 2;
      next.dashPattern = [dash, gap];
    } else if (patch.strokeStyle === "dotted") {
      const w = next.width || 1;
      next.dashPattern = [w, w * 1.5];
      next.cap = "round";
    } else if (patch.strokeStyle === "dashed") {
      const w = next.width || 1;
      next.dashPattern = [Math.max(2, w * 4), Math.max(2, w * 2)];
    }
  } else if (patch.strokeDashLength != null || patch.strokeDashGap != null) {
    const dash = patch.strokeDashLength ?? next.dashPattern[0] ?? 2;
    const gap = patch.strokeDashGap ?? next.dashPattern[1] ?? 2;
    next.dashPattern = [dash, gap];
  }

  const style: EditorNode["strokeStyle"] =
    next.dashPattern.length === 0
      ? "solid"
      : next.dashPattern[0] === next.width && next.dashPattern[1] === next.width * 1.5
        ? "dotted"
        : "dashed";

  const out: Partial<EditorNode> = {
    stroke: next,
    strokeColor: next.color,
    strokeWidth: next.width,
    strokeOpacity: next.opacity,
    strokeEnabled: next.enabled,
    strokePosition: next.align,
    strokeStyle: style,
    strokeDashLength: next.dashPattern[0],
    strokeDashGap: next.dashPattern[1],
    strokeLinecap: next.cap,
    strokeLinejoin: next.join,
  };
  if (patch.strokeType != null) out.strokeType = patch.strokeType;
  if (patch.strokeGradient != null) out.strokeGradient = patch.strokeGradient;
  return out;
}

/** Hydrate legacy nodes missing `stroke` on load. */
export function migrateNodeStroke(node: EditorNode): EditorNode {
  if (node.stroke) return node;
  const spec = resolveStrokeSpec(node);
  if ((node.strokeWidth ?? 0) <= 0 && node.strokeEnabled === false) return node;
  return { ...node, stroke: spec };
}

export function migrateAllNodeStrokes(
  nodes: Record<string, EditorNode>,
): Record<string, EditorNode> {
  let changed = false;
  const out: Record<string, EditorNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    const migrated = migrateNodeStroke(node);
    out[id] = migrated;
    if (migrated !== node) changed = true;
  }
  return changed ? out : nodes;
}
