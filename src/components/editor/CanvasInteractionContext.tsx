"use client";

import { createContext, useContext } from "react";

export type CanvasInteractionState = {
  spaceDown: boolean;
  panning: boolean;
  /** Option / Alt held — measurements outside selection; copy cursor on selection. */
  optionDown: boolean;
  /** Pointer is over selected bounds while Option is held (duplicate, not measure). */
  optionOverSelection: boolean;
  /** Deepest layer under pointer while Option is held (for measure target). */
  optionPointerHoverId: string | null;
};

export const CanvasInteractionContext = createContext<CanvasInteractionState>({
  spaceDown: false,
  panning: false,
  optionDown: false,
  optionOverSelection: false,
  optionPointerHoverId: null,
});

export function useCanvasInteraction(): CanvasInteractionState {
  return useContext(CanvasInteractionContext);
}
