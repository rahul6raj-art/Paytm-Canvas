"use client";

import { useMemo } from "react";
import { PenLine } from "lucide-react";
import { buildPathLayerIconSpec } from "@/lib/layerPathIcon";
import { cn } from "@/lib/utils";
import type { EditorNode } from "@/stores/useEditorStore";

/** Layers-panel thumbnail of a pen / vector path (Figma-style). */
export function PathLayerIcon({
  node,
  className,
}: {
  node: EditorNode;
  className?: string;
}) {
  const spec = useMemo(() => buildPathLayerIconSpec(node), [node]);

  if (!spec) {
    return <PenLine className={cn("h-3.5 w-3.5 shrink-0 text-app-subtle", className)} strokeWidth={1.75} />;
  }

  return (
    <svg
      viewBox={spec.viewBox}
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0 text-app-subtle", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={spec.d}
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={spec.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
