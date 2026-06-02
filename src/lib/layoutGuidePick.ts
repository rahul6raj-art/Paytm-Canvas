import type { LayoutGuide } from "@/stores/useEditorStore";

const HIT_SCREEN_PX = 8;

/** World-space hit tolerance from screen pixels. */
export function layoutGuideHitThresholdWorld(zoom: number): number {
  return HIT_SCREEN_PX / Math.max(zoom, 0.01);
}

/** Pick the nearest layout guide at a world point (for selection). */
export function pickLayoutGuideAt(
  worldX: number,
  worldY: number,
  guides: LayoutGuide[],
  zoom: number,
): string | null {
  if (!guides.length) return null;
  const threshold = layoutGuideHitThresholdWorld(zoom);
  let bestId: string | null = null;
  let bestDist = threshold;

  for (const g of guides) {
    const dist =
      g.axis === "v" ? Math.abs(worldX - g.pos) : Math.abs(worldY - g.pos);
    if (dist <= bestDist) {
      bestDist = dist;
      bestId = g.id;
    }
  }
  return bestId;
}
