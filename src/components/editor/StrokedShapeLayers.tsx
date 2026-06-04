"use client";

import type { ReactNode } from "react";
import { svgSafeId } from "@/lib/svgMarkupCore";
import {
  alignedPathStrokeWidth,
  resolveStrokeSides,
  shouldUseAlignedPathStroke,
  strokeEdgeRects,
  usesPerEdgeStroke,
  type StrokeEdgeRect,
} from "@/lib/strokeAlign";
import type { SvgStrokePresentation } from "@/lib/stroke";
import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";

function EdgeStrokeRects({
  rects,
  color,
}: {
  rects: StrokeEdgeRect[];
  color: string;
}) {
  return (
    <>
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={Math.max(0, r.width)}
          height={Math.max(0, r.height)}
          fill={color}
        />
      ))}
    </>
  );
}

/** Closed shape fill + stroke with Figma-like inside/center/outside alignment. */
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
}) {
  const pos = strokePosition ?? "center";
  const sw = Math.max(0, strokeWidth);
  const safeId = svgSafeId(nodeId);

  if (!showStroke || sw <= 0) {
    if (uniformRect) {
      return (
        <rect
          x={0}
          y={0}
          width={uniformRect.width}
          height={uniformRect.height}
          rx={uniformRect.rx}
          ry={uniformRect.rx}
          fill={fill}
        />
      );
    }
    return <path d={pathD} fill={fill} />;
  }

  if (pos === "center") {
    const strokeProps = {
      fill,
      stroke: strokeColor,
      strokeWidth: sw,
      strokeDasharray: strokePresentation.strokeDasharray,
      strokeLinecap: strokePresentation.strokeLinecap,
      strokeLinejoin: strokePresentation.strokeLinejoin,
      strokeMiterlimit: strokePresentation.strokeMiterlimit,
    };
    if (uniformRect) {
      return <rect x={0} y={0} {...uniformRect} rx={uniformRect.rx} ry={uniformRect.rx} {...strokeProps} />;
    }
    return <path d={pathD} {...strokeProps} />;
  }

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
        <path d={pathD} fill={fill} />
        <path d={pathD} clipPath={`url(#${clipId})`} {...strokeOnly} />
      </>
    );
  }

  return (
    <>
      <path d={pathD} {...strokeOnly} />
      <path d={pathD} fill={fill} />
    </>
  );
}

export function renderShapeStrokeLayers(
  node: Pick<
    EditorNode,
    "id" | "type" | "width" | "height" | "strokePosition" | "strokeSides" | "strokeSidesCustom"
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
  },
): ReactNode {
  const closed = opts.closed ?? true;
  const position = node.strokePosition ?? "center";

  if (usesPerEdgeStroke(node)) {
    const sides = resolveStrokeSides(node);
    const rects = strokeEdgeRects(node.width, node.height, opts.strokeWidth, position, sides);
    return (
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
        {opts.showStroke ? <EdgeStrokeRects rects={rects} color={opts.strokeColor} /> : null}
      </>
    );
  }

  if (shouldUseAlignedPathStroke(node, closed)) {
    return (
      <StrokedClosedPath
        nodeId={node.id}
        pathD={opts.pathD}
        fill={opts.fill}
        showStroke={opts.showStroke}
        strokeColor={opts.strokeColor}
        strokeWidth={opts.strokeWidth}
        strokePosition={position}
        strokePresentation={opts.strokePresentation}
        uniformRect={opts.uniformRect}
      />
    );
  }

  return (
    <StrokedClosedPath
      nodeId={node.id}
      pathD={opts.pathD}
      fill={opts.fill}
      showStroke={opts.showStroke}
      strokeColor={opts.strokeColor}
      strokeWidth={opts.strokeWidth}
      strokePosition="center"
      strokePresentation={opts.strokePresentation}
      uniformRect={opts.uniformRect}
    />
  );
}
