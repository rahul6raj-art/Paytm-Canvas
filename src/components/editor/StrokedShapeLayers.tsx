"use client";

import type { ReactNode } from "react";
import { svgSafeId } from "@/lib/svgMarkupCore";
import { roundedRectBorderFills } from "@/lib/borderGeometry";
import { effectiveStrokeType } from "@/lib/fillGradient";
import type { EditorAsset } from "@/lib/documentPersistence";
import {
  alignedPathStrokeWidth,
  resolveStrokeSideWidths,
  resolveStrokeSides,
  resolveStrokeSidePaint,
  shouldUseAlignedPathStroke,
  shouldUseFilledStrokeRingForNode,
  strokeEdgeRects,
  strokeFillLayerBeforeStrokeLayer,
  strokeRingLayersBeforeFill,
  strokeUsesAxisAlignedRects,
  usesPerEdgeStroke,
  type StrokeEdgeRect,
} from "@/lib/strokeAlign";
import { shapeContourForNode, strokeRenderPaths, type ShapeContour } from "@/lib/strokeGeometry";
import type { SvgStrokePresentation } from "@/lib/stroke";
import { resolveSvgStrokeLayers } from "@/lib/stroke";
import {
  buildTaperedStrokeFillD,
} from "@/lib/taperedStrokePath";
import { filledStrokeOutlineFromPathD, outlineStroke } from "@/lib/outlineStroke";
import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";
import { ROUNDED_RECT_SIDE_STROKE_DEBUG, buildRoundedRectStrokeSegments } from "@/lib/vector/roundedRectStrokeSegments";
import { getNodeCornerRadii } from "@/lib/cornerRadius";

function EdgeStrokeRects({
  rects,
  node,
  unifiedPaint,
}: {
  rects: StrokeEdgeRect[];
  node: Pick<
    EditorNode,
    "strokeColor" | "strokeOpacity" | "strokeSidesCustomColors" | "strokeType" | "strokeGradient"
  >;
  unifiedPaint?: string;
}) {
  const useUnified = effectiveStrokeType(node) !== "solid" && unifiedPaint;
  return (
    <>
      {rects.map((r) => (
        <rect
          key={r.side}
          x={r.x}
          y={r.y}
          width={Math.max(0, r.width)}
          height={Math.max(0, r.height)}
          fill={useUnified ? unifiedPaint! : resolveStrokeSidePaint(node, r.side)}
        />
      ))}
    </>
  );
}

function strokeBandFillPaint(
  node: Pick<
    EditorNode,
    "strokeColor" | "strokeOpacity" | "strokeSidesCustomColors" | "strokeType" | "strokeGradient"
  >,
  side: StrokeEdgeRect["side"],
  unifiedPaint: string,
): string {
  return effectiveStrokeType(node) === "solid"
    ? resolveStrokeSidePaint(node, side)
    : unifiedPaint;
}

/** Closed shape fill + stroke with inset/outset centerline paths (Figma-like align). */
export function StrokedClosedPath({
  nodeId,
  pathD,
  fill,
  showStroke,
  strokeColor,
  strokeWidth,
  strokePosition,
  strokePresentation,
  contour,
}: {
  nodeId: string;
  pathD: string;
  fill: string;
  showStroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokePosition: StrokePosition;
  strokePresentation: SvgStrokePresentation;
  contour?: ShapeContour | null;
}) {
  const pos = strokePosition ?? "center";
  const sw = Math.max(0, strokeWidth);
  const roundedRect = contour?.kind === "roundedRect";
  const { fillPathD, strokePathD } = strokeRenderPaths(contour ?? null, pathD, {
    align: pos,
    width: sw,
    join: roundedRect ? "round" : strokePresentation.strokeLinejoin,
  });

  const strokeOnly = {
    fill: "none" as const,
    stroke: strokeColor,
    strokeWidth: sw,
    strokeDasharray: strokePresentation.strokeDasharray,
    strokeLinecap: (roundedRect ? "round" : strokePresentation.strokeLinecap) as "butt" | "round" | "square",
    strokeLinejoin: (roundedRect ? "round" : strokePresentation.strokeLinejoin) as "miter" | "round" | "bevel",
    strokeMiterlimit: strokePresentation.strokeMiterlimit,
  };

  const fillEl = <path d={fillPathD} fill={fill} />;

  if (!showStroke || sw <= 0) {
    return fillEl;
  }

  const strokeEl = <path d={strokePathD} {...strokeOnly} />;

  if (pos === "center") {
    return (
      <>
        {fillEl}
        {strokeEl}
      </>
    );
  }

  if (pos === "inside") {
    return (
      <>
        {fillEl}
        {strokeEl}
      </>
    );
  }

  return (
    <>
      {strokeEl}
      {fillEl}
    </>
  );
}

function PartialSideClipDef({
  clipId,
  clipPathD,
}: {
  clipId: string;
  clipPathD: string;
}) {
  return (
    <defs>
      <clipPath id={clipId}>
        <path d={clipPathD} />
      </clipPath>
    </defs>
  );
}

/**
 * Stroke along selected sides of a rounded rect (open path).
 * Tapers toward both ends; inside/outside clip to shape.
 */
function StrokedPartialSidesPath({
  nodeId,
  edgePathD,
  clipPathD,
  showStroke,
  strokeColor,
  strokeWidth,
  strokePosition,
  strokePresentation,
  strokeWidthProfileFlipped,
  shapeWidth,
  shapeHeight,
  useTaper,
  taperProfile = "symmetric",
}: {
  nodeId: string;
  edgePathD: string;
  clipPathD: string;
  showStroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokePosition: StrokePosition;
  strokePresentation: SvgStrokePresentation;
  strokeWidthProfileFlipped?: boolean;
  shapeWidth: number;
  shapeHeight: number;
  useTaper: boolean;
  taperProfile?: "uniform" | "symmetric" | "start" | "end";
}) {
  const pos = strokePosition ?? "center";
  const sw = Math.max(0, strokeWidth);
  const taperEnabled = useTaper && !strokePresentation.strokeDasharray;
  const taperFillD =
    taperEnabled && showStroke && sw > 0
      ? buildTaperedStrokeFillD(edgePathD, {
          maxWidth: sw,
          flipped: strokeWidthProfileFlipped,
          position: pos,
          bounds: { width: shapeWidth, height: shapeHeight },
          taperProfile,
        })
      : null;

  if (!showStroke || sw <= 0) return null;

  const safeId = svgSafeId(nodeId);
  const clipId = `pc-stroke-partial-in-${safeId}`;
  const needsClip = pos === "inside";
  const clipPathAttr = needsClip ? `url(#${clipId})` : undefined;

  if (taperEnabled && taperFillD) {
    return (
      <>
        {needsClip ? (
          <PartialSideClipDef clipId={clipId} clipPathD={clipPathD} />
        ) : null}
        <path d={taperFillD} fill={strokeColor} clipPath={clipPathAttr} />
      </>
    );
  }

  const strokeW = pos === "center" ? sw : alignedPathStrokeWidth(pos, sw);
  const strokeProps = {
    fill: "none" as const,
    stroke: strokeColor,
    strokeWidth: strokeW,
    strokeDasharray: strokePresentation.strokeDasharray,
    strokeLinecap: "butt" as const,
    strokeLinejoin: "round" as const,
    strokeMiterlimit: strokePresentation.strokeMiterlimit,
  };

  if (needsClip) {
    return (
      <>
        <PartialSideClipDef clipId={clipId} clipPathD={clipPathD} />
        <path d={edgePathD} clipPath={clipPathAttr} {...strokeProps} />
      </>
    );
  }

  return <path d={edgePathD} {...strokeProps} />;
}

function strokePaintWithDefs(
  node: Pick<
    EditorNode,
    | "id"
    | "width"
    | "height"
    | "strokeColor"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokeType"
    | "strokeGradient"
    | "strokeImageAssetId"
    | "strokeVideoAssetId"
    | "strokeWidth"
  >,
  showStroke: boolean,
  assets?: Record<string, EditorAsset>,
): { strokePaint: string; defsEl: ReactNode; underlayEl: ReactNode; underlayMarkup: string } {
  const strokeDefs: string[] = [];
  if (!showStroke) {
    return { strokePaint: "none", defsEl: null, underlayEl: null, underlayMarkup: "" };
  }
  const { strokePaint, underlayMarkup } = resolveSvgStrokeLayers(node, {
    gradientId: `pc-sg-${svgSafeId(node.id)}`,
    width: node.width,
    height: node.height,
    registerGradient: (id, markup) => strokeDefs.push(markup),
    assets,
  });
  const defsEl =
    strokeDefs.length > 0 ? (
      <defs dangerouslySetInnerHTML={{ __html: strokeDefs.join("") }} />
    ) : null;
  const underlayEl = underlayMarkup ? (
    <g dangerouslySetInnerHTML={{ __html: underlayMarkup }} />
  ) : null;
  return { strokePaint, defsEl, underlayEl, underlayMarkup };
}

function strokeRingUnderlayEl(
  nodeId: string,
  ringPathD: string,
  fillRule: "evenodd" | "nonzero" | undefined,
  underlayMarkup: string,
): ReactNode {
  if (!underlayMarkup.trim()) return null;
  const clipId = `pc-stroke-ring-clip-${svgSafeId(nodeId)}`;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path
            d={ringPathD}
            fillRule={fillRule && fillRule !== "nonzero" ? fillRule : undefined}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} dangerouslySetInnerHTML={{ __html: underlayMarkup }} />
    </>
  );
}

function composeStrokeRingLayers(
  nodeId: string,
  outlined: { pathD: string; fillRule?: "evenodd" | "nonzero" },
  strokePaint: string,
  underlayMarkup: string,
): ReactNode {
  const strokeEl = (
    <path
      d={outlined.pathD}
      fill={strokePaint}
      fillRule={outlined.fillRule && outlined.fillRule !== "nonzero" ? outlined.fillRule : undefined}
    />
  );
  const clippedUnderlay = strokeRingUnderlayEl(
    nodeId,
    outlined.pathD,
    outlined.fillRule,
    underlayMarkup,
  );
  return (
    <>
      {clippedUnderlay}
      {strokeEl}
    </>
  );
}

function wrapStrokeLayers(defsEl: ReactNode, underlayEl: ReactNode, layers: ReactNode): ReactNode {
  if (!defsEl && !underlayEl) return layers;
  return (
    <>
      {defsEl}
      {underlayEl}
      {layers}
    </>
  );
}

/** Whether closed shapes should render stroke as a filled even-odd ring (not native SVG stroke). */
export function shouldUseFilledStrokeRing(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
    | "cornerRadius"
    | "cornerRadii"
    | "cornerSmoothing"
    | "pathPoints"
    | "pathClosed"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
    | "strokeType"
  >,
  opts: { showStroke: boolean; closed: boolean },
): boolean {
  return shouldUseFilledStrokeRingForNode(node, opts);
}

export function resolveShapeStrokeLayerOrder(
  position: StrokePosition | undefined,
  usesFilledRing: boolean,
): { fillBeforeStroke: boolean } {
  return { fillBeforeStroke: strokeFillLayerBeforeStrokeLayer(position, usesFilledRing) };
}

export function renderShapeStrokeLayers(
  node: Pick<
    EditorNode,
    | "id"
    | "type"
    | "width"
    | "height"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeSidesCustomColors"
    | "cornerRadius"
    | "cornerRadii"
    | "cornerSmoothing"
    | "strokeWidthProfile"
    | "strokeWidthProfileFlipped"
    | "strokeColor"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokeType"
    | "strokeGradient"
    | "strokeImageAssetId"
    | "strokeVideoAssetId"
    | "strokeWidth"
  >,
  opts: {
    pathD: string;
    fill: string;
    showStroke: boolean;
    strokeColor: string;
    strokeWidth: number;
    strokePresentation: SvgStrokePresentation;
    closed?: boolean;
    assets?: Record<string, EditorAsset>;
  },
): ReactNode {
  const closed = opts.closed ?? true;
  const position = node.strokePosition ?? "center";
  const { strokePaint, defsEl, underlayEl, underlayMarkup } = strokePaintWithDefs(node, opts.showStroke, opts.assets);

  const borderFills = usesPerEdgeStroke(node) ? roundedRectBorderFills(node) : null;
  if (borderFills?.length) {
    const fillLayer =
      opts.fill !== "none" ? <path d={opts.pathD} fill={opts.fill} /> : null;

    const [tl, tr, br, bl] = getNodeCornerRadii(node as EditorNode);
    const debugSegments = ROUNDED_RECT_SIDE_STROKE_DEBUG
      ? buildRoundedRectStrokeSegments({
          width: node.width,
          height: node.height,
          radius: { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl },
          smoothing: (node as EditorNode).cornerSmoothing ?? 0,
          strokeSides: {
            top: borderFills.some((f) => f.side === "top"),
            right: borderFills.some((f) => f.side === "right"),
            bottom: borderFills.some((f) => f.side === "bottom"),
            left: borderFills.some((f) => f.side === "left"),
          },
        })
      : [];

    const strokeLayers = borderFills.flatMap((fill) => {
      const paint = strokeBandFillPaint(node, fill.side, strokePaint);
      const layers = [
        <path key={fill.side} d={fill.pathD} fill={paint} />,
      ];
      if (ROUNDED_RECT_SIDE_STROKE_DEBUG) {
        const debug = debugSegments.find((s) => s.side === fill.side);
        if (debug) {
          layers.unshift(
            <path
              key={`${fill.side}-debug`}
              d={debug.d}
              fill="none"
              stroke="red"
              strokeWidth={2}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />,
          );
        }
      }
      return layers;
    });

    if (strokeRingLayersBeforeFill(position)) {
      return wrapStrokeLayers(
        defsEl,
        underlayEl,
        <>
          {strokeLayers}
          {fillLayer}
        </>,
      );
    }

    return wrapStrokeLayers(
      defsEl,
      underlayEl,
      <>
        {fillLayer}
        {strokeLayers}
      </>,
    );
  }

  if (
    shouldUseFilledStrokeRing(node, { showStroke: opts.showStroke, closed })
  ) {
    const outlined = filledStrokeOutlineFromPathD(
      node as EditorNode,
      opts.pathD,
      closed,
    );
    const fillLayer =
      opts.fill !== "none" ? <path d={opts.pathD} fill={opts.fill} /> : null;
    if (outlined?.pathD) {
      const strokeStack = composeStrokeRingLayers(
        node.id,
        outlined,
        strokePaint,
        underlayMarkup,
      );
      if (strokeRingLayersBeforeFill(position)) {
        return wrapStrokeLayers(
          defsEl,
          null,
          <>
            {strokeStack}
            {fillLayer}
          </>,
        );
      }
      return wrapStrokeLayers(
        defsEl,
        null,
        <>
          {fillLayer}
          {strokeStack}
        </>,
      );
    }
    if (fillLayer) {
      return wrapStrokeLayers(defsEl, underlayEl, fillLayer);
    }
    return wrapStrokeLayers(defsEl, underlayEl, null);
  }

  if (strokeUsesAxisAlignedRects(node, node.width, node.height)) {
    const sides = resolveStrokeSides(node);
    const sideWidths = resolveStrokeSideWidths(node);
    const rects = strokeEdgeRects(node.width, node.height, position, sides, sideWidths);
    return wrapStrokeLayers(
      defsEl,
      underlayEl,
      <>
        {opts.fill !== "none" ? <path d={opts.pathD} fill={opts.fill} /> : null}
        {opts.showStroke ? <EdgeStrokeRects rects={rects} node={node} unifiedPaint={strokePaint} /> : null}
      </>,
    );
  }

  const contour = shapeContourForNode(node);
  const useOffsetStroke = closed && (contour != null || shouldUseAlignedPathStroke(node, closed));

  if (useOffsetStroke) {
    return wrapStrokeLayers(
      defsEl,
      underlayEl,
      <StrokedClosedPath
        nodeId={node.id}
        pathD={opts.pathD}
        fill={opts.fill}
        showStroke={opts.showStroke}
        strokeColor={strokePaint}
        strokeWidth={opts.strokeWidth}
        strokePosition={position}
        strokePresentation={opts.strokePresentation}
        contour={contour}
      />,
    );
  }

  return wrapStrokeLayers(
    defsEl,
    underlayEl,
    <StrokedClosedPath
      nodeId={node.id}
      pathD={opts.pathD}
      fill={opts.fill}
      showStroke={opts.showStroke}
      strokeColor={strokePaint}
      strokeWidth={opts.strokeWidth}
      strokePosition="center"
      strokePresentation={opts.strokePresentation}
      contour={contour}
    />,
  );
}
