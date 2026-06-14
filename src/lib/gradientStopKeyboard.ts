import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { effectiveFillType, resolveEditableFillGradient } from "@/lib/fillGradient";
import { removeStop } from "@/lib/gradient";
import { shouldBlockDeleteSelectionShortcut } from "@/lib/editorKeyboardFocus";
import { useEditorStore } from "@/stores/useEditorStore";

export type ActiveGradientStopTarget = {
  nodeId: string;
  stopId: string;
};

let activeTarget: ActiveGradientStopTarget | null = null;

export function setActiveGradientStopTarget(target: ActiveGradientStopTarget | null): void {
  activeTarget = target;
}

export function getActiveGradientStopTarget(): ActiveGradientStopTarget | null {
  return activeTarget;
}

/** Delete the focused gradient stop when Delete/Backspace is pressed (Figma-style). */
export function tryDeleteActiveGradientStop(e: KeyboardEvent, target: EventTarget | null): boolean {
  if (e.code !== "Backspace" && e.code !== "Delete") return false;
  if (shouldBlockDeleteSelectionShortcut(e, target)) return false;
  if (!activeTarget) return false;

  const st = useEditorStore.getState();
  if (st.editorMode !== "design") return false;
  if (st.selectedIds.length !== 1 || st.selectedIds[0] !== activeTarget.nodeId) return false;

  const node = st.nodes[activeTarget.nodeId];
  if (!node || node.locked || node.visible === false) return false;

  const resolved = resolveNodeWithDesignTokens(node, st.designTokens);
  if (effectiveFillType(resolved) !== "gradient") return false;

  const gradient = resolveEditableFillGradient(resolved);
  const next = removeStop(gradient, activeTarget.stopId);
  if (!next) return false;

  e.preventDefault();
  st.updateNodeStyle(activeTarget.nodeId, { fillGradient: next });
  st.pushHistory();

  const sorted = [...next.stops].sort((a, b) => a.position - b.position);
  const fallback = sorted[0];
  activeTarget = fallback ? { nodeId: activeTarget.nodeId, stopId: fallback.id } : null;
  return true;
}
