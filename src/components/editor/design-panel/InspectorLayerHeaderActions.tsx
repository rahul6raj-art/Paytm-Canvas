"use client";

import { CreateComponentDropdown } from "./CreateComponentDropdown";

export function InspectorLayerHeaderActions({
  locked,
  showMakeComponent,
  showCreateComponentSet,
}: {
  locked?: boolean;
  showMakeComponent?: boolean;
  showCreateComponentSet?: boolean;
}) {
  if (!showMakeComponent && !showCreateComponentSet) return null;

  return (
    <div className="flex items-center gap-1">
      <CreateComponentDropdown disabled={locked} />
    </div>
  );
}
