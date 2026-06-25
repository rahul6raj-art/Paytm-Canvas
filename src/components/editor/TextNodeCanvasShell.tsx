"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { DesignToken } from "@/lib/designTokens";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { resolveNodeForDisplay } from "@/lib/components/resolveForDisplay";
import { layerBlendCanvasStyle } from "@/lib/layerBlendMode";
import { buildTextCanvasEffectRenderStyle } from "@/lib/nodeEffects";
import type { EditorNode } from "@/stores/useEditorStore";
import { EffectOverlays } from "./EffectOverlays";
import { cn } from "@/lib/utils";

type TextNodeCanvasShellProps = {
  nodeId: string;
  node: EditorNode;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  designTokens: Record<string, DesignToken>;
  className?: string;
  children: ReactNode;
};

/** Applies layer effects to native canvas text (SVG scene excludes text nodes). */
export function TextNodeCanvasShell({
  nodeId,
  node,
  nodes,
  childOrder,
  designTokens,
  className,
  children,
}: TextNodeCanvasShellProps) {
  const resolved = useMemo(() => {
    const merged = resolveNodeForDisplay(nodes, childOrder, nodeId) ?? node;
    return resolveNodeWithDesignTokens(merged, designTokens);
  }, [nodeId, node, nodes, childOrder, designTokens]);

  const { shellStyle, contentFilter, effectOverlays } = useMemo(() => {
    const hasRichEff = !!(resolved.effects && resolved.effects.length > 0);
    const er = buildTextCanvasEffectRenderStyle(hasRichEff ? resolved.effects : undefined);
    const glassBg =
      er.glassBackground && resolved.fillEnabled !== false ? er.glassBackground : undefined;

    const shellStyle: CSSProperties = {
      overflow: "visible",
      ...(glassBg ? { backgroundColor: glassBg } : {}),
      ...(er.glassBorder ? { border: er.glassBorder, boxSizing: "border-box" } : {}),
      backdropFilter: er.backdropFilter,
      ...layerBlendCanvasStyle(resolved),
    };

    return {
      shellStyle,
      contentFilter: er.filter,
      effectOverlays: er.overlayLayers,
    };
  }, [resolved]);

  return (
    <div className={cn("relative h-full w-full", className)} style={shellStyle}>
      <div className="h-full w-full" style={contentFilter ? { filter: contentFilter } : undefined}>
        {children}
      </div>
      {effectOverlays?.length ? <EffectOverlays layers={effectOverlays} /> : null}
    </div>
  );
}
