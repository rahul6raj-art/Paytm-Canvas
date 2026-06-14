"use client";

import { canvasSwapPinkDotStyle } from "@/lib/canvasVisual";

/** Figma-style pink swap handle — fixed screen pixels (render in screen overlay space). */
export function SwapPinkDot({
  left,
  top,
  variant = "solid",
  pulse = false,
}: {
  left: number;
  top: number;
  variant?: "solid" | "ring";
  pulse?: boolean;
}) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        left,
        top,
        transform: "translate(-50%, -50%)",
        ...canvasSwapPinkDotStyle(variant),
        animation: pulse ? "swap-pink-pulse 0.85s ease-in-out infinite" : undefined,
      }}
    />
  );
}
