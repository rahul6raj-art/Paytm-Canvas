"use client";

import { CanvasColorModeToggle } from "@/components/editor/CanvasColorModeToggle";
import { cn } from "@/lib/utils";

type DesignColorModeSectionProps = {
  className?: string;
  compact?: boolean;
};

/** Light/dark preview for linked design tokens — not the Craft app UI theme (moon icon). */
export function DesignColorModeSection({ className, compact = false }: DesignColorModeSectionProps) {
  return (
    <div className={cn("px-3.5 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ui font-medium text-app-fg">Design color mode</p>
          {!compact ? (
            <p className="text-ui text-app-subtle">
              Preview light/dark tokens from your linked CSS. Pasteboard grey follows the app theme.
            </p>
          ) : null}
        </div>
        <CanvasColorModeToggle compact className="shrink-0" />
      </div>
    </div>
  );
}
