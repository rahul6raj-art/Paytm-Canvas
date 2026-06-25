"use client";

import { useSyncExternalStore } from "react";
import { hasPathCornerRadius, resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import { effectiveStrokeType, fillPaintCss } from "@/lib/fillGradient";
import { roundedRectPathDForNode } from "@/lib/cornerRadius";
import {
  arrowHeadToStrokeEndpoint,
  arrowMarkerScale,
  resolveArrowEndKind,
  resolveArrowStartKind,
} from "@/lib/shapes/arrowGeometry";
import {
  centerlineStrokeLinecap,
  openPathStrokeViewport,
  resolveStrokeEndPoint,
  resolveStrokeStartPoint,
  strokeEndpointDecorationActive,
  strokeEndpointMarkerDefs,
  strokeMarkerRefs,
} from "@/lib/strokeEndpoints";
import {
  resolveStrokeColor,
  resolveSvgStrokeLayers,
  strokeIsVisible,
  svgNativeLinecap,
  svgStrokePresentationFromNode,
  svgStrokePropsFromNode,
} from "@/lib/stroke";
import { svgSafeId } from "@/lib/svgMarkupCore";
import {
  closedShapeStrokeViewport,
  fullEllipsePathD,
  individualBorderStrokeStyle,
  shouldUseAlignedPathStroke,
  shouldUseFilledStrokeRingForNode,
  shouldUseOutlinedOpenPathStroke,
  shouldUseTaperedOpenPathStroke,
  strokeUsesCssIndividualBorders,
} from "@/lib/strokeAlign";
import { buildTaperedOpenStrokeFromNode } from "@/lib/taperedStrokePath";
import { outlineStroke } from "@/lib/outlineStroke";
import { effectColorToRgba } from "@/lib/nodeEffects";
import { shapeHasRoundedCornerStroke } from "@/lib/geometry/roundedVectorStrokeRing";
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
    const pathD = roundedRectPathDForNode(node, node.width, node.height);
    const cssBorderStroke = strokeUsesCssIndividualBorders(node) && showStroke;
    const strokeViewport =
      showStroke && !cssBorderStroke
        ? closedShapeStrokeViewport(node.width, node.height, sw, node.strokePosition)
        : null;
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
          className="pointer-events-none absolute block overflow-visible"
          style={
            strokeViewport
              ? { left: strokeViewport.offsetLeft, top: strokeViewport.offsetTop }
              : { inset: 0 }
          }
          width={strokeViewport?.svgWidth ?? node.width}
          height={strokeViewport?.svgHeight ?? node.height}
          viewBox={strokeViewport?.viewBox}
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
          {(() => {
            const shapeD = arcPath ?? fullEllipsePathD(node.width, node.height);
            const fillRule =
              arcPath &&
              hasEllipseArcInnerHole(arc.innerRadiusRatio) &&
              isFullEllipseArc(arc.sweepDeg)
                ? "evenodd"
                : undefined;
            const useLayeredStroke = shouldUseFilledStrokeRingForNode(node, {
              closed: true,
              showStroke,
            });
            if (useLayeredStroke) {
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
              <>
                {strokeDefs.length > 0 ? (
                  <defs dangerouslySetInnerHTML={{ __html: strokeDefs.join("") }} />
                ) : null}
                {strokeUnderlay ? (
                  <g dangerouslySetInnerHTML={{ __html: strokeUnderlay }} />
                ) : null}
                <path
                  d={shapeD}
                  fill={solidFill}
                  fillRule={fillRule}
                  {...strokeProps}
                />
              </>
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
    const lineCap = !closed ? centerlineStrokeLinecap(start, end) : undefined;
    const endpointDecorated = !closed && strokeEndpointDecorationActive(start, end);
    const pathViewport = showStroke
      ? closed
        ? closedShapeStrokeViewport(node.width, node.height, sw, node.strokePosition)
        : openPathStrokeViewport(node.width, node.height, sw, start, end)
      : null;
    const useOpenOutlineStroke = shouldUseOutlinedOpenPathStroke(node, closed) && showStroke;
    const useTaperedOpenStroke = shouldUseTaperedOpenPathStroke(node, closed) && showStroke;
    const openStrokeOutline = useOpenOutlineStroke ? outlineStroke(node) : null;
    const taperedOpenStrokePathD =
      useTaperedOpenStroke ? buildTaperedOpenStrokeFromNode(node, d || "M0 0", closed) : null;
    const openStrokeFill =
      openStrokeOutline && effectiveStrokeType(node) === "gradient" && node.strokeGradient
        ? sc
        : openStrokeOutline
          ? effectColorToRgba(
              openStrokeOutline.fill,
              openStrokeOutline.fillOpacity ?? node.strokeOpacity ?? 1,
            )
          : sc;
    const taperedOpenStrokeFill = taperedOpenStrokePathD ? sc : null;
    const useLayeredStroke =
      closed &&
      shouldUseFilledStrokeRingForNode(node, { closed, showStroke });
    return (
      <>
        <svg
          className="pointer-events-none absolute block overflow-visible"
          style={
            pathViewport
              ? { left: pathViewport.offsetLeft, top: pathViewport.offsetTop }
              : { inset: 0 }
          }
          width={pathViewport?.svgWidth ?? node.width}
          height={pathViewport?.svgHeight ?? node.height}
          viewBox={pathViewport?.viewBox}
          aria-hidden
        >
          {!useLayeredStroke && (strokeDefs.length > 0 || markers) ? (
            <defs
              dangerouslySetInnerHTML={{
                __html: [...strokeDefs, markers].filter(Boolean).join(""),
              }}
            />
          ) : markers ? (
            <defs dangerouslySetInnerHTML={{ __html: markers }} />
          ) : null}
          {!useLayeredStroke && strokeUnderlay ? (
            <g dangerouslySetInnerHTML={{ __html: strokeUnderlay }} />
          ) : null}
          {useLayeredStroke ? (
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
          ) : taperedOpenStrokePathD ? (
            <>
              <path
                d={d || "M0 0"}
                fill={closed && fillVisible ? solidFill : "none"}
                fillRule={pathFillRule}
                stroke="none"
              />
              <path d={taperedOpenStrokePathD} fill={taperedOpenStrokeFill ?? sc} stroke="none" />
            </>
          ) : openStrokeOutline?.pathD ? (
            <>
              <path
                d={d || "M0 0"}
                fill={closed && fillVisible ? solidFill : "none"}
                fillRule={pathFillRule}
                stroke="none"
              />
              <path
                d={openStrokeOutline.pathD}
                fill={openStrokeFill}
                fillRule={
                  openStrokeOutline.fillRule !== "nonzero"
                    ? openStrokeOutline.fillRule
                    : undefined
                }
                stroke="none"
                markerStart={markerRefs.markerStart}
                markerEnd={markerRefs.markerEnd}
              />
            </>
          ) : (
            <path
              d={d || "M0 0"}
              fill={closed && fillVisible ? solidFill : "none"}
              fillRule={pathFillRule}
              {...strokeProps}
              {...(lineCap ? { strokeLinecap: lineCap } : {})}
              {...(roundedStroke &&
              showStroke &&
              !shapeHasRoundedCornerStroke(node) &&
              !endpointDecorated
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
      ? svgNativeLinecap(node.strokeLinecap ?? "butt")
      : centerlineStrokeLinecap(start, end);

  const lineViewport = showStroke
    ? openPathStrokeViewport(width, height, strokeWidth, start, end)
    : null;
  const vpOffsetLeft = lineViewport?.offsetLeft ?? 0;
  const vpOffsetTop = lineViewport?.offsetTop ?? 0;

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
      className="pointer-events-none absolute block overflow-visible"
      style={
        lineViewport
          ? { left: lineViewport.offsetLeft, top: lineViewport.offsetTop }
          : { inset: 0 }
      }
      width={lineViewport?.svgWidth ?? width}
      height={lineViewport?.svgHeight ?? height}
      viewBox={lineViewport?.viewBox}
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
        x1={x1 - vpOffsetLeft}
        y1={y1 - vpOffsetTop}
        x2={x2 - vpOffsetLeft}
        y2={y2 - vpOffsetTop}
        fill="none"
        {...lineStrokeProps}
        {...(lineCap ? { strokeLinecap: lineCap } : {})}
        markerStart={showStroke ? markerRefs.markerStart : undefined}
        markerEnd={showStroke ? markerRefs.markerEnd : undefined}
      />
    </svg>
  );
}
