"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
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
  strokeEdgeRects,
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
import { outlineStroke } from "@/lib/outlineStroke";
import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";

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
  uniformRect,
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
  /** When set, use <rect> for center stroke instead of path (rounded rects). */
  uniformRect?: { width: number; height: number; rx: number };
  contour?: ShapeContour | null;
}) {
  const pos = strokePosition ?? "center";
  const sw = Math.max(0, strokeWidth);
  const useOffset = contour != null && pos !== "center";
  const { fillPathD, strokePathD } = strokeRenderPaths(contour ?? null, pathD, {
    align: pos,
    width: sw,
    join: strokePresentation.strokeLinejoin,
  });

  if (!useOffset && pos !== "center") {
    const safeId = svgSafeId(nodeId);
    const clipId = `pc-stroke-in-${safeId}`;
    const strokeW = alignedPathStrokeWidth(pos, sw);
    const strokeOnly = {
      fill: "none" as const,
      stroke: strokeColor,
      strokeWidth: strokeW,
      strokeDasharray: strokePresentation.strokeDasharray,
      strokeLinecap: strokePresentation.strokeLinecap,
      strokeLinejoin: strokePresentation.strokeLinejoin,
      strokeMiterlimit: strokePresentation.strokeMiterlimit,
    };
    const fillEl = uniformRect ? (
      <rect
        x={0}
        y={0}
        width={uniformRect.width}
        height={uniformRect.height}
        rx={uniformRect.rx}
        ry={uniformRect.rx}
        fill={fill}
      />
    ) : (
      <path d={pathD} fill={fill} />
    );
    if (!showStroke || sw <= 0) return fillEl;
    if (pos === "inside") {
      return (
        <>
          <defs>
            <clipPath id={clipId}>
              {uniformRect ? (
                <rect
                  x={0}
                  y={0}
                  width={uniformRect.width}
                  height={uniformRect.height}
                  rx={uniformRect.rx}
                  ry={uniformRect.rx}
                />
              ) : (
                <path d={pathD} />
              )}
            </clipPath>
          </defs>
          {fillEl}
          <path d={pathD} clipPath={`url(#${clipId})`} {...strokeOnly} />
        </>
      );
    }
    return (
      <>
        <path d={pathD} {...strokeOnly} />
        {fillEl}
      </>
    );
  }

  const strokeOnly = {
    fill: "none" as const,
    stroke: strokeColor,
    strokeWidth: sw,
    strokeDasharray: strokePresentation.strokeDasharray,
    strokeLinecap: strokePresentation.strokeLinecap,
    strokeLinejoin: strokePresentation.strokeLinejoin,
    strokeMiterlimit: strokePresentation.strokeMiterlimit,
  };

  const fillEl = uniformRect ? (
    <rect
      x={0}
      y={0}
      width={uniformRect.width}
      height={uniformRect.height}
      rx={uniformRect.rx}
      ry={uniformRect.rx}
      fill={fill}
    />
  ) : (
    <path d={fillPathD} fill={fill} />
  );

  if (!showStroke || sw <= 0) {
    return fillEl;
  }

  if (pos === "center" && uniformRect) {
    return (
      <rect
        x={0}
        y={0}
        width={uniformRect.width}
        height={uniformRect.height}
        rx={uniformRect.rx}
        ry={uniformRect.rx}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={sw}
        strokeDasharray={strokePresentation.strokeDasharray}
        strokeLinecap={strokePresentation.strokeLinecap}
        strokeLinejoin={strokePresentation.strokeLinejoin}
        strokeMiterlimit={strokePresentation.strokeMiterlimit}
      />
    );
  }

  if (pos === "center") {
    return <path d={strokePathD} {...strokeOnly} fill={fill} />;
  }

  const strokeEl = <path d={strokePathD} {...strokeOnly} />;

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
  uniformRect,
}: {
  clipId: string;
  clipPathD: string;
  uniformRect?: { width: number; height: number; rx: number };
}) {
  return (
    <defs>
      <clipPath id={clipId}>
        {uniformRect ? (
          <rect
            x={0}
            y={0}
            width={uniformRect.width}
            height={uniformRect.height}
            rx={uniformRect.rx}
            ry={uniformRect.rx}
          />
        ) : (
          <path d={clipPathD} />
        )}
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
  uniformRect,
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
  uniformRect?: { width: number; height: number; rx: number };
  useTaper: boolean;
  taperProfile?: "uniform" | "symmetric" | "start" | "end";
}) {
  const [taperFillD, setTaperFillD] = useState<string | null>(null);

  const pos = strokePosition ?? "center";
  const sw = Math.max(0, strokeWidth);
  const taperEnabled = useTaper && !strokePresentation.strokeDasharray;

  useLayoutEffect(() => {
    if (!taperEnabled || !showStroke || sw <= 0) {
      setTaperFillD(null);
      return;
    }
    setTaperFillD(
      buildTaperedStrokeFillD(edgePathD, {
        maxWidth: sw,
        flipped: strokeWidthProfileFlipped,
        position: pos,
        bounds: { width: shapeWidth, height: shapeHeight },
        taperProfile,
      }),
    );
  }, [
    edgePathD,
    sw,
    pos,
    strokeWidthProfileFlipped,
    shapeWidth,
    shapeHeight,
    taperEnabled,
    taperProfile,
    showStroke,
  ]);

  if (!showStroke || sw <= 0) return null;

  const safeId = svgSafeId(nodeId);
  const clipId = `pc-stroke-partial-in-${safeId}`;
  const needsClip = pos === "inside";
  const clipPathAttr = needsClip ? `url(#${clipId})` : undefined;

  if (taperEnabled && taperFillD) {
    return (
      <>
        {needsClip ? (
          <PartialSideClipDef clipId={clipId} clipPathD={clipPathD} uniformRect={uniformRect} />
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
        <PartialSideClipDef clipId={clipId} clipPathD={clipPathD} uniformRect={uniformRect} />
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
): { strokePaint: string; defsEl: ReactNode; underlayEl: ReactNode } {
  const strokeDefs: string[] = [];
  if (!showStroke) {
    return { strokePaint: "none", defsEl: null, underlayEl: null };
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
  return { strokePaint, defsEl, underlayEl };
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
    uniformRect?: { width: number; height: number; rx: number };
    closed?: boolean;
    assets?: Record<string, EditorAsset>;
  },
): ReactNode {
  const closed = opts.closed ?? true;
  const position = node.strokePosition ?? "center";
  const { strokePaint, defsEl, underlayEl } = strokePaintWithDefs(node, opts.showStroke, opts.assets);

  const borderFills = usesPerEdgeStroke(node) ? roundedRectBorderFills(node) : null;
  if (borderFills?.length) {
    const fillLayer =
      opts.fill !== "none" ? (
        opts.uniformRect ? (
          <rect
            x={0}
            y={0}
            width={opts.uniformRect.width}
            height={opts.uniformRect.height}
            rx={opts.uniformRect.rx}
            ry={opts.uniformRect.rx}
            fill={opts.fill}
          />
        ) : (
          <path d={opts.pathD} fill={opts.fill} />
        )
      ) : null;

    const strokeLayers = borderFills.map((fill) => (
      <path
        key={fill.side}
        d={fill.pathD}
        fill={strokeBandFillPaint(node, fill.side, strokePaint)}
      />
    ));

    if (position === "outside") {
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
    opts.showStroke &&
    closed &&
    !usesPerEdgeStroke(node) &&
    effectiveStrokeType(node) === "gradient"
  ) {
    const outlined = outlineStroke(node as EditorNode);
    if (outlined?.pathD) {
      const fillLayer =
        opts.fill !== "none" ? (
          opts.uniformRect ? (
            <rect
              x={0}
              y={0}
              width={opts.uniformRect.width}
              height={opts.uniformRect.height}
              rx={opts.uniformRect.rx}
              ry={opts.uniformRect.rx}
              fill={opts.fill}
            />
          ) : (
            <path d={opts.pathD} fill={opts.fill} />
          )
        ) : null;
      const strokeEl = (
        <path
          d={outlined.pathD}
          fill={strokePaint}
          fillRule={outlined.fillRule !== "nonzero" ? outlined.fillRule : undefined}
        />
      );
      if (position === "outside") {
        return wrapStrokeLayers(
          defsEl,
          underlayEl,
          <>
            {strokeEl}
            {fillLayer}
          </>,
        );
      }
      return wrapStrokeLayers(
        defsEl,
        underlayEl,
        <>
          {fillLayer}
          {strokeEl}
        </>,
      );
    }
  }

  if (strokeUsesAxisAlignedRects(node, node.width, node.height)) {
    const sides = resolveStrokeSides(node);
    const sideWidths = resolveStrokeSideWidths(node);
    const rects = strokeEdgeRects(node.width, node.height, position, sides, sideWidths);
    return wrapStrokeLayers(
      defsEl,
      underlayEl,
      <>
        {opts.fill !== "none" ? (
          opts.uniformRect ? (
            <rect
              x={0}
              y={0}
              width={opts.uniformRect.width}
              height={opts.uniformRect.height}
              rx={opts.uniformRect.rx}
              ry={opts.uniformRect.rx}
              fill={opts.fill}
            />
          ) : (
            <path d={opts.pathD} fill={opts.fill} />
          )
        ) : null}
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
        uniformRect={opts.uniformRect}
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
      uniformRect={opts.uniformRect}
      contour={contour}
    />,
  );
}
