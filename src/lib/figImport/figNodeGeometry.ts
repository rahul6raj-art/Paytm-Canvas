import type { FigDocument, FigNode } from "openfig-core";

export type FigNodePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
};

/** Decompose Figma 2×3 affine transform + intrinsic size into editor placement. */
export function placementFromFigNode(node: FigNode): FigNodePlacement {
  const size = node.size ?? { x: 1, y: 1 };
  const t = node.transform;
  const baseW = Math.max(0.01, size.x ?? 1);
  const baseH = Math.max(0.01, size.y ?? 1);

  if (!t) {
    return { x: 0, y: 0, width: Math.max(1, baseW), height: Math.max(1, baseH), rotation: 0 };
  }

  const m00 = t.m00 ?? 1;
  const m01 = t.m01 ?? 0;
  const m10 = t.m10 ?? 0;
  const m11 = t.m11 ?? 1;
  const x = t.m02 ?? 0;
  const y = t.m12 ?? 0;

  const scaleX = Math.hypot(m00, m10) || 1;
  const scaleY = Math.hypot(m01, m11) || 1;
  const rotationRad = Math.atan2(m10, m00);
  let rotation = (rotationRad * 180) / Math.PI;
  if (Math.abs(rotation) < 0.01) rotation = 0;
  else rotation = Math.round(rotation * 100) / 100;

  const det = m00 * m11 - m01 * m10;
  const flipHorizontal = det < 0 ? true : undefined;
  const flipVertical = undefined;

  return {
    x,
    y,
    width: Math.max(1, baseW * scaleX),
    height: Math.max(1, baseH * scaleY),
    rotation,
    ...(flipHorizontal ? { flipHorizontal } : {}),
    ...(flipVertical ? { flipVertical } : {}),
  };
}

export function sortedFigChildren(doc: FigDocument, figParentId: string): FigNode[] {
  const children = doc.childrenMap.get(figParentId) ?? [];
  return [...children].sort((a, b) => {
    const pa = a.parentIndex?.position ?? "";
    const pb = b.parentIndex?.position ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    const ida = `${a.guid?.sessionID ?? 0}:${a.guid?.localID ?? 0}`;
    const idb = `${b.guid?.sessionID ?? 0}:${b.guid?.localID ?? 0}`;
    return ida.localeCompare(idb);
  });
}

export function figTextResizeMode(
  node: FigNode,
): "auto-width" | "auto-height" | "fixed" | undefined {
  const mode = (node as { textAutoResize?: string }).textAutoResize?.toUpperCase();
  if (!mode) return undefined;
  if (mode === "WIDTH_AND_HEIGHT" || mode === "WIDTH") return "auto-width";
  if (mode === "HEIGHT") return "auto-height";
  if (mode === "NONE" || mode === "TRUNCATE") return "fixed";
  return "auto-height";
}

export function figNodeVisible(node: FigNode): boolean {
  const v = (node as { visible?: boolean }).visible;
  return v !== false;
}
