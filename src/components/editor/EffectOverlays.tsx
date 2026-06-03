"use client";

import type { CSSProperties } from "react";
import {
  noisePatternDataUrl,
  texturePatternDataUrl,
  type EffectOverlayLayer,
} from "@/lib/nodeEffects";

export function EffectOverlays({ layers }: { layers: EffectOverlayLayer[] }) {
  if (!layers.length) return null;
  return (
    <>
      {layers.map((layer, i) => {
        if (layer.kind === "noise") {
          return (
            <div
              key={`noise-${i}`}
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                opacity: layer.opacity,
                backgroundImage: noisePatternDataUrl(layer.density, layer.mono),
                backgroundSize: "128px 128px",
                mixBlendMode: "overlay",
              }}
              aria-hidden
            />
          );
        }
        return (
          <div
            key={`texture-${i}`}
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              opacity: layer.opacity,
              backgroundImage: texturePatternDataUrl(layer.scale),
              backgroundSize: `${Math.round(16 * layer.scale)}px ${Math.round(16 * layer.scale)}px`,
              mixBlendMode: layer.blendMode as CSSProperties["mixBlendMode"],
            }}
            aria-hidden
          />
        );
      })}
    </>
  );
}
