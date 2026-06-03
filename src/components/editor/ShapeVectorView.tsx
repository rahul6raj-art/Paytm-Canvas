"use client";

import { useSyncExternalStore } from "react";
import { vectorShapeOutlineD } from "@/lib/shapes/shapeToPath";
import { effectiveFillType, fillPaintCss } from "@/lib/fillGradient";
import { ShapeGradientFill } from "./ShapeGradientFill";
import {
  clampCornerRadii,
  getNodeCornerRadii,
  isUniformCornerRadii,
  roundedRectPathD,
  uniformCornerRadiusForRect,
} from "@/lib/cornerRadius";
import {
  arrowHeadToStrokeEndpoint,
  arrowMarkerScale,
  resolveArrowEndKind,
  resolveArrowStartKind,
} from "@/lib/shapes/arrowGeometry";
import {
  resolveStrokeEndPoint,
  resolveStrokeStartPoint,
  strokeEndpointMarkerDefs,
  strokeMarkerRefs,
  unifiedLineCap,
} from "@/lib/strokeEndpoints";
import {
  resolveStrokeColor,
  strokeIsVisible,
  svgStrokePropsFromNode,
} from "@/lib/stroke";
import {
  effectiveEllipseArc,
  ellipseArcPathD,
  hasEllipseArcInnerHole,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";
import {
  getEllipseArcPreview,
  subscribeEllipseArcPreview,
} from "@/lib/shapes/ellipseArcDrag";
import { getLinePreview, subscribeLinePreview } from "@/lib/shapes/lineDrag";
import { lineLocalRenderPoints } from "@/lib/shapes/lineGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

/** SVG vector body for shapes — sharper than CSS borders under canvas zoom transforms. */
export function ShapeVectorView({
  node,
  nodeId,
  strokeOnly = false,
}: {
  node: EditorNode;
  nodeId: string;
  /** Draw stroke only (frame fill stays on the HTML shell). */
  strokeOnly?: boolean;
}) {
  const arcPreview = useSyncExternalStore(
    subscribeEllipseArcPreview,
    getEllipseArcPreview,
    () => null,
  );
  const linePreview = useSyncExternalStore(subscribeLinePreview, getLinePreview, () => null);
  const sw = node.strokeWidth ?? 0;
  const sc = resolveStrokeColor(node);
  const showStroke = strokeIsVisible(node);
  const fill = fillPaintCss(node);
  const isGradientFill = effectiveFillType(node) === "gradient";
  const showShapeFill = !strokeOnly && node.fillEnabled !== false && isGradientFill;
  const fillVisible = !strokeOnly && node.fillEnabled !== false;
  const solidFill = fillVisible && !showShapeFill ? fill : "none";
  const strokePresentation = svgStrokePropsFromNode(node);
  const strokeProps = {
    stroke: showStroke ? sc : "none",
    strokeWidth: showStroke ? sw : 0,
    ...strokePresentation,
  };

  if (node.type === "rectangle" || node.type === "frame") {
    const radii = clampCornerRadii(getNodeCornerRadii(node), node.width, node.height);
    const uniform = isUniformCornerRadii(radii);
    const r = uniformCornerRadiusForRect(node, node.width, node.height);
    const pathD = uniform ? null : roundedRectPathD(node.width, node.height, radii);
    return (
      <>
        {showShapeFill ? <ShapeGradientFill node={node} nodeId={nodeId} shape="rect" /> : null}
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          {pathD ? (
            <path d={pathD} fill={solidFill} {...strokeProps} />
          ) : (
            <rect
              x={0}
              y={0}
              width={node.width}
              height={node.height}
              rx={r}
              ry={r}
              fill={solidFill}
              {...strokeProps}
            />
          )}
        </svg>
      </>
    );
  }

  if (node.type === "ellipse") {
    const cx = node.width / 2;
    const cy = node.height / 2;
    const arc =
      arcPreview?.nodeId === nodeId
        ? {
            startDeg: arcPreview.startDeg,
            sweepDeg: arcPreview.sweepDeg,
            innerRadiusRatio: arcPreview.innerRadiusRatio,
          }
        : effectiveEllipseArc(node);
    const useArcPath =
      !isFullEllipseArc(arc.sweepDeg) || hasEllipseArcInnerHole(arc.innerRadiusRatio);
    const arcPath = useArcPath
      ? ellipseArcPathD(
          node.width,
          node.height,
          arc.startDeg,
          arc.sweepDeg,
          arc.innerRadiusRatio,
        )
      : null;
    return (
      <>
        {showShapeFill ? (
          <ShapeGradientFill
            node={node}
            nodeId={nodeId}
            shape="ellipse"
            pathD={arcPath ?? undefined}
          />
        ) : null}
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          {arcPath ? (
            <path
              d={arcPath}
              fill={solidFill}
              fillRule={
                hasEllipseArcInnerHole(arc.innerRadiusRatio) &&
                isFullEllipseArc(arc.sweepDeg)
                  ? "evenodd"
                  : undefined
              }
              {...strokeProps}
            />
          ) : (
            <ellipse cx={cx} cy={cy} rx={cx} ry={cy} fill={solidFill} {...strokeProps} />
          )}
        </svg>
      </>
    );
  }

  if (node.type === "line" || node.type === "arrow") {
    const previewEp =
      linePreview?.nodeId === nodeId
        ? {
            lineX1: linePreview.x1,
            lineY1: linePreview.y1,
            lineX2: linePreview.x2,
            lineY2: linePreview.y2,
          }
        : {};
    const pts = lineLocalRenderPoints({ ...node, ...previewEp });
    return (
      <StrokedLineSvg
        nodeId={nodeId}
        width={node.width}
        height={node.height}
        x1={pts.x1}
        y1={pts.y1}
        x2={pts.x2}
        y2={pts.y2}
        strokeColor={sc}
        strokeWidth={sw}
        showStroke={showStroke}
        node={node}
        strokeProps={strokeProps}
      />
    );
  }

  if (node.type === "path" || node.type === "polygon") {
    const closed = node.type === "polygon" ? true : (node.pathClosed ?? false);
    const d = node.flattenedPathData ?? vectorShapeOutlineD(node, nodeId);
    const start = resolveStrokeStartPoint(node);
    const end = resolveStrokeEndPoint(node);
    const markerPrefix = `pc-stroke-${nodeId}`;
    const markers = !closed ? strokeEndpointMarkerDefs(markerPrefix, start, end, sc, sw) : "";
    const markerRefs = !closed ? strokeMarkerRefs(start, end, markerPrefix) : {};
    const lineCap = !closed ? unifiedLineCap(start, end) : undefined;
    return (
      <>
        {showShapeFill && d ? (
          <ShapeGradientFill node={node} nodeId={nodeId} shape="path" pathD={d} />
        ) : null}
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          {markers ? <defs dangerouslySetInnerHTML={{ __html: markers }} /> : null}
          <path
            d={d || "M0 0"}
            fill={closed && fillVisible && !showShapeFill ? solidFill : "none"}
            {...strokeProps}
            {...(lineCap ? { strokeLinecap: lineCap } : {})}
            markerStart={markerRefs.markerStart}
            markerEnd={markerRefs.markerEnd}
          />
        </svg>
      </>
    );
  }

  return null;
}

function StrokedLineSvg({
  nodeId,
  width,
  height,
  x1,
  y1,
  x2,
  y2,
  strokeColor,
  strokeWidth,
  showStroke,
  node,
  strokeProps,
}: {
  nodeId: string;
  width: number;
  height: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  showStroke: boolean;
  node: EditorNode;
  strokeProps: Record<string, unknown>;
}) {
  const start =
    node.type === "arrow"
      ? arrowHeadToStrokeEndpoint(resolveArrowStartKind(node))
      : resolveStrokeStartPoint(node);
  const end =
    node.type === "arrow"
      ? arrowHeadToStrokeEndpoint(resolveArrowEndKind(node))
      : resolveStrokeEndPoint(node);
  const prefix = `pc-stroke-${nodeId}`;
  const markerOpts =
    node.type === "arrow" ? { markerScale: arrowMarkerScale(node) } : undefined;
  const markers = strokeEndpointMarkerDefs(
    prefix,
    start,
    end,
    strokeColor,
    strokeWidth,
    markerOpts,
  );
  const markerRefs = strokeMarkerRefs(start, end, prefix);
  const lineCap =
    node.type === "arrow"
      ? node.strokeLinecap ?? "butt"
      : unifiedLineCap(start, end);

  return (
    <svg
      className="pointer-events-none absolute inset-0 block overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      {markers ? <defs dangerouslySetInnerHTML={{ __html: markers }} /> : null}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        fill="none"
        {...strokeProps}
        {...(lineCap ? { strokeLinecap: lineCap } : {})}
        markerStart={showStroke ? markerRefs.markerStart : undefined}
        markerEnd={showStroke ? markerRefs.markerEnd : undefined}
      />
    </svg>
  );
}
