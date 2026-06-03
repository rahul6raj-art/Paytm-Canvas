import type { EditorNode } from "@/stores/useEditorStore";

/** Top-left, top-right, bottom-right, bottom-left (Figma / CSS 4-value order). */
export type CornerRadii = [number, number, number, number];

export function getNodeCornerRadii(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
): CornerRadii {
  if (node.cornerRadii?.length === 4) {
    return [
      Math.max(0, node.cornerRadii[0] ?? 0),
      Math.max(0, node.cornerRadii[1] ?? 0),
      Math.max(0, node.cornerRadii[2] ?? 0),
      Math.max(0, node.cornerRadii[3] ?? 0),
    ];
  }
  const r = Math.max(0, node.cornerRadius ?? 0);
  return [r, r, r, r];
}

export function hasIndependentCornerRadii(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
): boolean {
  if (!node.cornerRadii?.length) return false;
  const [tl, tr, br, bl] = node.cornerRadii;
  return !(tl === tr && tr === br && br === bl);
}

export function isUniformCornerRadii(radii: CornerRadii): boolean {
  const [tl, tr, br, bl] = radii;
  return tl === tr && tr === br && br === bl;
}

export function cornerRadiiMax(radii: CornerRadii): number {
  return Math.max(...radii);
}

/** Rectangle / frame layers that show on-canvas corner radius handles. */
export function supportsCornerRadiusHandles(
  node: Pick<EditorNode, "type" | "visible" | "locked">,
): boolean {
  if (!node.visible || node.locked) return false;
  return node.type === "rectangle" || node.type === "frame";
}

/** CSS `border-radius` for canvas / export. */
export function cornerRadiiToCss(radii: CornerRadii): string | number {
  if (isUniformCornerRadii(radii)) return radii[0];
  const [tl, tr, br, bl] = radii;
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

/** Scale radii so adjacent corners do not overlap (CSS corner overlap). */
export function clampCornerRadii(radii: CornerRadii, w: number, h: number): CornerRadii {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  if (width <= 0 || height <= 0) return [0, 0, 0, 0];

  let [tl, tr, br, bl] = radii.map((r) => Math.max(0, r)) as CornerRadii;
  const top = tl + tr;
  const bottom = bl + br;
  const left = tl + bl;
  const right = tr + br;
  let f = 1;
  if (top > width) f = Math.min(f, width / top);
  if (bottom > width) f = Math.min(f, width / bottom);
  if (left > height) f = Math.min(f, height / left);
  if (right > height) f = Math.min(f, height / right);
  if (f < 1) {
    tl *= f;
    tr *= f;
    br *= f;
    bl *= f;
  }
  return [tl, tr, br, bl];
}

/** SVG path for a rounded rectangle with per-corner radii (local 0,0–w,h). */
export function roundedRectPathD(w: number, h: number, radii: CornerRadii): string {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  if (width <= 0 || height <= 0) return "";
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M 0 0 H ${width} V ${height} H 0 Z`;
  }

  const parts: string[] = [`M ${tl} 0`];
  if (width - tl - tr > 0) parts.push(`H ${width - tr}`);
  else if (tr > 0) parts.push(`H ${width}`);

  if (tr > 0) parts.push(`A ${tr} ${tr} 0 0 1 ${width} ${tr}`);
  if (height - tr - br > 0) parts.push(`V ${height - br}`);
  else if (br > 0) parts.push(`V ${height}`);

  if (br > 0) parts.push(`A ${br} ${br} 0 0 1 ${width - br} ${height}`);
  if (width - br - bl > 0) parts.push(`H ${bl}`);
  else if (bl > 0) parts.push(`H 0`);

  if (bl > 0) parts.push(`A ${bl} ${bl} 0 0 1 0 ${height - bl}`);
  if (height - bl - tl > 0) parts.push(`V ${tl}`);
  else if (tl > 0) parts.push(`V 0`);

  if (tl > 0) parts.push(`A ${tl} ${tl} 0 0 1 ${tl} 0`);
  parts.push("Z");
  return parts.join(" ");
}

function arcPoints(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** Polygon approximation of a variable rounded rect (for boolean / hit tests). */
export function roundedRectPolygonPoints(
  w: number,
  h: number,
  radii: CornerRadii,
  segmentsPerCorner = 8,
): { x: number; y: number }[] {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  }

  const pts: { x: number; y: number }[] = [{ x: tl, y: 0 }];
  if (tr > 0) {
    pts.push(...arcPoints(width - tr, tr, tr, -Math.PI / 2, 0, segmentsPerCorner).slice(1));
  } else {
    pts.push({ x: width, y: 0 });
  }
  if (br > 0) {
    pts.push(...arcPoints(width - br, height - br, br, 0, Math.PI / 2, segmentsPerCorner).slice(1));
  } else {
    pts.push({ x: width, y: height });
  }
  if (bl > 0) {
    pts.push(...arcPoints(bl, height - bl, bl, Math.PI / 2, Math.PI, segmentsPerCorner).slice(1));
  } else {
    pts.push({ x: 0, y: height });
  }
  if (tl > 0) {
    pts.push(...arcPoints(tl, tl, tl, Math.PI, (3 * Math.PI) / 2, segmentsPerCorner).slice(1));
  }
  return pts;
}

/** Uniform corner value for legacy `rx` on SVG `<rect>`. */
export function uniformCornerRadiusForRect(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
  w: number,
  h: number,
): number {
  const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
  if (isUniformCornerRadii(radii)) return radii[0];
  return 0;
}
