"use client";

import { useSyncExternalStore } from "react";
import { hasPathCornerRadius, resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import { fillPaintCss } from "@/lib/fillGradient";
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
  resolveSvgStrokeLayers,
  strokeIsVisible,
  svgStrokePresentationFromNode,
  svgStrokePropsFromNode,
} from "@/lib/stroke";
import { svgSafeId } from "@/lib/svgMarkupCore";
import {
  fullEllipsePathD,
  individualBorderStrokeStyle,
  shouldUseAlignedPathStroke,
  strokeUsesCssIndividualBorders,
} from "@/lib/strokeAlign";
import { renderShapeStrokeLayers } from "./StrokedShapeLayers";
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
import { useEditorStore } from "@/stores/useEditorStore";

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
  const assets = useEditorStore((s) => s.assets);
  const sw = node.strokeWidth ?? 0;
  const showStroke = strokeIsVisible(node);
  const strokeDefs: string[] = [];
  const { strokePaint: sc, underlayMarkup: strokeUnderlay } = showStroke
    ? resolveSvgStrokeLayers(node, {
        gradientId: `pc-sg-${svgSafeId(nodeId)}`,
        width: node.width,
        height: node.height,
        registerGradient: (id, markup) => strokeDefs.push(markup),
        assets,
      })
    : { strokePaint: resolveStrokeColor(node), underlayMarkup: "" };
  const fill = fillPaintCss(node);
  const fillVisible = !strokeOnly && node.fillEnabled !== false;
  const solidFill = fillVisible ? fill : "none";
  const strokePresentation = svgStrokePresentationFromNode(node);
  const strokeProps = {
    stroke: showStroke ? sc : "none",
    strokeWidth: showStroke ? sw : 0,
    ...svgStrokePropsFromNode(node),
  };

  if (node.type === "rectangle" || node.type === "frame") {
    const radii = clampCornerRadii(getNodeCornerRadii(node), node.width, node.height);
    const uniform = isUniformCornerRadii(radii);
    const r = uniformCornerRadiusForRect(node, node.width, node.height);
    const pathD = uniform
      ? roundedRectPathD(node.width, node.height, [
          r,
          r,
          r,
          r,
        ])
      : roundedRectPathD(node.width, node.height, radii);
    const cssBorderStroke = strokeUsesCssIndividualBorders(node) && showStroke;
    return (
      <>
        {cssBorderStroke ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={individualBorderStrokeStyle(node, sc)}
          />
        ) : null}
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          {renderShapeStrokeLayers(
            { ...node, id: nodeId },
            {
              pathD,
              fill: solidFill,
              showStroke: cssBorderStroke ? false : showStroke,
              strokeColor: sc,
              strokeWidth: sw,
              strokePresentation,
              uniformRect: uniform ? { width: node.width, height: node.height, rx: r } : undefined,
              closed: true,
              assets,
            },
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
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          {strokeDefs.length > 0 ? (
            <defs dangerouslySetInnerHTML={{ __html: strokeDefs.join("") }} />
          ) : null}
          {strokeUnderlay ? (
            <g dangerouslySetInnerHTML={{ __html: strokeUnderlay }} />
          ) : null}
          {(() => {
            const shapeD = arcPath ?? fullEllipsePathD(node.width, node.height);
            const fillRule =
              arcPath &&
              hasEllipseArcInnerHole(arc.innerRadiusRatio) &&
              isFullEllipseArc(arc.sweepDeg)
                ? "evenodd"
                : undefined;
            if (shouldUseAlignedPathStroke(node, true)) {
              return renderShapeStrokeLayers(
                { ...node, id: nodeId },
                {
                  pathD: shapeD,
                  fill: solidFill,
                  showStroke,
                  strokeColor: sc,
                  strokeWidth: sw,
                  strokePresentation,
                  closed: true,
                  assets,
                },
              );
            }
            return (
              <path
                d={shapeD}
                fill={solidFill}
                fillRule={fillRule}
                {...strokeProps}
              />
            );
          })()}
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
    const d = resolvePathOutlineD(node, nodeId);
    const roundedStroke = hasPathCornerRadius(node);
    const pathFillRule = node.pathFillRule;
    const start = resolveStrokeStartPoint(node);
    const end = resolveStrokeEndPoint(node);
    const markerPrefix = `pc-stroke-${nodeId}`;
    const markers = !closed ? strokeEndpointMarkerDefs(markerPrefix, start, end, sc, sw) : "";
    const markerRefs = !closed ? strokeMarkerRefs(start, end, markerPrefix) : {};
    const lineCap = !closed ? unifiedLineCap(start, end) : undefined;
    return (
      <>
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
          {strokeDefs.length > 0 || markers ? (
            <defs
              dangerouslySetInnerHTML={{
                __html: [...strokeDefs, markers].filter(Boolean).join(""),
              }}
            />
          ) : null}
          {strokeUnderlay ? (
            <g dangerouslySetInnerHTML={{ __html: strokeUnderlay }} />
          ) : null}
          {closed && shouldUseAlignedPathStroke(node, true) ? (
            renderShapeStrokeLayers(
              { ...node, id: nodeId },
              {
                pathD: d || "M0 0",
                fill: fillVisible ? solidFill : "none",
                showStroke,
                strokeColor: sc,
                strokeWidth: sw,
                strokePresentation,
                closed: true,
                assets,
              },
            )
          ) : (
            <path
              d={d || "M0 0"}
              fill={closed && fillVisible ? solidFill : "none"}
              fillRule={pathFillRule}
              {...strokeProps}
              {...(lineCap ? { strokeLinecap: lineCap } : {})}
              {...(roundedStroke && showStroke
                ? { strokeLinejoin: "round" as const, strokeLinecap: "round" as const }
                : {})}
              markerStart={markerRefs.markerStart}
              markerEnd={markerRefs.markerEnd}
            />
          )}
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

  const assets = useEditorStore((s) => s.assets);
  const lineStrokeDefs: string[] = [];
  const { strokePaint: lineStrokePaint, underlayMarkup: lineUnderlay } = showStroke
    ? resolveSvgStrokeLayers(node, {
        gradientId: `pc-sg-${svgSafeId(nodeId)}`,
        width,
        height,
        registerGradient: (id, markup) => lineStrokeDefs.push(markup),
        assets,
      })
    : { strokePaint: "none", underlayMarkup: "" };
  const lineStrokeProps = {
    ...strokeProps,
    stroke: showStroke ? lineStrokePaint : "none",
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0 block overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      {lineStrokeDefs.length > 0 || markers ? (
        <defs
          dangerouslySetInnerHTML={{
            __html: [...lineStrokeDefs, markers].filter(Boolean).join(""),
          }}
        />
      ) : null}
      {lineUnderlay ? <g dangerouslySetInnerHTML={{ __html: lineUnderlay }} /> : null}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        fill="none"
        {...lineStrokeProps}
        {...(lineCap ? { strokeLinecap: lineCap } : {})}
        markerStart={showStroke ? markerRefs.markerStart : undefined}
        markerEnd={showStroke ? markerRefs.markerEnd : undefined}
      />
    </svg>
  );
}
