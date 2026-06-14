import {
  getRenderedWorldTopLeft,
  topLevelSelectedIds,
} from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

/** Figma Cmd+D repeat-offset chain (not Option/Alt drag duplicate). */

export type WorldPoint = { x: number; y: number };
export type WorldDelta = { dx: number; dy: number };

type DuplicateRepeatState = {
  duplicateIds: string[];
  anchorWorldById: Record<string, WorldPoint>;
  stepWorld: WorldDelta | null;
};

let state: DuplicateRepeatState | null = null;

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

function idsEqual(a: readonly string[], b: readonly string[]): boolean {
  const sa = sortedIds(a);
  const sb = sortedIds(b);
  return sa.length === sb.length && sa.every((id, i) => id === sb[i]);
}

export function resetDuplicateRepeatOffset(): void {
  state = null;
}

export function selectionMatchesDuplicateChain(tops: readonly string[]): boolean {
  if (!state || tops.length === 0) return false;
  return idsEqual(tops, state.duplicateIds);
}

/** Step offset for the next duplicate when the selection is a prior duplicate result. */
export function getDuplicateStepOffset(tops: readonly string[]): WorldDelta | null {
  if (!selectionMatchesDuplicateChain(tops)) return null;
  const step = state?.stepWorld;
  if (!step || (step.dx === 0 && step.dy === 0)) return null;
  return step;
}

export function recordDuplicateCreated(
  duplicateTopIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const anchorWorldById: Record<string, WorldPoint> = {};
  for (const id of duplicateTopIds) {
    anchorWorldById[id] = getRenderedWorldTopLeft(id, nodes, childOrder);
  }
  state = {
    duplicateIds: [...duplicateTopIds],
    anchorWorldById,
    stepWorld: state?.stepWorld ?? null,
  };
}

/** Clear repeat state when the user selects something outside the duplicate chain. */
export function syncDuplicateRepeatSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): void {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
  if (!selectionMatchesDuplicateChain(tops)) {
    resetDuplicateRepeatOffset();
  }
}

/** Recompute step offset after the duplicate chain is moved (drag, nudge, inspector). */
export function refreshDuplicateStepAfterMove(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
  if (!state || !selectionMatchesDuplicateChain(tops)) return;

  let dx = 0;
  let dy = 0;
  let count = 0;
  for (const id of tops) {
    const anchor = state.anchorWorldById[id];
    if (!anchor) continue;
    const cur = getRenderedWorldTopLeft(id, nodes, childOrder);
    dx += cur.x - anchor.x;
    dy += cur.y - anchor.y;
    count += 1;
  }
  if (count === 0) return;

  const step: WorldDelta = { dx: dx / count, dy: dy / count };
  state = {
    ...state,
    stepWorld: step.dx === 0 && step.dy === 0 ? null : step,
  };
}

/** For tests. */
export function getDuplicateRepeatStateForTest(): DuplicateRepeatState | null {
  return state;
}
