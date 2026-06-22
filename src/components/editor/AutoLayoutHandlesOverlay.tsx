"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import {
  getAutoLayoutInteractionHandles,
  beginSpacingDrag,
  beginPaddingDrag,
  beginFillDividerDrag,
  subscribeAutoLayoutDragPreview,
  getAutoLayoutDragPreview,
  autoLayoutPaddingGuideSize,
} from "@/lib/autoLayout";
import { shouldClipChildren } from "@/lib/clipChildren";
import {
  worldPointToOverlay,
  worldRectToOverlay,
  screenPxToOverlay,
  type OverlaySpace,
} from "@/lib/canvasOverlaySpace";
import {
  AUTO_LAYOUT_SPACING_LINE_SCREEN_PX,
  AUTO_LAYOUT_SPACING_TICK_SCREEN_PX,
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_VISUAL,
} from "@/lib/canvasVisual";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { useAutoLayoutHandlesGate } from "./useAutoLayoutHandlesGate";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { CanvasEditValueBadge } from "./CanvasEditValueBadge";

function localToWorld(
  parentId: string,
  local: { x: number; y: number },
  nodes: ReturnType<typeof useEditorStore.getState>["nodes"],
  childOrder: ReturnType<typeof useEditorStore.getState>["childOrder"],
): { x: number; y: number } {
  const matrix = getNodeWorldMatrixFromChildOrder(parentId, nodes, childOrder);
  if (matrix) return applyMatrixToPoint(matrix, local);
  const parent = nodes[parentId];
  return { x: (parent?.x ?? 0) + local.x, y: (parent?.y ?? 0) + local.y };
}

function parentLocalToOverlay(
  parentId: string,
  local: { x: number; y: number },
  nodes: ReturnType<typeof useEditorStore.getState>["nodes"],
  childOrder: ReturnType<typeof useEditorStore.getState>["childOrder"],
  overlay: OverlaySpace,
): { x: number; y: number } {
  const world = localToWorld(parentId, local, nodes, childOrder);
  return worldPointToOverlay(world.x, world.y, overlay);
}

const GAP_COLOR = "#ff24ff";
const PAD_COLOR = "#0d99ff";
const HIT_SCREEN_PX = 28;

/** Figma-style spacing, padding, and fill divider handles on auto-layout frames. */
export function AutoLayoutHandlesOverlay() {
  const { show, id } = useAutoLayoutHandlesGate();
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const overlay = useCanvasOverlaySpace();
  const clientToWorld = useCanvasToWorld();

  const preview = useSyncExternalStore(
    subscribeAutoLayoutDragPreview,
    getAutoLayoutDragPreview,
    () => null,
  );

  const handles = useMemo(() => {
    if (!show || !id) return null;
    return getAutoLayoutInteractionHandles(id, nodes, childOrder);
  }, [show, id, nodes, childOrder]);

  const handlePx = screenPxToOverlay(CANVAS_HANDLE_SCREEN_PX, overlay);
  const hitPx = screenPxToOverlay(14, overlay);
  const hitSize = screenPxToOverlay(HIT_SCREEN_PX, overlay);
  const lineW = AUTO_LAYOUT_SPACING_LINE_SCREEN_PX;
  const spacingTickHalf = AUTO_LAYOUT_SPACING_TICK_SCREEN_PX;

  const toOverlay = useCallback(
    (local: { x: number; y: number }) => {
      if (!id) return local;
      return parentLocalToOverlay(id, local, nodes, childOrder, overlay);
    },
    [id, nodes, childOrder, overlay],
  );

  const resolveClientToWorld = useCallback(
    (clientX: number, clientY: number) =>
      clientToWorld
        ? clientToWorld(clientX, clientY)
        : clientToWorldFromDocument(clientX, clientY, { pan, zoom }),
    [clientToWorld, pan, zoom],
  );

  const onSpacingDown = useCallback(
    (gapIndex: number) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      beginSpacingDrag({
        nodeId: id,
        gapIndex,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: resolveClientToWorld,
        captureTarget: e.currentTarget,
      });
    },
    [id, resolveClientToWorld],
  );

  const onPaddingDown = useCallback(
    (side: "top" | "right" | "bottom" | "left") => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      beginPaddingDrag({
        nodeId: id,
        side,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: resolveClientToWorld,
        captureTarget: e.currentTarget,
      });
    },
    [id, resolveClientToWorld],
  );

  const onFillDividerDown = useCallback(
    (leftChildId: string, rightChildId: string) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      beginFillDividerDrag({
        nodeId: id,
        leftChildId,
        rightChildId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: resolveClientToWorld,
        captureTarget: e.currentTarget,
      });
    },
    [id, resolveClientToWorld],
  );

  const spacingBadge = useMemo(() => {
    if (!preview || preview.nodeId !== id || preview.kind !== "spacing" || !handles) return null;
    const gapIndex = preview.gapIndex ?? 0;
    const handle = handles.spacing.find((h) => h.index === gapIndex) ?? handles.spacing[0];
    if (!handle) return null;
    const screen = toOverlay({ x: handle.localX, y: handle.localY });
    return { x: screen.x, y: screen.y, label: preview.label };
  }, [preview, id, handles, toOverlay]);

  const otherBadge = useMemo(() => {
    if (!preview || preview.nodeId !== id || preview.kind === "spacing") return null;
    if (preview.badgeX == null || preview.badgeY == null) return null;
    const screen = toOverlay({ x: preview.badgeX, y: preview.badgeY });
    return { x: screen.x, y: screen.y, label: preview.label };
  }, [preview, id, toOverlay]);

  if (!show || !id || !handles) return null;

  const parent = nodes[id];
  if (!parent) return null;

  const pad = {
    top: parent.paddingTop ?? 0,
    right: parent.paddingRight ?? 0,
    bottom: parent.paddingBottom ?? 0,
    left: parent.paddingLeft ?? 0,
  };

  const guideSize = autoLayoutPaddingGuideSize(id, nodes, childOrder);
  const innerW = Math.max(0, guideSize.width - pad.left - pad.right);
  const innerH = Math.max(0, guideSize.height - pad.top - pad.bottom);

  const spacingHandles = handles.spacing;
  const fillDividers = handles.fillDividers;

  const clipFrame = shouldClipChildren(parent);
  const frameClipId = clipFrame ? `al-frame-clip-${id}` : null;
  const frameClipRect = clipFrame
    ? worldRectToOverlay(
        (() => {
          const nw = localToWorld(id, { x: 0, y: 0 }, nodes, childOrder);
          const se = localToWorld(id, { x: parent.width, y: parent.height }, nodes, childOrder);
          return {
            x: Math.min(nw.x, se.x),
            y: Math.min(nw.y, se.y),
            width: Math.abs(se.x - nw.x),
            height: Math.abs(se.y - nw.y),
          };
        })(),
        overlay,
      )
    : null;

  const padGuides = [
    { x1: pad.left, y1: pad.top, x2: pad.left + innerW, y2: pad.top, color: PAD_COLOR },
    { x1: pad.left + innerW, y1: pad.top, x2: pad.left + innerW, y2: pad.top + innerH, color: PAD_COLOR },
    { x1: pad.left, y1: pad.top + innerH, x2: pad.left + innerW, y2: pad.top + innerH, color: PAD_COLOR },
    { x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + innerH, color: PAD_COLOR },
  ].map((g) => {
    const a = toOverlay({ x: g.x1, y: g.y1 });
    const b = toOverlay({ x: g.x2, y: g.y2 });
    return { ...g, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-[38] overflow-visible" aria-hidden>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {frameClipId && frameClipRect ? (
          <defs>
            <clipPath id={frameClipId}>
              <rect
                x={frameClipRect.x}
                y={frameClipRect.y}
                width={frameClipRect.width}
                height={frameClipRect.height}
              />
            </clipPath>
          </defs>
        ) : null}
        <g clipPath={frameClipId ? `url(#${frameClipId})` : undefined}>
          {padGuides.map((g, i) => (
            <line
              key={`pad-${i}`}
              x1={g.x1}
              y1={g.y1}
              x2={g.x2}
              y2={g.y2}
              stroke={g.color}
              strokeWidth={lineW}
              strokeDasharray={`${lineW * 3} ${lineW * 2}`}
              opacity={0.85}
            />
          ))}
          {spacingHandles.map((h) => {
            const center = toOverlay({ x: h.localX, y: h.localY });
            const a =
              handles.mode === "horizontal"
                ? { x: center.x, y: center.y - spacingTickHalf }
                : { x: center.x - spacingTickHalf, y: center.y };
            const b =
              handles.mode === "horizontal"
                ? { x: center.x, y: center.y + spacingTickHalf }
                : { x: center.x + spacingTickHalf, y: center.y };
            return (
              <line
                key={`gap-${h.index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={GAP_COLOR}
                strokeWidth={lineW}
              />
            );
          })}
        </g>
      </svg>

      {spacingHandles.map((h) => {
        const isHorizontal = handles.mode === "horizontal";
        const center = toOverlay({ x: h.localX, y: h.localY });
        const arrowPx = screenPxToOverlay(12, overlay);
        return (
          <button
            key={`gap-hit-${h.index}`}
            type="button"
            data-autolayout-spacing-handle={id}
            aria-label="Adjust item spacing"
            className="pointer-events-auto absolute touch-none flex items-center justify-center border-0 bg-[rgba(255,36,255,0.14)] p-0"
            style={{
              left: center.x,
              top: center.y,
              width: hitSize,
              height: hitSize,
              transform: "translate(-50%, -50%)",
              cursor: isHorizontal ? "ew-resize" : "ns-resize",
            }}
            onPointerDown={onSpacingDown(h.index)}
          >
            <span
              className="pointer-events-none select-none font-bold leading-none drop-shadow-sm"
              style={{ color: GAP_COLOR, fontSize: arrowPx }}
              aria-hidden
            >
              {isHorizontal ? "↔" : "↕"}
            </span>
          </button>
        );
      })}

      {handles.padding.map((h) => {
        const screen = toOverlay({ x: h.localX, y: h.localY });
        const cursor =
          h.side === "top" || h.side === "bottom" ? "ns-resize" : "ew-resize";
        return (
          <button
            key={`pad-${h.side}`}
            type="button"
            data-autolayout-padding-handle={id}
            aria-label={`Adjust ${h.side} padding`}
            className="pointer-events-auto absolute rounded-sm border border-white shadow-sm"
            style={{
              left: screen.x,
              top: screen.y,
              width: handlePx,
              height: handlePx,
              transform: "translate(-50%, -50%)",
              background: PAD_COLOR,
              cursor,
            }}
            onPointerDown={onPaddingDown(h.side)}
          />
        );
      })}

      {fillDividers.map((h) => {
        const screen = toOverlay({ x: h.localX, y: h.localY });
        return (
          <button
            key={`fill-${h.index}`}
            type="button"
            aria-label="Adjust fill distribution"
            className="pointer-events-auto absolute rounded-full border-2 border-white"
            style={{
              left: screen.x,
              top: screen.y,
              width: hitPx,
              height: hitPx,
              transform: "translate(-50%, -50%)",
              background: CANVAS_VISUAL.selection,
              cursor: handles.mode === "horizontal" ? "ew-resize" : "ns-resize",
            }}
            onPointerDown={onFillDividerDown(h.leftChildId, h.rightChildId)}
          />
        );
      })}

      {spacingBadge ? (
        <CanvasEditValueBadge
          x={spacingBadge.x}
          y={spacingBadge.y}
          zoom={zoom}
          placement="center"
          background={GAP_COLOR}
          screenSpace
          stableWidth
        >
          {spacingBadge.label}
        </CanvasEditValueBadge>
      ) : null}
      {otherBadge ? (
        <CanvasEditValueBadge x={otherBadge.x} y={otherBadge.y} zoom={zoom} screenSpace>
          {otherBadge.label}
        </CanvasEditValueBadge>
      ) : null}
    </div>
  );
}
