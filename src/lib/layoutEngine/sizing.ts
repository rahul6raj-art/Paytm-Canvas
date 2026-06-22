/**
 * Fill distribution along the main axis when children use fill sizing.
 * Pass 4 calculates remaining space; pass 5 assigns it to FILL children.
 */

import {
  childMainSizing,
  clampDimension,
  flowGapForSizing,
  type LayoutEngineNode,
  type LayoutMode,
} from "./types";
import type { MeasuredChild } from "./measure";
import { clampMainAxisSize } from "./layoutConstraints";

/** Split remaining main-axis space evenly among fill children. */
export function resolveFillSize(
  availableMain: number,
  fixedMainTotal: number,
  gapTotal: number,
  fillCount: number,
): number {
  if (fillCount <= 0) return 0;
  const extra = Math.max(0, availableMain - fixedMainTotal - gapTotal);
  return Math.max(1, extra / fillCount);
}

export type FillGrowEntry = { id: string; grow: number };

/**
 * Pass 4 — remaining main-axis space after FIXED and HUG children are measured.
 * FILL children are excluded from the consumed total.
 */
export function calculateRemainingMainSpace(
  innerMain: number,
  childIds: string[],
  measures: MeasuredChild[],
  nodes: Record<string, LayoutEngineNode>,
  mode: Exclude<LayoutMode, "none">,
  gap: number,
): number {
  const fixedAndHugMain = childIds.reduce((sum, id, i) => {
    return childMainSizing(nodes[id]!, mode) === "fill" ? sum : sum + measures[i]!.main;
  }, 0);
  const gapTotal = flowGapForSizing(gap, childIds.length);
  return Math.max(0, innerMain - fixedAndHugMain - gapTotal);
}

/**
 * Pass 5 — distribute remaining main-axis space by layoutGrow weights.
 * When total grow is 0, falls back to even split.
 */
export function assignFillMainSizes(
  innerMain: number,
  childIds: string[],
  measures: MeasuredChild[],
  nodes: Record<string, LayoutEngineNode>,
  mode: Exclude<LayoutMode, "none">,
  gap: number,
): Record<string, number> {
  const fillEntries = childIds
    .filter((id) => childMainSizing(nodes[id]!, mode) === "fill")
    .map((id) => ({ id, grow: nodes[id]!.layoutGrow ?? 1 }));

  if (fillEntries.length === 0) return {};

  const fixedMain = childIds.reduce((sum, id, i) => {
    return childMainSizing(nodes[id]!, mode) === "fill" ? sum : sum + measures[i]!.main;
  }, 0);

  return resolveFillSizesByGrow(
    innerMain,
    fixedMain,
    flowGapForSizing(gap, childIds.length),
    fillEntries,
    nodes,
    mode,
  );
}

export function resolveFillSizesByGrow(
  availableMain: number,
  fixedMainTotal: number,
  gapTotal: number,
  entries: FillGrowEntry[],
  nodes?: Record<string, LayoutEngineNode>,
  mode?: Exclude<LayoutMode, "none">,
): Record<string, number> {
  if (entries.length === 0) return {};
  const extra = Math.max(0, availableMain - fixedMainTotal - gapTotal);
  const totalGrow = entries.reduce((s, e) => s + Math.max(0, e.grow ?? 0), 0);
  const assign = (raw: number, id: string): number => {
    if (nodes && mode) {
      return clampMainAxisSize(nodes[id]!, mode, raw);
    }
    return Math.max(1, raw);
  };
  if (totalGrow <= 0) {
    const each = extra > 0 ? extra / entries.length : 0;
    return Object.fromEntries(entries.map((e) => [e.id, assign(Math.max(1, each), e.id)]));
  }
  const out: Record<string, number> = {};
  for (const e of entries) {
    const w = Math.max(0, e.grow ?? 0);
    out[e.id] = assign(Math.max(1, (extra * w) / totalGrow), e.id);
  }
  return out;
}

/** @deprecated Use assignFillMainSizes */
export const calculateFillSpace = resolveFillSizesByGrow;
