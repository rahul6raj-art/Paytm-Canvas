"use client";

import { createContext, useContext } from "react";

export type ToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export const CanvasToWorldContext = createContext<ToWorldFn | null>(null);

export function useCanvasToWorld(): ToWorldFn | null {
  return useContext(CanvasToWorldContext);
}
