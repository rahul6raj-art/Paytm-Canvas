"use client";

import { CreateComponentDropdown } from "./CreateComponentDropdown";

export function InspectorLayerHeaderActions({
  locked,
  showMakeComponent,
}: {
  locked?: boolean;
  showMakeComponent?: boolean;
}) {
  if (!showMakeComponent) return null;

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <CreateComponentDropdown disabled={locked} />
    </div>
  );
}
