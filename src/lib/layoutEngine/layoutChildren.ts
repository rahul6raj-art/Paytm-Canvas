import { assignFillMainSizes } from "./sizing";
import {
  childCrossSizing,
  childMainSizing,
  type CrossAxisAlign,
  type LayoutChildPatch,
  type LayoutEngineNode,
  type LayoutMode,
  type PrimaryAxisAlign,
  flowGapForSizing,
  flowGapSpan,
} from "./types";
import type { MeasuredChild as MC } from "./measure";
import { canFillOnMainAxis, clampLayoutSize } from "./layoutConstraints";

export type FlowLine = {
  childIds: string[];
  measures: MC[];
  mainTotal: number;
  crossMax: number;
};

/** Pack children into lines when wrap is enabled (horizontal → rows, vertical → columns). */
export function buildFlowLines(
  mode: Exclude<LayoutMode, "none">,
  childIds: string[],
  measures: MC[],
  innerMain: number,
  gap: number,
  wrap: boolean,
): FlowLine[] {
  if (!wrap || childIds.length === 0) {
    return [
      {
        childIds,
        measures,
        mainTotal:
          measures.reduce((s, m) => s + m.main, 0) + flowGapForSizing(gap, measures.length),
        crossMax: measures.length ? Math.max(...measures.map((m) => m.cross)) : 0,
      },
    ];
  }

  const lines: FlowLine[] = [];
  let curIds: string[] = [];
  let curMeasures: MC[] = [];
  let curMain = 0;
  let curCrossMax = 0;

  const flush = () => {
    if (curIds.length === 0) return;
    lines.push({
      childIds: curIds,
      measures: curMeasures,
      mainTotal: curMain,
      crossMax: curCrossMax,
    });
    curIds = [];
    curMeasures = [];
    curMain = 0;
    curCrossMax = 0;
  };

  for (let i = 0; i < childIds.length; i++) {
    const id = childIds[i]!;
    const m = measures[i]!;
    const addGap = curIds.length > 0 ? gap : 0;
    const nextMain = curMain + addGap + m.main;

    if (curIds.length > 0 && nextMain > innerMain + 0.5) {
      flush();
    }

    const g = curIds.length > 0 ? gap : 0;
    curIds.push(id);
    curMeasures.push(m);
    curMain += g + m.main;
    curCrossMax = Math.max(curCrossMax, m.cross);
  }
  flush();

  return lines.length > 0 ? lines : [{ childIds: [], measures: [], mainTotal: 0, crossMax: 0 }];
}

function alignMainCursor(
  primary: PrimaryAxisAlign,
  innerMain: number,
  lineMain: number,
  childCount: number,
): { start: number; between: number } {
  const extra = innerMain - lineMain;
  if (primary === "center") return { start: extra / 2, between: 0 };
  if (primary === "end") return { start: extra, between: 0 };
  if (primary === "space-between" && childCount > 1) {
    return { start: 0, between: extra / (childCount - 1) };
  }
  if (primary === "space-between" && childCount === 1) {
    return { start: extra / 2, between: 0 };
  }
  return { start: 0, between: 0 };
}

function crossPosition(
  cross: CrossAxisAlign,
  innerCross: number,
  crossSize: number,
  effectiveStretch: boolean,
): { pos: number; size: number } {
  if (effectiveStretch) return { pos: 0, size: innerCross };
  if (cross === "center") return { pos: (innerCross - crossSize) / 2, size: crossSize };
  if (cross === "end") return { pos: innerCross - crossSize, size: crossSize };
  return { pos: 0, size: crossSize };
}

export type LayoutChildrenInput = {
  mode: Exclude<LayoutMode, "none">;
  parent: LayoutEngineNode;
  childIds: string[];
  measures: MC[];
  nodes: Record<string, LayoutEngineNode>;
  innerW: number;
  innerH: number;
  padLeft: number;
  padTop: number;
  gap: number;
  primary: PrimaryAxisAlign;
  cross: CrossAxisAlign;
  wrap: boolean;
};

/**
 * Position flow children inside the parent's content box.
 * Returns local x/y/width/height patches.
 */
export function layoutChildren(input: LayoutChildrenInput): Record<string, LayoutChildPatch> {
  const {
    mode,
    parent,
    childIds,
    measures,
    nodes,
    innerW,
    innerH,
    padLeft,
    padTop,
    gap,
    primary,
    cross,
    wrap,
  } = input;

  const out: Record<string, LayoutChildPatch> = {};
  if (childIds.length === 0) return out;

  const innerMain = mode === "horizontal" ? innerW : innerH;
  const innerCross = mode === "horizontal" ? innerH : innerW;

  const lines = buildFlowLines(mode, childIds, measures, innerMain, gap, wrap);

  const fillSizesById = canFillOnMainAxis(parent, mode)
    ? assignFillMainSizes(innerMain, childIds, measures, nodes, mode, gap)
    : {};

  // Cross-axis: stack lines (wrap) with gap between lines
  const lineCrossSizes = lines.map((l) => l.crossMax);
  const lineCrossTotal =
    lineCrossSizes.reduce((a, b) => a + b, 0) + flowGapSpan(gap, lines.length);
  const crossExtra = innerCross - lineCrossTotal;
  let lineCrossCursor = 0;
  if (cross === "center") lineCrossCursor = crossExtra / 2;
  else if (cross === "end") lineCrossCursor = crossExtra;

  for (const line of lines) {
    const { start: mainStart, between } = alignMainCursor(
      primary,
      innerMain,
      line.mainTotal,
      line.childIds.length,
    );
    let mainCursor = mainStart;

    for (let i = 0; i < line.childIds.length; i++) {
      const id = line.childIds[i]!;
      const child = nodes[id]!;
      const m0 = line.measures[i]!;
      const mainMode = childMainSizing(child, mode);
      const crossMode = childCrossSizing(child, mode);

      const mainSize =
        mainMode === "fill" && canFillOnMainAxis(parent, mode)
          ? (fillSizesById[id] ?? m0.main)
          : m0.main;
      let crossSize = m0.cross;
      const crossFill = crossMode === "fill";
      const effectiveStretch = crossFill || cross === "stretch";
      const crossBounds = crossFill ? innerCross : line.crossMax;
      const { pos: crossOff, size: crossSz } = crossPosition(
        cross,
        crossBounds,
        crossSize,
        effectiveStretch,
      );
      crossSize = crossSz;

      const sized = clampLayoutSize(
        child,
        mode === "horizontal" ? mainSize : crossSize,
        mode === "horizontal" ? crossSize : mainSize,
      );

      const localX =
        mode === "horizontal" ? padLeft + mainCursor : padLeft + lineCrossCursor + crossOff;
      const localY =
        mode === "horizontal" ? padTop + lineCrossCursor + crossOff : padTop + mainCursor;

      if (mode === "horizontal") {
        out[id] = {
          x: localX,
          y: localY,
          width: sized.width,
          height: sized.height,
          computedWidth: sized.width,
          computedHeight: sized.height,
          layoutDirty: false,
        };
        mainCursor += sized.width + gap + between;
      } else {
        out[id] = {
          x: localX,
          y: localY,
          width: sized.width,
          height: sized.height,
          computedWidth: sized.width,
          computedHeight: sized.height,
          layoutDirty: false,
        };
        mainCursor += sized.height + gap + between;
      }
    }

    lineCrossCursor += line.crossMax + gap;
  }

  return out;
}
