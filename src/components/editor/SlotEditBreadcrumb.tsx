"use client";

import { ChevronLeft } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";

/** Breadcrumb bar for nested slot edit sessions. */
export function SlotEditBreadcrumb() {
  const activeSlotEdit = useEditorStore((s) => s.activeSlotEdit);
  const exitSlotEditMode = useEditorStore((s) => s.exitSlotEditMode);
  const navigateSlotEditBreadcrumb = useEditorStore((s) => s.navigateSlotEditBreadcrumb);

  if (!activeSlotEdit?.breadcrumb.length) return null;

  return (
    <div
      className="pointer-events-auto absolute left-3 top-3 z-[25] flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-950/90 px-2 py-1 text-ui shadow-lg backdrop-blur-sm"
      data-testid="slot-edit-breadcrumb"
    >
      {activeSlotEdit.breadcrumb.map((crumb, idx) => {
        const isLast = idx === activeSlotEdit.breadcrumb.length - 1;
        return (
          <span key={`${crumb.instanceRootId}-${crumb.propertyKey}`} className="inline-flex items-center gap-1">
            {idx > 0 ? <span className="text-violet-300/60">/</span> : null}
            {isLast ? (
              <span className="font-medium text-violet-100">{crumb.label.split(" / ").pop()}</span>
            ) : (
              <button
                type="button"
                className="text-violet-200/80 hover:text-violet-50"
                onClick={() => navigateSlotEditBreadcrumb(idx)}
              >
                {crumb.label.split(" / ")[0]}
              </button>
            )}
          </span>
        );
      })}
      <button
        type="button"
        className="ml-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-violet-100 hover:bg-violet-400/20"
        data-testid="slot-edit-done"
        onClick={() => exitSlotEditMode(true)}
      >
        <ChevronLeft className="h-3 w-3" />
        Done
      </button>
    </div>
  );
}
