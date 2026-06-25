"use client";

import { Diamond } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { findInstanceRoot, groupComponentMasters, listComponentMasters } from "@/lib/componentModel";
import { cn } from "@/lib/utils";

/** Figma-like purple component marker on frame corners. */
export function ComponentCanvasMarker({ nodeId }: { nodeId: string }) {
  const node = useEditorStore((s) => s.nodes[nodeId]);
  const nodes = useEditorStore((s) => s.nodes);
  if (!node) return null;

  const isMaster = Boolean(node.isComponent);
  const isSetContainer = Boolean(node.isComponentSet);
  const isInstance = nodeId === findInstanceRoot(nodes, nodeId) && Boolean(node.sourceComponentId);
  if (!isMaster && !isInstance && !isSetContainer) return null;

  const variantSet =
    isMaster &&
    node.variantGroupId &&
    (groupComponentMasters(listComponentMasters(nodes), nodes).find((g) => g.id === node.variantGroupId)
      ?.variants.length ?? 0) > 1;

  return (
    <div
      className="pointer-events-none absolute left-1 top-1 z-[2] flex items-center gap-0.5"
      aria-hidden
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-sm",
          isSetContainer
            ? "border border-dashed border-violet-200 bg-violet-400/90 text-white shadow-sm"
            : isMaster
            ? "bg-violet-400 text-white shadow-sm"
            : "border border-violet-300 bg-transparent text-violet-200",
          variantSet && isMaster && "ring-1 ring-dashed ring-violet-200/80",
        )}
      >
        <Diamond className="h-2.5 w-2.5" strokeWidth={2} fill={isMaster || isSetContainer ? "currentColor" : "none"} />
      </span>
    </div>
  );
}
