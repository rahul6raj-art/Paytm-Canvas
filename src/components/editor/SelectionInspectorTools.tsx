"use client";

import { BooleanToolbarDropdown } from "./BooleanToolbarDropdown";
import { StrokeWidthToolbar } from "./StrokeWidthToolbar";

/** Align / boolean / stroke controls for the right properties panel (not on canvas). */
export function SelectionInspectorTools() {
  return (
    <div
      className="flex w-full flex-col gap-2 rounded-md border border-app-border bg-white/[0.02] p-2.5"
      data-selection-inspector-tools
    >
      <div className="section-heading">Selection</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <BooleanToolbarDropdown />
        <StrokeWidthToolbar />
      </div>
    </div>
  );
}
