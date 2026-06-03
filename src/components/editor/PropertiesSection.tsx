"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PropertiesSection({
  title,
  children,
  className,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** When false, section starts collapsed. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("border-b border-app-border-subtle", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-2 py-2 text-left text-[11px] font-semibold text-app-fg transition-colors hover:bg-app-hover"
      >
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 text-app-subtle transition-transform", open && "rotate-90")}
          strokeWidth={2}
        />
        {title}
      </button>
      {open && <div className="space-y-1.5 px-2 pb-2 pt-0.5">{children}</div>}
    </section>
  );
}
