"use client";

import type { ReactNode } from "react";
import type { BooleanRenderModel } from "@/lib/booleanGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import { svgSafeId } from "@/lib/svgMarkupCore";
import { svgStrokePropsFromNode } from "@/lib/stroke";

/** Canvas boolean preview — same mask/clip strategy as code export. */
export function BooleanCompositeSvg({
  render,
  groupId,
  node,
  width,
  height,
  fill,
}: {
  render: BooleanRenderModel;
  groupId: string;
  node: EditorNode;
  width: number;
  height: number;
  fill: string;
}) {
  const safe = svgSafeId(groupId);
  const strokeOn = Boolean(node.strokeColor && (node.strokeWidth ?? 0) > 0);
  const strokeProps = strokeOn ? svgStrokePropsFromNode(node) : {};
  const pathCommon = {
    fill,
    fillOpacity: node.fillOpacity ?? 1,
    stroke: strokeOn ? node.strokeColor : "none",
    strokeWidth: node.strokeWidth ?? 0,
    ...strokeProps,
    pointerEvents: "none" as const,
  };

  if (render.op === "union") {
    return (
      <svg
        className="absolute inset-0 overflow-visible"
        width={width}
        height={height}
        aria-hidden
      >
        {render.pathDs.map((d, i) => (
          <path key={i} d={d} {...pathCommon} />
        ))}
      </svg>
    );
  }

  if (render.op === "subtract") {
    const maskId = `pc-sub-mask-${safe}`;
    return (
      <svg
        className="absolute inset-0 overflow-visible"
        width={width}
        height={height}
        aria-hidden
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <path d={render.baseD} fill="white" />
            <path d={render.subtractD} fill="black" />
          </mask>
        </defs>
        <path d={render.baseD} mask={`url(#${maskId})`} {...pathCommon} />
      </svg>
    );
  }

  if (render.op === "intersect") {
    const clipIds = render.pathDs.map((_, i) => `pc-int-${safe}-${i}`);
    let inner: ReactNode = <path d={render.pathDs[0]} {...pathCommon} />;
    for (let i = render.pathDs.length - 1; i >= 0; i--) {
      const clipId = clipIds[i]!;
      inner = (
        <g key={clipId} clipPath={`url(#${clipId})`}>
          {inner}
        </g>
      );
    }
    return (
      <svg
        className="absolute inset-0 overflow-visible"
        width={width}
        height={height}
        aria-hidden
      >
        <defs>
          {render.pathDs.map((d, i) => (
            <clipPath key={clipIds[i]} id={clipIds[i]} clipPathUnits="userSpaceOnUse">
              <path d={d} />
            </clipPath>
          ))}
        </defs>
        {inner}
      </svg>
    );
  }

  if (render.op === "exclude") {
    return (
      <svg
        className="absolute inset-0 overflow-visible"
        width={width}
        height={height}
        aria-hidden
      >
        <defs>
          {render.pathDs.map((d, i) => {
            const maskId = `pc-exc-mask-${safe}-${i}`;
            return (
              <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse">
                <path d={d} fill="white" />
                {render.pathDs.map((other, j) =>
                  j !== i ? <path key={j} d={other} fill="black" /> : null,
                )}
              </mask>
            );
          })}
        </defs>
        {render.pathDs.map((d, i) => {
          const maskId = `pc-exc-mask-${safe}-${i}`;
          return <path key={i} d={d} mask={`url(#${maskId})`} {...pathCommon} />;
        })}
      </svg>
    );
  }

  return null;
}
