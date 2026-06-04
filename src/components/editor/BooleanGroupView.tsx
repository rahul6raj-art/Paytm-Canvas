"use client";

import { useMemo } from "react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { fillCss } from "@/lib/color";
import { buildBooleanRenderForGroup, buildMaskClipPathDForGroup } from "@/lib/booleanGeometry";
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
    const fill =
      node.fillEnabled === false
        ? "none"
        : node.fill
          ? fillCss(node.fill, node.fillOpacity, node.fillEnabled)
          : booleanRender.fill;
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
          fill={fill}
        />
        <div className="pointer-events-none absolute inset-0 hidden" aria-hidden>
          {childrenTree}
        </div>
      </>
    );
  }

  return <>{childrenTree}</>;
}

/** Mask group — clips content to mask shape. */
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
  const maskId = node.maskId;
  const maskSelected = Boolean(maskId && selectedIds.includes(maskId));
  const safeId = svgSafeId(groupId);
  const clipId = `pc-mask-clip-${safeId}`;

  const maskChildOrder = useEditorStore((s) => s.childOrder);
  const clipD = useMemo(() => {
    if (!maskId) return null;
    return buildMaskClipPathDForGroup(groupId, maskId, nodes, maskChildOrder);
  }, [groupId, maskId, nodes, maskChildOrder]);

  return (
    <>
      {clipD ? (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={Math.max(1, node.width)}
          height={Math.max(1, node.height)}
          aria-hidden
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={clipD} />
            </clipPath>
          </defs>
        </svg>
      ) : null}
      <div className="relative h-full w-full">
        {maskLayer && maskSelected ? (
          <div className="absolute inset-0 z-0" data-mask-shape>
            {maskLayer}
          </div>
        ) : null}
        <div
          className="relative z-10 h-full w-full"
          style={clipD ? { clipPath: `url(#${clipId})` } : undefined}
        >
          {contentTree}
        </div>
      </div>
    </>
  );
}
