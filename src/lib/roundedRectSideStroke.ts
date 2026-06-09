import {
  clampCornerRadii,
  getNodeCornerRadii,
  type CornerRadii,
} from "@/lib/cornerRadius";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  strokeSideWidthsAreUniform,
  strokeUsesCssIndividualBorders,
  type ResolvedStrokeSides,
  type ResolvedStrokeSideWidths,
} from "@/lib/strokeAlign";
import type { EditorNode } from "@/stores/useEditorStore";

const SIDE_ORDER = ["top", "right", "bottom", "left"] as const;
export type RectStrokeSide = (typeof SIDE_ORDER)[number];

export type RectCorner = "tl" | "tr" | "br" | "bl";

export type StrokeSegmentTaper = "uniform" | "symmetric" | "start" | "end";

export type StrokeSideSegment = {
  /** Sides that activate this segment (corner or chain). */
  sides: RectStrokeSide[];
  corner?: RectCorner;
  pathD: string;
  width: number;
  taper: StrokeSegmentTaper;
};

function prevSide(side: RectStrokeSide): RectStrokeSide {
  const i = SIDE_ORDER.indexOf(side);
  return SIDE_ORDER[(i + 3) % 4]!;
}

function nextSide(side: RectStrokeSide): RectStrokeSide {
  const i = SIDE_ORDER.indexOf(side);
  return SIDE_ORDER[(i + 1) % 4]!;
}

/** Maximal chains of adjacent active sides around the rectangle perimeter. */
export function getActiveSideChains(sides: ResolvedStrokeSides): RectStrokeSide[][] {
  const chains: RectStrokeSide[][] = [];
  let chain: RectStrokeSide[] = [];

  for (const side of SIDE_ORDER) {
    if (!sides[side]) {
      if (chain.length) {
        chains.push(chain);
        chain = [];
      }
      continue;
    }
    if (chain.length === 0) chain.push(side);
    else if (nextSide(chain[chain.length - 1]!) === side) chain.push(side);
    else {
      chains.push(chain);
      chain = [side];
    }
  }
  if (chain.length) chains.push(chain);

  if (chains.length >= 2) {
    const head = chains[0]![0]!;
    const tail = chains[chains.length - 1]!.at(-1)!;
    if (nextSide(tail) === head) {
      return [[...chains[chains.length - 1]!, ...chains[0]!]];
    }
  }
  return chains;
}

function chainUniformWidth(
  chain: RectStrokeSide[],
  sideWidths: ResolvedStrokeSideWidths,
): number | null {
  if (chain.length === 0) return null;
  const w0 = sideWidths[chain[0]!];
  for (const side of chain) {
    if (sideWidths[side] !== w0) return null;
  }
  return w0;
}

/**
 * One open path tracing a chain of adjacent sides (each corner arc once).
 */
export function traceChainPathD(
  chain: RectStrokeSide[],
  width: number,
  height: number,
  radii: CornerRadii,
): string {
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  const inChain = new Set(chain);
  const parts: string[] = [];
  let atPoint: { x: number; y: number } | null = null;

  const lineTo = (x: number, y: number) => {
    parts.push(`L ${x} ${y}`);
    atPoint = { x, y };
  };

  const moveTo = (x: number, y: number) => {
    parts.push(`M ${x} ${y}`);
    atPoint = { x, y };
  };

  const arcTo = (rx: number, ry: number, x: number, y: number) => {
    parts.push(`A ${rx} ${ry} 0 0 1 ${x} ${y}`);
    atPoint = { x, y };
  };

  for (let i = 0; i < chain.length; i++) {
    const side = chain[i]!;
    const nextInChain = chain[i + 1] ?? null;
    const prevInChain = chain[i - 1] ?? null;
    const isLast = i === chain.length - 1;

    if (side === "top") {
      if (atPoint === null) {
        if (inChain.has("left") || prevInChain === "left") {
          moveTo(0, tl);
          if (tl > 0) arcTo(tl, tl, tl, 0);
        } else if (tl > 0) {
          moveTo(tl, 0);
        } else {
          moveTo(0, 0);
        }
      }
      if (width - (atPoint?.x ?? 0) - tr > 0.5) lineTo(width - tr, atPoint!.y);
      const loneTop = isLast && chain.length === 1;
      if (tr > 0 && (nextInChain === "right" || loneTop)) {
        arcTo(tr, tr, width, tr);
      }
    }

    if (side === "right") {
      if (atPoint === null) {
        if (inChain.has("top") || prevInChain === "top") {
          atPoint = { x: width, y: tr };
        } else {
          moveTo(width - tr, 0);
          if (tr > 0) arcTo(tr, tr, width, tr);
        }
      }
      const y = atPoint!.y;
      if (height - y - br > 0.5) lineTo(width, height - br);
      else if (br > 0 && nextInChain === "bottom") lineTo(width, height);
      if (br > 0 && nextInChain === "bottom") {
        arcTo(br, br, width - br, height);
      }
    }

    if (side === "bottom") {
      if (atPoint === null) {
        if (inChain.has("right") || prevInChain === "right") {
          atPoint = { x: width - br, y: height };
        } else {
          moveTo(width, height - br);
          if (br > 0) arcTo(br, br, width - br, height);
        }
      }
      const x = atPoint!.x;
      const loneBottom = isLast && chain.length === 1;
      if (x - bl > 0.5) lineTo(bl, height);
      else if (bl > 0 && nextInChain === "left") lineTo(0, height);
      if (bl > 0 && (nextInChain === "left" || loneBottom)) {
        arcTo(bl, bl, 0, height - bl);
      }
    }

    if (side === "left") {
      if (atPoint === null) {
        if (inChain.has("bottom") || prevInChain === "bottom") {
          atPoint = { x: 0, y: height - bl };
        } else {
          moveTo(0, height - bl);
          if (bl > 0) arcTo(bl, bl, 0, height - bl);
        }
      }
      const y = atPoint!.y;
      const loneLeft = isLast && chain.length === 1;
      if (y - tl > 0.5) lineTo(0, tl);
      else if (tl > 0 && nextInChain === "top") lineTo(0, 0);
      if (tl > 0 && (nextInChain === "top" || loneLeft)) {
        arcTo(tl, tl, tl, 0);
      }
    }
  }

  return parts.join(" ");
}

function sidePathChunk(
  side: RectStrokeSide,
  width: number,
  height: number,
  radii: CornerRadii,
): string | null {
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);

  if (side === "top") {
    const seg: string[] = [`M 0 ${tl}`];
    if (tl > 0) seg.push(`A ${tl} ${tl} 0 0 1 ${tl} 0`);
    if (width - tl - tr > 0) seg.push(`H ${width - tr}`);
    else if (tr > 0) seg.push(`H ${width}`);
    if (tr > 0) seg.push(`A ${tr} ${tr} 0 0 1 ${width} ${tr}`);
    return seg.join(" ");
  }

  if (side === "right") {
    const seg: string[] = [`M ${width - tr} 0`];
    if (tr > 0) seg.push(`A ${tr} ${tr} 0 0 1 ${width} ${tr}`);
    if (height - tr - br > 0) seg.push(`V ${height - br}`);
    else if (br > 0) seg.push(`V ${height}`);
    if (br > 0) seg.push(`A ${br} ${br} 0 0 1 ${width - br} ${height}`);
    return seg.join(" ");
  }

  if (side === "bottom") {
    const seg: string[] = [`M ${width} ${height - br}`];
    if (br > 0) seg.push(`A ${br} ${br} 0 0 1 ${width - br} ${height}`);
    if (width - br - bl > 0) seg.push(`H ${bl}`);
    else if (bl > 0) seg.push(`H 0`);
    if (bl > 0) seg.push(`A ${bl} ${bl} 0 0 1 0 ${height - bl}`);
    return seg.join(" ");
  }

  if (side === "left") {
    const seg: string[] = [`M ${bl} ${height}`];
    if (bl > 0) seg.push(`A ${bl} ${bl} 0 0 1 0 ${height - bl}`);
    if (height - bl - tl > 0) seg.push(`V ${tl}`);
    else if (tl > 0) seg.push(`V 0`);
    if (tl > 0) seg.push(`A ${tl} ${tl} 0 0 1 ${tl} 0`);
    return seg.join(" ");
  }

  return null;
}

type CornerMeta = {
  corner: RectCorner;
  sides: [RectStrokeSide, RectStrokeSide];
  radius: (r: CornerRadii) => number;
  pathD: (w: number, h: number, r: number) => string;
};

const CORNER_META: CornerMeta[] = [
  {
    corner: "tl",
    sides: ["left", "top"],
    radius: ([tl]) => tl,
    pathD: (w, h, r) => `M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`,
  },
  {
    corner: "tr",
    sides: ["top", "right"],
    radius: ([, tr]) => tr,
    pathD: (w, h, r) => `M ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r}`,
  },
  {
    corner: "br",
    sides: ["right", "bottom"],
    radius: ([, , br]) => br,
    pathD: (w, h, r) => `M ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h}`,
  },
  {
    corner: "bl",
    sides: ["bottom", "left"],
    radius: ([, , , bl]) => bl,
    pathD: (w, h, r) => `M ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r}`,
  },
];

function cornerSegmentTaper(
  prevOn: boolean,
  nextOn: boolean,
  prevW: number,
  nextW: number,
): StrokeSegmentTaper {
  if (prevOn && nextOn && prevW === nextW) return "uniform";
  if (prevOn && !nextOn) return "start";
  if (!prevOn && nextOn) return "end";
  if (prevOn && nextOn) return "start";
  return "symmetric";
}

/** Corner-arc strokes only (matches Figma partial stroke on rounded rects). */
export function roundedRectCornerStrokeSegments(
  sides: ResolvedStrokeSides,
  sideWidths: ResolvedStrokeSideWidths,
  width: number,
  height: number,
  radii: CornerRadii,
): StrokeSideSegment[] {
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  const rMap = { tl, tr, br, bl };
  const segments: StrokeSideSegment[] = [];

  for (const meta of CORNER_META) {
    const [prevSide, nextSide] = meta.sides;
    const prevOn = sides[prevSide] && sideWidths[prevSide] > 0;
    const nextOn = sides[nextSide] && sideWidths[nextSide] > 0;
    if (!prevOn && !nextOn) continue;

    const r = rMap[meta.corner];
    if (r <= 0) continue;

    const prevW = sideWidths[prevSide];
    const nextW = sideWidths[nextSide];
    const strokeW = prevOn && nextOn ? Math.max(prevW, nextW) : prevOn ? prevW : nextW;

    segments.push({
      corner: meta.corner,
      sides: meta.sides.filter((s) => sides[s] && sideWidths[s] > 0),
      pathD: meta.pathD(width, height, r),
      width: strokeW,
      taper: cornerSegmentTaper(prevOn, nextOn, prevW, nextW),
    });
  }

  return segments;
}

/** True when any corner radius is non-zero on a rect-like layer. */
export function shapeHasCornerRadius(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
  width: number,
  height: number,
): boolean {
  const [tl, tr, br, bl] = clampCornerRadii(getNodeCornerRadii(node), width, height);
  return tl > 0 || tr > 0 || br > 0 || bl > 0;
}

/**
 * Rounded-rect partial strokes (Figma individual strokes):
 * each active side = straight edge + both adjacent corner arcs.
 */
export function roundedRectStrokeSegments(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokePosition"
    | "strokeStyle"
    | "cornerRadius"
    | "cornerRadii"
    | "width"
    | "height"
  >,
): StrokeSideSegment[] | null {
  if (node.type !== "rectangle" && node.type !== "frame") return null;
  if (strokeUsesCssIndividualBorders(node)) return null;
  if (!shapeHasCornerRadius(node, node.width, node.height)) return null;

  const sideWidths = resolveStrokeSideWidths(node);
  const sides = resolveStrokeSides(node);
  const allOn = sides.top && sides.right && sides.bottom && sides.left;
  if (allOn && strokeSideWidthsAreUniform(sideWidths)) return null;

  const radii = getNodeCornerRadii(node);
  const segments: StrokeSideSegment[] = [];

  for (const side of SIDE_ORDER) {
    if (!sides[side] || sideWidths[side] <= 0) continue;
    const pathD = sidePathChunk(side, node.width, node.height, radii);
    if (!pathD) continue;
    segments.push({
      sides: [side],
      pathD,
      width: sideWidths[side],
      taper: "uniform",
    });
  }

  return segments.length > 0 ? segments : null;
}

/** @deprecated Use roundedRectStrokeSegments */
export function partialRoundedSidesPath(
  node: Pick<
    EditorNode,
    "type" | "strokeWidth" | "strokeSides" | "strokeSidesCustom" | "cornerRadius" | "cornerRadii" | "width" | "height"
  >,
): string | null {
  const segments = roundedRectStrokeSegments(node);
  if (!segments) return null;
  if (segments.length === 1) return segments[0]!.pathD;
  return segments.map((s) => s.pathD).join(" ");
}

/** Open SVG path tracing only the selected sides (legacy single-width join). */
export function roundedRectSidesPathD(
  w: number,
  h: number,
  radii: CornerRadii,
  sides: ResolvedStrokeSides,
): string | null {
  if (sides.top && sides.right && sides.bottom && sides.left) return null;

  const chains = getActiveSideChains(sides);
  const chunks: string[] = [];
  for (const chain of chains) {
    chunks.push(traceChainPathD(chain, w, h, radii));
  }
  return chunks.length > 0 ? chunks.join(" ") : null;
}

export function needsPerSideSegmentStroke(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "cornerRadius"
    | "cornerRadii"
    | "width"
    | "height"
  >,
): boolean {
  if (node.type !== "rectangle" && node.type !== "frame") return false;
  const sideWidths = resolveStrokeSideWidths(node);
  const sides = resolveStrokeSides(node);
  const allOn = sides.top && sides.right && sides.bottom && sides.left;
  if ((node.strokeSides ?? "all") === "custom" && allOn && !strokeSideWidthsAreUniform(sideWidths)) {
    return true;
  }
  if (shapeHasCornerRadius(node, node.width, node.height)) {
    return Boolean(roundedRectStrokeSegments(node));
  }
  return false;
}

/** Per-side bands use uniform weight (Figma individual strokes). Path taper is a separate feature. */
export function partialStrokeSegmentUsesTaper(
  _segment: Pick<StrokeSideSegment, "taper">,
  _globalTaper: boolean,
): boolean {
  return false;
}
