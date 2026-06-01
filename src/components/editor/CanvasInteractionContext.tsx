"use client";

import { createContext, useContext } from "react";

export type CanvasInteractionState = {
  spaceDown: boolean;
  panning: boolean;
};

export const CanvasInteractionContext = createContext<CanvasInteractionState>({
  spaceDown: false,
  panning: false,
});

export function useCanvasInteraction(): CanvasInteractionState {
  return useContext(CanvasInteractionContext);
}
