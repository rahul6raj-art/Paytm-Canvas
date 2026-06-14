import type { EditorNode } from "@/stores/useEditorStore";

/** Resize imported SVG groups/frames to encompass their children (fixes 1×1 group shells). */
export function fitSvgImportGroupBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootId: string,
): Record<string, EditorNode> {
  const out = { ...nodes };

  const fit = (groupId: string): void => {
    const kids = (childOrder[groupId] ?? []).filter((id) => out[id]);
    for (const cid of kids) {
      const c = out[cid];
      if (c && (c.type === "group" || c.type === "frame")) fit(cid);
    }

    if (groupId === rootId) return;

    const g = out[groupId];
    if (!g || (g.type !== "group" && g.type !== "frame")) return;
    if (kids.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const cid of kids) {
      const c = out[cid]!;
      const x0 = c.x;
      const y0 = c.y;
      const x1 = c.x + Math.max(0, c.width);
      const y1 = c.y + Math.max(0, c.height);
      minX = Math.min(minX, x0);
      minY = Math.min(minY, y0);
      maxX = Math.max(maxX, x1);
      maxY = Math.max(maxY, y1);
    }

    if (!Number.isFinite(minX)) return;

    const pad = 0;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxY - minY + pad * 2);
    const dx = minX - pad;
    const dy = minY - pad;

    out[groupId] = {
      ...g,
      x: g.x + dx,
      y: g.y + dy,
      width: w,
      height: h,
    };

    for (const cid of kids) {
      const c = out[cid]!;
      out[cid] = { ...c, x: c.x - dx, y: c.y - dy };
    }
  };

  fit(rootId);
  return out;
}
