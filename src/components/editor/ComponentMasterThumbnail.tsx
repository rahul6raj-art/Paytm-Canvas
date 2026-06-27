"use client";

import { useMemo } from "react";
import { Component } from "lucide-react";
import { buildComponentMasterThumbnail } from "@/lib/components/componentMasterThumbnail";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

function ThumbnailFallback({
  width,
  height,
  compact,
}: {
  width: number;
  height: number;
  compact?: boolean;
}) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const ar = w / h;
  const max = compact ? 14 : 40;
  const boxW = ar >= 1 ? max : max * ar;
  const boxH = ar >= 1 ? max / ar : max;

  return (
    <div className="flex h-full w-full items-center justify-center">
      {boxW > 4 && boxH > 4 ? (
        <div
          className="rounded-sm border border-app-border-subtle bg-white/70"
          style={{ width: boxW, height: boxH }}
        />
      ) : (
        <Component className="h-3.5 w-3.5 text-app-subtle" strokeWidth={1.75} />
      )}
    </div>
  );
}

export function ComponentMasterThumbnail({
  masterId,
  width,
  height,
  compact = false,
}: {
  masterId: string;
  width: number;
  height: number;
  compact?: boolean;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const assets = useEditorStore((s) => s.assets);
  const designTokens = useEditorStore((s) => s.designTokens);
  const canvasColorMode = useEditorStore((s) => s.canvasColorMode);
  const projectCssSources = useEditorStore((s) => s.projectCssSources);

  const thumbnail = useMemo(
    () =>
      buildComponentMasterThumbnail(masterId, nodes, childOrder, {
        assets,
        designTokens,
        colorMode: canvasColorMode,
        cssSources: projectCssSources,
      }),
    [masterId, nodes, childOrder, assets, designTokens, canvasColorMode, projectCssSources],
  );

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded border border-app-border-subtle bg-[#f4f4f5]",
        compact ? "h-7 w-7" : "h-14 w-full",
      )}
      aria-hidden
    >
      {thumbnail ? (
        <div
          className="flex h-full w-full items-center justify-center p-1 [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: thumbnail.svg }}
        />
      ) : (
        <ThumbnailFallback width={width} height={height} compact={compact} />
      )}
    </div>
  );
}
