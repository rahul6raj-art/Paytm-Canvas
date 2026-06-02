import { resolveFillSize } from "./sizing";
import {
  childCrossSizing,
  childMainSizing,
  type CrossAxisAlign,
  type LayoutChildPatch,
  type LayoutEngineNode,
  type LayoutMode,
  type PrimaryAxisAlign,
} from "./types";
import type { MeasuredChild as MC } from "./measure";

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
        mainTotal: measures.reduce((s, m) => s + m.main, 0) + gap * Math.max(0, measures.length - 1),
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

  const fillCount = childIds.filter((id) => childMainSizing(nodes[id]!, mode) === "fill").length;
  const fixedMain = childIds.reduce((sum, id, i) => {
    return childMainSizing(nodes[id]!, mode) === "fill" ? sum : sum + measures[i]!.main;
  }, 0);
  const fillMain =
    fillCount > 0
      ? resolveFillSize(
          innerMain,
          fixedMain,
          gap * Math.max(0, childIds.length - 1),
          fillCount,
        )
      : 0;

  // Cross-axis: stack lines (wrap) with gap between lines
  const lineCrossSizes = lines.map((l) => l.crossMax);
  const lineCrossTotal =
    lineCrossSizes.reduce((a, b) => a + b, 0) + gap * Math.max(0, lines.length - 1);
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

      const mainSize = mainMode === "fill" ? fillMain : m0.main;
      let crossSize = m0.cross;
      const effectiveStretch = crossMode === "fill" || cross === "stretch";
      const { pos: crossOff, size: crossSz } = crossPosition(
        cross,
        line.crossMax,
        crossSize,
        effectiveStretch,
      );
      crossSize = crossSz;

      if (mode === "horizontal") {
        out[id] = {
          x: padLeft + mainCursor,
          y: padTop + lineCrossCursor + crossOff,
          width: mainSize,
          height: crossSize,
          computedWidth: mainSize,
          computedHeight: crossSize,
          layoutDirty: false,
        };
        mainCursor += mainSize + gap + between;
      } else {
        out[id] = {
          x: padLeft + lineCrossCursor + crossOff,
          y: padTop + mainCursor,
          width: crossSize,
          height: mainSize,
          computedWidth: crossSize,
          computedHeight: mainSize,
          layoutDirty: false,
        };
        mainCursor += mainSize + gap + between;
      }
    }

    lineCrossCursor += line.crossMax + gap;
  }

  return out;
}
