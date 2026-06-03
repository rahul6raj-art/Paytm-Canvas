"use client";

import { useMemo } from "react";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import type { SceneRendererProps } from "./RendererTypes";

const SCENE_SIZE = 6000;

export function SvgSceneRenderer({
  rootIds,
  nodes,
  childOrder,
  assets,
  designTokens,
}: SceneRendererProps) {
  const scene = useMemo(
    () =>
      buildSvgScene({
        rootIds,
        nodes,
        childOrder,
        assets,
        designTokens,
      }),
    [rootIds, nodes, childOrder, assets, designTokens],
  );

  const uniqueWarnings = useMemo(() => [...new Set(scene.warnings)], [scene.warnings]);

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        width={SCENE_SIZE}
        height={SCENE_SIZE}
        viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`}
        aria-hidden
        focusable="false"
      >
        {scene.defs ? <defs dangerouslySetInnerHTML={{ __html: scene.defs }} /> : null}
        <g data-svg-scene dangerouslySetInnerHTML={{ __html: scene.body }} />
        {/* Root frame labels are rendered as DOM via RootFrameLabels (Canvas.tsx). */}
      </svg>

      <div
        className="absolute right-3 top-3 z-50 max-w-[220px] rounded border border-[#18a0fb]/40 bg-white/95 px-2 py-1 text-[10px] font-medium text-[#333] shadow-sm"
        title="Experimental SVG scene renderer (NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=svg)"
      >
        <div className="text-[#18a0fb]">SVG renderer</div>
        <div className="mt-0.5 tabular-nums text-[#666]">{scene.renderedNodeCount} nodes</div>
        {uniqueWarnings.length > 0 ? (
          <div className="mt-1 text-[9px] font-normal leading-tight text-amber-700">
            {uniqueWarnings.slice(0, 3).join(" · ")}
            {uniqueWarnings.length > 3 ? ` (+${uniqueWarnings.length - 3})` : ""}
          </div>
        ) : null}
      </div>
    </>
  );
}
