"use client";

import type { BooleanRenderModel } from "@/lib/booleanGeometry";
import { fillCss } from "@/lib/color";
import {
  effectiveFillType,
  fillPaintCss,
  gradientKindUsesCssPaint,
  normalizeFillGradient,
  svgFillPaint,
} from "@/lib/fillGradient";
import { svgSafeId } from "@/lib/svgMarkupCore";
import { resolveSvgStrokePaint, strokeIsVisible, svgStrokePropsFromNode } from "@/lib/stroke";
import type { EditorNode } from "@/stores/useEditorStore";

function booleanFillPaint(
  node: EditorNode,
  groupId: string,
  width: number,
  height: number,
  fallbackFill: string,
): { fill: string; fillDefs: string[]; cssBackground: string | null } {
  if (node.fillEnabled === false) {
    return { fill: "none", fillDefs: [], cssBackground: null };
  }

  if (effectiveFillType(node) === "gradient") {
    const g = normalizeFillGradient(node.fillGradient, node.fill);
    if (gradientKindUsesCssPaint(g.kind)) {
      return { fill: "none", fillDefs: [], cssBackground: fillPaintCss(node) };
    }
    const gradId = `pc-bg-${svgSafeId(groupId)}`;
    const fillDefs: string[] = [];
    const fill = svgFillPaint(node, {
      gradientId: gradId,
      width,
      height,
      registerGradient: (_id, markup) => fillDefs.push(markup),
    });
    return { fill, fillDefs, cssBackground: null };
  }

  const solid =
    node.fill != null
      ? fillCss(node.fill, node.fillOpacity, node.fillEnabled)
      : fallbackFill;
  return { fill: solid, fillDefs: [], cssBackground: null };
}

function booleanStrokePaint(
  node: EditorNode,
  groupId: string,
  width: number,
  height: number,
): { stroke: string; strokeDefs: string[] } {
  const showStroke = strokeIsVisible(node);
  const strokeDefs: string[] = [];
  const stroke = showStroke
    ? resolveSvgStrokePaint(node, {
        gradientId: `pc-sg-${svgSafeId(groupId)}`,
        width,
        height,
        registerGradient: (_id, markup) => strokeDefs.push(markup),
      })
    : "none";
  return { stroke, strokeDefs };
}

function CssMaskedBooleanFill({
  pathD,
  groupId,
  width,
  height,
  background,
}: {
  pathD: string;
  groupId: string;
  width: number;
  height: number;
  background: string;
}) {
  const maskId = `pc-bgmask-${svgSafeId(groupId)}`;
  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect x="0" y="0" width={width} height={height} fill="black" />
          <path d={pathD} fill="white" />
        </mask>
      </defs>
      <foreignObject x="0" y="0" width={width} height={height} mask={`url(#${maskId})`}>
        <div
          {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            background,
          }}
        />
      </foreignObject>
    </>
  );
}

function clipperPathD(render: BooleanRenderModel): string | null {
  if (render.op === "clipper") return render.pathD;
  if (render.op === "subtract") return render.baseD;
  if ("pathDs" in render && render.pathDs.length > 0) return render.pathDs.join(" ");
  return null;
}

/** Canvas boolean preview — Clipper2 path for all operand counts. */
export function BooleanCompositeSvg({
  render,
  groupId,
  node,
  width,
  height,
  fallbackFill,
}: {
  render: BooleanRenderModel;
  groupId: string;
  node: EditorNode;
  width: number;
  height: number;
  fallbackFill: string;
}) {
  const pathD = clipperPathD(render);
  if (!pathD) return null;

  const fillRule =
    render.op === "clipper" ? render.fillRule : render.op === "subtract" ? "evenodd" : "nonzero";

  const strokeOn = strokeIsVisible(node);
  const strokeProps = strokeOn ? svgStrokePropsFromNode(node) : {};
  const { fill, fillDefs, cssBackground } = booleanFillPaint(node, groupId, width, height, fallbackFill);
  const { stroke, strokeDefs } = booleanStrokePaint(node, groupId, width, height);

  const pathCommon = {
    fill,
    fillOpacity: node.fillOpacity ?? 1,
    stroke,
    strokeWidth: node.strokeWidth ?? 0,
    ...strokeProps,
    pointerEvents: "none" as const,
  };

  const gradientDefsMarkup = [...fillDefs, ...strokeDefs].join("");

  const cssFillEl =
    cssBackground != null ? (
      <CssMaskedBooleanFill
        pathD={pathD}
        groupId={groupId}
        width={width}
        height={height}
        background={cssBackground}
      />
    ) : null;

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      {gradientDefsMarkup ? (
        <defs dangerouslySetInnerHTML={{ __html: gradientDefsMarkup }} />
      ) : null}
      {cssFillEl}
      <path
        d={pathD}
        fillRule={fillRule}
        {...pathCommon}
        fill={cssBackground ? "none" : pathCommon.fill}
      />
    </svg>
  );
}
