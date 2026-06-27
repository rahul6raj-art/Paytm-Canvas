import type { LayoutMode } from "@/lib/autoLayout";
import type { EditorNode } from "@/stores/useEditorStore";

/** Promote obvious row/column stacks to auto-layout before reflow (multi-pass). */
export function promoteInferredAutoLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  passes = 5,
): Record<string, EditorNode> {
  let next = { ...nodes };
  for (let i = 0; i < passes; i++) {
    const prev = next;
    next = promoteInferredAutoLayoutOnce(next, childOrder);
    if (JSON.stringify(prev) === JSON.stringify(next)) break;
  }
  return next;
}

function promoteInferredAutoLayoutOnce(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const next = { ...nodes };

  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = next[parentId];
    if (!parent || parent.type !== "frame") continue;
    if ((parent.layoutMode ?? "none") !== "none") continue;
    if (kids.length < 2) continue;

    const visible = kids
      .map((id) => next[id])
      .filter((n): n is EditorNode => Boolean(n?.visible));
    if (visible.length < 2) continue;

    const inferred = inferStackLayout(visible);
    if (!inferred) continue;

    next[parentId] = {
      ...parent,
      layoutMode: inferred.layoutMode,
      layoutGap: inferred.gap,
      primaryAxisAlign: parent.primaryAxisAlign ?? "start",
      counterAxisAlign: parent.counterAxisAlign ?? "start",
      layoutDirty: true,
    };
  }

  return next;
}

function inferStackLayout(
  children: EditorNode[],
): { layoutMode: LayoutMode; gap: number } | null {
  const xs = children.map((c) => c.x);
  const ys = children.map((c) => c.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);

  const horizontal = ySpread < 48 && xSpread > 48;
  const vertical = xSpread < 96 && ySpread > 24;
  if (!horizontal && !vertical) return null;

  const layoutMode: LayoutMode = horizontal ? "horizontal" : "vertical";
  const sorted = [...children].sort((a, b) =>
    layoutMode === "horizontal" ? a.x - b.x : a.y - b.y,
  );
  let total = 0;
  let count = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const gap =
      layoutMode === "horizontal"
        ? cur.x - (prev.x + prev.width)
        : cur.y - (prev.y + prev.height);
    if (gap >= 0 && gap < 200) {
      total += gap;
      count++;
    }
  }
  return { layoutMode, gap: count ? Math.round(total / count) : 0 };
}
