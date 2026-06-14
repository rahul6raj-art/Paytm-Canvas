"use client";

import { screenPxToWorld } from "@/lib/canvasVisual";
import { resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import type { EditorNode } from "@/stores/useEditorStore";

/** Figma-style path wireframe in vector edit mode (follows corner-radius arcs). */
export function PathEditPathOutline({
  node,
  nodeId,
  zoom,
}: {
  node: EditorNode;
  nodeId: string;
  zoom: number;
}) {
  const d = resolvePathOutlineD(node, nodeId);
  if (!d) return null;
  const strokeW = screenPxToWorld(1, zoom);
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={node.width}
      height={node.height}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="var(--pc-canvas-selection)"
        strokeWidth={strokeW}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
