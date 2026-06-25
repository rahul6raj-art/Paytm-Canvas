import type { PathPoint } from "@/lib/pathGeometry";
import {
  arrowChevronMarkerPathD,
  arrowFilledTriangleMarkerPathD,
} from "@/lib/shapes/arrowGeometry";

/** Stroke endpoint styles (line caps + arrowheads), Figma-aligned. */

export type StrokeEndpoint =
  | "none"
  | "round"
  | "square"
  | "line-arrow"
  | "triangle-arrow"
  | "reversed-triangle"
  | "circle-arrow"
  | "diamond-arrow";

export const STROKE_ENDPOINT_CAP_OPTIONS: { value: StrokeEndpoint; label: string }[] = [
  { value: "none", label: "None" },
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
];

export const STROKE_ENDPOINT_ARROW_OPTIONS: { value: StrokeEndpoint; label: string }[] = [
  { value: "line-arrow", label: "Line arrow" },
  { value: "triangle-arrow", label: "Triangle arrow" },
  { value: "reversed-triangle", label: "Reversed triangle" },
  { value: "circle-arrow", label: "Circle arrow" },
  { value: "diamond-arrow", label: "Diamond arrow" },
];

export function strokeEndpointLabel(v: StrokeEndpoint): string {
  return (
    [...STROKE_ENDPOINT_CAP_OPTIONS, ...STROKE_ENDPOINT_ARROW_OPTIONS].find((o) => o.value === v)
      ?.label ?? "None"
  );
}

export function strokeEndpointUsesMarker(v: StrokeEndpoint): boolean {
  return v !== "none" && v !== "round" && v !== "square";
}

export function strokeEndpointDecorationActive(
  start: StrokeEndpoint,
  end: StrokeEndpoint,
): boolean {
  return start !== "none" || end !== "none";
}

/** Arrowheads need more viewport padding than round/square caps. */
export function strokeEndpointUsesArrowMarker(
  start: StrokeEndpoint,
  end: StrokeEndpoint,
): boolean {
  return strokeEndpointUsesMarker(start) || strokeEndpointUsesMarker(end);
}

/** Padding for render-only SVG overflow (does not change layer bounds). */
export function strokeEndpointViewportPad(
  strokeWidth: number,
  start: StrokeEndpoint,
  end: StrokeEndpoint,
): number {
  const sw = Math.max(1, strokeWidth);
  const strokePad = sw / 2 + 1;
  if (strokeEndpointUsesArrowMarker(start, end)) {
    return Math.max(strokePad, sw * 2.5);
  }
  if (strokeEndpointDecorationActive(start, end) || strokeWidth > 0) {
    return strokePad;
  }
  return strokePad;
}

/** Expand SVG viewport so centerline strokes, caps, and arrow markers are not clipped (Figma-style). */
export function openPathStrokeViewport(
  width: number,
  height: number,
  strokeWidth: number,
  start: StrokeEndpoint,
  end: StrokeEndpoint,
): {
  viewBox: string;
  svgWidth: number;
  svgHeight: number;
  offsetLeft: number;
  offsetTop: number;
} {
  const sw = Math.max(1, strokeWidth);
  const decorated = strokeEndpointDecorationActive(start, end);
  const needsPad = decorated || width <= 0 || height <= 0;
  if (!needsPad) {
    return {
      viewBox: `0 0 ${width} ${height}`,
      svgWidth: width,
      svgHeight: height,
      offsetLeft: 0,
      offsetTop: 0,
    };
  }
  const pad = strokeEndpointViewportPad(sw, start, end);
  const innerW = Math.max(width, sw);
  const innerH = Math.max(height, sw);
  const svgWidth = innerW + pad * 2;
  const svgHeight = innerH + pad * 2;
  return {
    viewBox: `${-pad} ${-pad} ${svgWidth} ${svgHeight}`,
    svgWidth,
    svgHeight,
    offsetLeft: -pad,
    offsetTop: -pad,
  };
}

/** @deprecated Layer bounds must stay tight (Figma-style). Use {@link openPathStrokeViewport} at render time only. */
export function reframeOpenPathForStrokeEndpoints(node: {
  type?: string;
  pathClosed?: boolean;
  pathPoints?: PathPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth?: number;
  strokeStartPoint?: StrokeEndpoint;
  strokeEndPoint?: StrokeEndpoint;
  arrowHead?: boolean;
}): {
  x: number;
  y: number;
  width: number;
  height: number;
  pathPoints: PathPoint[];
} | null {
  if (node.type !== "path" || node.pathClosed || !node.pathPoints?.length) return null;
  const start = resolveStrokeStartPoint(node);
  const end = resolveStrokeEndPoint(node);
  const sw = Math.max(1, node.strokeWidth ?? 1);
  const vp = openPathStrokeViewport(node.width, node.height, sw, start, end);
  if (vp.offsetLeft === 0 && vp.offsetTop === 0) return null;
  const dx = -vp.offsetLeft;
  const dy = -vp.offsetTop;
  return {
    x: node.x + vp.offsetLeft,
    y: node.y + vp.offsetTop,
    width: vp.svgWidth,
    height: vp.svgHeight,
    pathPoints: node.pathPoints.map((p) => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
    })),
  };
}

/** Centerline cap: arrows use butt + markers; round/square caps use native linecap when possible. */
export function centerlineStrokeLinecap(
  start: StrokeEndpoint,
  end: StrokeEndpoint,
): "butt" | "round" | "square" | undefined {
  if (strokeEndpointUsesArrowMarker(start, end)) return "butt";
  return unifiedLineCap(start, end);
}

/** Resolve legacy `arrowHead` to endpoint type. */
export function resolveStrokeEndPoint(
  node: {
    strokeEndPoint?: StrokeEndpoint;
    arrowHead?: boolean;
  },
): StrokeEndpoint {
  if (node.strokeEndPoint) return node.strokeEndPoint;
  if (node.arrowHead) return "triangle-arrow";
  return "none";
}

export function resolveStrokeStartPoint(node: { strokeStartPoint?: StrokeEndpoint }): StrokeEndpoint {
  return node.strokeStartPoint ?? "none";
}

/** Pick a single SVG linecap when both ends share the same cap style. */
export function unifiedLineCap(
  start: StrokeEndpoint,
  end: StrokeEndpoint,
): "butt" | "round" | "square" | undefined {
  if (start !== end) return undefined;
  if (start === "round") return "round";
  if (start === "square") return "square";
  if (start === "none") return "butt";
  return undefined;
}

/** Build marker-start / marker-end attribute values (ids must exist in SVG defs). */
export function strokeMarkerRefs(
  start: StrokeEndpoint,
  end: StrokeEndpoint,
  prefix: string,
): { markerStart?: string; markerEnd?: string } {
  const markerStart = strokeEndpointUsesMarker(start)
    ? `url(#${prefix}-start)`
    : start === "round" || start === "square"
      ? `url(#${prefix}-cap-start)`
      : undefined;
  const markerEnd = strokeEndpointUsesMarker(end)
    ? `url(#${prefix}-end)`
    : end === "round" || end === "square"
      ? `url(#${prefix}-cap-end)`
      : undefined;
  return {
    markerStart: markerStart && start !== "none" ? markerStart : undefined,
    markerEnd: markerEnd && end !== "none" ? markerEnd : undefined,
  };
}

/** SVG marker definitions for a stroke color and width. */
export function strokeEndpointMarkerDefs(
  prefix: string,
  start: StrokeEndpoint,
  end: StrokeEndpoint,
  color: string,
  strokeWidth: number,
  opts?: { markerScale?: number },
): string {
  const sw = Math.max(1, strokeWidth);
  const scale = Math.max(0.25, opts?.markerScale ?? 1);
  const parts: string[] = [];

  const capMarker = (id: string, cap: "round" | "square", atStart: boolean) => {
    if (cap === "round") {
      const cx = atStart ? 0 : sw;
      return `<marker id="${id}" markerWidth="${sw}" markerHeight="${sw}" refX="${cx}" refY="${sw / 2}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><circle cx="${cx}" cy="${sw / 2}" r="${sw / 2}" fill="${color}"/></marker>`;
    }
    const x = atStart ? -sw / 2 : sw / 2;
    return `<marker id="${id}" markerWidth="${sw}" markerHeight="${sw}" refX="${atStart ? 0 : sw}" refY="${sw / 2}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><rect x="${x}" y="0" width="${sw / 2}" height="${sw}" fill="${color}"/></marker>`;
  };

  if (start === "round" || start === "square") {
    parts.push(capMarker(`${prefix}-cap-start`, start, true));
  }
  if (end === "round" || end === "square") {
    parts.push(capMarker(`${prefix}-cap-end`, end, false));
  }

  const arrowMarker = (id: string, type: StrokeEndpoint) => {
    const s = sw * 1.8 * scale;
    switch (type) {
      case "line-arrow": {
        const chevron = arrowChevronMarkerPathD(s);
        return `<marker id="${id}" markerWidth="${chevron.markerWidth}" markerHeight="${chevron.markerHeight}" refX="${chevron.refX}" refY="${chevron.refY}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><path d="${chevron.pathD}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
      }
      case "triangle-arrow": {
        const head = arrowFilledTriangleMarkerPathD(s);
        return `<marker id="${id}" markerWidth="${head.markerWidth}" markerHeight="${head.markerHeight}" refX="${head.refX}" refY="${head.refY}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><path d="${head.pathD}" fill="${color}"/></marker>`;
      }
      case "reversed-triangle": {
        const head = arrowFilledTriangleMarkerPathD(s);
        return `<marker id="${id}" markerWidth="${head.markerWidth}" markerHeight="${head.markerHeight}" refX="${head.refX}" refY="${head.refY}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><path d="${head.pathD}" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.85)}" stroke-linejoin="round"/></marker>`;
      }
      case "circle-arrow":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><circle cx="${s * 0.65}" cy="${s / 2}" r="${s * 0.28}" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.85)}" stroke-linecap="round"/></marker>`;
      case "diamond-arrow":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><polygon points="0,${s / 2} ${s * 0.5},0 ${s},${s / 2} ${s * 0.5},${s}" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.85)}" stroke-linejoin="round"/></marker>`;
      default:
        return "";
    }
  };

  if (strokeEndpointUsesMarker(start)) {
    parts.push(arrowMarker(`${prefix}-start`, start));
  }
  if (strokeEndpointUsesMarker(end)) {
    parts.push(arrowMarker(`${prefix}-end`, end));
  }

  return parts.filter(Boolean).join("");
}
