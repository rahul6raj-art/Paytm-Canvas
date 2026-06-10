import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type PanelFieldKeyDownOptions = {
  onEnter?: () => void;
  onEscape?: () => void;
  /** ArrowUp/ArrowDown — omit for plain text / search fields that use arrows elsewhere. */
  onArrowNudge?: (direction: 1 | -1, shift: boolean, alt: boolean) => void;
};

/** ⌘A / Ctrl+A — select all text; returns true when handled. */
export function trySelectAllPanelField(
  e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement> | KeyboardEvent,
): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.code !== "KeyA") return false;
  const el = e.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  e.stopPropagation();
  el.select();
  return true;
}

export function keyboardNudgeStep(
  baseStep: number,
  decimals: number,
  shift: boolean,
  alt: boolean,
): number {
  let step = baseStep;
  if (shift) step *= 10;
  if (alt) step /= 10;
  if (decimals > 0) {
    const minStep = 10 ** -decimals;
    step = Math.max(minStep, step);
    return Number(step.toFixed(decimals));
  }
  return step;
}

/** Shared inspector / sidebar field keyboard behavior. */
export function handlePanelFieldKeyDown(
  e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  options: PanelFieldKeyDownOptions = {},
): void {
  if (trySelectAllPanelField(e)) return;

  if (e.key === "Enter" && options.onEnter) {
    e.preventDefault();
    options.onEnter();
    return;
  }

  if (e.key === "Escape" && options.onEscape) {
    e.preventDefault();
    options.onEscape();
    return;
  }

  if (options.onArrowNudge && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    e.stopPropagation();
    options.onArrowNudge(e.key === "ArrowUp" ? 1 : -1, e.shiftKey, e.altKey);
  }
}
