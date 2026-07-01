import type { DomSnapshotStyles } from "@/lib/webImport/types";

export type StructuralHairline = {
  edge: "top" | "bottom" | "left" | "right";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

const MIN_EDGE_PX = 0.5;

function parseEdgeWidth(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function isVisibleCssColor(color: string | undefined): boolean {
  if (!color?.trim()) return false;
  const c = color.trim().toLowerCase();
  return c !== "transparent" && c !== "rgba(0, 0, 0, 0)";
}

/** Hairline from computed box-shadow offset (PML footer uses `0 -1px 0 color`). */
export function boxShadowEdgeHairline(
  boxShadow: string | undefined,
): { edge: "top" | "bottom"; color: string } | null {
  if (!boxShadow?.trim() || boxShadow.trim() === "none") return null;
  for (const layer of boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim())) {
    if (/^inset\b/i.test(layer)) continue;
    const nums = layer.match(/-?[\d.]+px/g);
    if (!nums || nums.length < 2) continue;
    const offsetY = parseFloat(nums[1]!);
    if (!Number.isFinite(offsetY) || Math.abs(offsetY) < MIN_EDGE_PX) continue;
    const blur = nums[2] ? parseFloat(nums[2]) : 0;
    const spread = nums[3] ? parseFloat(nums[3]) : 0;
    if (Math.abs(blur) >= MIN_EDGE_PX || Math.abs(spread) >= MIN_EDGE_PX) continue;
    const colorMatch = layer.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/i);
    if (!colorMatch) continue;
    return {
      edge: offsetY < 0 ? "top" : "bottom",
      color: colorMatch[0],
    };
  }
  return null;
}

/** @deprecated use boxShadowEdgeHairline */
export function boxShadowTopHairlineColor(boxShadow: string | undefined): string | null {
  const edge = boxShadowEdgeHairline(boxShadow);
  return edge?.edge === "top" ? edge.color : null;
}

function hasFullBoxBorder(styles: DomSnapshotStyles): boolean {
  const widths = [
    parseEdgeWidth(styles.borderTopWidth),
    parseEdgeWidth(styles.borderRightWidth),
    parseEdgeWidth(styles.borderBottomWidth),
    parseEdgeWidth(styles.borderLeftWidth),
  ];
  if (!widths.every((w) => w >= MIN_EDGE_PX)) return false;
  const colors = [
    styles.borderTopColor,
    styles.borderRightColor,
    styles.borderBottomColor,
    styles.borderLeftColor,
  ];
  return colors.filter(isVisibleCssColor).length >= 4;
}

export type StructuralHairlineOpts = {
  /** Emit four edge rects for full box borders (outline CTAs) when frame stroke is missing. */
  includeFullBoxBorder?: boolean;
};

/** Detect top/bottom hairlines from computed border + box-shadow (PML uses both patterns). */
export function structuralHairlinesFromStyles(
  styles: DomSnapshotStyles,
  width: number,
  height: number,
  opts?: StructuralHairlineOpts,
): StructuralHairline[] {
  const lines: StructuralHairline[] = [];
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const skipBorderEdges = hasFullBoxBorder(styles) && opts?.includeFullBoxBorder !== true;

  if (!skipBorderEdges) {
    const topBorderW = parseEdgeWidth(styles.borderTopWidth);
    if (topBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderTopColor)) {
      lines.push({
        edge: "top",
        x: 0,
        y: 0,
        width: w,
        height: Math.max(1, Math.round(topBorderW)),
        color: styles.borderTopColor!.trim(),
      });
    }

    const bottomBorderW = parseEdgeWidth(styles.borderBottomWidth);
    if (bottomBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderBottomColor)) {
      lines.push({
        edge: "bottom",
        x: 0,
        y: Math.max(0, h - Math.max(1, Math.round(bottomBorderW))),
        width: w,
        height: Math.max(1, Math.round(bottomBorderW)),
        color: styles.borderBottomColor!.trim(),
      });
    }

    const leftBorderW = parseEdgeWidth(styles.borderLeftWidth);
    if (leftBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderLeftColor)) {
      lines.push({
        edge: "left",
        x: 0,
        y: 0,
        width: Math.max(1, Math.round(leftBorderW)),
        height: h,
        color: styles.borderLeftColor!.trim(),
      });
    }

    const rightBorderW = parseEdgeWidth(styles.borderRightWidth);
    if (rightBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderRightColor)) {
      lines.push({
        edge: "right",
        x: Math.max(0, w - Math.max(1, Math.round(rightBorderW))),
        y: 0,
        width: Math.max(1, Math.round(rightBorderW)),
        height: h,
        color: styles.borderRightColor!.trim(),
      });
    }
  }

  if (!lines.some((l) => l.edge === "top")) {
    const shadowTop = boxShadowEdgeHairline(styles.boxShadow);
    if (shadowTop?.edge === "top") {
      lines.push({ edge: "top", x: 0, y: 0, width: w, height: 1, color: shadowTop.color });
    }
  }

  if (!lines.some((l) => l.edge === "bottom")) {
    const shadowBottom = boxShadowEdgeHairline(styles.boxShadow);
    if (shadowBottom?.edge === "bottom") {
      lines.push({
        edge: "bottom",
        x: 0,
        y: Math.max(0, h - 1),
        width: w,
        height: 1,
        color: shadowBottom.color,
      });
    }
  }

  return lines;
}
