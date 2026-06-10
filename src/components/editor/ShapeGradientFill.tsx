"use client";

import type { ReactNode } from "react";
import {
  effectiveFillType,
  fillPaintCss,
  gradientKindUsesCssPaint,
  normalizeFillGradient,
  svgFillPaint,
} from "@/lib/fillGradient";
import {
  clampCornerRadii,
  getNodeCornerRadii,
  isUniformCornerRadii,
  roundedRectPathD,
  uniformCornerRadiusForRect,
} from "@/lib/cornerRadius";
import {
  effectiveEllipseArc,
  hasEllipseArcInnerHole,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";
import { svgSafeId } from "@/lib/svgMarkupCore";
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

  const g = normalizeFillGradient(node.fillGradient, node.fill);
  if (gradientKindUsesCssPaint(g.kind)) {
    return <CssMaskedGradientFill node={node} nodeId={nodeId} shape={shape} pathD={pathD} />;
  }

  const gradId = `pc-g-${svgSafeId(nodeId)}`;
  const defs: string[] = [];
  const fillRef = svgFillPaint(node, {
    gradientId: gradId,
    width: node.width,
    height: node.height,
    registerGradient: (_id, markup) => {
      defs.push(markup);
    },
  });

  const radii = clampCornerRadii(getNodeCornerRadii(node), node.width, node.height);
  const uniform = isUniformCornerRadii(radii);
  const r = uniformCornerRadiusForRect(node, node.width, node.height);
  const rectPathD = uniform ? null : roundedRectPathD(node.width, node.height, radii);
  const closed = node.pathClosed ?? false;
  const ellipseArc = node.type === "ellipse" ? effectiveEllipseArc(node) : null;
  const ellipseFillEvenOdd =
    ellipseArc != null &&
    hasEllipseArcInnerHole(ellipseArc.innerRadiusRatio) &&
    isFullEllipseArc(ellipseArc.sweepDeg);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      width={node.width}
      height={node.height}
      aria-hidden
    >
      {defs.length > 0 ? <defs dangerouslySetInnerHTML={{ __html: defs.join("") }} /> : null}
      {shape === "ellipse" && pathD ? (
        <path d={pathD} fill={fillRef} fillRule={ellipseFillEvenOdd ? "evenodd" : undefined} />
      ) : shape === "ellipse" ? (
        <ellipse
          cx={node.width / 2}
          cy={node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          fill={fillRef}
        />
      ) : shape === "path" && pathD ? (
        <path
          d={pathD}
          fill={closed ? fillRef : "none"}
          fillRule={node.pathFillRule}
        />
      ) : rectPathD ? (
        <path d={rectPathD} fill={fillRef} />
      ) : (
        <rect x={0} y={0} width={node.width} height={node.height} rx={r} fill={fillRef} />
      )}
    </svg>
  );
}

/** Angular / diamond fills via CSS background clipped to the shape (reliable in the DOM). */
function CssMaskedGradientFill({
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
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const bg = fillPaintCss(node);
  const maskId = `pc-gmask-${svgSafeId(nodeId)}`;

  const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
  const uniform = isUniformCornerRadii(radii);
  const r = uniformCornerRadiusForRect(node, w, h);
  const rectPathD = uniform ? null : roundedRectPathD(w, h, radii);
  const effectivePathD = pathD ?? rectPathD;

  let maskShape: ReactNode;
  if (shape === "ellipse" && effectivePathD) {
    maskShape = <path d={effectivePathD} fill="white" />;
  } else if (shape === "ellipse") {
    maskShape = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="white" />;
  } else if (effectivePathD) {
    maskShape = <path d={effectivePathD} fill="white" />;
  } else {
    maskShape = <rect x={0} y={0} width={w} height={h} rx={r} fill="white" />;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      width={w}
      height={h}
      aria-hidden
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
          <rect x="0" y="0" width={w} height={h} fill="black" />
          {maskShape}
        </mask>
      </defs>
      <foreignObject x="0" y="0" width={w} height={h} mask={`url(#${maskId})`}>
        <div
          {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}
          style={{
            width: `${w}px`,
            height: `${h}px`,
            background: bg,
          }}
        />
      </foreignObject>
    </svg>
  );
}
