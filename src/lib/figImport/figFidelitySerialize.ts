import type { FillGradient } from "@/lib/fillGradient";
import type { NodeEffect } from "@/lib/nodeEffects";

export function serializeGradient(g: FillGradient): string {
  const stops = g.stops
    .map((s) => `${s.position}:${s.color}:${s.opacity ?? 1}`)
    .join("|");
  return `${g.kind}:${stops}`;
}

export function serializeEffects(effects: NodeEffect[]): string {
  return effects
    .filter((e) => e.visible)
    .map((e) =>
      [
        e.type,
        e.x ?? 0,
        e.y ?? 0,
        e.blur ?? 0,
        e.spread ?? 0,
        e.color ?? "",
        e.opacity ?? 1,
      ].join(","),
    )
    .join(";");
}
