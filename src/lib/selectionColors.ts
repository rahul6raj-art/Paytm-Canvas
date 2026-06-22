import { normalizeHex } from "@/lib/color";
import { effectiveFillType } from "@/lib/fillGradient";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { nodeFillDisplayHex, nodeSupportsFillColor } from "@/lib/fillAdjust";
import type { EditorNode } from "@/stores/useEditorStore";

export type SelectionColorEntry = {
  /** Stable grouping key: hex + opacity percent */
  id: string;
  hex: string;
  opacity: number;
  nodeIds: string[];
};

export function selectionColorKey(hex: string, opacity: number): string {
  const h = normalizeHex(hex) ?? hex;
  const pct = Math.round(Math.min(1, Math.max(0, opacity)) * 100);
  return `${h}|${pct}`;
}

/** Unique solid fill / text colors across the current multi-selection. */
export function collectSelectionFillColors(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): SelectionColorEntry[] {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible && nodeSupportsFillColor(n);
  });

  const byKey = new Map<string, SelectionColorEntry>();

  for (const id of tops) {
    const n = nodes[id]!;
    if (n.type !== "text") {
      if (n.fillEnabled === false) continue;
      const fillType = effectiveFillType(n);
      if (fillType !== "solid") continue;
    }

    const hex = nodeFillDisplayHex(n);
    const opacity = n.fillOpacity ?? 1;
    const key = selectionColorKey(hex, opacity);
    const existing = byKey.get(key);
    if (existing) {
      existing.nodeIds.push(id);
      continue;
    }
    byKey.set(key, { id: key, hex, opacity, nodeIds: [id] });
  }

  return [...byKey.values()];
}

/** Show selection colors only when the multi-selection has 2+ distinct fills. */
export function shouldShowSelectionColorsSection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  return collectSelectionFillColors(selectedIds, nodes).length > 1;
}
