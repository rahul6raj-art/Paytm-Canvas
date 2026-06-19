"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PropertiesSection({
  title,
  children,
  className,
  headerActions,
  defaultOpen: _defaultOpen,
  open: _open,
  onOpenChange: _onOpenChange,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** @deprecated Sections are always expanded. */
  defaultOpen?: boolean;
  /** @deprecated Sections are always expanded. */
  open?: boolean;
  /** @deprecated Sections are always expanded. */
  onOpenChange?: (open: boolean) => void;
  /** Icons or controls on the right side of the section header. */
  headerActions?: ReactNode;
}) {
  return (
    <section className={cn("border-b border-app-panel-edge last:border-b-0", className)}>
      <div className="flex items-center gap-0.5">
        <div className="flex min-w-0 flex-1 items-center px-3.5 py-3 text-ui font-medium text-app-fg">
          {title}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-0.5 pr-3.5">{headerActions}</div>
        ) : null}
      </div>
      <div className="space-y-4 px-3.5 pb-4 pt-2">{children}</div>
    </section>
  );
}
