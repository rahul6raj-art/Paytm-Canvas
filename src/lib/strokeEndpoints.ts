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

  const capMarker = (id: string, cap: "round" | "square") => {
    if (cap === "round") {
      return `<marker id="${id}" markerWidth="${sw * 2}" markerHeight="${sw * 2}" refX="${sw}" refY="${sw}" orient="auto" markerUnits="userSpaceOnUse"><circle cx="${sw}" cy="${sw}" r="${sw / 2}" fill="${color}"/></marker>`;
    }
    return `<marker id="${id}" markerWidth="${sw}" markerHeight="${sw}" refX="${sw / 2}" refY="${sw / 2}" orient="auto" markerUnits="userSpaceOnUse"><rect x="0" y="0" width="${sw}" height="${sw}" fill="${color}"/></marker>`;
  };

  if (start === "round" || start === "square") {
    parts.push(capMarker(`${prefix}-cap-start`, start));
  }
  if (end === "round" || end === "square") {
    parts.push(capMarker(`${prefix}-cap-end`, end));
  }

  const arrowMarker = (id: string, type: StrokeEndpoint) => {
    const s = sw * 1.8 * scale;
    switch (type) {
      case "line-arrow":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s * 0.85}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${s},${s / 2} L0,${s} Z" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.15)}"/></marker>`;
      case "triangle-arrow":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s * 0.95}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0,0 ${s},${s / 2} 0,${s}" fill="${color}"/></marker>`;
      case "reversed-triangle":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s * 0.95}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0,0 ${s},${s / 2} 0,${s}" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.12)}"/></marker>`;
      case "circle-arrow":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s * 0.7}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse"><circle cx="${s * 0.35}" cy="${s / 2}" r="${s * 0.28}" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.12)}"/></marker>`;
      case "diamond-arrow":
        return `<marker id="${id}" markerWidth="${s}" markerHeight="${s}" refX="${s * 0.9}" refY="${s / 2}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0,${s / 2} ${s * 0.45},0 ${s * 0.9},${s / 2} ${s * 0.45},${s}" fill="none" stroke="${color}" stroke-width="${Math.max(1, sw * 0.12)}"/></marker>`;
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
