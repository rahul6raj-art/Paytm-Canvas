"use client";

import { useMemo } from "react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { buildBooleanRenderForGroup, buildMaskClipPathDForGroup } from "@/lib/booleanGeometry";
import {
  maskCompositorUsesSvgMask,
  resolveMaskCompositorMode,
  shouldShowMaskLayer,
} from "@/lib/mask";
import { svgSafeId } from "@/lib/svgMarkupCore";
import { BooleanCompositeSvg } from "./BooleanCompositeSvg";

/** Renders boolean group: composite SVG preview, or children while editing. */
export function BooleanGroupView({
  groupId,
  node,
  childIds,
  childrenTree,
}: {
  groupId: string;
  node: EditorNode;
  childIds: string[];
  childrenTree: React.ReactNode;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrderMap = useEditorStore((s) => s.childOrder);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const op = node.booleanOperation ?? "union";
  const editing = objectEditModeNodeId === groupId;

  const booleanRender = useMemo(() => {
    if (editing) return null;
    return buildBooleanRenderForGroup(groupId, childIds, nodes, op, childOrderMap);
  }, [editing, groupId, childIds, nodes, childOrderMap, op]);

  if (editing) {
    return <>{childrenTree}</>;
  }

  if (booleanRender) {
    const w = Math.max(1, node.width);
    const h = Math.max(1, node.height);

    return (
      <>
        <BooleanCompositeSvg
          render={booleanRender}
          groupId={groupId}
          node={node}
          width={w}
          height={h}
          fallbackFill={booleanRender.fill}
        />
        <div className="pointer-events-none absolute inset-0 hidden" aria-hidden>
          {childrenTree}
        </div>
      </>
    );
  }

  return <>{childrenTree}</>;
}

/** Mask group — Figma-like compositor (outline clipPath or alpha/luminance SVG mask). */
export function MaskGroupView({
  groupId,
  node,
  maskNode,
  contentTree,
  maskLayer,
}: {
  groupId: string;
  node: EditorNode;
  maskNode: EditorNode | null;
  contentTree: React.ReactNode;
  /** Mask shape layer (below content, still selectable). */
  maskLayer?: React.ReactNode;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const maskId = node.maskId;
  const safeId = svgSafeId(groupId);
  const clipId = `pc-mask-clip-${safeId}`;
  const alphaMaskId = `pc-mask-alpha-${safeId}`;

  const maskChildOrder = useEditorStore((s) => s.childOrder);
  const clip = useMemo(() => {
    if (!maskId) return null;
    return buildMaskClipPathDForGroup(groupId, maskId, nodes, maskChildOrder);
  }, [groupId, maskId, nodes, maskChildOrder]);

  const mode = useMemo(() => {
    if (!maskNode) return "OUTLINE" as const;
    return resolveMaskCompositorMode(node, maskNode);
  }, [node, maskNode]);

  const usesSvgMask = maskCompositorUsesSvgMask(mode);
  const showMaskLayer = shouldShowMaskLayer(node, {
    objectEditModeNodeId,
    selectedIds,
  });

  const maskStyle = useMemo((): React.CSSProperties | undefined => {
    if (!clip) return undefined;
    if (usesSvgMask) {
      return {
        mask: `url(#${alphaMaskId})`,
        WebkitMask: `url(#${alphaMaskId})`,
      };
    }
    return {
      clipPath: `url(#${clipId})`,
      WebkitClipPath: `url(#${clipId})`,
    };
  }, [clip, usesSvgMask, alphaMaskId, clipId]);

  const escapedD = clip?.clipD.replace(/&/g, "&amp;").replace(/"/g, "&quot;") ?? "";

  return (
    <>
      {clip ? (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={Math.max(1, node.width)}
          height={Math.max(1, node.height)}
          aria-hidden
        >
          <defs>
            {usesSvgMask ? (
              <mask
                id={alphaMaskId}
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                style={mode === "LUMINANCE" ? { maskType: "luminance" } : undefined}
              >
                <path d={escapedD} fill="white" fillRule={clip.clipRule} />
              </mask>
            ) : (
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <path d={escapedD} clipRule={clip.clipRule} />
              </clipPath>
            )}
          </defs>
        </svg>
      ) : null}
      <div className="relative h-full w-full">
        {maskLayer && showMaskLayer ? (
          <div className="absolute inset-0 z-0" data-mask-shape>
            {maskLayer}
          </div>
        ) : null}
        <div className="relative z-10 h-full w-full" style={maskStyle}>
          {contentTree}
        </div>
      </div>
    </>
  );
}
