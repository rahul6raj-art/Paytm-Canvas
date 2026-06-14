import type { LayoutMode } from "@/lib/autoLayout";
import type { LayoutSizingMode } from "@/lib/autoLayout";
import type { DomSnapshotNode, DesignLayout, LayoutKind } from "@/lib/webImport/types";
import {
  isAuto,
  isPercent,
  mapCounterAxisAlign,
  mapPrimaryAxisAlign,
  parsePx,
} from "@/lib/webImport/cssParseUtils";

export function analyzeLayout(node: DomSnapshotNode, parent?: DomSnapshotNode): DesignLayout {
  const styles = inferDisplayFromClassName(node);
  const display = (styles.display ?? "").toLowerCase();
  const position = (node.styles.position ?? "static").toLowerCase();

  if (position === "absolute" || position === "fixed" || position === "sticky") {
    return {
      kind: "absolute",
      layoutPositioning: "absolute",
      ...inferSizing(node, parent),
    };
  }

  if (display === "flex" || display === "inline-flex") {
    return analyzeFlexLayout({ ...node, styles }, parent);
  }

  if (display === "grid" || display === "inline-grid") {
    return analyzeGridLayout({ ...node, styles }, parent);
  }

  if (display === "inline" || display === "inline-block") {
    return {
      kind: "inline",
      layoutPositioning: "auto",
      ...inferSizing(node, parent),
    };
  }

  if (node.children.length > 1) {
    return {
      kind: "stack",
      layoutMode: inferStackDirection(node, parent),
      layoutGap: inferStackGap(node),
      layoutPositioning: "auto",
      ...inferSizing(node, parent),
    };
  }

  return {
    kind: "none",
    layoutPositioning: "auto",
    ...inferSizing(node, parent),
  };
}

function inferDisplayFromClassName(node: DomSnapshotNode): DomSnapshotNode["styles"] {
  const styles = { ...node.styles };
  let display = (styles.display ?? "").toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  if ((display === "block" || display === "inline" || display === "" || display === "initial") && /\bflex\b/.test(cls)) {
    styles.display = "flex";
    if (!styles.flexDirection) {
      if (/\bflex-col\b/.test(cls)) styles.flexDirection = "column";
      else if (/\bflex-row\b/.test(cls)) styles.flexDirection = "row";
    }
  }
  if ((display === "block" || display === "" || display === "initial") && /\bgrid\b/.test(cls)) {
    styles.display = "grid";
    const cols = cls.match(/\bgrid-cols-(\d+)\b/);
    if (cols && !styles.gridTemplateColumns) {
      styles.gridTemplateColumns = `repeat(${cols[1]}, minmax(0, 1fr))`;
    }
  }
  const tailwindGap = inferTailwindGapPx(cls);
  if (tailwindGap != null && !parsePx(styles.gap)) {
    styles.gap = `${tailwindGap}px`;
  }
  return styles;
}

function inferTailwindGapPx(className: string): number | null {
  const gap = className.match(/\bgap-(?:x-|y-)?(\d+(?:\.\d+)?)\b/);
  if (gap) return tailwindSpacingPx(gap[1]!);
  const spaceY = className.match(/\bspace-y-(\d+(?:\.\d+)?)\b/);
  if (spaceY) return tailwindSpacingPx(spaceY[1]!);
  const spaceX = className.match(/\bspace-x-(\d+(?:\.\d+)?)\b/);
  if (spaceX) return tailwindSpacingPx(spaceX[1]!);
  return null;
}

/** Tailwind default spacing scale (4px per unit at 1). */
function tailwindSpacingPx(token: string): number {
  const n = parseFloat(token);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 4);
}

function analyzeFlexLayout(node: DomSnapshotNode, parent?: DomSnapshotNode): DesignLayout {
  const dir = (node.styles.flexDirection ?? "row").toLowerCase();
  const layoutMode: LayoutMode = dir.startsWith("column") ? "vertical" : "horizontal";
  const gap =
    parsePx(node.styles.gap) ??
    parsePx(node.styles.rowGap) ??
    parsePx(node.styles.columnGap) ??
    0;

  return {
    kind: "flex",
    layoutMode,
    layoutGap: gap,
    layoutWrap: (node.styles.flexWrap ?? "").includes("wrap"),
    paddingTop: parsePx(node.styles.paddingTop, 0),
    paddingRight: parsePx(node.styles.paddingRight, 0),
    paddingBottom: parsePx(node.styles.paddingBottom, 0),
    paddingLeft: parsePx(node.styles.paddingLeft, 0),
    primaryAxisAlign: mapPrimaryAxisAlign(node.styles.justifyContent),
    counterAxisAlign: mapCounterAxisAlign(node.styles.alignItems),
    layoutPositioning: "auto",
    ...inferSizing(node, parent),
  };
}

function analyzeGridLayout(node: DomSnapshotNode, parent?: DomSnapshotNode): DesignLayout {
  const gap =
    parsePx(node.styles.gap) ??
    parsePx(node.styles.rowGap) ??
    parsePx(node.styles.columnGap) ??
    0;
  const cols = countGridColumns(node.styles.gridTemplateColumns);
  const flow = (node.styles.gridAutoFlow ?? "row").toLowerCase();
  const layoutMode: LayoutMode =
    cols > 1 ? "horizontal" : flow.includes("column") ? "horizontal" : "vertical";

  return {
    kind: "grid",
    layoutMode,
    layoutGap: gap,
    layoutWrap: cols > 1 && node.children.length > cols,
    gridTemplateColumns: node.styles.gridTemplateColumns,
    gridTemplateRows: node.styles.gridTemplateRows,
    gridGap: gap,
    paddingTop: parsePx(node.styles.paddingTop, 0),
    paddingRight: parsePx(node.styles.paddingRight, 0),
    paddingBottom: parsePx(node.styles.paddingBottom, 0),
    paddingLeft: parsePx(node.styles.paddingLeft, 0),
    primaryAxisAlign: "start",
    counterAxisAlign: "stretch",
    layoutPositioning: "auto",
    ...inferSizing(node, parent),
  };
}

function countGridColumns(template: string | undefined): number {
  if (!template) return 1;
  const t = template.trim();
  if (!t || t === "none") return 1;
  const repeat = t.match(/repeat\(\s*(\d+)/i);
  if (repeat) return Math.max(1, parseInt(repeat[1]!, 10));
  const tracks = t.split(/\s+/).filter((part) => part && part !== "none");
  return Math.max(1, tracks.length);
}

function inferStackDirection(node: DomSnapshotNode, parent?: DomSnapshotNode): LayoutMode {
  if (!node.children.length) return "vertical";
  const first = node.children[0]!;
  const last = node.children[node.children.length - 1]!;
  const dx = Math.abs(last.rect.x - first.rect.x);
  const dy = Math.abs(last.rect.y - first.rect.y);
  return dx > dy ? "horizontal" : "vertical";
}

function inferStackGap(node: DomSnapshotNode): number {
  if (node.children.length < 2) return 0;
  const layoutMode = inferStackDirection(node);
  let total = 0;
  let count = 0;
  for (let i = 1; i < node.children.length; i++) {
    const prev = node.children[i - 1]!;
    const cur = node.children[i]!;
    const gap =
      layoutMode === "horizontal"
        ? cur.rect.x - (prev.rect.x + prev.rect.width)
        : cur.rect.y - (prev.rect.y + prev.rect.height);
    if (gap >= 0 && gap < 200) {
      total += gap;
      count++;
    }
  }
  return count ? Math.round(total / count) : 0;
}

function inferSizing(
  node: DomSnapshotNode,
  parent?: DomSnapshotNode,
): Pick<
  DesignLayout,
  "layoutSizingHorizontal" | "layoutSizingVertical" | "layoutGrow"
> {
  const grow = parseFloat(node.styles.flexGrow ?? "0");
  const width = node.styles.width;
  const height = node.styles.height;

  let layoutSizingHorizontal: LayoutSizingMode = "fixed";
  let layoutSizingVertical: LayoutSizingMode = "fixed";

  if (isPercent(width) || grow > 0 || width === "100%") {
    layoutSizingHorizontal = "fill";
  } else if (isAuto(width) || width === "fit-content" || width === "max-content") {
    layoutSizingHorizontal = "hug";
  } else if (parent && isFlexChild(parent, node)) {
    layoutSizingHorizontal = inferFlexChildSizing(node, "horizontal");
  }

  if (isPercent(height) || height === "100%") {
    layoutSizingVertical = "fill";
  } else if (isAuto(height) || height === "fit-content" || height === "max-content") {
    layoutSizingVertical = "hug";
  } else if (parent && isFlexChild(parent, node)) {
    layoutSizingVertical = inferFlexChildSizing(node, "vertical");
  }

  if (node.tagName.toLowerCase() === "img" && isAuto(width) && isAuto(height)) {
    layoutSizingHorizontal = "fixed";
    layoutSizingVertical = "fixed";
  }

  return {
    layoutSizingHorizontal,
    layoutSizingVertical,
    layoutGrow: Number.isFinite(grow) && grow > 0 ? grow : undefined,
  };
}

function isFlexChild(parent: DomSnapshotNode, _child: DomSnapshotNode): boolean {
  const d = (parent.styles.display ?? "").toLowerCase();
  return d === "flex" || d === "inline-flex";
}

function inferFlexChildSizing(
  node: DomSnapshotNode,
  axis: "horizontal" | "vertical",
): LayoutSizingMode {
  const alignSelf = (node.styles.alignSelf ?? "").toLowerCase();
  const grow = parseFloat(node.styles.flexGrow ?? "0");
  const basis = node.styles.flexBasis;
  const size = axis === "horizontal" ? node.styles.width : node.styles.height;

  if (grow > 0 || isPercent(size) || basis === "0" || basis === "0px") return "fill";
  if (alignSelf === "stretch") return "fill";
  if (isAuto(size)) return "hug";
  return "fixed";
}

export function childBoundsRelativeToParent(
  child: DomSnapshotNode,
  parent: DomSnapshotNode,
  layout: DesignLayout,
): { x: number; y: number; width: number; height: number } {
  const w = Math.max(1, Math.round(child.rect.width));
  const h = Math.max(1, Math.round(child.rect.height));

  if (layout.kind === "flex" || layout.kind === "grid") {
    return {
      x: Math.max(0, Math.round(child.rect.x - parent.rect.x)),
      y: Math.max(0, Math.round(child.rect.y - parent.rect.y)),
      width: w,
      height: h,
    };
  }

  return {
    x: Math.max(0, Math.round(child.rect.x - parent.rect.x)),
    y: Math.max(0, Math.round(child.rect.y - parent.rect.y)),
    width: w,
    height: h,
  };
}

export function isLayoutContainer(layout: DesignLayout): boolean {
  return layout.kind === "flex" || layout.kind === "grid" || layout.kind === "stack";
}
