"use client";

import { pathOutlineD } from "@/lib/shapes/shapeToPath";
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
    return (
      <>
        {showShapeFill ? <ShapeGradientFill node={node} nodeId={nodeId} shape="ellipse" /> : null}
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          <ellipse cx={cx} cy={cy} rx={cx} ry={cy} fill={solidFill} {...strokeProps} />
        </svg>
      </>
    );
  }

  if (node.type === "line") {
    const mid = node.height / 2;
    return (
      <StrokedLineSvg
        nodeId={nodeId}
        width={node.width}
        height={node.height}
        x1={0}
        y1={mid}
        x2={node.width}
        y2={mid}
        strokeColor={sc}
        strokeWidth={sw}
        showStroke={showStroke}
        node={node}
        strokeProps={strokeProps}
      />
    );
  }

  if (node.type === "path") {
    const closed = node.pathClosed ?? false;
    const d = node.flattenedPathData ?? pathOutlineD(node);
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
  const start = resolveStrokeStartPoint(node);
  const end = resolveStrokeEndPoint(node);
  const prefix = `pc-stroke-${nodeId}`;
  const markers = strokeEndpointMarkerDefs(prefix, start, end, strokeColor, strokeWidth);
  const markerRefs = strokeMarkerRefs(start, end, prefix);
  const lineCap = unifiedLineCap(start, end);

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
