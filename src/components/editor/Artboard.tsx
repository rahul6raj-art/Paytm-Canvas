"use client";

/** Root frame shell; label is rendered by `RootFrameLabels` on the canvas. */
export function Artboard({ children }: { children: React.ReactNode }) {
  return <div className="relative h-full w-full overflow-hidden">{children}</div>;
}
