"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getDragPreviewSnapshot,
  getResizePreviewEpoch,
  subscribeDragPreview,
  subscribeResizePreview,
} from "@/lib/canvasEphemeralTransform";
import {
  getEllipseArcPreview,
  subscribeEllipseArcPreview,
} from "@/lib/shapes/ellipseArcDrag";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { useEditorStore } from "@/stores/useEditorStore";
import type { SceneRendererProps } from "./RendererTypes";
import { TextFidelityDebugOverlay } from "@/components/editor/TextFidelityDebugOverlay";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import { getTextLayoutEpoch, subscribeTextLayoutEpoch } from "@/lib/text/textLayoutEpoch";

const SCENE_SIZE = 6000;

export function SvgSceneRenderer({
  rootIds,
  nodes,
  childOrder,
  assets,
  designTokens,
  editingTextId,
  selectedIds,
  zoom = 1,
  showDebugBadge = true,
  interactionPreview = false,
}: SceneRendererProps & { showDebugBadge?: boolean; interactionPreview?: boolean }) {
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const resizeEpoch = useSyncExternalStore(subscribeResizePreview, getResizePreviewEpoch, () => 0);
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  const ellipseArcPreview = useSyncExternalStore(
    subscribeEllipseArcPreview,
    getEllipseArcPreview,
    () => null,
  );
  const textLayoutEpoch = useSyncExternalStore(subscribeTextLayoutEpoch, getTextLayoutEpoch, () => 0);

  const nodesForScene = useMemo(() => {
    if (!interactionPreview || transformInteractionMode !== "resize") return nodes;
    void resizeEpoch;
    return useEditorStore.getState().nodes;
  }, [nodes, interactionPreview, transformInteractionMode, resizeEpoch]);

  const excludeNodeIds = useMemo(
    () => (editingTextId ? new Set([editingTextId]) : undefined),
    [editingTextId],
  );

  const activeDragPreview =
    interactionPreview && dragPreview?.movingIds.length ? dragPreview : undefined;

  const scene = useMemo(
    () =>
      buildSvgScene({
        rootIds,
        nodes: nodesForScene,
        childOrder,
        assets,
        designTokens,
        excludeNodeIds,
        zoom,
        dragPreview: activeDragPreview,
        ellipseArcPreview,
        objectEditModeNodeId,
        selectedIds,
      }),
    [
      rootIds,
      nodesForScene,
      childOrder,
      assets,
      designTokens,
      excludeNodeIds,
      zoom,
      activeDragPreview,
      ellipseArcPreview,
      objectEditModeNodeId,
      selectedIds,
      textLayoutEpoch,
    ],
  );

  const uniqueWarnings = useMemo(() => [...new Set(scene.warnings)], [scene.warnings]);

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        width={SCENE_SIZE}
        height={SCENE_SIZE}
        viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`}
        shapeRendering="geometricPrecision"
        aria-hidden
        focusable="false"
      >
        {scene.defs ? <defs dangerouslySetInnerHTML={{ __html: scene.defs }} /> : null}
        <g data-svg-scene dangerouslySetInnerHTML={{ __html: scene.body }} />
        {/* Root frame labels are rendered as DOM via RootFrameLabels (Canvas.tsx). */}
      </svg>

      {showDebugBadge ? (
        <EditorHintWrap title="Experimental SVG scene renderer (NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=svg)">
          <div className="absolute right-3 top-3 z-50 max-w-[220px] rounded border border-[#18a0fb]/40 bg-white/95 px-2 py-1 text-micro font-medium text-[#333] shadow-sm">
            <div className="text-[#18a0fb]">SVG renderer</div>
            <div className="mt-0.5 tabular-nums text-[#666]">{scene.renderedNodeCount} nodes</div>
            {uniqueWarnings.length > 0 ? (
              <div className="mt-1 text-nano font-normal leading-tight text-amber-700">
                {uniqueWarnings.slice(0, 3).join(" · ")}
                {uniqueWarnings.length > 3 ? ` (+${uniqueWarnings.length - 3})` : ""}
              </div>
            ) : null}
          </div>
        </EditorHintWrap>
      ) : null}
      <TextFidelityDebugOverlay />
    </>
  );
}
