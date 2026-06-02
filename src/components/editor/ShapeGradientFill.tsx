"use client";

import { effectiveFillType, svgFillPaint } from "@/lib/fillGradient";
import {
  clampCornerRadii,
  getNodeCornerRadii,
  isUniformCornerRadii,
  roundedRectPathD,
  uniformCornerRadiusForRect,
} from "@/lib/cornerRadius";
import type { EditorNode } from "@/stores/useEditorStore";

type ShapeKind = "rect" | "ellipse" | "path";

export function ShapeGradientFill({
  node,
  nodeId,
  shape,
  pathD,
}: {
  node: EditorNode;
  nodeId: string;
  shape: ShapeKind;
  pathD?: string;
}) {
  if (node.fillEnabled === false || effectiveFillType(node) !== "gradient") return null;

  const gradId = `pc-g-${nodeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const defs: string[] = [];
  const fillRef = svgFillPaint(node, {
    gradientId: gradId,
    width: node.width,
    height: node.height,
    registerGradient: (id, markup) => {
      defs.push(markup);
    },
  });

  const radii = clampCornerRadii(getNodeCornerRadii(node), node.width, node.height);
  const uniform = isUniformCornerRadii(radii);
  const r = uniformCornerRadiusForRect(node, node.width, node.height);
  const rectPathD = uniform ? null : roundedRectPathD(node.width, node.height, radii);
  const closed = node.pathClosed ?? false;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      width={node.width}
      height={node.height}
      aria-hidden
    >
      {defs.length > 0 ? <defs dangerouslySetInnerHTML={{ __html: defs.join("") }} /> : null}
      {shape === "ellipse" ? (
        <ellipse
          cx={node.width / 2}
          cy={node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          fill={fillRef}
        />
      ) : shape === "path" && pathD ? (
        <path d={pathD} fill={closed ? fillRef : "none"} />
      ) : rectPathD ? (
        <path d={rectPathD} fill={fillRef} />
      ) : (
        <rect x={0} y={0} width={node.width} height={node.height} rx={r} fill={fillRef} />
      )}
    </svg>
  );
}
