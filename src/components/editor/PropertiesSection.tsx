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
    <section className={cn("border-b border-white/[0.06]", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8c8c8c] transition-colors hover:bg-white/[0.04] hover:text-[#c4c4c4]"
      >
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 text-[#6b6b6b] transition-transform", open && "rotate-90")}
          strokeWidth={2}
        />
        {title}
      </button>
      {open && <div className="space-y-1.5 px-2 pb-2 pt-0.5">{children}</div>}
    </section>
  );
}
