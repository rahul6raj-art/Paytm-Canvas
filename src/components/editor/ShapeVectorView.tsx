"use client";

import { pathToSvgD } from "@/lib/pathGeometry";
import { effectiveFillType, fillPaintCss } from "@/lib/fillGradient";
import { ShapeGradientFill } from "./ShapeGradientFill";
import type { EditorNode } from "@/stores/useEditorStore";

function strokeDashArray(style: EditorNode["strokeStyle"], sw: number): string | undefined {
  if (style === "dashed") return `${sw * 4} ${sw * 2}`;
  if (style === "dotted") return `${sw} ${sw * 1.5}`;
  return undefined;
}

/** SVG vector body for shapes — sharper than CSS borders under canvas zoom transforms. */
export function ShapeVectorView({ node, nodeId }: { node: EditorNode; nodeId: string }) {
  const sw = node.strokeWidth ?? 0;
  const sc = node.strokeColor ?? "#0f172a";
  const fill = fillPaintCss(node);
  const isGradientFill = effectiveFillType(node) === "gradient";
  const showShapeFill = node.fillEnabled !== false && isGradientFill;
  const fillVisible = node.fillEnabled !== false;
  const solidFill = fillVisible && !showShapeFill ? fill : "none";
  const dash = strokeDashArray(node.strokeStyle, sw);
  const strokeProps = {
    stroke: sw > 0 ? sc : "none",
    strokeWidth: sw,
    strokeDasharray: dash,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  if (node.type === "rectangle") {
    const r = Math.min(node.cornerRadius ?? 0, node.width / 2, node.height / 2);
    return (
      <>
        {showShapeFill ? <ShapeGradientFill node={node} nodeId={nodeId} shape="rect" /> : null}
        <svg
          className="pointer-events-none absolute inset-0 block overflow-visible"
          width={node.width}
          height={node.height}
          aria-hidden
        >
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
      <svg
        className="pointer-events-none absolute inset-0 block overflow-visible"
        width={node.width}
        height={node.height}
        aria-hidden
      >
        <line x1={0} y1={mid} x2={node.width} y2={mid} fill="none" {...strokeProps} />
      </svg>
    );
  }

  if (node.type === "path") {
    const pts = node.pathPoints ?? [];
    const closed = node.pathClosed ?? false;
    const d = node.flattenedPathData ?? pathToSvgD(pts, closed);
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
          <path
            d={d || "M0 0"}
            fill={closed && fillVisible && !showShapeFill ? solidFill : "none"}
            {...strokeProps}
          />
        </svg>
      </>
    );
  }

  return null;
}
