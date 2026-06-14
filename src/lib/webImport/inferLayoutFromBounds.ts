import type { DesignNode, DomSnapshotNode } from "@/lib/webImport/types";
import type { LayoutMode } from "@/lib/autoLayout";
import { isImportableTextContent } from "@/lib/webImport/textContentHeuristics";

/** Infer auto-layout metadata on containers; preserve browser-measured child positions. */
export function inferLayoutFromChildPositions(node: DesignNode): DesignNode {
  const walk = (n: DesignNode): DesignNode => {
    const children = n.children.map(walk);

    if (children.length >= 2 && (!n.layout.layoutMode || n.layout.layoutMode === "none")) {
      const inferred = inferStackLayout(children);
      if (inferred) {
        return {
          ...n,
          children,
          layout: {
            ...n.layout,
            kind: inferred.kind,
            layoutMode: inferred.layoutMode,
            layoutGap: inferred.gap,
            primaryAxisAlign: "start",
            counterAxisAlign: "start",
          },
        };
      }
    }
    return { ...n, children };
  };
  return walk(node);
}

function inferStackLayout(
  children: DesignNode[],
): { kind: "flex" | "stack"; layoutMode: LayoutMode; gap: number } | null {
  const visible = children.filter((c) => c.style.visible !== false);
  if (visible.length < 2) return null;

  const xs = visible.map((c) => c.bounds.x);
  const ys = visible.map((c) => c.bounds.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);

  const horizontal =
    ySpread < 40 && xSpread > 40;
  const vertical =
    xSpread < 80 && ySpread > 20;

  if (!horizontal && !vertical) return null;

  const layoutMode: LayoutMode = horizontal ? "horizontal" : "vertical";
  const gap = estimateGap(visible, layoutMode);
  return { kind: horizontal ? "flex" : "stack", layoutMode, gap };
}

function estimateGap(children: DesignNode[], layoutMode: LayoutMode): number {
  if (children.length < 2) return 0;
  const sorted = [...children].sort((a, b) =>
    layoutMode === "horizontal" ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y,
  );
  let total = 0;
  let count = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const gap =
      layoutMode === "horizontal"
        ? cur.bounds.x - (prev.bounds.x + prev.bounds.width)
        : cur.bounds.y - (prev.bounds.y + prev.bounds.height);
    if (gap >= 0 && gap < 200) {
      total += gap;
      count++;
    }
  }
  return count ? Math.round(total / count) : 0;
}

/** Strip junk text fields from DOM snapshot before design tree build. */
export function sanitizeDomSnapshotText(root: DomSnapshotNode): DomSnapshotNode {
  const walk = (node: DomSnapshotNode): DomSnapshotNode => {
    const children = node.children.map(walk);
    let text = node.text;
    if (
      text &&
      !isImportableTextContent(text, {
        className: node.className,
        tagName: node.tagName,
        role: node.role,
      })
    ) {
      text = undefined;
    }
    return { ...node, text, children };
  };
  return walk(root);
}
