"use client";

import { useMemo } from "react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  BOOLEAN_OPERATION_LABELS,
  buildCompositePathDForGroup,
  buildMaskClipPathDForGroup,
  type BooleanOperation,
} from "@/lib/booleanGeometry";
import { svgSafeId } from "@/lib/svgMarkupCore";

function BooleanBadge({ operation }: { operation: BooleanOperation }) {
  return (
    <div className="pointer-events-none absolute -right-1 -top-1 z-10 rounded bg-[#18a0fb] px-1 py-px text-[8px] font-bold uppercase leading-none text-white shadow-sm">
      {BOOLEAN_OPERATION_LABELS[operation].slice(0, 3)}
    </div>
  );
}

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
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const op = node.booleanOperation ?? "union";
  const editing = objectEditModeNodeId === groupId;

  const composite = useMemo(() => {
    if (editing) return null;
    if (node.flattenedPathData) {
      const fillRule: "nonzero" | "evenodd" =
        op === "subtract" || op === "exclude" ? "evenodd" : "nonzero";
      return {
        d: node.flattenedPathData,
        fillRule,
        fill: node.fill ?? "#0d99ff",
      };
    }
    return buildCompositePathDForGroup(groupId, childIds, nodes, op);
  }, [editing, node.flattenedPathData, node.fill, groupId, childIds, nodes, op]);

  if (editing) {
    return (
      <>
        {childrenTree}
        <BooleanBadge operation={op} />
      </>
    );
  }

  if (composite) {
    const fill = node.fillEnabled === false ? "none" : composite.fill;

    if (op === "intersect" && childIds.length >= 2) {
      let clipped: React.ReactNode = (
        <div className="relative h-full w-full">{childrenTree}</div>
      );
      const defs: React.ReactNode[] = [];
      for (const cid of childIds) {
        const clipD = buildMaskClipPathDForGroup(groupId, cid, nodes);
        if (!clipD) continue;
        const clipId = `pc-int-${svgSafeId(groupId)}-${svgSafeId(cid)}`;
        defs.push(
          <clipPath key={clipId} id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipD} />
          </clipPath>,
        );
        clipped = (
          <div key={cid} className="relative h-full w-full" style={{ clipPath: `url(#${clipId})` }}>
            {clipped}
          </div>
        );
      }
      return (
        <>
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={Math.max(1, node.width)}
            height={Math.max(1, node.height)}
            aria-hidden
          >
            <defs>{defs}</defs>
          </svg>
          {clipped}
          <BooleanBadge operation={op} />
        </>
      );
    }

    return (
      <>
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={Math.max(1, node.width)}
          height={Math.max(1, node.height)}
          aria-hidden
        >
          <path
            d={composite.d}
            fill={fill}
            fillRule={composite.fillRule}
            fillOpacity={node.fillOpacity ?? 1}
            stroke={node.strokeColor && (node.strokeWidth ?? 0) > 0 ? node.strokeColor : "none"}
            strokeWidth={node.strokeWidth ?? 0}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden>
          {childrenTree}
        </div>
        <BooleanBadge operation={op} />
      </>
    );
  }

  return (
    <>
      {childrenTree}
      <BooleanBadge operation={op} />
    </>
  );
}

/** Mask group — clips content to mask shape. */
export function MaskGroupView({
  groupId,
  node,
  maskNode,
  contentTree,
  maskPreview,
}: {
  groupId: string;
  node: EditorNode;
  maskNode: EditorNode | null;
  contentTree: React.ReactNode;
  maskPreview?: React.ReactNode;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const maskId = node.maskId;
  const safeId = svgSafeId(groupId);
  const clipId = `pc-mask-clip-${safeId}`;

  const clipD = useMemo(() => {
    if (!maskId) return null;
    return buildMaskClipPathDForGroup(groupId, maskId, nodes);
  }, [groupId, maskId, nodes]);

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
      <div
        className="relative h-full w-full"
        style={clipD ? { clipPath: `url(#${clipId})` } : undefined}
      >
        {contentTree}
      </div>
      {maskPreview}
    </>
  );
}

export function MaskPreviewOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
      {children}
    </div>
  );
}
